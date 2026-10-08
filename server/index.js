require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const axios = require('axios');
let mongoose = null;
try {
    mongoose = require('mongoose');
} catch (e) {
    console.warn('Mongoose failed to load (likely Node 24 incompatibility). MongoDB features will be disabled.');
}
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'dummy';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// Force HTTPS in production
app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
        res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
        next();
    }
});

// Rate Limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // Stricter limit for auth/orders
    message: { success: false, error: 'Too many requests, please try again later.' }
});

// Auth Middleware
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    
    // Verify token using supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    
    req.user = data.user;
    next();
};

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.warn('WARNING: MONGODB_URI is not set. Using local database for testing.');
}

if (mongoose) {
    mongoose.connect(MONGODB_URI || 'mongodb://localhost:27017/restnest')
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB connection error:', err));
}

let Order, UserProfile, BulkOrder, ContactMessage, PageTraffic;

if (mongoose) {
    // Mongoose Schema
    const orderSchema = new mongoose.Schema({
        id: { type: String, required: true, unique: true },
        user_id: { type: String, required: false },
        customer_name: String,
        email: String,
        phone: String,
        address: String,
        total_amount: Number,
        items: mongoose.Schema.Types.Mixed,
        status: String,
        shiprocket_awb: String,
        shiprocket_shipment_id: String,
        created_at: { type: Date, default: Date.now }
    });

    Order = mongoose.model('Order', orderSchema);

    const userProfileSchema = new mongoose.Schema({
        user_id: { type: String, required: true, unique: true },
        first_name: String,
        last_name: String,
        phone: String,
        addresses: [{
            address: String,
            city: String,
            state: String,
            pincode: String,
            is_default: Boolean
        }],
        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now }
    });

    UserProfile = mongoose.model('UserProfile', userProfileSchema);

    const bulkOrderSchema = new mongoose.Schema({
        id: { type: String, required: true, unique: true },
        first_name: String,
        last_name: String,
        email: String,
        phone: String,
        address: String,
        city: String,
        state: String,
        pincode: String,
        status: { type: String, default: 'Pending' },
        created_at: { type: Date, default: Date.now }
    });

    BulkOrder = mongoose.model('BulkOrder', bulkOrderSchema);

    const contactMessageSchema = new mongoose.Schema({
        id: { type: String, required: true, unique: true },
        name: String,
        email: String,
        phone: String,
        company: String,
        message: String,
        status: { type: String, default: 'Unread' },
        created_at: { type: Date, default: Date.now }
    });

    ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

    const pageTrafficSchema = new mongoose.Schema({
        page: { type: String, required: true, unique: true },
        visits: { type: Number, default: 0 }
    });

    PageTraffic = mongoose.model('PageTraffic', pageTrafficSchema);
}


// ----------------------------------------------------
// Configuration
// ----------------------------------------------------
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'dummy_key_id';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
});

let shiprocketToken = null;

// ----------------------------------------------------
// Helper: Authenticate with Shiprocket
// ----------------------------------------------------
async function getShiprocketToken() {
    if (shiprocketToken) return shiprocketToken;

    if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
        console.warn('Shiprocket credentials missing. Using mock token.');
        return 'MOCK_TOKEN';
    }

    try {
        const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
            email: process.env.SHIPROCKET_EMAIL,
            password: process.env.SHIPROCKET_PASSWORD,
        });
        shiprocketToken = response.data.token;
        return shiprocketToken;
    } catch (error) {
        console.error('Shiprocket auth failed:', error.response ? error.response.data : error.message);
        throw new Error('Failed to authenticate with Shiprocket');
    }
}

// ----------------------------------------------------
// Endpoint 1: Create Razorpay Order
// ----------------------------------------------------
// ----------------------------------------------------
// Endpoint: Public Config (Securely send Anon Keys)
// ----------------------------------------------------
app.get('/api/public-config', (req, res) => {
    res.json({
        success: true,
        SUPABASE_URL: supabaseUrl,
        SUPABASE_ANON_KEY: supabaseAnonKey,
        RAZORPAY_KEY_ID: RAZORPAY_KEY_ID
    });
});

app.get('/api/config', (req, res) => {
    res.json({ razorpayKeyId: RAZORPAY_KEY_ID });
});

