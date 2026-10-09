/* ============================================
   RESTNEST — Landing Page Scripts
   Hero Slider, Scroll Reveal, Interactions
   ============================================ */

const basePath = window.location.pathname.includes('/product/') || window.location.pathname.includes('/cushions/') || window.location.pathname.includes('/pillows/') || window.location.pathname.includes('/about/') ? '../' : './';
const resolveImg = (url) => url ? (url.startsWith('http') ? url : (basePath + 'assets/' + url)) : '';

document.addEventListener('DOMContentLoaded', () => {
    initHeroSlider();
    initScrollReveal();
    initStickyNav();
    initFeaturesMarquee();
    initProductsSlider();
    initSearchModal();
    initProductPage();
    initReviewsSlider();
    initMobileMenu();
    trackPageView();
    
    // Auth Check
    const token = localStorage.getItem('sb-julktcdhbnvxsjuqsimp-auth-token');
    if (token) {
        const accountLink = document.getElementById('account-link');
        if (accountLink) {
            accountLink.innerHTML = accountLink.innerHTML.replace('ACCOUNT', 'YOU');
        }
    }
});

/* ==============================================
   PAGE TRAFFIC TRACKING
   ============================================== */
function trackPageView() {
    let page = window.location.pathname.replace(/\/$/, '').split('/').pop() || 'home';
    
    // Better page names for tracking
    if (page === 'home' || page === 'index.html' || page === '') page = 'Home';
    else if (page.includes('pillows')) page = 'Pillows';
    else if (page.includes('cushions')) page = 'Cushions';
    else if (page.includes('bulk')) page = 'Bulk Requests';
    else if (page.includes('checkout')) page = 'Checkout';
    else if (page.includes('about')) page = 'About';
    else if (page.includes('terms')) page = 'Terms';
    else if (page.includes('product')) page = 'Product Detail';
    
    // Prevent duplicated hits in rapid succession or dev mode
    const lastTracked = sessionStorage.getItem('last_tracked_page');
    if (lastTracked === page) return;
    
    fetch('https://restienestie.onrender.com/api/track-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: page })
    })
    .then(res => res.json())
    .then(() => sessionStorage.setItem('last_tracked_page', page))
    .catch(err => console.warn('Failed to track page view', err));
}


/* ==============================================
   MOBILE HAMBURGER MENU
   ============================================== */
function initMobileMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const curtain = document.getElementById('mobile-nav-curtain');
    if (!toggle || !curtain) return;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = curtain.classList.toggle('open');
        toggle.classList.toggle('active', isOpen);
        toggle.setAttribute('aria-expanded', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close menu when a curtain link is clicked
    curtain.querySelectorAll('.mobile-nav-curtain__link').forEach(link => {
        link.addEventListener('click', () => {
            curtain.classList.remove('open');
            toggle.classList.remove('active');
            toggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        });
    });
}


/* ==============================================
   REVIEWS AUTO-SLIDER (2.8s per card)
   ============================================== */
