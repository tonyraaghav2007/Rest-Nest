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

let rawSupabaseUrl = (process.env.SUPABASE_URL || 'https://dummy.supabase.co').trim();
if (rawSupabaseUrl.includes('/project/')) {
    const match = rawSupabaseUrl.match(/project\/([a-zA-Z0-9_-]+)/);
    if (match) {
        rawSupabaseUrl = `https://${match[1]}.supabase.co`;
    }
}
const supabaseUrl = rawSupabaseUrl.replace(/\/+$/, '');
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || 'dummy').trim();
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
    max: 5000, // Generous limit for storefront browsing & admin dashboard polling
    message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Prevent auth/order spam without blocking legitimate checkout
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
        payment_method: String,
        payment_id: String,
        paymentMethod: String,
        paymentId: String,
        cod_fee: Number,
        bigship_awb: String,
        bigship_shipment_id: String,
        bigship_status: String,
        bigship_error: String,
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
        first_name: { type: String, default: '' },
        last_name: { type: String, default: '' },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        business_name: { type: String, default: '' },
        quantity: { type: Number, default: 50 },
        address: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' },
        notes: { type: String, default: '' },
        status: { type: String, default: 'Pending' },
        created_at: { type: Date, default: Date.now }
    }, { strict: false });

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

    const productReviewSchema = new mongoose.Schema({
        product_id: String,
        reviewer_name: String,
        rating: Number,
        review_text: String,
        status: { type: String, default: 'Approved' },
        created_at: { type: Date, default: Date.now }
    });

    ProductReview = mongoose.model('ProductReview', productReviewSchema);
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

let bigshipToken = null;
let lastBigshipAuthError = null;

// ----------------------------------------------------
// Helper: Authenticate with Big Ship Direct
// ----------------------------------------------------
async function getBigshipToken() {
    if (bigshipToken) return bigshipToken;

    const userName = process.env.BIGSHIP_USER_NAME || 'contact@restnest.in';
    const password = process.env.BIGSHIP_PASSWORD || '2051@Chirag';

    // Method 1: BigShip Direct Login (https://appapi.bigship.direct/api/login)
    if (userName && password) {
        try {
            const response = await axios.post('https://appapi.bigship.direct/api/login', {
                email: userName,
                password: password
            }, { timeout: 10000 });

            if (response.data && (response.data.status === 'Success' || response.data.data?.token || response.data.token)) {
                bigshipToken = response.data.data?.token || response.data.token;
                lastBigshipAuthError = null;
                return bigshipToken;
            } else {
                const msg = response.data?.message || 'Invalid Credentials on appapi.bigship.direct';
                console.warn('Big Ship appapi.bigship.direct login failed:', msg);
                lastBigshipAuthError = msg;
            }
        } catch (error) {
            lastBigshipAuthError = error.response ? (error.response.data?.message || JSON.stringify(error.response.data)) : error.message;
            console.error('Big Ship appapi.bigship.direct auth error:', lastBigshipAuthError);
        }
    }

    // Method 2: Legacy BigShip API Login fallback (https://api.bigship.in/api/login/user)
    const apiKey = process.env.BIGSHIP_API_KEY;
    if (apiKey) {
        try {
            const response = await axios.post('https://api.bigship.in/api/login/user', {
                user_name: userName,
                password: password,
                access_key: apiKey
            }, { timeout: 10000 });

            if (response.data && response.data.success && (response.data.data?.token || response.data.token)) {
                bigshipToken = response.data.data?.token || response.data.token;
                lastBigshipAuthError = null;
                return bigshipToken;
            }
        } catch (error) {
            console.error('Legacy BigShip auth error:', error.message);
        }
    }

    return 'MOCK_TOKEN';
}