// ----------------------------------------------------
// Secure Product Registry (Anti-Tampering)
// ----------------------------------------------------
const PRODUCT_REGISTRY = {
    "Glace Cotton Pillow": 899.0,
    "Contour Memory Foam Pillow": 899.0,
    "Slim Pillow": 899.0,
    "Black Latex": 899.0,
    "Rest Nest 16x16 White Stripe Soft Cushions": 899.0,
    "Rest Nest 5 Premium White Cushions": 899.0,
    "Rest Nest 16x16 White Premium Cushions": 899.0,
    "Rest Nest ContourCare Memory Foam Pillow": 899.0,
    "Rest Nest Soft Cushion Set of 5": 899.0,
    "Rest Nest White & Gold Glace Cotton Pillows": 899.0,
    "Stripe Pillow": 899.0,
    "Contour Memory Foam Pillow": 899.0,
    "Slim Pillow": 899.0,
    "Black Latex": 899.0,
    "Rest Nest ContourCare™ Memory Foam Pillow": 899.0,
    "Rest Nest White & Gold Glace Cotton Sleeping Pillows": 899.0,
    "Rest Nest Blue & White Polycotton Pillow": 899.0,
    "Rest Nest Premium Polycotton Pillow With Recron Fiber Filling": 899.0,
    "Rest Nest Soft Cushion Pack Of 2": 899.0,
    "Rest Nest Orthopedic Cervical Memory Foam Cushion": 899.0,
    "Rest Nest Slim Microfiber Cushion": 899.0,
    "Rest Nest Premium White Glace Cotton Cushions": 899.0,
    "Rest Nest ContourCare™ Memory Foam Cushion": 899.0,
    "Rest Nest White & Gold Glace Cotton Sleeping Cushions": 899.0,
    "Rest Nest Premium White Sleeping Cushion": 899.0,
    "Rest Nest Blue & White Polycotton Cushion": 899.0,
    "Rest Nest Premium Polycotton Cushion With Recron Fiber Filling": 899.0,
    "Rest Nest Premium White Sleeping Pillow": 899.0
};

function calculateCartTotal(cart) {
    let total = 0;
    if (!Array.isArray(cart)) return total;
    
    for (const item of cart) {
        // Find real price from registry, fallback to 0 if unknown product
        const realPrice = PRODUCT_REGISTRY[item.name] || 0; 
        total += (realPrice * (item.quantity || 1));
    }
    return total;
}