function initReviewsSlider() {
    const track = document.querySelector('.reviews__track');
    if (!track) return;

    const cards = track.querySelectorAll('.review-card');
    if (!cards.length) return;

    function getCardWidth() {
        const card = cards[0];
        const style = getComputedStyle(track);
        const gap = parseFloat(style.gap) || 0;
        return card.offsetWidth + gap;
    }

    function slide() {
        const maxScroll = track.scrollWidth - track.clientWidth;
        
        // If we've reached the end of the scrollable area, jump back to the start
        if (track.scrollLeft >= maxScroll - 10) { 
            track.scrollTo({ left: 0, behavior: 'smooth' });
            return;
        }

        track.scrollBy({ left: getCardWidth(), behavior: 'smooth' });
    }

    let intervalId = setInterval(slide, 2800);

    // Pause auto-scrolling when user interacts manually
    track.addEventListener('mouseenter', () => clearInterval(intervalId));
    track.addEventListener('mouseleave', () => {
        intervalId = setInterval(slide, 2800);
    });
    track.addEventListener('touchstart', () => clearInterval(intervalId), {passive: true});
    track.addEventListener('touchend', () => {
        intervalId = setInterval(slide, 2800);
    });

    // Arrow navigation
    const prevBtn = document.getElementById('reviews-prev');
    const nextBtn = document.getElementById('reviews-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            clearInterval(intervalId);
            if (track.scrollLeft <= 5) {
                const maxScroll = track.scrollWidth - track.clientWidth;
                track.scrollTo({ left: maxScroll, behavior: 'smooth' });
            } else {
                track.scrollBy({ left: -getCardWidth(), behavior: 'smooth' });
            }
            intervalId = setInterval(slide, 2800);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            clearInterval(intervalId);
            slide();
            intervalId = setInterval(slide, 2800);
        });
    }
}

/* ==============================================
   PRODUCTS AUTO-SLIDER (2.8s per card)
   ============================================== */
function initProductsSlider() {
    const track = document.getElementById('products-track');
    if (!track) return;

    const cards = track.querySelectorAll('.products-slider__card');
    if (!cards.length) return;

    let currentIndex = 0;
    const totalCards = cards.length;
    let visibleCards = 4; // show 4 at a time

    function getCardWidth() {
        const card = cards[0];
        const style = getComputedStyle(track);
        const gap = parseFloat(style.gap) || 0;
        return card.offsetWidth + gap;
    }

    function updateTransform(instant = false) {
        if (window.innerWidth <= 900) visibleCards = 2;
        
        if (instant) {
            track.style.transition = 'none';
        } else {
            track.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        }
        
        const offset = currentIndex * getCardWidth();
        track.style.transform = `translateX(-${offset}px)`;
        
        if (instant) {
            track.offsetHeight;
        }
    }

    function slide() {
        currentIndex++;
        if (currentIndex > totalCards - visibleCards) {
            currentIndex = 0;
            updateTransform(true);
            return;
        }
        updateTransform();
    }

    let slideInterval = setInterval(slide, 2800);
    
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    let pauseTimeout;

    function pauseAutoScroll() {
        clearInterval(slideInterval);
        clearTimeout(pauseTimeout);
        pauseTimeout = setTimeout(() => {
            slideInterval = setInterval(slide, 2800);
        }, 3000);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            pauseAutoScroll();
            currentIndex--;
            if (currentIndex < 0) {
                currentIndex = Math.max(0, totalCards - visibleCards);
            }
            updateTransform(false);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            pauseAutoScroll();
            currentIndex++;
            if (currentIndex > totalCards - visibleCards) {
                currentIndex = 0;
            }
            updateTransform(false);
        });
    }
}


/* ==============================================
   FEATURES MARQUEE (seamless loop)
   ============================================== */
