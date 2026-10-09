/**
 * RestNest - Custom Checkout Integration (Razorpay + Shiprocket)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

let supabase = null;

const firebaseConfig = {
  apiKey: "[HIDDEN_FIREBASE_KEY]",
  authDomain: "restnest-355b3.firebaseapp.com",
  projectId: "restnest-355b3",
  storageBucket: "restnest-355b3.firebasestorage.app",
  messagingSenderId: "418459690953",
  appId: "1:418459690953:web:61db69e9b41a0e54a3aa18",
  measurementId: "G-Q1EJ31CTXC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ----------------------------------------------------
// UI Initialization
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Only run on checkout page
    if (document.getElementById('checkout-form')) {
        initCheckoutPage();
    }
});

function formatPrice(num) {
    return 'Rs. ' + parseFloat(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function initCheckoutPage() {
    const cart = JSON.parse(localStorage.getItem('restnest_cart')) || [];
    
    if (cart.length === 0) {
        alert('Your cart is empty!');
        window.location.href = 'index.html';
        return;
    }

    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000/api' 
        : 'https://restienestie.onrender.com/api';

    try {
        const configRes = await fetch(`${API_BASE}/public-config`);
        const config = await configRes.json();
        supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    } catch (e) {
        console.error("Failed to load config", e);
    }

    // Attempt to fetch user profile and auto-fill
    if (supabase) {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session) {
                document.getElementById('email').value = session.user.email || '';
            try {
                const res = await fetch('http://localhost:3000/api/my-profile', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                const data = await res.json();
                if (data.success && data.profile) {
                    if(data.profile.first_name) {
                        const parts = data.profile.first_name.split(' ');
                        document.getElementById('fname').value = parts[0] || '';
                        document.getElementById('lname').value = parts.slice(1).join(' ') || '';
                    }
                    if(data.profile.phone) document.getElementById('phone').value = data.profile.phone;
                }
            } catch(e) { console.error('Error fetching profile for checkout:', e); }
        }
    });
    }

    const itemsContainer = document.getElementById('checkout-items');
    const subtotalEl = document.getElementById('summary-subtotal');
    const totalEl = document.getElementById('summary-total');
    
    let totalAmount = 0;

    itemsContainer.innerHTML = '';
    
    cart.forEach(item => {
        totalAmount += (item.price * item.quantity);
        
        const div = document.createElement('div');
        div.className = 'checkout-item';
        div.innerHTML = `
            <img src="${item.img}" alt="${item.name}">
            <div class="checkout-item-details">
                <div class="checkout-item-title">${item.name}</div>
                <div class="checkout-item-price">Qty: ${item.quantity} × ${formatPrice(item.price)}</div>
            </div>
            <div style="font-weight: 500;">${formatPrice(item.price * item.quantity)}</div>
        `;
        itemsContainer.appendChild(div);
    });

    subtotalEl.textContent = formatPrice(totalAmount);
    totalEl.textContent = formatPrice(totalAmount);

    // Meta Pixel: InitiateCheckout event
    if (typeof fbq === 'function') {
        fbq('track', 'InitiateCheckout', {
            content_type: 'product',
            num_items: cart.reduce((sum, item) => sum + item.quantity, 0),
            value: totalAmount,
            currency: 'INR'
        });
    }

    // Form Submission Handler
    const form = document.getElementById('checkout-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const customerInfo = {
            name: `${document.getElementById('fname').value} ${document.getElementById('lname').value}`.trim(),
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            pincode: document.getElementById('pincode').value
        };

        let userId = null;
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            userId = session ? session.user.id : null;
        }

        await processCheckout(cart, totalAmount, customerInfo, userId);
    });
}

function showStatus(message, type) {
    const statusEl = document.getElementById('checkout-status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `status-${type}`;
    statusEl.style.display = 'block';
}

// ----------------------------------------------------
// Checkout Flow (Razorpay -> Shiprocket)
// ----------------------------------------------------
async function processCheckout(cart, totalAmount, customerInfo, userId = null) {
    const payBtn = document.getElementById('pay-btn');
    payBtn.disabled = true;
    payBtn.textContent = 'Preparing Payment...';
    showStatus('Connecting to payment gateway...', 'loading');

    // Use localhost for local testing, otherwise use the live Render backend
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000/api' 
        : 'https://restienestie.onrender.com/api';

    try {
        // 1. Get Config (Razorpay Key)
        const configRes = await fetch(`${API_BASE}/config`);
        const { razorpayKeyId } = await configRes.json();

        // 2. Create Order on Backend
        const orderRes = await fetch(`${API_BASE}/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: cart, currency: 'INR' })
        });
        const orderDataRes = await orderRes.json();
        
        if (!orderDataRes.success) throw new Error('Failed to create order');

        const order = orderDataRes.order;

        // 3. Handle Mock vs Real Payment
        if (order.id.startsWith('order_mock_')) {
            showStatus('Mock Mode: Simulating Payment Success...', 'loading');
            setTimeout(() => handlePaymentSuccess({
                razorpay_payment_id: 'pay_mock_' + Date.now(),
                razorpay_order_id: order.id,
                razorpay_signature: 'mock_sig'
            }, true), 1500);
            return;
        }

        // 4. Open Razorpay Widget for real/test credentials
        const options = {
            key: razorpayKeyId,
            amount: order.amount,
            currency: order.currency,
            name: "RestNest",
            description: "Luxurious Pillows & Cushions",
            image: "assets/logo-nav.png",
            order_id: order.id,
            handler: function (response) {
                handlePaymentSuccess(response, false);
            },
            prefill: {
                name: customerInfo.name,
                email: customerInfo.email,
                contact: customerInfo.phone
            },
            theme: { color: "#4B3621" },
            modal: {
                ondismiss: function() {
                    showStatus('Payment cancelled.', 'error');
                    payBtn.disabled = false;
                    payBtn.textContent = 'Place Order';
                }
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();

    } catch (error) {
        console.error('Checkout error:', error);
        showStatus('Error preparing payment. Ensure backend is running.', 'error');
        payBtn.disabled = false;
        payBtn.textContent = 'Place Order';
    }

    async function handlePaymentSuccess(paymentResponse, isMock = false) {
        showStatus('Payment successful! Verifying...', 'loading');
        payBtn.textContent = 'Finalizing Order...';

        try {
            // A. Verify Payment
            const verifyRes = await fetch(`${API_BASE}/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...paymentResponse, is_mock: isMock })
            });
            const verifyData = await verifyRes.json();

            if (!verifyData.success) throw new Error('Payment verification failed');

            showStatus('Payment verified. Creating shipping label...', 'loading');

            // B. Create Shiprocket Shipment
            const baseOrderData = {
                order_id: 'ORD' + Date.now().toString().slice(-6),
                user_id: userId,
                name: customerInfo.name,
                email: customerInfo.email,
                phone: customerInfo.phone,
                address: customerInfo.address,
                city: customerInfo.city,
                state: customerInfo.state,
                pincode: customerInfo.pincode,
                total_amount: totalAmount,
                items: cart
            };

            const shipRes = await fetch(`${API_BASE}/create-shipment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderData: baseOrderData })
            });
            const shipData = await shipRes.json();

            if (!shipData.success) {
                console.warn('Shiprocket failed, but payment succeeded.');
            }

            // C. Save Final Complete Order to Firebase (For Admin App)
            const finalOrder = {
                id: baseOrderData.order_id,
                user_id: userId,
                customer_name: customerInfo.name,
                email: customerInfo.email,
                phone: customerInfo.phone,
                address: `${customerInfo.address}, ${customerInfo.city}, ${customerInfo.state} - ${customerInfo.pincode}`,
                total_amount: totalAmount,
                items: cart.map(i => `${i.name} (x${i.quantity})`).join(', '),
                raw_items: JSON.stringify(cart),
                status: 'Processing',
                paymentMethod: 'Pre-paid (Razorpay)',
                paymentId: paymentResponse.razorpay_payment_id,
                shiprocketAwb: shipData.data?.awb_code || 'Pending',
                shiprocketShipmentId: shipData.data?.shipment_id || 'Pending'
            };

            await addDoc(collection(db, "orders"), {
                ...finalOrder,
                createdAt: serverTimestamp()
            });

            // Save to localStorage for fallback UI if needed
            const existingOrders = JSON.parse(localStorage.getItem('restnest_orders') || '[]');
            existingOrders.push(finalOrder);
            localStorage.setItem('restnest_orders', JSON.stringify(existingOrders));

            showStatus('Order placed successfully! Redirecting...', 'success');

            // Meta Pixel: Purchase event
            if (typeof fbq === 'function') {
                fbq('track', 'Purchase', {
                    content_type: 'product',
                    num_items: cart.reduce((sum, item) => sum + item.quantity, 0),
                    value: totalAmount,
                    currency: 'INR'
                });
            }
            localStorage.removeItem('restnest_cart');
            
            setTimeout(() => window.location.href = 'index.html', 2000);

        } catch (error) {
            console.error('Post-payment error:', error);
            showStatus('Payment succeeded, but error finalizing order. Please contact support.', 'error');
        }
    }
}
