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
    // Buy Now uses a separate key so only that product is checked out
    const buyNowRaw = sessionStorage.getItem('restnest_buy_now') || localStorage.getItem('restnest_buy_now');
    let buyNowData = null;
    try {
        buyNowData = buyNowRaw ? JSON.parse(buyNowRaw) : null;
    } catch (e) {
        buyNowData = null;
    }

    const isBuyNow = !!(buyNowData && Array.isArray(buyNowData) && buyNowData.length > 0);
    let cart = isBuyNow 
        ? buyNowData 
        : (JSON.parse(localStorage.getItem('restnest_cart')) || []);

    if (cart.length === 0) {
        alert('Your cart is empty!');
        window.location.href = 'index.html';
        return;
    }

    // Clean up buy-now when leaving checkout via navigation links
    document.querySelectorAll('.checkout-header__back, .checkout-breadcrumb a').forEach(link => {
        link.addEventListener('click', () => {
            if (isBuyNow) {
                localStorage.removeItem('restnest_buy_now');
                sessionStorage.removeItem('restnest_buy_now');
            }
        });
    });

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

    function saveCheckoutState() {
        if (isBuyNow) {
            localStorage.setItem('restnest_buy_now', JSON.stringify(cart));
            sessionStorage.setItem('restnest_buy_now', JSON.stringify(cart));
        } else {
            localStorage.setItem('restnest_cart', JSON.stringify(cart));
        }
    }

    function renderCheckoutItems() {
        itemsContainer.innerHTML = '';
        totalAmount = 0;

        if (cart.length === 0) {
            itemsContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem 1rem; color: #8B7355;">
                    <p style="margin-bottom: 1rem; font-size: 0.95rem;">Your cart is empty.</p>
                    <a href="index.html" class="btn btn--primary" style="display: inline-block; padding: 0.6rem 1.25rem; background: #4B3621; color: #FAF9F6; text-decoration: none; border-radius: 6px; font-size: 0.85rem; font-weight: 500;">Continue Shopping</a>
                </div>
            `;
            subtotalEl.textContent = formatPrice(0);
            totalEl.textContent = formatPrice(0);
            const payBtn = document.getElementById('pay-btn');
            if (payBtn) payBtn.disabled = true;
            return;
        }

        const payBtn = document.getElementById('pay-btn');
        if (payBtn) payBtn.disabled = false;

        cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            totalAmount += itemTotal;

            let cleanImg = item.img || 'assets/logo-nav.png';
            cleanImg = cleanImg.replace(/^(\.\.\/)+/, '');

            const div = document.createElement('div');
            div.className = 'checkout-item';
            div.innerHTML = `
                <img src="${cleanImg}" alt="${item.name}">
                <div class="checkout-item-details">
                    <div class="checkout-item-title">${item.name}</div>
                    <div class="checkout-item-price">${formatPrice(item.price)} each</div>
                    <div class="checkout-qty-control">
                        <button type="button" class="checkout-qty-btn checkout-qty-minus" data-index="${index}" aria-label="Decrease quantity">−</button>
                        <span class="checkout-qty-value">${item.quantity}</span>
                        <button type="button" class="checkout-qty-btn checkout-qty-plus" data-index="${index}" aria-label="Increase quantity">+</button>
                        <button type="button" class="checkout-item-remove-btn" data-index="${index}" title="Remove item" aria-label="Remove item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
                <div class="checkout-item-total">${formatPrice(itemTotal)}</div>
            `;
            itemsContainer.appendChild(div);
        });

        subtotalEl.textContent = formatPrice(totalAmount);
        totalEl.textContent = formatPrice(totalAmount);
    }

    // Interactive quantity controls in checkout items
    itemsContainer.addEventListener('click', (e) => {
        const minusBtn = e.target.closest('.checkout-qty-minus');
        const plusBtn = e.target.closest('.checkout-qty-plus');
        const removeBtn = e.target.closest('.checkout-item-remove-btn');

        if (plusBtn) {
            const idx = parseInt(plusBtn.getAttribute('data-index'), 10);
            if (!isNaN(idx) && cart[idx]) {
                cart[idx].quantity += 1;
                saveCheckoutState();
                renderCheckoutItems();
            }
        } else if (minusBtn) {
            const idx = parseInt(minusBtn.getAttribute('data-index'), 10);
            if (!isNaN(idx) && cart[idx]) {
                if (cart[idx].quantity > 1) {
                    cart[idx].quantity -= 1;
                } else {
                    cart.splice(idx, 1);
                }
                saveCheckoutState();
                renderCheckoutItems();
            }
        } else if (removeBtn) {
            const idx = parseInt(removeBtn.getAttribute('data-index'), 10);
            if (!isNaN(idx) && cart[idx]) {
                cart.splice(idx, 1);
                saveCheckoutState();
                renderCheckoutItems();
            }
        }
    });

    renderCheckoutItems();

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
        
        if (cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }

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

        await processCheckout(cart, totalAmount, customerInfo, userId, isBuyNow);
    });
}

function showStatus(message, type) {
    const statusEl = document.getElementById('checkout-status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `status-${type}`;
    statusEl.style.display = 'block';
}

function setPayButtonState(state, text = '') {
    const payBtn = document.getElementById('pay-btn');
    if (!payBtn) return;

    if (state === 'loading') {
        payBtn.disabled = true;
        payBtn.classList.add('is-loading');
        payBtn.innerHTML = `
            <span class="pay-btn-spinner" aria-hidden="true"></span>
            <span class="btn-text">${text || 'Connecting to Payment Gateway...'}</span>
        `;
    } else if (state === 'awaiting') {
        payBtn.disabled = true;
        payBtn.classList.add('is-loading');
        payBtn.innerHTML = `
            <span class="pay-btn-spinner" aria-hidden="true"></span>
            <span class="btn-text">${text || 'Awaiting Payment...'}</span>
        `;
    } else {
        payBtn.disabled = false;
        payBtn.classList.remove('is-loading');
        payBtn.innerHTML = `Place Order <span class="btn-icon">→</span>`;
    }
}

// ----------------------------------------------------
// Checkout Flow (Razorpay -> Shiprocket)
// ----------------------------------------------------
async function processCheckout(cart, totalAmount, customerInfo, userId = null, isBuyNow = false) {
    setPayButtonState('loading', 'Connecting to Payment Gateway...');
    showStatus('Connecting to secure payment gateway...', 'loading');

    let gatewayTimer = setTimeout(() => {
        setPayButtonState('loading', 'Opening Razorpay...');
    }, 2500);

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
        
        if (!orderDataRes.success) throw new Error(orderDataRes.error || 'Failed to create order');

        const order = orderDataRes.order;

        // 3. Handle Mock vs Real Payment
        if (order.id.startsWith('order_mock_')) {
            clearTimeout(gatewayTimer);
            showStatus('Mock Mode: Simulating Payment Success...', 'loading');
            setPayButtonState('loading', 'Simulating Payment...');
            setTimeout(() => handlePaymentSuccess({
                razorpay_payment_id: 'pay_mock_' + Date.now(),
                razorpay_order_id: order.id,
                razorpay_signature: 'mock_sig'
            }, true), 1500);
            return;
        }

        // 4. Open Razorpay Widget for real/test credentials
        clearTimeout(gatewayTimer);
        setPayButtonState('awaiting', 'Awaiting Payment in Razorpay...');

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
                    setPayButtonState('default');
                }
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
            showStatus('Payment failed: ' + (response.error?.description || 'Transaction declined'), 'error');
            setPayButtonState('default');
        });
        rzp.open();

    } catch (error) {
        clearTimeout(gatewayTimer);
        console.error('Checkout error:', error);
        showStatus('Error preparing payment. Ensure backend is running.', 'error');
        setPayButtonState('default');
    }

    async function handlePaymentSuccess(paymentResponse, isMock = false) {
        showStatus('Payment successful! Verifying...', 'loading');
        setPayButtonState('loading', 'Finalizing Order...');

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
            // Clear checkout storage
            if (isBuyNow) {
                localStorage.removeItem('restnest_buy_now');
                sessionStorage.removeItem('restnest_buy_now');
            } else {
                localStorage.removeItem('restnest_cart');
            }
            
            setTimeout(() => window.location.href = 'index.html', 2000);

        } catch (error) {
            console.error('Post-payment error:', error);
            showStatus('Payment succeeded, but error finalizing order. Please contact support.', 'error');
            setPayButtonState('default');
        }
    }
}