function initFeaturesMarquee() {
    const track = document.getElementById('features-track');
    if (!track) return;

    const originalSet = track.querySelector('.features-marquee__set');
    if (!originalSet) return;

    // Dynamically clone enough sets to always cover the full viewport width
    const setWidth = originalSet.offsetWidth;
    const clonesNeeded = Math.ceil(window.innerWidth / setWidth) + 1;

    for (let i = 0; i < clonesNeeded; i++) {
        track.appendChild(originalSet.cloneNode(true));
    }

    let offset = 0;
    const speed = 0.5; // pixels per frame

    function animate() {
        offset -= speed;
        // When the first set has fully scrolled off-screen, reset seamlessly
        if (Math.abs(offset) >= setWidth) {
            offset += setWidth;
        }
        track.style.transform = `translateX(${offset}px)`;
        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}


/* ==============================================
   HERO IMAGE SLIDER
   ============================================== */
function initHeroSlider() {
    const track = document.getElementById('hero-track');
    const slides = track ? track.querySelectorAll('.hero__slide') : [];
    const prevBtn = document.getElementById('hero-prev');
    const nextBtn = document.getElementById('hero-next');

    if (!track || slides.length === 0) return;

    let currentIndex = 0;
    const totalSlides = slides.length;
    let autoSlideInterval;
    let isTransitioning = false;

    function goToSlide(index, direction = 'next') {
        if (isTransitioning) return;
        isTransitioning = true;

        // Remove active class from current slide
        slides[currentIndex].classList.remove('hero__slide--active');

        // Update index
        currentIndex = ((index % totalSlides) + totalSlides) % totalSlides;

        // Move track
        track.style.transform = `translateX(-${currentIndex * 100}%)`;

        // Add active class to new slide after transition
        setTimeout(() => {
            slides[currentIndex].classList.add('hero__slide--active');
            // Re-trigger animations
            restartAnimations(slides[currentIndex]);
            isTransitioning = false;
        }, 800);
    }

    function restartAnimations(slide) {
        const heading = slide.querySelector('.hero__heading');
        const cta = slide.querySelector('.hero__cta');

        if (heading) {
            heading.style.animation = 'none';
            heading.offsetHeight; // Trigger reflow
            heading.style.animation = '';
        }
        if (cta) {
            cta.style.animation = 'none';
            cta.offsetHeight; // Trigger reflow
            cta.style.animation = '';
        }
    }

    function nextSlide() {
        goToSlide(currentIndex + 1, 'next');
    }

    function prevSlide() {
        goToSlide(currentIndex - 1, 'prev');
    }

    // Button click handlers
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            nextSlide();
            resetAutoSlide();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            prevSlide();
            resetAutoSlide();
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            nextSlide();
            resetAutoSlide();
        } else if (e.key === 'ArrowLeft') {
            prevSlide();
            resetAutoSlide();
        }
    });

    // Auto-slide
    function startAutoSlide() {
        autoSlideInterval = setInterval(nextSlide, 6000);
    }

    function resetAutoSlide() {
        clearInterval(autoSlideInterval);
        startAutoSlide();
    }

    // Pause on hover
    const hero = document.getElementById('hero');
    if (hero) {
        hero.addEventListener('mouseenter', () => clearInterval(autoSlideInterval));
        hero.addEventListener('mouseleave', startAutoSlide);
    }

    // Touch/swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    if (track) {
        track.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        track.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
    }

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
            resetAutoSlide();
        }
    }

    // Initialize
    slides[0].classList.add('hero__slide--active');
    startAutoSlide();
}


/* ==============================================
   SCROLL REVEAL ANIMATIONS
   ============================================== */
function initScrollReveal() {
    const revealElements = document.querySelectorAll(
        '.story__feature, .categories__card, .collection__card, ' +
        '.story__label, .story__text, .categories__heading, ' +
        '.collection__heading, .collection__subtitle'
    );

    if (!revealElements.length) return;

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -80px 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(el => observer.observe(el));
}


/* ==============================================
   STICKY NAVIGATION (optional enhancement)
   ============================================== */
function initStickyNav() {
    const pillNav = document.getElementById('pill-nav');

    if (!pillNav) return;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 10) {
            pillNav.classList.add('scrolled');
        } else {
            pillNav.classList.remove('scrolled');
        }
    }, { passive: true });
}

/* ==============================================
   SEARCH MODAL
   ============================================== */
