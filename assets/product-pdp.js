/**
 * REST NEST - PRODUCT DETAIL PAGE (PDP) ENGINE
 * High-converting, SleepyCat-inspired modern luxury e-commerce architecture
 * Handles dynamic product loading, gallery, delivery checker,
 * bundle cross-sells, comparison matrix, and catalog recommendations.
 */

(function () {
    'use strict';

    // Helper: Parse currency strings to numeric float
    function parseNumericPrice(str) {
        if (typeof str === 'number') return str;
        if (!str) return 0;
        var cleaned = str.toString().replace(/[^0-9.]/g, '');
        return parseFloat(cleaned) || 0;
    }

    // Helper: Format number to Indian Currency string
    function formatINR(num) {
        return 'Rs. ' + Math.round(num).toLocaleString('en-IN') + '.00';
    }

    // Helper: Resolve image URL
    function getImgUrl(url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        var b = (typeof window.basePath !== 'undefined') ? window.basePath : '../';
        return b + 'assets/' + url;
    }

    // Helper: Get product from global store
    function getProductStore() {
        return window.RESTNEST_PRODUCTS || window.productsData || {};
    }

    // State
    var state = {
        product: null,
        productId: '',
        images: [],
        currentIndex: 0,
        unitBasePrice: 0,
        unitOriginalPrice: 0,
        pairProduct: null,
        pairChecked: true
    };

    /**
     * Initialize PDP when DOM is ready
     */
    document.addEventListener('DOMContentLoaded', function () {
        initSleepyCatPDP();
    });

    // Also listen in case products data loaded asynchronously
    window.addEventListener('load', function () {
        if (!state.product) {
            initSleepyCatPDP();
        }
    });

    function initSleepyCatPDP() {
        var products = getProductStore();
        if (!products || Object.keys(products).length === 0) return;

        var urlParams = new URLSearchParams(window.location.search);
        var pid = urlParams.get('id');

        // Default to slim pillow if no ID provided
        if (!pid) {
            pid = 'rest-nest-slim-microfiber-pillow-17x27-inch-white-1-pcs';
            if (!products[pid]) {
                pid = Object.keys(products).find(function (k) { return products[k] && products[k].available !== false && !products[k].aliasOf; }) || Object.keys(products)[0];
            }
        }

        // Handle alias resolution
        var entry = products[pid];
        var defaultVariantLabel = null;
        if (entry && entry.aliasOf) {
            defaultVariantLabel = entry.defaultVariant || null;
            pid = entry.aliasOf;
            entry = products[pid];
        }

        if (!entry) {
            console.warn('Product not found in store:', pid);
            return;
        }

        state.productId = pid;
        state.product = entry;
        state.unitBasePrice = parseNumericPrice(entry.salePrice);
        state.unitOriginalPrice = parseNumericPrice(entry.originalPrice) || (state.unitBasePrice * 1.35);

        // Images array
        state.images = entry.images && entry.images.length > 0 ? entry.images : [entry.imgUrl || 'sold_out.jpg'];
        state.currentIndex = 0;

        // Render sections
        renderHeaderAndSEO(entry);
        renderGallery(state.images);
        renderBuyBox(entry);
        renderPincodeChecker();
        renderPairWithBundle(entry);
        renderFeatureHighlights(entry);
        renderSpecsAccordion(entry);
        renderComparisonTable(entry);
        renderCatalogRecommendations(pid, entry);
        initStickyPurchaseBar(entry);
    }

    /**
     * 1. Header, Title, SEO & Breadcrumbs
     */
    function renderHeaderAndSEO(p) {
        document.title = p.title + " | Rest Nest Luxury Sleep";

        var breadcrumbCat = document.getElementById('breadcrumb-category');
        var breadcrumbTitle = document.getElementById('breadcrumb-title');
        var collectionTag = document.getElementById('product-collection-tag');

        var isPillow = (p.category || '').toLowerCase().includes('pillow') || p.id.includes('pillow');
        var categoryName = isPillow ? 'Pillows' : 'Cushions';
        var categoryHref = isPillow ? '../pillows/' : '../cushions/';

        if (breadcrumbCat) {
            breadcrumbCat.textContent = categoryName;
            breadcrumbCat.href = categoryHref;
        }
        if (breadcrumbTitle) {
            breadcrumbTitle.textContent = p.title;
        }
        if (collectionTag) {
            collectionTag.textContent = 'REST NEST ' + (isPillow ? 'ORTHOPEDIC PILLOW SERIES' : 'LUXURY CUSHION SERIES');
        }

        var titleEl = document.getElementById('product-title');
        if (titleEl) titleEl.textContent = p.title;

        var descEl = document.getElementById('product-desc');
        if (descEl) descEl.textContent = p.description || '';
    }

    /**
     * 2. Image Gallery with Thumbnails, Swipe & Badges
     */
    function renderGallery(images) {
        var thumbsContainer = document.getElementById('product-thumbnails');
        var mainImg = document.getElementById('product-main-image');
        var prevBtn = document.getElementById('gallery-prev');
        var nextBtn = document.getElementById('gallery-next');
        var counter = document.getElementById('gallery-counter');
        var badge = document.getElementById('product-gallery-badge');

        if (!mainImg) return;

        // Set initial main image
        mainImg.src = getImgUrl(images[0]);
        mainImg.alt = state.product.title;

        // Update badge
        if (badge) {
            if (state.product.discount) {
                badge.textContent = state.product.discount + " OFF";
            } else if (state.product.title.toLowerCase().includes('slim')) {
                badge.textContent = "Slim 2.5\" Profile";
            } else {
                badge.textContent = "Best Seller";
            }
        }

        // Rebuild thumbnails
        if (thumbsContainer) {
            thumbsContainer.innerHTML = '';
            images.forEach(function (img, idx) {
                var thumb = document.createElement('div');
                thumb.className = 'thumbnail' + (idx === 0 ? ' active' : '');
                thumb.setAttribute('data-index', idx);
                thumb.innerHTML = '<img src="' + getImgUrl(img) + '" alt="Thumbnail ' + (idx + 1) + '" loading="lazy">';
                thumb.addEventListener('click', function () {
                    switchImage(idx);
                });
                thumbsContainer.appendChild(thumb);
            });
        }

        updateCounter();

        function switchImage(index) {
            if (index < 0) index = images.length - 1;
            if (index >= images.length) index = 0;
            state.currentIndex = index;

            mainImg.src = getImgUrl(images[state.currentIndex]);

            // Update active thumbnail
            if (thumbsContainer) {
                var thumbs = thumbsContainer.querySelectorAll('.thumbnail');
                thumbs.forEach(function (t, i) {
                    t.classList.toggle('active', i === state.currentIndex);
                });
                if (thumbs[state.currentIndex]) {
                    thumbs[state.currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }
            updateCounter();
        }

        function updateCounter() {
            if (counter) {
                counter.textContent = (state.currentIndex + 1) + ' / ' + images.length;
            }
            if (images.length <= 1) {
                if (prevBtn) prevBtn.style.display = 'none';
                if (nextBtn) nextBtn.style.display = 'none';
                if (counter) counter.style.display = 'none';
            } else {
                if (prevBtn) prevBtn.style.display = 'flex';
                if (nextBtn) nextBtn.style.display = 'flex';
                if (counter) counter.style.display = 'block';
            }
        }

        if (prevBtn) {
            prevBtn.onclick = function (e) {
                e.preventDefault();
                switchImage(state.currentIndex - 1);
            };
        }
        if (nextBtn) {
            nextBtn.onclick = function (e) {
                e.preventDefault();
                switchImage(state.currentIndex + 1);
            };
        }
    }

    /**
     * 3. Pricing & Buy Box
     */
    function renderBuyBox(p) {
        updatePriceDisplay();

        // Check if out of stock
        if (p.available === false) {
            var addBtn = document.querySelector('.product-actions .add-to-cart-btn');
            var buyBtn = document.querySelector('.product-actions .buy-now-btn');
            var qtySec = document.querySelector('.product-quantity');
            var stockBadge = document.querySelector('.pdp-stock-badge');

            if (addBtn) {
                addBtn.textContent = 'Out of Stock';
                addBtn.disabled = true;
                addBtn.style.opacity = '0.55';
                addBtn.style.cursor = 'not-allowed';
            }
            if (buyBtn) buyBtn.style.display = 'none';
            if (qtySec) qtySec.style.display = 'none';
            if (stockBadge) {
                stockBadge.innerHTML = '<span class="pdp-stock-dot" style="background:#D32F2F;"></span><span style="color:#D32F2F;">Currently Sold Out</span>';
                stockBadge.style.background = '#FFEBEE';
            }
        }
    }

    /**
     * Update price based on product data
     */
    function updatePriceDisplay() {
        var saleEl = document.getElementById('product-sale-price');
        var origEl = document.getElementById('product-original-price');
        var discEl = document.getElementById('product-discount');
        var stickyPriceEl = document.getElementById('pdp-sticky-price');

        var currentSale = state.unitBasePrice;
        var currentOrig = state.unitOriginalPrice;
        var discountPct = Math.round(((currentOrig - currentSale) / currentOrig) * 100);

        if (saleEl) saleEl.textContent = formatINR(currentSale);
        if (origEl) origEl.textContent = formatINR(currentOrig);
        if (discEl) discEl.textContent = '-' + discountPct + '% OFF';
        if (stickyPriceEl) stickyPriceEl.textContent = formatINR(currentSale);
    }

    /**
     * 6. Pincode Delivery Estimator (SleepyCat Hallmark)
     */
    function renderPincodeChecker() {
        var input = document.getElementById('pdp-pincode-input');
        var btn = document.getElementById('pdp-pincode-btn');
        var result = document.getElementById('pdp-pincode-result');

        if (!input || !btn || !result) return;

        btn.addEventListener('click', function () {
            var pin = input.value.trim();
            if (!/^[1-9][0-9]{5}$/.test(pin)) {
                result.className = 'pdp-pincode-result error';
                result.textContent = '⚠️ Please enter a valid 6-digit Indian postal pincode.';
                return;
            }

            // Calculate estimated delivery: 3 to 4 days ahead
            var deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + 3);
            var dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
            var formattedDate = deliveryDate.toLocaleDateString('en-IN', dateOptions);

            result.className = 'pdp-pincode-result success';
            result.innerHTML = '✅ <strong>Express Delivery to ' + pin + ' by ' + formattedDate + '</strong><br>' +
                               '• Standard Delivery &bull; Cash on Delivery Available';
        });

        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });
    }

    /**
     * 7. "Great to Pair With" / Frequently Bought Together Widget
     */
    function renderPairWithBundle(currentProduct) {
        var container = document.getElementById('pdp-pair-with-container');
        var row = document.getElementById('pdp-pair-items-row');
        var totalEl = document.getElementById('pdp-pair-total-price');
        var addBtn = document.getElementById('pdp-pair-add-btn');

        if (!container || !row) return;

        var products = getProductStore();
        var allKeys = Object.keys(products);

        // Find a complementary item: if current is Pillow, suggest Cushion or top Pillow
        var isPillow = (currentProduct.category || '').toLowerCase().includes('pillow') || currentProduct.id.includes('pillow');
        var candidateKey = allKeys.find(function (k) {
            var item = products[k];
            if (!item || item.aliasOf || item.available === false || k === currentProduct.id) return false;
            if (isPillow) {
                return (item.category || '').toLowerCase().includes('cushion') || k.includes('cotton') || k.includes('honeycomb');
            } else {
                return (item.category || '').toLowerCase().includes('pillow') || k.includes('slim') || k.includes('cotton');
            }
        });

        if (!candidateKey) {
            candidateKey = allKeys.find(function (k) {
                return k !== currentProduct.id && products[k] && !products[k].aliasOf && products[k].available !== false;
            });
        }

        if (!candidateKey || !products[candidateKey]) {
            container.style.display = 'none';
            return;
        }

        var pairItem = products[candidateKey];
        state.pairProduct = pairItem;

        var currentPrice = state.unitBasePrice;
        var pairPrice = parseNumericPrice(pairItem.salePrice);
        var bundleTotal = Math.round((currentPrice + pairPrice) * 0.90); // 10% bundle discount

        row.innerHTML =
            '<div class="pdp-pair-item">' +
                '<input type="checkbox" id="pair-chk-1" checked disabled>' +
                '<img src="' + getImgUrl(state.images[0]) + '" alt="' + currentProduct.title + '">' +
                '<div class="pdp-pair-item-info">' +
                    '<span class="pdp-pair-item-name">' + currentProduct.title + ' (This item)</span>' +
                    '<span class="pdp-pair-item-price">' + formatINR(currentPrice) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="pdp-pair-plus">+</div>' +
            '<div class="pdp-pair-item">' +
                '<input type="checkbox" id="pair-chk-2" checked>' +
                '<img src="' + getImgUrl((pairItem.images && pairItem.images[0]) || pairItem.imgUrl) + '" alt="' + pairItem.title + '">' +
                '<div class="pdp-pair-item-info">' +
                    '<span class="pdp-pair-item-name">' + pairItem.title + '</span>' +
                    '<span class="pdp-pair-item-price">' + formatINR(pairPrice) + '</span>' +
                '</div>' +
            '</div>';

        if (totalEl) totalEl.textContent = formatINR(bundleTotal);

        var chk2 = document.getElementById('pair-chk-2');
        if (chk2) {
            chk2.addEventListener('change', function () {
                state.pairChecked = chk2.checked;
                if (chk2.checked) {
                    totalEl.textContent = formatINR(Math.round((currentPrice + pairPrice) * 0.90));
                    addBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Both to Cart';
                } else {
                    totalEl.textContent = formatINR(currentPrice);
                    addBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Item to Cart';
                }
            });
        }

        // Add bundle to cart
        if (addBtn) {
            addBtn.onclick = function () {
                var cart = JSON.parse(localStorage.getItem('cart') || '[]');

                // Add item 1
                var name1 = currentProduct.title;
                var price1 = state.unitBasePrice;
                var img1 = getImgUrl(state.images[0]);
                var exist1 = cart.find(function (i) { return i.name === name1; });
                if (exist1) exist1.quantity += 1;
                else cart.push({ name: name1, price: price1, img: img1, quantity: 1 });

                // Add item 2 if checked
                if (state.pairChecked && state.pairProduct) {
                    var name2 = state.pairProduct.title;
                    var price2 = Math.round(pairPrice * 0.90); // bundled price
                    var img2 = getImgUrl((state.pairProduct.images && state.pairProduct.images[0]) || state.pairProduct.imgUrl);
                    var exist2 = cart.find(function (i) { return i.name === name2; });
                    if (exist2) exist2.quantity += 1;
                    else cart.push({ name: name2, price: price2, img: img2, quantity: 1 });
                }

                localStorage.setItem('cart', JSON.stringify(cart));
                if (typeof window.updateCartUI === 'function') window.updateCartUI();
                if (typeof window.openCart === 'function') window.openCart();

                addBtn.textContent = 'Bundle Added!';
                addBtn.style.background = '#2E7D32';
                setTimeout(function () {
                    addBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Both to Cart';
                    addBtn.style.background = '';
                }, 1500);
            };
        }
    }

    /**
     * 8. Features & Sleep Position Meter Customization
     */
    function renderFeatureHighlights(p) {
        var isCushion = (p.category || '').toLowerCase().includes('cushion') || p.id.includes('cushion');
        var meterSection = document.getElementById('pdp-meter-section');
        var featuresGrid = document.getElementById('pdp-features-grid');

        // If product has specific benefits in products-data.js, we can also inject them!
        if (p.benefits && p.benefits.length >= 4 && featuresGrid) {
            featuresGrid.innerHTML = '';
            var icons = [
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 12h20M2 12l5-5M2 12l5 5M22 12l-5-5M22 12l-5 5"/></svg>',
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v20M17 5l-10 14M22 12H2M19 17L5 7"/></svg>',
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"></circle><path d="M8 12l2.5 2.5L16 9"></path></svg>'
            ];

            p.benefits.slice(0, 4).forEach(function (benefit, idx) {
                var parts = benefit.split('—');
                var title = parts[0] ? parts[0].trim() : 'Premium Feature';
                var desc = parts[1] ? parts[1].trim() : parts[0].trim();

                var card = document.createElement('div');
                card.className = 'pdp-feature-card';
                card.innerHTML =
                    '<div class="pdp-feature-icon-wrap">' + (icons[idx] || icons[0]) + '</div>' +
                    '<h4 class="pdp-feature-title">' + title + '</h4>' +
                    '<p class="pdp-feature-desc">' + desc + '</p>';
                featuresGrid.appendChild(card);
            });
        }

        // Adjust Firmness Meter for cushions vs pillows
        if (isCushion && meterSection) {
            var colH3 = meterSection.querySelectorAll('.pdp-meter-col h3');
            if (colH3[1]) colH3[1].textContent = 'Ergonomic Support Usage';
            var posRow = meterSection.querySelector('.pdp-sleep-positions');
            if (posRow) {
                posRow.innerHTML =
                    '<div class="pdp-pos-row">' +
                        '<span class="pdp-pos-name">Work & Office Chairs</span>' +
                        '<span class="pdp-pos-score">★★★★★ 100% Ideal</span>' +
                    '</div>' +
                    '<div class="pdp-pos-row">' +
                        '<span class="pdp-pos-name">Living Room Sofas & Couches</span>' +
                        '<span class="pdp-pos-score">★★★★★ 100% Ideal</span>' +
                    '</div>' +
                    '<div class="pdp-pos-row">' +
                        '<span class="pdp-pos-name">Car & Travel Seating</span>' +
                        '<span class="pdp-pos-score">★★★★☆ Recommended</span>' +
                    '</div>';
            }
        }
    }

    /**
     * 9. Specifications Table
     */
    function renderSpecsAccordion(p) {
        var specDim = document.getElementById('spec-dimensions');
        var specLoft = document.getElementById('spec-loft');

        if (specDim) {
            if (p.sizes && p.sizes[0]) {
                specDim.textContent = p.sizes[0].label + ' ' + (p.sizes[0].desc || '');
            } else if (p.title.includes('16x16')) {
                specDim.textContent = '16 x 16 inches (40 x 40 cm)';
            } else {
                specDim.textContent = '17 x 27 inches (approx. 43 x 68 cm)';
            }
        }

        if (specLoft) {
            if (p.title.toLowerCase().includes('slim')) {
                specLoft.textContent = 'Slim Low Profile (2.5 inches) for zero cervical strain';
            } else {
                specLoft.textContent = 'Medium-High Plush Loft (4.5 - 5.5 inches)';
            }
        }
    }

    /**
     * 10. Comparison Table Highlight
     */
    function renderComparisonTable(p) {
        var curTh = document.getElementById('compare-col-current');
        if (curTh) curTh.textContent = p.title;
    }

    /**
     * Helper: Render recommendation cards into a container
     */
    function renderProductCardsInto(container, keys) {
        if (!container || !keys || keys.length === 0) return;
        var products = getProductStore();
        container.innerHTML = '';
        keys.forEach(function (recKey) {
            var item = products[recKey];
            if (!item) return;
            var img = (item.images && item.images[0]) || item.imgUrl || 'sold_out.jpg';
            var salePrice = item.salePrice || 'Rs. 999.00';
            var origPrice = item.originalPrice || 'Rs. 1,400.00';
            var disc = item.discount || '-25%';
            var cat = item.category || 'Sleep Luxury';

            var card = document.createElement('div');
            card.className = 'pdp-rec-card';
            card.innerHTML =
                '<div class="pdp-rec-img-wrap">' +
                    '<a href="../product/?id=' + encodeURIComponent(recKey) + '">' +
                        '<img src="' + getImgUrl(img) + '" alt="' + item.title + '" loading="lazy">' +
                    '</a>' +
                    '<span class="pdp-rec-badge">' + cat + '</span>' +
                    '<span class="pdp-rec-discount">' + disc + '</span>' +
                '</div>' +
                '<div class="pdp-rec-content">' +
                    '<div class="pdp-rec-rating">' +
                        '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
                        '<span>4.8 (120+ reviews)</span>' +
                    '</div>' +
                    '<h4 class="pdp-rec-title">' +
                        '<a href="../product/?id=' + encodeURIComponent(recKey) + '">' + item.title + '</a>' +
                    '</h4>' +
                    '<div class="pdp-rec-pricing">' +
                        '<span class="pdp-rec-sale">' + salePrice + '</span>' +
                        '<span class="pdp-rec-original">' + origPrice + '</span>' +
                    '</div>' +
                    '<div class="pdp-rec-actions">' +
                        '<a href="../product/?id=' + encodeURIComponent(recKey) + '" class="pdp-rec-btn-view">View</a>' +
                        '<button type="button" class="pdp-rec-btn-add" data-id="' + recKey + '">Add to Cart</button>' +
                    '</div>' +
                '</div>';

            var addBtn = card.querySelector('.pdp-rec-btn-add');
            if (addBtn) {
                addBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    var cart = JSON.parse(localStorage.getItem('cart') || '[]');
                    var exist = cart.find(function (i) { return i.name === item.title; });
                    var pNumeric = parseNumericPrice(salePrice);
                    if (exist) {
                        exist.quantity += 1;
                    } else {
                        cart.push({
                            name: item.title,
                            price: pNumeric,
                            img: getImgUrl(img),
                            quantity: 1
                        });
                    }
                    localStorage.setItem('cart', JSON.stringify(cart));
                    if (typeof window.updateCartUI === 'function') window.updateCartUI();
                    if (typeof window.openCart === 'function') window.openCart();

                    addBtn.textContent = 'Added!';
                    addBtn.style.background = '#2E7D32';
                    setTimeout(function () {
                        addBtn.textContent = 'Add to Cart';
                        addBtn.style.background = '';
                    }, 1400);
                });
            }

            container.appendChild(card);
        });
    }

    /**
     * 11. Dynamic Catalog Recommendations ("Recommended For You")
     */
    function renderCatalogRecommendations(currentId, currentProduct) {
        var container = document.getElementById('pdp-rec-grid') || document.getElementById('pdp-highlights-rec-grid');
        if (!container) return;

        var products = getProductStore();
        var keys = Object.keys(products);

        // Filter valid, available products excluding current and aliases
        var eligible = keys.filter(function (k) {
            var item = products[k];
            return k !== currentId && item && !item.aliasOf && item.available !== false;
        });

        // 4 recommendations right below key product highlights
        var recs = eligible.slice(0, 4);
        renderProductCardsInto(container, recs);
    }

    /**
     * 12. SleepyCat Sticky Bottom Purchase Bar
     */
    function initStickyPurchaseBar(p) {
        var bar = document.getElementById('pdp-sticky-bar');
        var img = document.getElementById('pdp-sticky-img');
        var title = document.getElementById('pdp-sticky-title');
        var price = document.getElementById('pdp-sticky-price');
        var cartBtn = document.getElementById('pdp-sticky-cart-btn');
        var buyBtn = document.getElementById('pdp-sticky-buy-btn');

        if (!bar || !p) return;

        img.src = getImgUrl(state.images[0]);
        img.alt = p.title;
        title.textContent = p.title;
        price.textContent = formatINR(state.unitBasePrice);

        // Show/Hide sticky bar based on scroll position past main action buttons
        var mainActions = document.querySelector('.product-actions');
        window.addEventListener('scroll', function () {
            if (!mainActions) return;
            var rect = mainActions.getBoundingClientRect();
            if (rect.bottom < 0) {
                bar.classList.add('visible');
            } else {
                bar.classList.remove('visible');
            }
        });

        // Hook up sticky Add to Cart
        if (cartBtn) {
            cartBtn.addEventListener('click', function () {
                var mainCartBtn = document.querySelector('.product-actions .add-to-cart-btn');
                if (mainCartBtn) mainCartBtn.click();
            });
        }

        // Hook up sticky Buy Now
        if (buyBtn) {
            buyBtn.addEventListener('click', function () {
                var mainBuyBtn = document.querySelector('.product-actions .buy-now-btn');
                if (mainBuyBtn) mainBuyBtn.click();
            });
        }
    }

})();