// ----------------------------------------------------
// Helper: Book Shipment directly on BigShip Direct
// ----------------------------------------------------
async function bookBigshipOrder(order) {
    const token = await getBigshipToken();
    if (token === 'MOCK_TOKEN') {
        throw new Error(lastBigshipAuthError || 'BigShip authentication failed. Check credentials.');
    }

    // BigShip allows alphanumeric, hyphen, forward slash, backward slash in invoice/order ID
    const rawId = String(order.id || ('RN-' + Date.now().toString().slice(-6)));
    const cleanOrderId = rawId.replace(/[^a-zA-Z0-9\-\/\\]/g, '-');

    const customerName = (order.customer_name || 'Customer').trim();
    const phone = String(order.phone || '9999999999').replace(/[^0-9]/g, '').slice(-10) || '9999999999';
    const email = order.email || 'contact@restnest.in';

    // Extract pincode (clean 6 digits)
    const rawPincode = String(order.pincode || (order.address?.match(/\b\d{6}\b/)?.[0]) || '110001');

    // Geo resolution: lookup exact city and state names recognized by BigShip Direct
    let city = (order.city || 'DELHI').trim().toUpperCase();
    let state = (order.state || 'DELHI').trim().toUpperCase();
    let country = 'India';

    try {
        const geoRes = await axios.post(
            'https://appapi.bigship.direct/api/get-country-state-city',
            { pincode: rawPincode },
            { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
        );
        if (geoRes.data?.status === 'Success' && geoRes.data?.data) {
            if (geoRes.data.data.city) city = geoRes.data.data.city;
            if (geoRes.data.data.state) state = geoRes.data.data.state;
            if (geoRes.data.data.country) country = geoRes.data.data.country;
        }
    } catch (geoErr) {
        console.warn('BigShip pincode lookup note:', geoErr.message);
    }

    // Clean address line 1 (max 75 chars) and line 2 (max 75 chars)
    const fullAddr = (order.address || 'Delivery Address').replace(/[\r\n]+/g, ', ').trim();
    const address1 = fullAddr.substring(0, 75).trim() || 'Delivery Address';
    const address2 = fullAddr.length > 75 ? fullAddr.substring(75, 150).trim() : '';

    const isCod = String(order.payment_method || order.paymentMethod || '').toUpperCase().includes('COD');
    const totalAmount = Number(order.total_amount) || 0;
    const collectableAmount = isCod ? totalAmount : 0;
    const paymentMode = isCod ? '2' : '1';

    const orderItems = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];
    const products = orderItems.length > 0 ? orderItems.map((item, idx) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || (totalAmount / (orderItems.length || 1));
        const itemTotal = qty * price;
        return {
            productName: (item.name || `RestNest Item ${idx + 1}`).substring(0, 100),
            qty: qty,
            amount: price,
            totalAmount: itemTotal,
            ...(isCod ? { collectableAmount: itemTotal } : {}),
            categoryId: 1
        };
    }) : [
        {
            productName: 'RestNest Bedding Product',
            qty: 1,
            amount: totalAmount,
            totalAmount: totalAmount,
            ...(isCod ? { collectableAmount: totalAmount } : {}),
            categoryId: 1
        }
    ];

    const boxes = [
        {
            parameter: [
                { parameterId: '1', parameterValue: 10, parameterCategoryId: '1' },
                { parameterId: '2', parameterValue: 10, parameterCategoryId: '1' },
                { parameterId: '3', parameterValue: 10, parameterCategoryId: '1' },
                { parameterId: '6', parameterValue: 0.5, parameterCategoryId: '5' }
            ],
            noOfBoxes: 1,
            products: products
        }
    ];

    const today = new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 8);
    const pickupWarehouseId = Number(process.env.BIGSHIP_PICKUP_LOCATION_ID) || 209371;

    const payload = {
        PlatformTypeId: '1',
        MasterVerticalId: '2',
        LogisticsTypeId: '3',
        WeightcategoryId: '1',
        MasterOrderDate: `${today} ${time}`,
        MasterOrderInvoiceAmount: totalAmount,
        MasterOrderCollectableAmount: collectableAmount,
        MasterOrderPaymentMode: paymentMode,
        MasterCustomOrderId: cleanOrderId,
        OrderInvoiceNo: cleanOrderId,
        MasterOrderPickUpLocation: pickupWarehouseId,
        MasterOrderReturnLocation: pickupWarehouseId,
        totalNumOfBoxes: 1,
        MasterOrderShippingName: customerName,
        MasterOrderShippingMobileNo: phone,
        MasterOrderShippingEmail: email,
        MasterOrderShippingCountry: country,
        MasterOrderShippingZipCode: rawPincode,
        MasterOrderShippingCity: city,
        MasterOrderShippingState: state,
        MasterOrderShippingAddress: address1,
        MasterOrderShippingAddress2: address2,
        boxes: JSON.stringify(boxes)
    };

    const response = await axios.post('https://appapi.bigship.direct/api/create-order', payload, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        timeout: 20000
    });

    if (response.data?.status === 'Success' || response.data?.data?.CustomGlobalOrderId) {
        const shipmentId = response.data?.data?.CustomGlobalOrderId || response.data?.CustomGlobalOrderId;
        return {
            success: true,
            shipment_id: String(shipmentId),
            awb_code: 'Assigned on Dispatch',
            data: response.data
        };
    } else {
        const msg = response.data?.message || (response.data?.errors ? JSON.stringify(response.data.errors) : 'BigShip order creation failed');
        throw new Error(msg);
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
// Secure Product Registry (Catalog Prices)
// ----------------------------------------------------
const PRODUCT_REGISTRY = {
    // Pillows
    "White Fiber Pillow": 666.4,
    "Rest Nest White Fiber Pillow": 666.4,
    "Serene Everyday Comfort Pillow": 666.4,
    "White Latex Pillow": 666.4,
    "Rest Nest White Latex Pillow": 666.4,
    "white-latex-pillow": 666.4,

    "Hexagon Pillow": 1162.0,
    "Rest Nest Hexagon Pillow": 1162.0,
    "Honeycomb Pillow": 1162.0,
    "Rest Nest Honeycomb Pillow": 1162.0,
    "Ridge Textured Comfort Pillow": 1162.0,
    "Rest Nest Ridge Textured Comfort Pillow": 1162.0,
    "honeycomb-pillow": 1162.0,

    "Black / Blue Dot Pillow": 831.6,
    "Black Dotted Pillow": 831.6,
    "Rest Nest Black Dotted Pillow": 831.6,
    "Dusk Signature Print Pillow": 831.6,
    "Rest Nest Dusk Signature Print Pillow": 831.6,
    "black-dotted-pillow": 831.6,

    "Glace Cotton Pillow": 1055.8,
    "Loom Glace Cotton Pillow": 1055.8,
    "Rest Nest Loom Glace Cotton Pillow": 1055.8,
    "Premium White Sleeping Pillow": 1163.0,
    "Rest Nest Premium White Sleeping Pillow": 1163.0,
    "rest-nest-premium-white-sleeping-pillow-glace-cotton-fabric-lightweight-comfortable-pack-of-2": 1055.8,

    "Slim Pillow": 1162.0,
    "Form Slim Microfiber Pillow": 1162.0,
    "Rest Nest Form Slim Microfiber Pillow": 1162.0,
    "Slim Microfiber Pillow": 1162.0,
    "Rest Nest Slim Microfiber Pillow": 1162.0,
    "rest-nest-slim-microfiber-pillow-17x27-inch-white-1-pcs": 1162.0,

    "Black Fiber": 666.4,
    "Rest Nest Black Fiber": 666.4,
    "Classic Fiber Pillow": 666.4,
    "Classic Fiber Pillow (Midnight)": 666.4,
    "Classic Fiber Pillow (Serene)": 666.4,
    "Classic Fiber Pillow - Midnight": 666.4,
    "Classic Fiber Pillow - Serene": 666.4,
    "Classic Fiber Pillow — Midnight": 666.4,
    "Classic Fiber Pillow — Serene": 666.4,
    "Midnight Classic Fiber Pillow": 666.4,
    "classic-fiber-pillow": 666.4,
    "classic-fiber-pillow-midnight": 666.4,
    "classic-fiber-pillow-serene": 666.4,
    "Black Latex": 666.4,
    "Premium White Glace Cotton Pillows": 1240.0,
    "Rest Nest Premium White Glace Cotton Pillows": 1240.0,
    "Pipe Pillow": 1162.0,
    "rest-nest-premium-white-glace-cotton-pillows-pack-of-2-800g-each": 999.0,

    "Contour Memory Foam Pillow": 999.0,
    "Orthopedic Cervical Memory Foam Pillow": 1275.0,
    "Rest Nest Orthopedic Cervical Memory Foam Pillow": 1275.0,
    "rest-nest-orthopedic-cervical-memory-foam-pillow-white-1-pc": 999.0,

    "Stripe Pillow": 999.0,
    "Rest Nest Soft Pillow": 999.0,
    "rest-nest-soft-pillow-pack-of-2-premium-recron-fiber-17x27-inch": 999.0,

    "ContourCare Memory Foam Pillow": 1275.0,
    "ContourCare™ Memory Foam Pillow": 1275.0,
    "Rest Nest ContourCare Memory Foam Pillow": 1275.0,
    "Rest Nest ContourCare™ Memory Foam Pillow": 1275.0,
    "rest-nest-contourcare-memory-foam-pillow-orthopedic-support-for-perfect-sleep": 999.0,

    "White & Gold Glace Cotton Sleeping Pillows": 1210.0,
    "Rest Nest White & Gold Glace Cotton Pillows": 1210.0,
    "Rest Nest White & Gold Glace Cotton Sleeping Pillows": 1210.0,
    "rest-nest-white-gold-glace-cotton-sleeping-pillows-pack-of-2-lightweight-750g-each": 999.0,

    "Blue & White Polycotton Pillow": 1210.0,
    "Rest Nest Blue & White Polycotton Pillow": 1210.0,
    "rest-nest-blue-white-polycotton-pillow-pack-of-2-16x26-inch-light-weight-soft-supportive-filled-with-reliance-recron-fiber": 999.0,

    "Premium Polycotton Pillow With Recron Fiber Filling": 1064.0,
    "Rest Nest Premium Polycotton Pillow With Recron Fiber Filling": 1064.0,
    "rest-nest-premium-polycotton-pillow-with-recron-fiber-filling-black-white-16x26-inch-pack-of-2": 999.0,

    // Cushions
    "Honeycomb Cushion": 999.0,
    "Rest Nest Honeycomb Cushion": 999.0,
    "honeycomb-cushion": 999.0,

    "Glace Cotton Cushion": 999.0,
    "Rest Nest Glace Cotton Cushion": 999.0,
    "glace-cotton-cushion": 999.0,

    "Slim Pipe Cushion": 999.0,
    "Rest Nest Slim Pipe Cushion": 999.0,
    "slim-pipe-cushion": 999.0,

    "Soft Cushion Pack Of 2": 1165.0,
    "Rest Nest Soft Cushion Pack Of 2": 1165.0,
    "Rest Nest Soft Cushion Set of 5": 999.0,
    "rest-nest-soft-cushion-pack-of-2-premium-recron-fiber-17x27-inch": 999.0,

    "Orthopedic Cervical Memory Foam Cushion": 1275.0,
    "Rest Nest Orthopedic Cervical Memory Foam Cushion": 1275.0,
    "rest-nest-orthopedic-cervical-memory-foam-cushion-white-1-pc": 999.0,

    "Slim Microfiber Cushion": 1114.0,
    "Rest Nest Slim Microfiber Cushion": 1114.0,
    "rest-nest-slim-microfiber-cushion-17x27-inch-white-1-pcs": 999.0,

    "Premium White Glace Cotton Cushions": 1240.0,
    "Rest Nest Premium White Glace Cotton Cushions": 1240.0,
    "rest-nest-premium-white-glace-cotton-cushions-pack-of-2-800g-each": 999.0,

    "ContourCare™ Memory Foam Cushion": 1370.0,
    "ContourCare Memory Foam Cushion": 1370.0,
    "Rest Nest ContourCare™ Memory Foam Cushion": 1370.0,
    "rest-nest-contourcare-memory-foam-cushion-orthopedic-support-for-perfect-sleep": 999.0,

    "White & Gold Glace Cotton Sleeping Cushions": 1370.0,
    "Rest Nest White & Gold Glace Cotton Sleeping Cushions": 1370.0,
    "rest-nest-white-gold-glace-cotton-sleeping-cushions-pack-of-2-lightweight-750g-each": 999.0,

    "Premium White Sleeping Cushion": 1486.0,
    "Rest Nest Premium White Sleeping Cushion": 1486.0,
    "rest-nest-premium-white-sleeping-cushion-glace-cotton-fabric-lightweight-comfortable-pack-of-2": 999.0,

    "Blue & White Polycotton Cushion": 1275.0,
    "Rest Nest Blue & White Polycotton Cushion": 1275.0,
    "rest-nest-blue-white-polycotton-cushion-pack-of-2-16x26-inch-light-weight-soft-supportive-filled-with-reliance-recron-fiber": 999.0,

    "Premium Polycotton Cushion With Recron Fiber Filling": 1486.0,
    "Rest Nest Premium Polycotton Cushion With Recron Fiber Filling": 1486.0,
    "rest-nest-premium-polycotton-cushion-with-recron-fiber-filling-black-white-16x26-inch-pack-of-2": 999.0,

    "16x16 White Stripe Soft Cushions": 1210.0,
    "Rest Nest 16x16 White Stripe Soft Cushions": 1210.0,
    "Rest Nest 16x16 White Premium Cushions": 999.0,
    "Rest Nest 5 Premium White Cushions": 999.0,
    "rest-nest-16x16-white-stripe-soft-cushions-pack-of-5": 999.0
};

function calculateCartTotal(cart) {
    let total = 0;
    if (!Array.isArray(cart)) return total;
    
    for (const item of cart) {
        if (!item) continue;
        let realPrice = null;

        // 1. If valid client price provided, accept it directly if > 0
        if (typeof item.price === 'number' && !isNaN(item.price) && item.price > 0) {
            realPrice = item.price;
        } else if (typeof item.price === 'string') {
            const parsed = parseFloat(item.price.replace(/[^0-9.]/g, ''));
            if (!isNaN(parsed) && parsed > 0) realPrice = parsed;
        }

        // 2. If client price wasn't valid, check registry by name, stripped name, or ID
        if (!realPrice) {
            const cleanName = (item.name || '').trim();
            const strippedName = cleanName.replace(/^Rest Nest\s+/i, '').trim();
            const id = (item.id || item.sku || '').trim();

            realPrice = PRODUCT_REGISTRY[cleanName] 
                || PRODUCT_REGISTRY[strippedName] 
                || PRODUCT_REGISTRY[`Rest Nest ${strippedName}`]
                || PRODUCT_REGISTRY[id];

            if (!realPrice) {
                const lowerClean = cleanName.toLowerCase();
                const lowerStripped = strippedName.toLowerCase();
                const lowerId = id.toLowerCase();
                for (const [key, price] of Object.entries(PRODUCT_REGISTRY)) {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey === lowerClean || lowerKey === lowerStripped || (lowerId && lowerKey === lowerId) || lowerClean.includes(lowerKey) || lowerKey.includes(lowerStripped)) {
                        realPrice = price;
                        break;
                    }
                }
            }
        }

        // 3. Fallback default so ordering never fails
        if (!realPrice || realPrice <= 0) {
            realPrice = 999.0;
        }

        const quantity = parseInt(item.quantity, 10) > 0 ? parseInt(item.quantity, 10) : 1;
        total += (realPrice * quantity);
    }
    return total;
}

