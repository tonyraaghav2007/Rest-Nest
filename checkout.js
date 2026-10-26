/**
 * RestNest - Custom Checkout Integration (Razorpay + Big Ship)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

let supabase = null;
let cachedRazorpayKeyId = null;

const firebaseConfig = {
  apiKey: "AIzaSyAkIbq6sF7awGkuct1a1q-maFclLbGTAbA",
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
// UI Initialization & Fallback Catalog Prices
// ----------------------------------------------------
const PRODUCT_PRICES = {
    "White Fiber Pillow": 899.0,
    "Serene Everyday Comfort Pillow": 899.0,
    "White Latex Pillow": 899.0,
    "Honeycomb Pillow": 1299.0,
    "Rest Nest Honeycomb Pillow": 1299.0,
    "Ridge Textured Comfort Pillow": 1299.0,
    "Rest Nest Ridge Textured Comfort Pillow": 1299.0,
    "honeycomb-pillow": 1299.0,
    "Black Dotted Pillow": 999.0,
    "Rest Nest Black Dotted Pillow": 999.0,
    "Dusk Signature Print Pillow": 999.0,
    "Rest Nest Dusk Signature Print Pillow": 999.0,
    "black-dotted-pillow": 999.0,
    "Glace Cotton Pillow": 1199.0,
    "Loom Glace Cotton Pillow": 1199.0,
    "Rest Nest Loom Glace Cotton Pillow": 1199.0,
    "rest-nest-premium-white-sleeping-pillow-glace-cotton-fabric-lightweight-comfortable-pack-of-2": 1199.0,
    "Premium White Sleeping Pillow": 1063.0,
    "Slim Pillow": 1299.0,
    "Form Slim Microfiber Pillow": 1299.0,
    "Rest Nest Form Slim Microfiber Pillow": 1299.0,
    "Slim Microfiber Pillow": 1299.0,
    "Rest Nest Slim Microfiber Pillow": 1299.0,
    "rest-nest-slim-microfiber-pillow-17x27-inch-white-1-pcs": 1299.0,
    "Black Fiber": 899.0,
    "Classic Fiber Pillow": 899.0,
    "Classic Fiber Pillow (Midnight)": 899.0,
    "Classic Fiber Pillow (Serene)": 899.0,
    "Classic Fiber Pillow - Midnight": 899.0,
    "Classic Fiber Pillow - Serene": 899.0,
    "Midnight Classic Fiber Pillow": 899.0,
    "Black Latex": 899.0,
    "Premium White Glace Cotton Pillows": 1140.0,
    "Contour Memory Foam Pillow": 899.0,
    "Orthopedic Cervical Memory Foam Pillow": 1175.0,
    "Stripe Pillow": 899.0,
    "Rest Nest Soft Pillow": 899.0,
    "Rest Nest ContourCare™ Memory Foam Pillow": 1175.0,
    "Rest Nest ContourCare Memory Foam Pillow": 1175.0,
    "ContourCare™ Memory Foam Pillow": 1175.0,
    "ContourCare Memory Foam Pillow": 1175.0,
    "White & Gold Glace Cotton Sleeping Pillows": 1110.0,
    "Rest Nest White & Gold Glace Cotton Sleeping Pillows": 1110.0,
    "Blue & White Polycotton Pillow": 1110.0,
    "Rest Nest Blue & White Polycotton Pillow": 1110.0,
    "Premium Polycotton Pillow With Recron Fiber Filling": 964.0,
    "Rest Nest Premium Polycotton Pillow With Recron Fiber Filling": 964.0,
    "Honeycomb Cushion": 899.0,
    "Glace Cotton Cushion": 899.0,
    "Slim Pipe Cushion": 899.0,
    "Soft Cushion Pack Of 2": 1065.0,
    "Rest Nest Soft Cushion Pack Of 2": 1065.0,
    "Orthopedic Cervical Memory Foam Cushion": 1175.0,
    "Rest Nest Orthopedic Cervical Memory Foam Cushion": 1175.0,
    "Slim Microfiber Cushion": 1014.0,
    "Rest Nest Slim Microfiber Cushion": 1014.0,
    "Premium White Glace Cotton Cushions": 1140.0,
    "Rest Nest Premium White Glace Cotton Cushions": 1140.0,
    "ContourCare™ Memory Foam Cushion": 1270.0,
    "ContourCare Memory Foam Cushion": 1270.0,
    "Rest Nest ContourCare™ Memory Foam Cushion": 1270.0,
    "White & Gold Glace Cotton Sleeping Cushions": 1270.0,
    "Rest Nest White & Gold Glace Cotton Sleeping Cushions": 1270.0,
    "Premium White Sleeping Cushion": 1386.0,
    "Rest Nest Premium White Sleeping Cushion": 1386.0,
    "Blue & White Polycotton Cushion": 1175.0,
    "Rest Nest Blue & White Polycotton Cushion": 1175.0,
    "Premium Polycotton Cushion With Recron Fiber Filling": 1386.0,
    "Premium Polycotton Cushion With Recron Fiber Filling Cushion": 1386.0,
    "16x16 White Stripe Soft Cushions": 1110.0,
    "Rest Nest 16x16 White Stripe Soft Cushions": 1110.0
};

function getPriceForProduct(name, currentPrice) {
    if (typeof currentPrice === 'number' && !isNaN(currentPrice) && currentPrice > 0) {
        return currentPrice;
    }
    if (typeof currentPrice === 'string') {
        const parsed = parseFloat(currentPrice.replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (!name) return 899.0;
    const cleanName = name.trim();
    const strippedName = cleanName.replace(/^Rest Nest\s+/i, '').trim();

    if (PRODUCT_PRICES[cleanName]) return PRODUCT_PRICES[cleanName];
    if (PRODUCT_PRICES[strippedName]) return PRODUCT_PRICES[strippedName];
    if (PRODUCT_PRICES[`Rest Nest ${strippedName}`]) return PRODUCT_PRICES[`Rest Nest ${strippedName}`];

    const lowerClean = cleanName.toLowerCase();
    for (const [key, price] of Object.entries(PRODUCT_PRICES)) {
        if (key.toLowerCase() === lowerClean || key.toLowerCase().includes(lowerClean) || lowerClean.includes(key.toLowerCase())) {
            return price;
        }
    }
    return 899.0;
}

function startCheckout() {
    if (document.getElementById('checkout-form') || document.getElementById('checkout-items')) {
        initCheckoutPage();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startCheckout);
} else {
    // In module scripts or fast caches DOMContentLoaded may have already fired
    startCheckout();
}

function formatPrice(num) {
    return 'Rs. ' + parseFloat(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initCheckoutPage() {
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

    if (!Array.isArray(cart) || cart.length === 0) {
        // Double check fallback from either storage
        const fallbackRaw = localStorage.getItem('restnest_buy_now') || sessionStorage.getItem('restnest_buy_now') || localStorage.getItem('restnest_cart');
        try {
            const fallback = JSON.parse(fallbackRaw);
            if (Array.isArray(fallback) && fallback.length > 0) {
                cart = fallback;
            }
        } catch (e) {}
    }

    if (!Array.isArray(cart) || cart.length === 0) {
        alert('Your cart is empty!');
        window.location.href = 'index.html';
        return;
    }

    // Sanitize items: ensure valid price, quantity, name, and image
    cart = cart.map(item => {
        const name = (item.name && item.name !== 'Loading...') ? item.name : 'Rest Nest Premium Pillow';
        const price = getPriceForProduct(name, item.price);
        const quantity = (parseInt(item.quantity, 10) > 0) ? parseInt(item.quantity, 10) : 1;
        let img = item.img || 'assets/logo-nav.png';
        img = img.replace(/^(\.\.\/)+/, '').replace(/^(\.\/)+/, '');
        if (!img.startsWith('assets/') && !img.startsWith('http') && !img.startsWith('/')) {
            img = 'assets/' + img;
        }
        return { ...item, name, price, quantity, img };
    });

    // Clean up buy-now when leaving checkout via navigation links
    document.querySelectorAll('.checkout-header__back, .checkout-breadcrumb a').forEach(link => {
        link.addEventListener('click', () => {
            if (isBuyNow) {
                localStorage.removeItem('restnest_buy_now');
                sessionStorage.removeItem('restnest_buy_now');
            }
        });
    });

    const itemsContainer = document.getElementById('checkout-items');
    const subtotalEl = document.getElementById('summary-subtotal');
    const totalEl = document.getElementById('summary-total');
    
    let totalAmount = 0;
    let currentPaymentMethod = 'prepaid';
    const COD_FEE = 10.0;

    function updatePaymentMethod(method) {
        currentPaymentMethod = method;
        const prepaidCard = document.getElementById('choice-card-prepaid');
        const codCard = document.getElementById('choice-card-cod');
        const codFeeRow = document.getElementById('summary-cod-fee-row');
        const prepaidIconsBox = document.getElementById('prepaid-icons-box');
        const codNoticeBadge = document.getElementById('cod-notice-badge');

        if (method === 'cod') {
            if (prepaidCard) prepaidCard.classList.remove('is-selected');
            if (codCard) codCard.classList.add('is-selected');
            if (codFeeRow) codFeeRow.style.display = 'flex';
            if (prepaidIconsBox) prepaidIconsBox.style.display = 'none';
            if (codNoticeBadge) codNoticeBadge.style.display = 'flex';
        } else {
            if (prepaidCard) prepaidCard.classList.add('is-selected');
            if (codCard) codCard.classList.remove('is-selected');
            if (codFeeRow) codFeeRow.style.display = 'none';
            if (prepaidIconsBox) prepaidIconsBox.style.display = 'block';
            if (codNoticeBadge) codNoticeBadge.style.display = 'none';
        }
        updateSummaryTotals();
        setPayButtonState('default', '', currentPaymentMethod);
    }

    function updateSummaryTotals() {
        const isCod = (currentPaymentMethod === 'cod');
        const codFee = isCod ? COD_FEE : 0;
        const finalTotal = totalAmount + codFee;

        if (subtotalEl) subtotalEl.textContent = formatPrice(totalAmount);
        if (totalEl) totalEl.textContent = formatPrice(finalTotal);
    }

    // Attach listeners for payment method radio selection & card clicks
    document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updatePaymentMethod(e.target.value);
        });
    });

    document.querySelectorAll('.payment-choice-card').forEach(card => {
        card.addEventListener('click', () => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio && radio.value !== currentPaymentMethod) {
                radio.checked = true;
                updatePaymentMethod(radio.value);
            }
        });
    });

    function saveCheckoutState() {
        if (isBuyNow) {
            localStorage.setItem('restnest_buy_now', JSON.stringify(cart));
            sessionStorage.setItem('restnest_buy_now', JSON.stringify(cart));
        } else {
            localStorage.setItem('restnest_cart', JSON.stringify(cart));
        }
    }

    function renderCheckoutItems() {
        if (!itemsContainer) return;
        itemsContainer.innerHTML = '';
        totalAmount = 0;

        if (cart.length === 0) {
            itemsContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem 1rem; color: #8B7355;">
                    <p style="margin-bottom: 1rem; font-size: 0.95rem;">Your cart is empty.</p>
                    <a href="index.html" class="btn btn--primary" style="display: inline-block; padding: 0.6rem 1.25rem; background: #4B3621; color: #FAF9F6; text-decoration: none; border-radius: 6px; font-size: 0.85rem; font-weight: 500;">Continue Shopping</a>
                </div>
            `;
            if (subtotalEl) subtotalEl.textContent = formatPrice(0);
            if (totalEl) totalEl.textContent = formatPrice(0);
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
            cleanImg = cleanImg.replace(/^(\.\.\/)+/, '').replace(/^(\.\/)+/, '');

            const div = document.createElement('div');
            div.className = 'checkout-item';
            div.innerHTML = `
                <img src="${cleanImg}" alt="${item.name}" onerror="this.src='assets/logo-nav.png'">
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

        updateSummaryTotals();
        setPayButtonState('default', '', currentPaymentMethod);
    }

    // Interactive quantity controls in checkout items
    if (itemsContainer) {
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
    }

    // RENDER IMMEDIATELY AND SYNCHRONOUSLY! Never let async network lag block order summary!
    renderCheckoutItems();
    saveCheckoutState();

    // Meta Pixel: InitiateCheckout event
    if (typeof fbq === 'function') {
        fbq('track', 'InitiateCheckout', {
            content_type: 'product',
            num_items: cart.reduce((sum, item) => sum + item.quantity, 0),
            value: totalAmount,
            currency: 'INR'
        });
    }

    // Background asynchronous configuration & profile fetch (non-blocking)
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000/api' 
        : 'https://restienestie.onrender.com/api';

    fetch(`${API_BASE}/public-config`)
        .then(res => res.json())
        .then(config => {
            if (config && config.RAZORPAY_KEY_ID) {
                cachedRazorpayKeyId = config.RAZORPAY_KEY_ID;
            }
            if (config && config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
                supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
                // Attempt to fetch user profile and auto-fill
                supabase.auth.getSession().then(async ({ data: { session } }) => {
                    if (session) {
                        const emailInput = document.getElementById('email');
                        if (emailInput && !emailInput.value) emailInput.value = session.user.email || '';
                        try {
                            const res = await fetch(`${API_BASE}/my-profile`, {
                                headers: { 'Authorization': `Bearer ${session.access_token}` }
                            });
                            const data = await res.json();
                            if (data.success && data.profile) {
                                if (data.profile.first_name) {
                                    const parts = data.profile.first_name.split(' ');
                                    const fnameInput = document.getElementById('fname');
                                    const lnameInput = document.getElementById('lname');
                                    if (fnameInput && !fnameInput.value) fnameInput.value = parts[0] || '';
                                    if (lnameInput && !lnameInput.value) lnameInput.value = parts.slice(1).join(' ') || '';
                                }
                                if (data.profile.phone) {
                                    const phoneInput = document.getElementById('phone');
                                    if (phoneInput && !phoneInput.value) phoneInput.value = data.profile.phone;
                                }
                            }
                        } catch (err) {
                            console.warn('Profile auto-fill skipped:', err);
                        }
                    }
                });
            }
        })
        .catch(e => console.warn('Public config non-blocking fetch note:', e));

    // Form Submission Handler
    const form = document.getElementById('checkout-form');
    if (form) {
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
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    userId = session ? session.user.id : null;
                } catch (err) {}
            }

            const selectedMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'prepaid';
            await processCheckout(cart, totalAmount, customerInfo, userId, isBuyNow, selectedMethod);
        });
    }
}

function showStatus(message, type) {
    const statusEl = document.getElementById('checkout-status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `status-${type}`;
    statusEl.style.display = 'block';
}

function setPayButtonState(state, text = '', method = 'prepaid') {
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
        if (method === 'cod') {
            payBtn.innerHTML = `Place COD Order <span class="btn-icon">→</span>`;
        } else {
            payBtn.innerHTML = `Pay & Place Order <span class="btn-icon">→</span>`;
        }
    }
}

// Helper: Robust fetch with timeout & auto-retry for Render.com cold starts
async function fetchWithTimeoutAndRetry(url, options = {}, retries = 2, timeoutMs = 25000) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok && attempt < retries && res.status >= 500) {
                await new Promise(r => setTimeout(r, 1500));
                continue;
            }
            return res;
        } catch (err) {
            clearTimeout(timer);
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 1500));
                continue;
            }
            throw err;
        }
    }
}

// ----------------------------------------------------
// Checkout Flow (Razorpay / COD -> Big Ship)
// ----------------------------------------------------
async function processCheckout(cart, totalAmount, customerInfo, userId = null, isBuyNow = false, paymentMethod = 'prepaid') {
    const isCod = (paymentMethod === 'cod');
    const codFee = isCod ? 10.0 : 0.0;
    const finalTotalAmount = totalAmount + codFee;

    // Use localhost for local testing, otherwise use the live Render backend
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000/api' 
        : 'https://restienestie.onrender.com/api';

    // ─────────────────────────────────────────────
    // Flow 1: Cash on Delivery (COD) Flow
    // ─────────────────────────────────────────────
    if (isCod) {
        setPayButtonState('loading', 'Booking BigShip COD Order...', 'cod');
        showStatus('Placing your Cash on Delivery order...', 'loading');

        try {
            const orderId = 'ORD' + Date.now().toString().slice(-6);
            const baseOrderData = {
                order_id: orderId,
                user_id: userId,
                name: customerInfo.name,
                email: customerInfo.email,
                phone: customerInfo.phone,
                address: customerInfo.address,
                city: customerInfo.city,
                state: customerInfo.state,
                pincode: customerInfo.pincode,
                total_amount: finalTotalAmount,
                items: cart,
                payment_type: "COD",
                paymentMethod: "Cash on Delivery (COD)",
                payment_id: "COD_" + orderId,
                cod_fee: 10
            };

            const shipRes = await fetchWithTimeoutAndRetry(`${API_BASE}/create-shipment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderData: baseOrderData })
            }, 2, 25000);
            const shipData = await shipRes.json();

            if (!shipData.success) {
                console.warn('Big Ship notice:', shipData.error);
            }

            const awbCode = shipData.data?.awb_code || 'Pending';
            const shipmentId = shipData.data?.shipment_id || 'Pending';

            const finalOrder = {
                id: baseOrderData.order_id,
                user_id: userId,
                customer_name: customerInfo.name,
                email: customerInfo.email,
                phone: customerInfo.phone,
                address: `${customerInfo.address}, ${customerInfo.city}, ${customerInfo.state} - ${customerInfo.pincode}`,
                total_amount: finalTotalAmount,
                items: cart.map(i => `${i.name} (x${i.quantity})`).join(', '),
                raw_items: JSON.stringify(cart),
                status: 'Placed',
                paymentMethod: 'Cash on Delivery (COD)',
                payment_method: 'Cash on Delivery (COD)',
                paymentId: 'COD_' + baseOrderData.order_id,
                payment_id: 'COD_' + baseOrderData.order_id,
                codFee: 10,
                bigshipAwb: awbCode,
                bigshipShipmentId: shipmentId,
                shiprocketAwb: awbCode,
                shiprocketShipmentId: shipmentId
            };

            // Optional Firestore sync (non-blocking if security rules or network restrict client writes)
            try {
                if (db) {
                    await addDoc(collection(db, "orders"), {
                        ...finalOrder,
                        createdAt: serverTimestamp()
                    });
                }
            } catch (firebaseErr) {
                console.warn('Optional Firebase Firestore sync skipped:', firebaseErr);
            }

            // LocalStorage backup
            const existingOrders = JSON.parse(localStorage.getItem('restnest_orders') || '[]');
            existingOrders.push(finalOrder);
            localStorage.setItem('restnest_orders', JSON.stringify(existingOrders));

            showStatus(`Order placed successfully! Amount to pay at delivery: ${formatPrice(finalTotalAmount)}. Redirecting...`, 'success');

            if (typeof fbq === 'function') {
                fbq('track', 'Purchase', {
                    content_type: 'product',
                    num_items: cart.reduce((sum, item) => sum + item.quantity, 0),
                    value: finalTotalAmount,
                    currency: 'INR'
                });
            }

            if (isBuyNow) {
                localStorage.removeItem('restnest_buy_now');
                sessionStorage.removeItem('restnest_buy_now');
            } else {
                localStorage.removeItem('restnest_cart');
            }

            setTimeout(() => window.location.href = 'index.html', 2200);

        } catch (error) {
            console.error('COD placement error:', error);
            showStatus('Could not place COD order. Please check your connection and tap "Place COD Order" again.', 'error');
            setPayButtonState('default', '', 'cod');
        }
        return;
    }

    // ─────────────────────────────────────────────
    // Flow 2: Prepaid Flow (Razorpay)
    // ─────────────────────────────────────────────
    setPayButtonState('loading', 'Connecting to Payment Gateway...', 'prepaid');
    showStatus('Connecting to secure payment gateway...', 'loading');

    // Progressive status updates for Render.com cold starts
    const t1 = setTimeout(() => {
        setPayButtonState('loading', 'Securing Payment Session...', 'prepaid');
        showStatus('Securing payment session, please hold on...', 'loading');
    }, 3000);

    const t2 = setTimeout(() => {
        setPayButtonState('loading', 'Waking Payment Gateway...', 'prepaid');
        showStatus('Payment server is starting up, almost ready...', 'loading');
    }, 7000);

    const t3 = setTimeout(() => {
        setPayButtonState('loading', 'Opening Razorpay...', 'prepaid');
    }, 15000);

    const clearTimers = () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
    };

    try {
        // 1. Get Config (Use cached key if available, or fetch with retry)
        let razorpayKeyId = cachedRazorpayKeyId;
        if (!razorpayKeyId) {
            const configRes = await fetchWithTimeoutAndRetry(`${API_BASE}/config`, {}, 2, 20000);
            const cfg = await configRes.json();
            razorpayKeyId = cfg.razorpayKeyId;
            cachedRazorpayKeyId = razorpayKeyId;
        }

        // 2. Create Order on Backend (with cold-start retry)
        const orderRes = await fetchWithTimeoutAndRetry(`${API_BASE}/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: cart, currency: 'INR' })
        }, 2, 25000);
        const orderDataRes = await orderRes.json();
        
        if (!orderDataRes.success) throw new Error(orderDataRes.error || 'Failed to create order');

        const order = orderDataRes.order;

        // 3. Handle Mock vs Real Payment
        if (order.id.startsWith('order_mock_')) {
            clearTimers();
            showStatus('Mock Mode: Simulating Payment Success...', 'loading');
            setPayButtonState('loading', 'Simulating Payment...', 'prepaid');
            setTimeout(() => handlePaymentSuccess({
                razorpay_payment_id: 'pay_mock_' + Date.now(),
                razorpay_order_id: order.id,
                razorpay_signature: 'mock_sig'
            }, true), 1500);
            return;
        }

        // 4. Open Razorpay Widget for real/test credentials
        clearTimers();
        setPayButtonState('awaiting', 'Awaiting Payment in Razorpay...', 'prepaid');

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
                    setPayButtonState('default', '', 'prepaid');
                }
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
            showStatus('Payment failed: ' + (response.error?.description || 'Transaction declined'), 'error');
            setPayButtonState('default', '', 'prepaid');
        });
        rzp.open();

    } catch (error) {
        clearTimers();
        console.error('Checkout error:', error);
        showStatus('Unable to reach payment gateway. Please check your connection and tap "Pay & Place Order" again.', 'error');
        setPayButtonState('default', '', 'prepaid');
    }

    async function handlePaymentSuccess(paymentResponse, isMock = false) {
        showStatus('Payment successful! Verifying...', 'loading');
        setPayButtonState('loading', 'Finalizing Order...', 'prepaid');

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

            // B. Create Big Ship Shipment
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
                items: cart,
                payment_type: "Prepaid",
                paymentMethod: 'Pre-paid (Razorpay)',
                payment_id: paymentResponse.razorpay_payment_id
            };

            const shipRes = await fetch(`${API_BASE}/create-shipment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderData: baseOrderData })
            });
            const shipData = await shipRes.json();

            if (!shipData.success) {
                console.warn('Big Ship failed, but payment succeeded.');
            }

            // C. Save Final Complete Order to Firebase (For Admin App)
            const awbCode = shipData.data?.awb_code || 'Pending';
            const shipmentId = shipData.data?.shipment_id || 'Pending';
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
                payment_method: 'Pre-paid (Razorpay)',
                paymentId: paymentResponse.razorpay_payment_id,
                payment_id: paymentResponse.razorpay_payment_id,
                bigshipAwb: awbCode,
                bigshipShipmentId: shipmentId,
                shiprocketAwb: awbCode,
                shiprocketShipmentId: shipmentId
            };

            // Optional Firestore sync (non-blocking if security rules or network restrict client writes)
            try {
                if (db) {
                    await addDoc(collection(db, "orders"), {
                        ...finalOrder,
                        createdAt: serverTimestamp()
                    });
                }
            } catch (firebaseErr) {
                console.warn('Optional Firebase Firestore sync skipped:', firebaseErr);
            }

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
            setPayButtonState('default', '', 'prepaid');
        }
    }
}
