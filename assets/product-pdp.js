/* ==========================================================================
   REST NEST — SleepyCat-Inspired PDP Engine & Sliding Recommendations
   ========================================================================== */

(function () {
    'use strict';

    function initSleepyCatPDP() {
        const urlParams = new URLSearchParams(window.location.search);
        let productId = urlParams.get('id');

        const products = window.RESTNEST_PRODUCTS || window.productsData;
        if (!products) {
            console.warn("Product catalog not loaded yet, retrying...");
            setTimeout(initSleepyCatPDP, 200);
            return;
        }

        if (!productId) {
            productId = Object.keys(products).find(k => products[k] && products[k].available !== false) || Object.keys(products)[0];
        }

        let entry = products[productId];
        let defaultVariantLabel = null;
        if (entry && entry.aliasOf) {
            defaultVariantLabel = entry.defaultVariant || null;
            productId = entry.aliasOf;
            entry = products[productId];
        }

        if (!entry) return;

        const product = entry;
        renderBreadcrumbs(product);
        renderPriceContainer(product);
        renderVariantAndPackPills(product, defaultVariantLabel);
        renderDeliveryBox();
        renderHighlights(product);
        renderAccordions(product);
        renderRecommendations(products, productId);
    }

    // 1. Breadcrumbs
    function renderBreadcrumbs(product) {
        const detailsContainer = document.querySelector('.product-details');
        if (!detailsContainer) return;

        let existing = document.getElementById('pdp-breadcrumbs');
        if (!existing) {
            existing = document.createElement('div');
            existing.id = 'pdp-breadcrumbs';
            existing.className = 'pdp-breadcrumbs';
            detailsContainer.insertBefore(existing, detailsContainer.firstChild);
        }

        const category = product.category || 'Pillow';
        const catUrl = category.toLowerCase().includes('cushion') ? '../cushions/' : '../pillows/';

        existing.innerHTML = `
            <a href="../index.html">Home</a>
            <span class="sep">/</span>
            <a href="${catUrl}">${category}s</a>
            <span class="sep">/</span>
            <span class="pdp-breadcrumb-active">${product.title}</span>
        `;
    }

    // 2. SleepyCat Price Container
    function renderPriceContainer(product) {
        const priceWrap = document.querySelector('.product-details__price-wrap');
        if (!priceWrap) return;

        priceWrap.style.display = 'none'; // hide legacy wrap

        let container = document.getElementById('pdp-price-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pdp-price-container';
            container.className = 'pdp-price-container';
            priceWrap.parentNode.insertBefore(container, priceWrap.nextSibling);
        }

        const sale = product.salePrice || 'Rs. 1,299.00';
        const orig = product.originalPrice || 'Rs. 1,528.00';
        const disc = product.discount || '15% OFF';

        container.innerHTML = `
            <div class="pdp-price-row">
                <span class="pdp-sale-price" id="pdp-dynamic-sale">${sale}</span>
                <span class="pdp-original-price" id="pdp-dynamic-orig">${orig}</span>
                <span class="pdp-discount-pill" id="pdp-dynamic-disc">${disc}</span>
            </div>
            <span class="pdp-tax-notice">MRP inclusive of all taxes • Delivered in 7–8 days</span>
        `;
    }

    // 3. SleepyCat Variant & Size / Pack Pills
    function renderVariantAndPackPills(product, defaultVariantLabel) {
        const insertTarget = document.getElementById('pdp-price-container');
        if (!insertTarget) return;

        let optionsBlock = document.getElementById('pdp-options-block');
        if (!optionsBlock) {
            optionsBlock = document.createElement('div');
            optionsBlock.id = 'pdp-options-block';
            optionsBlock.className = 'pdp-options-block';
            insertTarget.parentNode.insertBefore(optionsBlock, insertTarget.nextSibling);
        }

        // Parse base price
        const parseNumeric = (str) => {
            if (!str) return 1299;
            const match = str.replace(/[^0-9.]/g, '');
            return parseFloat(match) || 1299;
        };

        const baseSaleNum = parseNumeric(product.salePrice);
        const baseOrigNum = parseNumeric(product.originalPrice || Math.round(baseSaleNum * 1.25));

        // Format INR
        const formatINR = (num) => 'Rs. ' + Math.round(num).toLocaleString('en-IN') + '.00';

        // Check if product already has color variants
        let colorHtml = '';
        if (product.variants && product.variants.length > 1) {
            const activeColor = defaultVariantLabel || product.variants[0].label;
            colorHtml = `
                <div class="pdp-options-title" style="margin-top:0.5rem;">
                    <span>Color / Style: <span class="selected-value" id="pdp-selected-color">${activeColor}</span></span>
                </div>
                <div class="pdp-variant-pills" id="pdp-color-pills" style="margin-bottom:1rem;">
                    ${product.variants.map((v, idx) => {
                        const isAct = v.label === activeColor || (!activeColor && idx === 0);
                        return `
                            <button type="button" class="pdp-variant-pill ${isAct ? 'active' : ''}" data-color="${v.label}">
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <span style="width:18px; height:18px; border-radius:50%; background:${v.color || '#ccc'}; border:1px solid rgba(0,0,0,0.15); flex-shrink:0;"></span>
                                    <span class="pdp-variant-pill__name">${v.label}</span>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // Pack sizes: Standard (1 Pc) vs Twin Pack (Set of 2)
        const pack1Sale = formatINR(baseSaleNum);
        const pack1Orig = formatINR(baseOrigNum);

        // Twin pack: 2x with extra 10% combo discount
        const pack2SaleNum = Math.round(baseSaleNum * 2 * 0.90);
        const pack2OrigNum = Math.round(baseOrigNum * 2);
        const pack2Sale = formatINR(pack2SaleNum);
        const pack2Orig = formatINR(pack2OrigNum);
        const pack2Savings = Math.round((1 - (pack2SaleNum / pack2OrigNum)) * 100) + '% OFF';

        optionsBlock.innerHTML = `
            ${colorHtml}
            <div class="pdp-options-title">
                <span>Select Pack / Size: <span class="selected-value" id="pdp-selected-pack">Standard (1 Pc)</span></span>
            </div>
            <div class="pdp-variant-pills" id="pdp-pack-pills">
                <div class="pdp-variant-pill active" data-pack="1" data-sale="${pack1Sale}" data-orig="${pack1Orig}" data-disc="${product.discount || '15% OFF'}">
                    <span class="pdp-variant-pill__name">Standard Pack</span>
                    <span class="pdp-variant-pill__desc">1 Pc (17" x 27" / Standard)</span>
                    <span class="pdp-variant-pill__price">${pack1Sale}</span>
                </div>
                <div class="pdp-variant-pill" data-pack="2" data-sale="${pack2Sale}" data-orig="${pack2Orig}" data-disc="${pack2Savings}">
                    <span class="pdp-variant-pill__badge">Save Extra 10%</span>
                    <span class="pdp-variant-pill__name">Twin Pack (Set of 2)</span>
                    <span class="pdp-variant-pill__desc">2 Pcs • Ideal for Bedroom</span>
                    <span class="pdp-variant-pill__price">${pack2Sale}</span>
                </div>
            </div>
        `;

        // Event listener for pack selection
        const packPills = optionsBlock.querySelectorAll('#pdp-pack-pills .pdp-variant-pill');
        packPills.forEach(pill => {
            pill.addEventListener('click', () => {
                packPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');

                const packType = pill.getAttribute('data-pack') === '2' ? 'Twin Pack (Set of 2)' : 'Standard (1 Pc)';
                const selLabel = document.getElementById('pdp-selected-pack');
                if (selLabel) selLabel.textContent = packType;

                const saleEl = document.getElementById('pdp-dynamic-sale');
                const origEl = document.getElementById('pdp-dynamic-orig');
                const discEl = document.getElementById('pdp-dynamic-disc');
                if (saleEl) saleEl.textContent = pill.getAttribute('data-sale');
                if (origEl) origEl.textContent = pill.getAttribute('data-orig');
                if (discEl) discEl.textContent = pill.getAttribute('data-disc');

                // Sync with base elements for cart system
                const baseSale = document.getElementById('product-sale-price');
                if (baseSale) baseSale.textContent = pill.getAttribute('data-sale');

                window.currentPackOption = packType;
            });
        });

        // Event listener for color selection
        const colorPills = optionsBlock.querySelectorAll('#pdp-color-pills .pdp-variant-pill');
        colorPills.forEach(pill => {
            pill.addEventListener('click', () => {
                colorPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                const colorVal = pill.getAttribute('data-color');
                const selColorLabel = document.getElementById('pdp-selected-color');
                if (selColorLabel) selColorLabel.textContent = colorVal;

                window.currentVariantLabel = colorVal;
                // Trigger main image swap if variant images exist
                const matchedVariant = product.variants.find(v => v.label === colorVal);
                if (matchedVariant && matchedVariant.images && matchedVariant.images.length > 0) {
                    const mainImg = document.getElementById('product-main-image');
                    const basePath = window.basePath || '../';
                    if (mainImg) {
                        mainImg.src = matchedVariant.images[0].startsWith('http') ? matchedVariant.images[0] : (basePath + 'assets/' + matchedVariant.images[0]);
                    }
                }
            });
        });
    }

    // 4. SleepyCat 7-8 Days Delivery Box & Pincode Checker
    function renderDeliveryBox() {
        const optionsBlock = document.getElementById('pdp-options-block');
        if (!optionsBlock) return;

        let deliveryCard = document.getElementById('pdp-delivery-card');
        if (!deliveryCard) {
            deliveryCard = document.createElement('div');
            deliveryCard.id = 'pdp-delivery-card';
            deliveryCard.className = 'pdp-delivery-card';
            optionsBlock.parentNode.insertBefore(deliveryCard, optionsBlock.nextSibling);
        }

        deliveryCard.innerHTML = `
            <div class="pdp-delivery-header">
                <div class="pdp-delivery-icon">🚚</div>
                <div class="pdp-delivery-info">
                    <div class="pdp-delivery-title">
                        Estimated Delivery: 7–8 Days
                        <span class="pdp-delivery-tag">FREE SHIPPING</span>
                    </div>
                    <span class="pdp-delivery-sub">Dispatched safely in sanitized eco-packaging across India</span>
                </div>
            </div>
            <div class="pdp-pincode-form">
                <input type="text" id="pdp-pincode-input" class="pdp-pincode-input" placeholder="Enter 6-digit Pincode" maxlength="6" pattern="[0-9]{6}">
                <button type="button" id="pdp-pincode-btn" class="pdp-pincode-submit">Check</button>
            </div>
            <div class="pdp-pincode-msg" id="pdp-pincode-msg">
                <span>✓</span> Free Delivery in 7–8 days to all Indian pincodes
            </div>
        `;

        const pinInput = deliveryCard.querySelector('#pdp-pincode-input');
        const pinBtn = deliveryCard.querySelector('#pdp-pincode-btn');
        const pinMsg = deliveryCard.querySelector('#pdp-pincode-msg');

        if (pinBtn && pinInput && pinMsg) {
            pinBtn.addEventListener('click', () => {
                const val = pinInput.value.trim();
                if (/^\d{6}$/.test(val)) {
                    pinMsg.innerHTML = `<span style="color:#2E7D32;">✓</span> <strong>Delivery in 7–8 days guaranteed</strong> for <strong>${val}</strong> (Cash on Delivery Available)`;
                    pinMsg.style.color = '#2E7D32';
                } else {
                    pinMsg.innerHTML = `<span style="color:#C62828;">⚠</span> Please enter a valid 6-digit Indian pincode`;
                    pinMsg.style.color = '#C62828';
                }
            });

            pinInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    pinBtn.click();
                }
            });
        }
    }

    // 5. SleepyCat Key Highlights Bullets
    function renderHighlights(product) {
        const deliveryCard = document.getElementById('pdp-delivery-card');
        if (!deliveryCard) return;

        // Hide old plain benefits
        const oldBenefits = document.getElementById('product-benefits-section');
        if (oldBenefits) oldBenefits.style.display = 'none';

        let highlightsCard = document.getElementById('pdp-highlights-card');
        if (!highlightsCard) {
            highlightsCard = document.createElement('div');
            highlightsCard.id = 'pdp-highlights-card';
            highlightsCard.className = 'pdp-highlights-card';
            deliveryCard.parentNode.insertBefore(highlightsCard, deliveryCard.nextSibling);
        }

        // Custom curated SleepyCat highlights for this product
        const defaultHighlights = [
            { icon: "✓", title: "Ergonomic Alignment:", text: "Specifically contoured to maintain neutral spine and cervical alignment throughout the night." },
            { icon: "✓", title: "Cloud Loft Fill:", text: "Fine microfibers and adaptive foam provide responsive cushioning that will not flatten or lump." },
            { icon: "✓", title: "Breathable Temperature Regulation:", text: "Promotes continuous micro-airflow to keep the surface cool, eliminating night heat buildup." },
            { icon: "✓", title: "Hypoallergenic & Safe:", text: "Naturally resistant to dust mites, allergens, and odors; gentle on delicate skin and hair." },
            { icon: "✓", title: "Machine Washable Cover:", text: "Features a smooth zippered outer shell for effortless cleaning and lasting freshness." }
        ];

        // If product benefits exist, merge them
        let items = defaultHighlights;
        if (product.benefits && product.benefits.length >= 3) {
            items = product.benefits.map(b => {
                const parts = b.split('—');
                if (parts.length > 1) {
                    return { icon: "✓", title: parts[0].trim() + ":", text: parts[1].trim() };
                }
                return { icon: "✓", title: "", text: b };
            });
        }

        highlightsCard.innerHTML = `
            <div class="pdp-highlights-heading">Key Product Highlights</div>
            <ul class="pdp-highlights-list">
                ${items.map(item => `
                    <li class="pdp-highlight-item">
                        <span class="pdp-highlight-icon">${item.icon}</span>
                        <div class="pdp-highlight-text">
                            ${item.title ? `<strong>${item.title}</strong> ` : ''}${item.text}
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    // 6. SleepyCat Accordions (Overview, Specifications, Wash Care, Delivery & Returns)
    function renderAccordions(product) {
        const actionsContainer = document.querySelector('.product-actions');
        if (!actionsContainer) return;

        let wrap = document.getElementById('pdp-accordions-wrapper');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'pdp-accordions-wrapper';
            wrap.className = 'pdp-accordions-wrapper';
            const perks = document.querySelector('.product-perks');
            const target = perks || actionsContainer;
            target.parentNode.insertBefore(wrap, target.nextSibling);
        }

        const isCushion = (product.category || '').toLowerCase().includes('cushion');

        wrap.innerHTML = `
            <div class="pdp-accordion-item open">
                <button type="button" class="pdp-accordion-trigger" aria-expanded="true">
                    <span>Product Overview</span>
                    <span class="pdp-accordion-icon">+</span>
                </button>
                <div class="pdp-accordion-content">
                    <p>${product.description || 'Crafted with premium materials to ensure deep, undisturbed rest. Designed to support your posture with cloud-like resilience.'}</p>
                </div>
            </div>

            <div class="pdp-accordion-item">
                <button type="button" class="pdp-accordion-trigger" aria-expanded="false">
                    <span>Specifications & Dimensions</span>
                    <span class="pdp-accordion-icon">+</span>
                </button>
                <div class="pdp-accordion-content">
                    <table class="pdp-specs-table">
                        <tr><td class="spec-name">Product Type</td><td class="spec-val">${product.category || (isCushion ? 'Luxury Cushion' : 'Ergonomic Pillow')}</td></tr>
                        <tr><td class="spec-name">Dimensions</td><td class="spec-val">${isCushion ? '16" x 16" (40 x 40 cm)' : '17" x 27" (43 x 68 cm)'}</td></tr>
                        <tr><td class="spec-name">Profile / Loft</td><td class="spec-val">${product.title.toLowerCase().includes('slim') ? 'Ultra Slim 2.5" Height' : 'Medium Plush 4.5" Height'}</td></tr>
                        <tr><td class="spec-name">Fill Composition</td><td class="spec-val">Virgin Microfiber & High-Resilience Comfort Core</td></tr>
                        <tr><td class="spec-name">Outer Fabric</td><td class="spec-val">100% Breathable Glace Cotton / Smooth Knitted Shell</td></tr>
                        <tr><td class="spec-name">Firmness Level</td><td class="spec-val">Medium Soft Ergonomic Support</td></tr>
                    </table>
                </div>
            </div>

            <div class="pdp-accordion-item">
                <button type="button" class="pdp-accordion-trigger" aria-expanded="false">
                    <span>Care & Wash Instructions</span>
                    <span class="pdp-accordion-icon">+</span>
                </button>
                <div class="pdp-accordion-content">
                    <ul style="padding-left:1.2rem; margin:0; display:flex; flex-direction:column; gap:0.4rem;">
                        <li>Remove outer zippered cover before washing.</li>
                        <li>Machine wash outer cover in cold water on gentle cycle.</li>
                        <li>Use mild liquid detergent. Do not bleach or use fabric softeners.</li>
                        <li>Tumble dry low or line dry in shade.</li>
                        <li>Do not wash the inner core; gently spot clean with a damp cloth if necessary.</li>
                    </ul>
                </div>
            </div>

            <div class="pdp-accordion-item">
                <button type="button" class="pdp-accordion-trigger" aria-expanded="false">
                    <span>Shipping, Delivery & Returns</span>
                    <span class="pdp-accordion-icon">+</span>
                </button>
                <div class="pdp-accordion-content">
                    <p><strong>Estimated Delivery:</strong> 7–8 business days across India.</p>
                    <p><strong>Courier Partners:</strong> Shipped via Big Ship & premier logistics providers with end-to-end SMS tracking.</p>
                    <p><strong>1-Year Warranty:</strong> Protected against sagging and manufacturing defects.</p>
                    <p><strong>7-Day Returns:</strong> Hassle-free returns and replacements if received damaged or defective.</p>
                </div>
            </div>
        `;

        // Accordion toggle behavior
        wrap.querySelectorAll('.pdp-accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', () => {
                const item = trigger.closest('.pdp-accordion-item');
                const isOpen = item.classList.contains('open');
                item.classList.toggle('open', !isOpen);
                trigger.setAttribute('aria-expanded', !isOpen);
            });
        });
    }

    // 7. SleepyCat Sliding Recommendations Carousel ("You May Also Like")
    function renderRecommendations(products, currentId) {
        let recSection = document.getElementById('pdp-recommendations-section');
        if (!recSection) {
            recSection = document.createElement('section');
            recSection.id = 'pdp-recommendations-section';
            recSection.className = 'pdp-recommendations-section';

            // Insert right before customer reviews
            const reviewsSection = document.getElementById('reviews') || document.querySelector('.reviews');
            if (reviewsSection && reviewsSection.parentNode) {
                reviewsSection.parentNode.insertBefore(recSection, reviewsSection);
            } else {
                const mainPage = document.querySelector('.product-page');
                if (mainPage && mainPage.parentNode) {
                    mainPage.parentNode.insertBefore(recSection, mainPage.nextSibling);
                }
            }
        }

        // Filter complementary products (exclude aliases and current product)
        const keys = Object.keys(products).filter(k => {
            const p = products[k];
            return k !== currentId && p && !p.aliasOf && p.available !== false;
        });

        const basePath = window.basePath || '../';
        const resolveImgUrl = (url) => {
            if (!url) return '';
            return url.startsWith('http') ? url : (basePath + 'assets/' + url);
        };

        recSection.innerHTML = `
            <div class="pdp-rec-header">
                <div class="pdp-rec-heading-group">
                    <span class="pdp-rec-tag">Frequently Recommended</span>
                    <h2 class="pdp-rec-title">Complete Your Sleep Setup</h2>
                </div>
                <div class="pdp-rec-nav-arrows">
                    <button type="button" class="pdp-rec-arrow" id="pdp-rec-prev" aria-label="Previous suggestions">‹</button>
                    <button type="button" class="pdp-rec-arrow" id="pdp-rec-next" aria-label="Next suggestions">›</button>
                </div>
            </div>
            <div class="pdp-rec-slider-container">
                <div class="pdp-rec-track" id="pdp-rec-track">
                    ${keys.slice(0, 10).map(key => {
                        const item = products[key];
                        const img = resolveImgUrl(item.imgUrl || (item.images && item.images[0]));
                        const category = item.category || 'Pillow';
                        const discount = item.discount || '15% OFF';
                        return `
                            <div class="pdp-rec-card product-card" data-product-id="${key}">
                                <div class="pdp-rec-image-wrap">
                                    <a href="../product/?id=${key}" style="display:block; width:100%; height:100%;">
                                        <img src="${img}" alt="${item.title}" loading="lazy">
                                    </a>
                                    <span class="pdp-rec-badge">${discount}</span>
                                    <span class="pdp-rec-delivery-badge">🚚 7–8 Days</span>
                                </div>
                                <div class="pdp-rec-body">
                                    <span class="pdp-rec-category">${category}</span>
                                    <a href="../product/?id=${key}" class="pdp-rec-title-link product-title">${item.title}</a>
                                    <div class="pdp-rec-rating">
                                        ★★★★★ <span class="count">4.8 (190+)</span>
                                    </div>
                                    <div class="pdp-rec-price-row">
                                        <span class="pdp-rec-sale sale-price">${item.salePrice}</span>
                                        ${item.originalPrice ? `<span class="pdp-rec-orig">${item.originalPrice}</span>` : ''}
                                    </div>
                                    <div class="pdp-rec-btn-group">
                                        <a href="../product/?id=${key}" class="pdp-rec-btn-view">View</a>
                                        <button type="button" class="pdp-rec-btn-add add-to-cart-btn" data-id="${key}">Add +</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        // Navigation arrow click logic
        const track = document.getElementById('pdp-rec-track');
        const prevBtn = document.getElementById('pdp-rec-prev');
        const nextBtn = document.getElementById('pdp-rec-next');

        if (track && prevBtn && nextBtn) {
            const getScrollDistance = () => {
                const card = track.querySelector('.pdp-rec-card');
                return card ? (card.offsetWidth + 24) * 2 : 560;
            };

            prevBtn.addEventListener('click', () => {
                track.scrollBy({ left: -getScrollDistance(), behavior: 'smooth' });
            });

            nextBtn.addEventListener('click', () => {
                track.scrollBy({ left: getScrollDistance(), behavior: 'smooth' });
            });
        }
    }

    // Auto-init on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSleepyCatPDP);
    } else {
        initSleepyCatPDP();
    }
})();