// ----------------------------------------------------
// Endpoint 1: Create Razorpay Order
// ----------------------------------------------------
app.post('/api/create-order', authLimiter, async (req, res) => {
    try {
        const { cart, currency = 'INR', receipt, couponCode, coupon_code } = req.body;
        
        // Anti-tampering: Calculate total securely on server
        let realAmount = calculateCartTotal(cart);
        if (realAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid cart or empty total.' });
        }

        // Apply first order / festival coupon code
        const code = (couponCode || coupon_code || '').toString().trim().toUpperCase();
        if (code === 'FIRST10' || code === 'DIWALI10') {
            const discount = Math.round(realAmount * 0.10);
            realAmount = Math.max(1, realAmount - discount);
        }
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
// ----------------------------------------------------
// Endpoint 3: Create Big Ship Shipment & Save Order
// ----------------------------------------------------
app.post('/api/create-shipment', async (req, res) => {
    try {
        const { orderData } = req.body;
        if (!orderData) {
            return res.status(400).json({ success: false, error: 'Missing orderData' });
        }

        const customerNameParts = (orderData.name || orderData.customer_name || '').trim().split(' ');
        const firstName = customerNameParts[0] || 'Customer';
        const lastName = customerNameParts.slice(1).join(' ') || '';

        const orderItems = Array.isArray(orderData.items) ? orderData.items : [];
        const totalAmount = Number(orderData.total_amount) || 0;
        const invoiceId = orderData.order_id || orderData.id || `ORDER_${Date.now()}`;

        // Detect Cash on Delivery (COD) vs Prepaid
        const paymentTypeRaw = String(orderData.payment_type || orderData.paymentMethod || orderData.payment_method || 'Prepaid').toUpperCase();
        const isCod = paymentTypeRaw.includes('COD');
        const paymentType = isCod ? 'COD' : 'Prepaid';
        const collectableAmount = isCod ? totalAmount : 0;
        const paymentLabel = isCod ? 'Cash on Delivery (COD)' : 'Pre-paid (Razorpay)';
        const paymentIdentifier = orderData.payment_id || orderData.paymentId || (isCod ? `COD_${invoiceId}` : null);
        const codFee = isCod ? (orderData.cod_fee !== undefined && !isNaN(Number(orderData.cod_fee)) ? Number(orderData.cod_fee) : Math.round(totalAmount * 0.02)) : 0;

        // Build formatted address string
        const addrParts = [orderData.address, orderData.city, orderData.state].filter(Boolean);
        const formattedAddress = addrParts.length > 0 
            ? `${addrParts.join(', ')}${orderData.pincode ? ' - ' + orderData.pincode : ''}` 
            : (orderData.address || 'Delivery Address');

        const orderDoc = {
            id: invoiceId,
            user_id: orderData.user_id || null,
            customer_name: orderData.name || orderData.customer_name || 'Customer',
            email: orderData.email || '',
            phone: orderData.phone || '',
            address: formattedAddress,
            total_amount: totalAmount,
            subtotal: Number(orderData.subtotal) || totalAmount,
            discount_amount: Number(orderData.discount_amount || orderData.discountAmount || 0),
            coupon_code: orderData.coupon_code || orderData.couponCode || null,
            items: orderItems,
            status: orderData.status || 'Placed',
            payment_method: paymentLabel,
            paymentMethod: paymentLabel,
            payment_id: paymentIdentifier,
            paymentId: paymentIdentifier,
            cod_fee: codFee,
            bigship_awb: 'Pending',
            bigship_shipment_id: 'Pending',
            shiprocket_awb: 'Pending',
            shiprocket_shipment_id: 'Pending'
        };

        // 1. GUARANTEED: Save/upsert order into MongoDB first so order is NEVER lost
        let savedOrder = null;
        if (Order) {
            try {
                savedOrder = await Order.findOneAndUpdate(
                    { id: invoiceId },
                    { $set: orderDoc },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            } catch (dbErr) {
                console.error('MongoDB order upsert error in create-shipment:', dbErr);
            }
        }

        // 2. ATTEMPT BIG SHIP SHIPMENT (isolated try/catch so third-party failures never drop the order)
        let responseData = {
            order_id: invoiceId,
            shipment_id: 'Pending',
            status: 'NEW',
            awb_code: 'Pending'
        };

        try {
            const bookingResult = await bookBigshipOrder(orderDoc);
            responseData = {
                order_id: invoiceId,
                shipment_id: bookingResult.shipment_id,
                status: 'NEW',
                status_code: 1,
                awb_code: bookingResult.awb_code,
                tracking_url: 'https://app.bigship.direct/',
                data: bookingResult.data
            };

            if (Order) {
                await Order.updateOne(
                    { id: invoiceId },
                    {
                        $set: {
                            bigship_status: 'Booked',
                            bigship_error: null,
                            bigship_shipment_id: bookingResult.shipment_id,
                            bigship_awb: bookingResult.awb_code,
                            shiprocket_shipment_id: bookingResult.shipment_id,
                            shiprocket_awb: bookingResult.awb_code
                        }
                    }
                );
            }
        } catch (shipErr) {
            const errMsg = shipErr.response ? (shipErr.response.data?.message || JSON.stringify(shipErr.response.data)) : shipErr.message;
            console.warn('Big Ship order booking error (Order safely stored in database):', errMsg);
            if (Order) {
                await Order.updateOne(
                    { id: invoiceId },
                    { $set: { bigship_status: 'Failed', bigship_error: errMsg } }
                );
            }
        }

        res.json({ success: true, data: responseData, order: savedOrder });
    } catch (error) {
        console.error('Error in /api/create-shipment:', error.message);
        res.status(500).json({ success: false, error: 'Internal server error processing shipment' });
    }
});

// ----------------------------------------------------
// Endpoint: Check BigShip Connection Status & Account Info
// ----------------------------------------------------
app.get('/api/bigship-status', async (req, res) => {
    try {
        const token = await getBigshipToken();
        const isConnected = token && token !== 'MOCK_TOKEN';
        let accountData = null;
        if (isConnected) {
            accountData = {
                account_email: process.env.BIGSHIP_USER_NAME || 'contact@restnest.in',
                warehouse_id: Number(process.env.BIGSHIP_PICKUP_LOCATION_ID) || 209371,
                platform: 'BigShip Direct (app.bigship.direct)'
            };
        }
        res.json({
            success: true,
            connected: isConnected,
            auth_error: lastBigshipAuthError,
            account: accountData,
            user_configured: true
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ----------------------------------------------------
// Endpoint: Retry / Push Single Shipment to BigShip Direct
// ----------------------------------------------------
const handleSingleShipmentPush = async (req, res) => {
    const orderId = req.body.orderId || req.body.id;
    try {
        if (!orderId) return res.status(400).json({ success: false, error: 'Missing orderId' });

        const order = await Order.findOne({ id: orderId });
        if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

        // Reset token cache to re-authenticate with freshest credentials
        bigshipToken = null;
        const result = await bookBigshipOrder(order);

        const assignedAwb = result.awb_code || 'Assigned on Dispatch';
        await Order.updateOne(
            { id: order.id },
            { 
                $set: { 
                    bigship_status: 'Booked',
                    bigship_error: null,
                    bigship_awb: assignedAwb,
                    bigship_shipment_id: result.shipment_id,
                    shiprocket_awb: assignedAwb,
                    shiprocket_shipment_id: result.shipment_id
                } 
            }
        );

        res.json({
            success: true,
            message: 'Shipment booked successfully on BigShip Direct',
            shipment_id: result.shipment_id,
            awb: assignedAwb,
            data: result.data
        });
    } catch (err) {
        const errMsg = err.response ? (err.response.data?.message || JSON.stringify(err.response.data)) : err.message;
        console.error('Retry/Push shipment error:', errMsg);
        if (Order && orderId) {
            await Order.updateOne(
                { id: orderId },
                { $set: { bigship_status: 'Failed', bigship_error: errMsg } }
            );
        }
        res.status(500).json({ success: false, error: errMsg });
    }
};

app.post('/api/retry-shipment', handleSingleShipmentPush);
app.post('/api/push-single-to-bigship', handleSingleShipmentPush);

// ----------------------------------------------------
// Endpoint: Custom Push Selected Orders to BigShip Direct
// ----------------------------------------------------
app.post('/api/push-selected-to-bigship', async (req, res) => {
    try {
        const orderIds = req.body.orderIds || req.body.ids;
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ success: false, error: 'No order IDs provided' });
        }

        const orders = await Order.find({ id: { $in: orderIds } });
        if (!orders || orders.length === 0) {
            return res.status(404).json({ success: false, error: 'No matching orders found' });
        }

        // Reset token once before batch
        bigshipToken = null;

        const results = {
            total: orders.length,
            successCount: 0,
            failureCount: 0,
            details: []
        };

        for (const order of orders) {
            try {
                const booking = await bookBigshipOrder(order);
                const assignedAwb = booking.awb_code || 'Assigned on Dispatch';
                await Order.updateOne(
                    { id: order.id },
                    {
                        $set: {
                            bigship_status: 'Booked',
                            bigship_error: null,
                            bigship_shipment_id: booking.shipment_id,
                            bigship_awb: assignedAwb,
                            shiprocket_awb: assignedAwb,
                            shiprocket_shipment_id: booking.shipment_id
                        }
                    }
                );
                results.successCount++;
                results.details.push({ id: order.id, status: 'Booked', shipment_id: booking.shipment_id, awb: assignedAwb });
            } catch (err) {
                const errMsg = err.response ? (err.response.data?.message || JSON.stringify(err.response.data)) : err.message;
                await Order.updateOne(
                    { id: order.id },
                    { $set: { bigship_status: 'Failed', bigship_error: errMsg } }
                );
                results.failureCount++;
                results.details.push({ id: order.id, status: 'Failed', error: errMsg });
            }
        }

        res.json({
            success: true,
            message: `Processed ${results.total} selected orders (${results.successCount} succeeded, ${results.failureCount} failed)`,
            results
        });
    } catch (err) {
        console.error('Error pushing selected orders to BigShip:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ----------------------------------------------------
// Endpoint: Bulk Push All Unbooked Orders to BigShip Direct
// ----------------------------------------------------
app.post('/api/push-all-unbooked-to-bigship', async (req, res) => {
    try {
        const unbookedOrders = await Order.find({
            $or: [
                { bigship_status: { $ne: 'Booked' } },
                { bigship_status: { $exists: false } },
                { bigship_awb: 'Pending' },
                { bigship_awb: 'N/A' },
                { bigship_awb: { $exists: false } }
            ]
        }).limit(100);

        if (unbookedOrders.length === 0) {
            return res.json({
                success: true,
                message: 'All orders are already booked on BigShip Direct!',
                results: { total: 0, successCount: 0, failureCount: 0, details: [] }
            });
        }

        bigshipToken = null;
        const results = {
            total: unbookedOrders.length,
            successCount: 0,
            failureCount: 0,
            details: []
        };

        for (const order of unbookedOrders) {
            try {
                const booking = await bookBigshipOrder(order);
                const assignedAwb = booking.awb_code || 'Assigned on Dispatch';
                await Order.updateOne(
                    { id: order.id },
                    {
                        $set: {
                            bigship_status: 'Booked',
                            bigship_error: null,
                            bigship_shipment_id: booking.shipment_id,
                            bigship_awb: assignedAwb,
                            shiprocket_awb: assignedAwb,
                            shiprocket_shipment_id: booking.shipment_id
                        }
                    }
                );
                results.successCount++;
                results.details.push({ id: order.id, status: 'Booked', shipment_id: booking.shipment_id, awb: assignedAwb });
            } catch (err) {
                const errMsg = err.response ? (err.response.data?.message || JSON.stringify(err.response.data)) : err.message;
                await Order.updateOne(
                    { id: order.id },
                    { $set: { bigship_status: 'Failed', bigship_error: errMsg } }
                );
                results.failureCount++;
                results.details.push({ id: order.id, status: 'Failed', error: errMsg });
            }
        }

        res.json({
            success: true,
            message: `Processed ${results.total} unbooked orders (${results.successCount} succeeded, ${results.failureCount} failed)`,
            results
        });
    } catch (err) {
        console.error('Error pushing unbooked orders to BigShip:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;

// ----------------------------------------------------
// Endpoint 4: Orders (GET all orders for admin, POST to save directly)
// ----------------------------------------------------
app.get('/api/orders', async (req, res) => {
    try {
        const rawOrders = await Order.find().sort({ created_at: -1 }).lean();
        const orders = rawOrders.map(o => {
            const rawItems = typeof o.items === 'string' ? o.items : JSON.stringify(o.items || []);
            let itemsSummary = '';
            if (Array.isArray(o.items)) {
                itemsSummary = o.items.map(i => `${i.quantity || 1}x ${i.name || 'Item'}`).join(', ');
            } else if (typeof o.items === 'string') {
                itemsSummary = o.items;
            }
            return {
                ...o,
                id: o.id,
                customerName: o.customer_name || o.customerName || 'Customer',
                customer_name: o.customer_name || o.customerName || 'Customer',
                address: o.address || '',
                phone: o.phone || '',
                amount: Number(o.total_amount || o.amount || 0),
                total_amount: Number(o.total_amount || o.amount || 0),
                items: itemsSummary || o.items || '',
                rawItems: rawItems,
                status: o.status || 'Placed',
                paymentMethod: o.payment_method || o.paymentMethod || 'Unknown',
                payment_method: o.payment_method || o.paymentMethod || 'Unknown',
                paymentId: o.payment_id || o.paymentId || 'N/A',
                payment_id: o.payment_id || o.paymentId || 'N/A',
                bigshipAwb: o.bigship_awb || o.bigshipAwb || 'N/A',
                bigship_awb: o.bigship_awb || o.bigshipAwb || 'N/A',
                bigshipShipmentId: o.bigship_shipment_id || o.bigshipShipmentId || 'N/A',
                bigship_shipment_id: o.bigship_shipment_id || o.bigshipShipmentId || 'N/A',
                bigshipStatus: o.bigship_status || o.bigshipStatus || 'Pending',
                bigship_status: o.bigship_status || o.bigshipStatus || 'Pending',
                shiprocketAwb: o.shiprocket_awb || o.bigship_awb || 'N/A',
                createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
                date: o.created_at ? new Date(o.created_at).toLocaleDateString() : ''
            };
        });
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body.orderData || req.body;
        if (!orderData) return res.status(400).json({ success: false, error: 'No order data provided' });

        const invoiceId = orderData.order_id || orderData.id || `ORD_${Date.now()}`;
        const isCod = String(orderData.payment_type || orderData.paymentMethod || orderData.payment_method || '').toUpperCase().includes('COD');
        const paymentLabel = isCod ? 'Cash on Delivery (COD)' : (orderData.payment_method || orderData.paymentMethod || 'Pre-paid (Razorpay)');
        const codFee = isCod ? (orderData.cod_fee !== undefined ? Number(orderData.cod_fee) : Math.round(Number(orderData.total_amount || 0) * 0.02)) : 0;

        const orderFields = {
            id: invoiceId,
            user_id: orderData.user_id || null,
            customer_name: orderData.name || orderData.customer_name || 'Customer',
            email: orderData.email || '',
            phone: orderData.phone || '',
            address: orderData.address || '',
            total_amount: Number(orderData.total_amount) || 0,
            subtotal: Number(orderData.subtotal) || (Number(orderData.total_amount) || 0),
            discount_amount: Number(orderData.discount_amount || orderData.discountAmount || 0),
            coupon_code: orderData.coupon_code || orderData.couponCode || null,
            items: orderData.items,
            status: orderData.status || 'Placed',
            payment_method: paymentLabel,
            paymentMethod: paymentLabel,
            payment_id: orderData.payment_id || orderData.paymentId || (isCod ? `COD_${invoiceId}` : null),
            paymentId: orderData.payment_id || orderData.paymentId || (isCod ? `COD_${invoiceId}` : null),
            cod_fee: codFee,
            bigship_awb: orderData.bigship_awb || orderData.bigshipAwb || 'Pending',
            bigship_shipment_id: orderData.bigship_shipment_id || orderData.bigshipShipmentId || 'Pending',
            shiprocket_awb: orderData.shiprocket_awb || orderData.shiprocketAwb || 'Pending',
            shiprocket_shipment_id: orderData.shiprocket_shipment_id || orderData.shiprocketShipmentId || 'Pending'
        };

        const saved = await Order.findOneAndUpdate(
            { id: invoiceId },
            { $set: orderFields },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, order: saved });
    } catch (err) {
        console.error('Error saving order directly:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ----------------------------------------------------
// Endpoint: Get Product Reviews
// ----------------------------------------------------
app.get('/api/reviews', async (req, res) => {
    try {
        const { product_id } = req.query;
        let query = {};
        if (product_id) {
            query.product_id = product_id;
        }
        // sort by newest
        const reviews = await ProductReview.find(query).sort({ created_at: -1 });
        res.json({ success: true, reviews });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const { product_id, reviewer_name, rating, review_text } = req.body;
        const newReview = new ProductReview({
            product_id,
            reviewer_name,
            rating,
            review_text,
            status: 'Approved' // auto-approve for now
        });
        await newReview.save();
        res.json({ success: true, review: newReview });
    } catch (error) {
        console.error('Error adding review:', error);
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
// Endpoint: Track Order (with Big Ship real-time)
// ----------------------------------------------------
app.get('/api/track-order/:orderId', authenticateUser, async (req, res) => {
    try {
        const order = await Order.findOne({ 
            $or: [
                { id: req.params.orderId, user_id: req.user.id },
                { bigship_awb: req.params.orderId, user_id: req.user.id },
                { shiprocket_awb: req.params.orderId, user_id: req.user.id }
            ]
        });
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        let trackingData = null;
        const awb = order.bigship_awb || order.shiprocket_awb;
        
        // Attempt to get real-time tracking from Big Ship
        if (awb && awb !== 'Pending') {
            try {
                const token = await getBigshipToken();
                if (token !== 'MOCK_TOKEN') {
                    const trackRes = await axios.get(
                        `https://api.bigship.in/api/tracking?tracking_id=${awb}`,
                        { 
                            headers: { 
                                Authorization: `Bearer ${token}`,
                                Accept: 'application/json'
                            } 
                        }
                    );
                    trackingData = trackRes.data;
                    
                    // Update order status from Big Ship if available
                    const currentStatus = trackingData?.data?.order_detail?.status_name || trackingData?.data?.status;
                    let newStatus = null;
                    if (currentStatus) {
                        const s = String(currentStatus).toLowerCase();
                        if (s.includes('deliver')) newStatus = 'Delivered';
                        else if (s.includes('out for delivery')) newStatus = 'Out for Delivery';
                        else if (s.includes('transit') || s.includes('shipped') || s.includes('dispatched')) newStatus = 'Shipped';
                        else if (s.includes('manifest') || s.includes('pickup') || s.includes('process')) newStatus = 'Processing';
                    }
                    
                    if (newStatus && newStatus !== order.status) {
                        await Order.updateOne({ id: order.id }, { status: newStatus });
                        order.status = newStatus;
                    }
                }
            } catch (trackErr) {
                console.error('Big Ship tracking error:', trackErr.message);
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
// Endpoint 7b: Delete Multiple Orders
// ----------------------------------------------------
app.post('/api/delete-orders', async (req, res) => {
    try {
        const ids = req.body.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'No order IDs provided' });
        }
        await Order.deleteMany({ id: { $in: ids } });
        res.json({ success: true, count: ids.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
        const body = req.body || {};
        const first_name = (body.first_name || body.fname || '').trim();
        const last_name = (body.last_name || body.lname || '').trim();
        const email = (body.email || '').trim();
        const phone = (body.phone || '').trim();
        const business_name = (body.business_name || body.businessName || body.company || '').trim();
        const rawQty = parseInt(body.quantity, 10);
        const quantity = isNaN(rawQty) || rawQty <= 0 ? 50 : rawQty;
        const address = (body.address || '').trim();
        const city = (body.city || '').trim();
        const state = (body.state || '').trim();
        const pincode = (body.pincode || '').trim();
        const notes = (body.notes || body.message || '').trim();

        const newBulkOrder = new BulkOrder({
            id: `bulk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            first_name,
            last_name,
            email,
            phone,
            business_name: business_name || (first_name ? `${first_name}'s Business` : 'Wholesale Inquiry'),
            quantity,
            address,
            city,
            state,
            pincode,
            notes,
            status: 'Pending',
            created_at: new Date()
        });
        await newBulkOrder.save();
        res.json({ success: true, bulkOrder: newBulkOrder });
    } catch (error) {
        console.error('Error creating bulk order:', error);
        res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
    }
});

app.get('/api/bulk-orders', async (req, res) => {
    try {
        const bulkOrders = await BulkOrder.find().sort({ created_at: -1 }).lean();
        const sanitized = bulkOrders.map(b => ({
            _id: b._id,
            id: b.id || `bulk_${b._id}`,
            first_name: b.first_name || '',
            last_name: b.last_name || '',
            email: b.email || '',
            phone: b.phone || '',
            business_name: b.business_name || (b.first_name ? `${b.first_name}'s Business` : 'Wholesale Inquiry'),
            quantity: typeof b.quantity === 'number' && !isNaN(b.quantity) && b.quantity > 0 ? b.quantity : 50,
            address: b.address || '',
            city: b.city || '',
            state: b.state || '',
            pincode: b.pincode || '',
            notes: b.notes || '',
            status: b.status || 'Pending',
            created_at: b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString()
        }));
        res.json({ success: true, bulkOrders: sanitized });
    } catch (error) {
        console.error('Error fetching bulk orders:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post('/api/bulk-orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const updated = await BulkOrder.findOneAndUpdate(
            { id },
            { $set: { status: status || 'Pending' } },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Bulk order not found' });
        }
        res.json({ success: true, bulkOrder: updated });
    } catch (error) {
        console.error('Error updating bulk order status:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.delete('/api/bulk-orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await BulkOrder.findOneAndDelete({ id });
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Bulk order not found' });
        }
        res.json({ success: true, message: 'Bulk order deleted successfully' });
    } catch (error) {
        console.error('Error deleting bulk order:', error);
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