function initSearchModal() {
    const searchLinks = document.querySelectorAll('#search-link, .top-bar__link[id="search-link"]');
    const searchModal = document.getElementById('search-modal');
    const searchClose = document.getElementById('search-close');
    const searchOverlay = document.getElementById('search-overlay');
    const searchInput = document.querySelector('.search-modal__input');
    const searchResults = document.getElementById('search-results');
    
    let productData = null;

    if (!searchModal) return;

    function openSearch(e) {
        if (e) e.preventDefault();
        searchModal.classList.add('active');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
        
        // Fetch products lazily when search is opened
        if (!productData) {
            const basePath = window.location.pathname.includes('/product/') || window.location.pathname.includes('/cushions/') || window.location.pathname.includes('/pillows/') || window.location.pathname.includes('/about/') ? '../' : './';
            fetch(basePath + 'assets/products.json?v=' + new Date().getTime())
                .then(res => res.json())
                .then(data => {
                    productData = Object.values(data);
                })
                .catch(err => console.error("Error loading products for search", err));
        }
    }

    function closeSearch() {
        searchModal.classList.remove('active');
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
    }

    searchLinks.forEach(link => {
        link.addEventListener('click', openSearch);
    });

    if (searchClose) searchClose.addEventListener('click', closeSearch);
    if (searchOverlay) searchOverlay.addEventListener('click', closeSearch);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchModal.classList.contains('active')) {
            closeSearch();
        }
    });

    if (searchInput && searchResults) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            searchResults.innerHTML = '';
            
            if (!query || !productData) return;
            
            const matches = productData.filter(p => p.title.toLowerCase().includes(query));
            
            if (matches.length === 0) {
                searchResults.innerHTML = '<p style="color: #666; font-style: italic;">No products found.</p>';
                return;
            }
            
            const basePath = window.location.pathname.includes('/product/') || window.location.pathname.includes('/cushions/') || window.location.pathname.includes('/pillows/') || window.location.pathname.includes('/about/') ? '../' : './';
            
            matches.forEach(p => {
                const item = document.createElement('a');
                item.href = `${basePath}product/?id=${p.id || p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.textDecoration = 'none';
                item.style.color = '#333';
                item.style.gap = '1rem';
                item.style.padding = '0.5rem';
                item.style.border = '1px solid #eee';
                item.style.borderRadius = '8px';
                
                item.innerHTML = `
                    <img src="${p.imgUrl}" alt="${p.title}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0; font-size: 0.95rem;">${p.title}</h4>
                        <span style="font-weight: bold; color: #4B3621;">${p.salePrice}</span>
                        ${p.available === false ? '<span style="color: red; font-size: 0.8rem; margin-left: 0.5rem;">(Out of Stock)</span>' : ''}
                    </div>
                `;
                
                // Add hover effect
                item.addEventListener('mouseenter', () => item.style.backgroundColor = '#f9f9f9');
                item.addEventListener('mouseleave', () => item.style.backgroundColor = 'transparent');
                
                searchResults.appendChild(item);
            });
        });
    }
}

/* ==============================================
   PRODUCT PAGE INITIALIZATION
   ============================================== */
async function initProductPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId || !document.querySelector('.product-page')) return;

    try {
        const response = await fetch('../assets/products.json?v=' + new Date().getTime());
        const products = await response.json();
        
        const product = products[productId];
        if (!product) {
            document.getElementById('product-title').innerText = "Product Not Found";
            return;
        }

        document.getElementById('product-title').innerText = product.title;
        document.getElementById('product-desc').innerText = product.description;
        document.getElementById('product-sale-price').innerText = product.salePrice;
        document.getElementById('product-original-price').innerText = product.originalPrice;
        document.getElementById('product-discount').innerText = product.discount;
        
        const images = product.images || [product.imgUrl];
        document.getElementById('product-main-image').src = resolveImg(images[0]);
        
        const productInfo = document.querySelector('.product-details');
        if (productInfo && product.variantId) {
            productInfo.setAttribute('data-variant-id', product.variantId);
        }

        // Generate Thumbnails
        const thumbnailsContainer = document.getElementById('product-thumbnails');
        if (thumbnailsContainer) {
            thumbnailsContainer.innerHTML = '';
            images.forEach((img, index) => {
                const thumb = document.createElement('div');
                thumb.className = `thumbnail ${index === 0 ? 'active' : ''}`;
                thumb.innerHTML = `<img src="${resolveImg(img)}" alt="Thumbnail ${index+1}">`;
                
                thumb.addEventListener('click', () => {
                    document.getElementById('product-main-image').src = resolveImg(img);
                    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
                
                thumbnailsContainer.appendChild(thumb);
            });
        }

        // Generate Description & Benefits (for pillows) or Sizes (for cushions)
        const sizesContainer = document.getElementById('product-sizes');
        const benefitsSection = document.getElementById('product-benefits-section');
        const benefitsListEl = document.getElementById('product-benefits');

        if (product.benefits && product.benefits.length > 0 && benefitsSection) {
            // Show benefits section
            benefitsListEl.innerHTML = '';
            product.benefits.forEach(benefit => {
                const li = document.createElement('li');
                li.style.cssText = 'display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.9rem; color: #6B5B4F; line-height: 1.5;';
                li.innerHTML = `<span style="color: #7BA05B; font-size: 1rem; flex-shrink: 0;">✓</span> ${benefit}`;
                benefitsListEl.appendChild(li);
            });
            benefitsSection.style.display = 'block';
        } else if (sizesContainer && product.sizes) {
            sizesContainer.innerHTML = '';
            product.sizes.forEach((size, index) => {
                const btn = document.createElement('button');
                btn.className = `size-btn ${index === 0 ? 'active' : ''}`;
                btn.innerHTML = `<strong>${size.label}</strong><span>${size.desc}</span>`;
                sizesContainer.appendChild(btn);
                
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }
        
        document.title = product.title + " – Cloudrest";

        // Meta Pixel: ViewContent event
        if (typeof fbq === 'function') {
            fbq('track', 'ViewContent', {
                content_name: product.title,
                content_category: 'product',
                value: parsePrice(product.salePrice),
                currency: 'INR'
            });
        }

        const addToCartBtn = document.querySelector('.product-actions .btn--primary');
        const buyNowBtn = document.querySelector('.product-actions .btn--secondary');
        const qtyMinus = document.getElementById('qty-minus');
        const qtyPlus = document.getElementById('qty-plus');
        const qtyInput = document.getElementById('qty-input');
        
        if (qtyMinus && qtyPlus && qtyInput) {
            qtyMinus.addEventListener('click', () => {
                let current = parseInt(qtyInput.value) || 1;
                if (current > 1) qtyInput.value = current - 1;
            });
            qtyPlus.addEventListener('click', () => {
                let current = parseInt(qtyInput.value) || 1;
                qtyInput.value = current + 1;
            });
        }

        if (product.available === false) {
            if (addToCartBtn) {
                addToCartBtn.innerHTML = 'Out of Stock';
                addToCartBtn.disabled = true;
                addToCartBtn.style.cursor = 'not-allowed';
                addToCartBtn.style.opacity = '0.5';
                addToCartBtn.classList.remove('add-to-cart-btn');
                addToCartBtn.classList.remove('btn--primary');
            }
            if (buyNowBtn) {
                buyNowBtn.style.display = 'none';
            }
        } else {
            if (buyNowBtn) {
                buyNowBtn.addEventListener('click', async () => {
                    if (typeof ShopifyCart !== 'undefined' && product.variantId) {
                        const originalText = buyNowBtn.innerHTML;
                        buyNowBtn.innerHTML = 'Redirecting...';
                        buyNowBtn.disabled = true;
                        
                        try {
                            const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
                            
                            window.location.href = basePath + 'checkout.html';
                        } catch (err) {
                            buyNowBtn.innerHTML = 'Error';
                            setTimeout(() => {
                                buyNowBtn.innerHTML = originalText;
                                buyNowBtn.disabled = false;
                            }, 2000);
                        }
                    }
                });
            }
        }

    } catch (error) {
        console.error("Failed to load product data:", error);
    }
}

/* ==============================================
   PRODUCT SORTING LOGIC
   ============================================== */
function initProductSort() {
    const sortSelect = document.getElementById('product-sort');
    const productsGrid = document.getElementById('products-grid');
    if (!sortSelect || !productsGrid) return;

    const cards = Array.from(productsGrid.querySelectorAll('.products-slider__card'));
    
    sortSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        let sortedCards = [...cards];

        if (val === 'most-selling') {
            sortedCards.sort((a, b) => parseInt(a.dataset.order) - parseInt(b.dataset.order));
        } else if (val === 'price-low') {
            sortedCards.sort((a, b) => parseFloat(a.dataset.price) - parseFloat(b.dataset.price));
        } else if (val === 'price-high') {
            sortedCards.sort((a, b) => parseFloat(b.dataset.price) - parseFloat(a.dataset.price));
        } else if (val === 'a-z') {
            sortedCards.sort((a, b) => a.dataset.title.localeCompare(b.dataset.title));
        } else if (val === 'z-a') {
            sortedCards.sort((a, b) => b.dataset.title.localeCompare(a.dataset.title));
        }

        productsGrid.innerHTML = '';
        sortedCards.forEach(card => productsGrid.appendChild(card));
    });
}
document.addEventListener('DOMContentLoaded', initProductSort);

/* =========================================
   CART SYSTEM
========================================= */
(function initCartSystem() {
    const cartBtns = document.querySelectorAll('.cart-btn');
    const cartDropdown = document.getElementById('cartDropdown');
    const cartCloseBtn = document.getElementById('cartCloseBtn');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartItemsContainer = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    const cartTotalEl = document.getElementById('cartTotal');
    const cartBadge = document.querySelector('.cart-badge');

    if (!localStorage.getItem('restnest_cart_v2')) {
        localStorage.removeItem('restnest_cart');
        localStorage.setItem('restnest_cart_v2', '1');
    }

    let cart = JSON.parse(localStorage.getItem('restnest_cart')) || [];

    if (cart.length > 0 && cart.some(item => item.price < 1)) {
        cart = [];
        localStorage.removeItem('restnest_cart');
    }

    function saveCart() {
        localStorage.setItem('restnest_cart', JSON.stringify(cart));
    }

    function formatPrice(num) {
        return 'Rs. ' + parseFloat(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function parsePrice(priceStr) {
        const match = priceStr.match(/[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
    }

    function updateCartUI() {
        if (!cartItemsContainer) return;

        cartItemsContainer.innerHTML = '';
        let total = 0;
        let count = 0;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="cart-empty">Your cart is empty</p>';
            if (cartFooter) cartFooter.style.display = 'none';
            if (cartBadge) {
                cartBadge.style.display = 'none';
                cartBadge.textContent = '0';
            }
        } else {
            cart.forEach((item, index) => {
                total += item.price * item.quantity;
                count += item.quantity;

                const div = document.createElement('div');
                div.className = 'cart-item';
                div.innerHTML = `
                    <img src="${item.img}" alt="${item.name}">
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <div class="cart-item-price">${formatPrice(item.price)}</div>
                        <div class="cart-item-qty-controls">
                            <button class="qty-btn qty-minus" data-index="${index}">−</button>
                            <span class="qty-value">${item.quantity}</span>
                            <button class="qty-btn qty-plus" data-index="${index}">+</button>
                        </div>
                    </div>
                    <button class="cart-item-remove" data-index="${index}" data-variant-id="${item.variantId || ''}">&times;</button>
                `;
                cartItemsContainer.appendChild(div);
            });

            if (cartFooter) cartFooter.style.display = 'block';
            if (cartBadge) {
                cartBadge.style.display = 'flex';
                cartBadge.textContent = count;
            }
            if (cartTotalEl) cartTotalEl.textContent = formatPrice(total);
        }

        // Quantity minus buttons
        document.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'), 10);
                if (cart[idx].quantity > 1) {
                    cart[idx].quantity -= 1;
                    saveCart();
                    updateCartUI();
                    
                } else {
                    // Remove item if quantity reaches 0
                    const removedItem = cart[idx];
                    cart.splice(idx, 1);
                    saveCart();
                    updateCartUI();
                    if (typeof ShopifyCart !== 'undefined' && removedItem && removedItem.variantId) {
                        const lineId = ShopifyCart.findLineIdByVariantId(removedItem.variantId);
                        if (lineId) {
                            ShopifyCart.removeItem(lineId);
                        }
                    }
                }
            });
        });

        // Quantity plus buttons
        document.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'), 10);
                cart[idx].quantity += 1;
                saveCart();
                updateCartUI();
                
            });
        });

        // Remove buttons
        document.querySelectorAll('.cart-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'), 10);
                const removedItem = cart[idx];
                cart.splice(idx, 1);
                saveCart();
                updateCartUI();

                if (typeof ShopifyCart !== 'undefined' && removedItem && removedItem.variantId) {
                    const lineId = ShopifyCart.findLineIdByVariantId(removedItem.variantId);
                    if (lineId) {
                        ShopifyCart.removeItem(lineId);
                    }
                }
            });
        });
    }

    function openCart(e) {
        if (e) e.preventDefault();
        if (cartDropdown) cartDropdown.classList.add('active');
        if (cartOverlay) cartOverlay.classList.add('active');
    }

    function closeCart() {
        if (cartDropdown) cartDropdown.classList.remove('active');
        if (cartOverlay) cartOverlay.classList.remove('active');
    }

    cartBtns.forEach(btn => btn.addEventListener('click', openCart));
    if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (cart.length === 0) return;

            window.location.href = basePath + 'checkout.html';
        });
    }

    updateCartUI();

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn') || e.target.classList.contains('btn--primary')) {
            const btn = e.target;
            const card = btn.closest('.product-card') || btn.closest('.products-slider__card') || document.querySelector('.product-details');

            if (card) {
                e.preventDefault();
                const titleEl = card.querySelector('.product-title') || card.querySelector('.products-slider__name') || document.getElementById('product-title');
                const priceEl = card.querySelector('.sale-price') || card.querySelector('.products-slider__sale') || document.getElementById('product-sale-price');
                const imgEl = card.querySelector('img') || document.getElementById('product-main-image');

                if (titleEl && priceEl && imgEl) {
                    const name = titleEl.textContent.trim();
                    const price = parsePrice(priceEl.textContent);
                    const img = imgEl.getAttribute('src');
                    
                    
                    let qty = 1;
                    const qtyInput = document.getElementById('qty-input');
                    if (qtyInput && card.classList.contains('product-details')) {
                        qty = parseInt(qtyInput.value) || 1;
                    }

                    const existing = cart.find(i => i.name === name);
                    if (existing) {
                        existing.quantity += qty;
                    } else {
                        cart.push({ name, price, img, quantity: qty });
                    }

                    saveCart();
                    updateCartUI();
                    openCart();

                    // Meta Pixel: AddToCart event
                    if (typeof fbq === 'function') {
                        fbq('track', 'AddToCart', {
                            content_name: name,
                            content_type: 'product',
                            value: price * qty,
                            currency: 'INR'
                        });
                    }

                    

                    // Show green "Added" feedback then restore original brown styling
                    const origText = btn.textContent;
                    btn.textContent = 'Added!';
                    btn.style.backgroundColor = '#4caf50';
                    btn.style.color = '#fff';
                    btn.style.borderColor = '#4caf50';
                    setTimeout(() => {
                        btn.textContent = origText;
                        btn.style.backgroundColor = '#4B3621';
                        btn.style.color = '#FAF9F6';
                        btn.style.borderColor = '#4B3621';
                    }, 1500);
                }
            }
        }
    });
})();