// ----------------------------------------------------
// Endpoint 1: Create Razorpay Order
// ----------------------------------------------------
app.post('/api/create-order', authLimiter, async (req, res) => {
    try {
        const { cart, currency = 'INR', receipt } = req.body;
        
        // Anti-tampering: Calculate total securely on server
        const realAmount = calculateCartTotal(cart);
        if (realAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid cart or empty total.' });
        }

        if (RAZORPAY_KEY_ID === 'dummy_key_id') {
            console.warn('Using dummy Razorpay keys. Returning mock order.');
            return res.json({ 
                success: true, 
                order: {
                    id: `order_mock_${Date.now()}`,
                    amount: realAmount * 100,
                    currency
                } 
            });
        }

        const options = {
            amount: realAmount * 100,
            currency,
            receipt: receipt || `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Endpoint 2: Verify Razorpay Payment Signature
// ----------------------------------------------------
app.post('/api/verify-payment', (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, is_mock } = req.body;

        if (RAZORPAY_KEY_SECRET === 'dummy_secret' || is_mock) {
            console.warn('Bypassing signature verification for mock/test flow.');
            return res.status(200).json({ success: true, message: "Mock payment verified successfully" });
        }

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            return res.status(200).json({ success: true, message: "Payment verified successfully" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid signature sent!" });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Endpoint 3: Create Shiprocket Shipment
// ----------------------------------------------------
app.post('/api/create-shipment', async (req, res) => {
    try {
        const { orderData } = req.body;

        const shiprocketOrderPayload = {
            order_id: orderData.order_id || `ORDER_${Date.now()}`,
            order_date: new Date().toISOString(),
            pickup_location: "Primary",
            billing_customer_name: orderData.name,
            billing_last_name: "",
            billing_address: orderData.address,
            billing_city: orderData.city,
            billing_pincode: orderData.pincode,
            billing_state: orderData.state,
            billing_country: "India",
            billing_email: orderData.email,
            billing_phone: orderData.phone,
            shipping_is_billing: true,
            order_items: orderData.items.map(item => ({
                name: item.name,
                sku: item.sku || "SKU-DEFAULT",
                units: item.quantity,
                selling_price: item.price,
                discount: 0,
                tax: 0,
                hsn: ""
            })),
            payment_method: "Prepaid",
            sub_total: orderData.total_amount,
            length: 10,
            breadth: 10,
            height: 10,
            weight: 1
        };

        const token = await getShiprocketToken();
        
        let responseData;
        if (token === 'MOCK_TOKEN') {
            console.warn('Simulating Shiprocket order creation.');
            responseData = {
                order_id: shiprocketOrderPayload.order_id,
                shipment_id: `SHIP_${Math.floor(Math.random() * 1000000)}`,
                status: 'NEW',
                status_code: 1,
                awb_code: `AWB${Math.floor(Math.random() * 1000000000)}`
            };
        } else {
            const response = await axios.post(
                'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
                shiprocketOrderPayload,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            responseData = response.data;
        }

        // Save order to MongoDB
        const newOrder = new Order({
            id: orderData.order_id,
            user_id: orderData.user_id || null,
            customer_name: orderData.name,
            email: orderData.email,
            phone: orderData.phone,
            address: `${orderData.address}, ${orderData.city}, ${orderData.state} - ${orderData.pincode}`,
            total_amount: orderData.total_amount,
            items: orderData.items,
            status: 'Placed',
            shiprocket_awb: responseData.awb_code || null,
            shiprocket_shipment_id: responseData.shipment_id ? String(responseData.shipment_id) : null
        });
        await newOrder.save();

        res.json({ success: true, data: responseData });
    } catch (error) {
        console.error('Error creating Shiprocket order:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: 'Failed to create shipment' });
    }
});

const PORT = process.env.PORT || 3000;

// ----------------------------------------------------
// Endpoint 4: Get All Orders (For Admin App)
// ----------------------------------------------------
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ created_at: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Endpoint: Get All Customers (For Admin App)
// ----------------------------------------------------
app.get('/api/customers', async (req, res) => {
    try {
        const customers = await UserProfile.find().sort({ created_at: -1 });
        res.json({ success: true, customers });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Endpoint: Get User Orders
// ----------------------------------------------------
app.get('/api/my-orders', authenticateUser, async (req, res) => {
    try {
        const orders = await Order.find({ user_id: req.user.id }).sort({ created_at: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Endpoint: Track Order (with Shiprocket real-time)
// ----------------------------------------------------
app.get('/api/track-order/:orderId', authenticateUser, async (req, res) => {
    try {
        const order = await Order.findOne({ 
            $or: [
                { id: req.params.orderId, user_id: req.user.id },
                { shiprocket_awb: req.params.orderId, user_id: req.user.id }
            ]
        });
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        let trackingData = null;
        
        // Attempt to get real-time tracking from Shiprocket
        if (order.shiprocket_awb && order.shiprocket_awb !== 'Pending') {
            try {
                const token = await getShiprocketToken();
                if (token !== 'MOCK_TOKEN') {
                    const trackRes = await axios.get(
                        `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${order.shiprocket_awb}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    trackingData = trackRes.data;
                    
                    // Update order status from Shiprocket if available
                    const srStatus = trackingData?.tracking_data?.shipment_status_id;
                    let newStatus = null;
                    if (srStatus >= 7) newStatus = 'Delivered';
                    else if (srStatus >= 6) newStatus = 'Out for Delivery';
                    else if (srStatus >= 4) newStatus = 'Shipped';
                    else if (srStatus >= 2) newStatus = 'Processing';
                    
                    if (newStatus && newStatus !== order.status) {
                        await Order.updateOne({ id: order.id }, { status: newStatus });
                        order.status = newStatus;
                    }
                }
            } catch (trackErr) {
                console.error('Shiprocket tracking error:', trackErr.message);
                // Continue without real-time tracking
            }
        }

        res.json({ 
            success: true, 
            order: order.toObject(),
            tracking: trackingData
        });
    } catch (error) {
        console.error('Error tracking order:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Endpoint: User Profile (Get & Update)
// ----------------------------------------------------
app.get('/api/my-profile', authenticateUser, async (req, res) => {
    try {
        let profile = await UserProfile.findOne({ user_id: req.user.id });
        if (!profile) {
            profile = new UserProfile({ user_id: req.user.id });
            await profile.save();
        }
        res.json({ success: true, profile });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post('/api/my-profile', authenticateUser, async (req, res) => {
    try {
        const { first_name, last_name, phone, addresses } = req.body;
        const profile = await UserProfile.findOneAndUpdate(
            { user_id: req.user.id },
            { 
                first_name, 
                last_name, 
                phone, 
                addresses,
                updated_at: Date.now()
            },
            { upsert: true, new: true }
        );
        res.json({ success: true, profile });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Endpoint 5: Place Order Directly (Bypass Razorpay)
// ----------------------------------------------------
app.post('/api/place-order-test', async (req, res) => {
    try {
        const { orderData } = req.body;
        
        const newOrder = new Order({
            id: orderData.id,
            user_id: orderData.user_id || null,
            customer_name: orderData.customer_name,
            email: orderData.email,
            phone: orderData.phone,
            address: orderData.address,
            total_amount: orderData.total_amount,
            items: orderData.items,
            status: 'Placed'
        });
        await newOrder.save();

        res.json({ success: true, message: 'Order placed successfully' });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Endpoint 6: Update Order Status
// ----------------------------------------------------
app.post('/api/update-order-status', async (req, res) => {
    try {
        const { id, status } = req.body;
        await Order.updateOne({ id }, { status });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Endpoint 7: Delete Order
// ----------------------------------------------------
app.delete('/api/delete-order/:id', async (req, res) => {
    try {
        await Order.deleteOne({ id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Endpoint 8: Reset Orders
// ----------------------------------------------------
app.delete('/api/reset-orders', async (req, res) => {
    try {
        await Order.deleteMany({});
        res.json({ success: true, message: 'All orders deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


// ----------------------------------------------------
// Bulk Orders Endpoints
// ----------------------------------------------------
app.post('/api/bulk-orders', async (req, res) => {
    try {
        const { first_name, last_name, email, phone, business_name, quantity } = req.body;
        const newBulkOrder = new BulkOrder({
            id: `bulk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            first_name,
            last_name,
            email,
            phone,
            business_name,
            quantity: Number(quantity)
        });
        await newBulkOrder.save();
        res.json({ success: true, bulkOrder: newBulkOrder });
    } catch (error) {
        console.error('Error creating bulk order:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.get('/api/bulk-orders', async (req, res) => {
    try {
        const bulkOrders = await BulkOrder.find().sort({ created_at: -1 });
        res.json({ success: true, bulkOrders });
    } catch (error) {
        console.error('Error fetching bulk orders:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Contact Messages Endpoints
// ----------------------------------------------------
app.post('/api/contact', async (req, res) => {
    try {
        const { name, company, email, phone, message } = req.body;
        const newContact = new ContactMessage({
            id: `contact_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name,
            company,
            email,
            phone,
            message
        });
        await newContact.save();
        res.json({ success: true, contact: newContact });
    } catch (error) {
        console.error('Error creating contact message:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.get('/api/contact', async (req, res) => {
    try {
        const contacts = await ContactMessage.find().sort({ created_at: -1 });
        res.json({ success: true, contacts });
    } catch (error) {
        console.error('Error fetching contact messages:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ----------------------------------------------------
// Page Traffic Endpoints
// ----------------------------------------------------
app.post('/api/track-page', async (req, res) => {
    try {
        const { page } = req.body;
        if (!page) return res.status(400).json({ success: false, error: 'Page name required' });
        
        await PageTraffic.findOneAndUpdate(
            { page },
            { $inc: { visits: 1 } },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking page:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.get('/api/page-traffic', async (req, res) => {
    try {
        const traffic = await PageTraffic.find();
        res.json({ success: true, traffic });
    } catch (error) {
        console.error('Error fetching traffic:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post('/api/reset-traffic', async (req, res) => {
    try {
        await PageTraffic.deleteMany({});
        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting traffic:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
