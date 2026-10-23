/* ============================================
   RESTNEST — Landing Page Scripts
   Hero Slider, Scroll Reveal, Interactions
   ============================================ */

// Universal Page Loader Safeguard - guarantees the mattress loader never gets stuck
(function ensurePageLoaderDismissed() {
    function hideLoader() {
        var loader = document.getElementById('page-loader');
        if (loader) {
            loader.classList.remove('active');
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
            loader.style.pointerEvents = 'none';
        }
    }
    if (document.readyState === 'complete') {
        hideLoader();
    } else {
        window.addEventListener('load', hideLoader);
        document.addEventListener('DOMContentLoaded', () => setTimeout(hideLoader, 400));
        setTimeout(hideLoader, 1500); // safety fallback
    }
})();

var basePath = window.basePath || (window.location.pathname.includes('/product/') || window.location.pathname.includes('/cushions/') || window.location.pathname.includes('/pillows/') || window.location.pathname.includes('/about/') || window.location.pathname.includes('/mobile/') || window.location.pathname.includes('/shipping/') || window.location.pathname.includes('/contact/') || window.location.pathname.includes('/terms/') || window.location.pathname.includes('/privacy/') || window.location.pathname.includes('/faqs/') || window.location.pathname.includes('/bulk/') ? '../' : './');
var resolveImg = (url) => url ? (url.startsWith('http') ? url : (basePath + 'assets/' + url)) : '';

function initAll() {
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
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    initAll();
}

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
        
        // Load products lazily when search is opened
        if (!productData) {
            if (window.RESTNEST_PRODUCTS) {
                productData = Object.values(window.RESTNEST_PRODUCTS).filter(p => p && p.title);
            } else {
                const basePath = window.location.pathname.includes('/product/') || window.location.pathname.includes('/cushions/') || window.location.pathname.includes('/pillows/') || window.location.pathname.includes('/about/') ? '../' : './';
                fetch(basePath + 'assets/products.json?v=' + new Date().getTime())
                    .then(res => res.json())
                    .then(data => {
                        productData = Object.values(data).filter(p => p && p.title);
                    })
                    .catch(err => console.error("Error loading products for search", err));
            }
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
            
            const matches = productData.filter(p => p && p.title && p.title.toLowerCase().includes(query));
            matches.sort((a, b) => (a.available === false ? 1 : 0) - (b.available === false ? 1 : 0));
            
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
                    <img src="${resolveImg(p.imgUrl)}" alt="${p.title}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
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
   QUANTITY SELECTOR INITIALIZATION
   ============================================== */
function initQuantitySelector() {
    const qtyMinus = document.getElementById('qty-minus');
    const qtyPlus = document.getElementById('qty-plus');
    const qtyInput = document.getElementById('qty-input');
    
    if (qtyMinus && qtyPlus && qtyInput) {
        if (qtyInput.dataset.qtyBound === 'true') return;
        qtyInput.dataset.qtyBound = 'true';

        qtyMinus.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            let current = parseInt(qtyInput.value, 10) || 1;
            const min = parseInt(qtyInput.min, 10) || 1;
            if (current > min) {
                qtyInput.value = current - 1;
                qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        qtyPlus.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            let current = parseInt(qtyInput.value, 10) || 1;
            const max = parseInt(qtyInput.max, 10) || 10;
            if (current < max) {
                qtyInput.value = current + 1;
                qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Validate manual input
        qtyInput.addEventListener('change', () => {
            let val = parseInt(qtyInput.value, 10) || 1;
            const min = parseInt(qtyInput.min, 10) || 1;
            const max = parseInt(qtyInput.max, 10) || 10;
            if (val < min) val = min;
            if (val > max) val = max;
            qtyInput.value = val;
        });

        // Prevent non-numeric keys
        qtyInput.addEventListener('keydown', (e) => {
            if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                e.preventDefault();
            }
        });
    }
}

/* ==============================================
   PRODUCT PAGE INITIALIZATION
   ============================================== */
async function initProductPage() {
    // Always initialize quantity selector on any product page
    initQuantitySelector();

    if (!document.querySelector('.product-page')) return;

    const urlParams = new URLSearchParams(window.location.search);
    let productId = urlParams.get('id');

    let products = window.RESTNEST_PRODUCTS || window.productsData;
    if (!products) {
        try {
            const response = await fetch('../assets/products.json?v=' + new Date().getTime());
            products = await response.json();
            window.RESTNEST_PRODUCTS = products;
        } catch (error) {
            console.warn("Failed to fetch products.json (likely file:// protocol):", error);
        }
    }

    if (!products) {
        console.warn("Product data unavailable.");
        return;
    }

    window.productsData = products;

    if (!productId) {
        productId = Object.keys(products).find(key => products[key] && products[key].available !== false) || Object.keys(products)[0];
    }

    // --- Alias resolution: if this product is an alias, resolve to the real product ---
    let defaultVariantLabel = null;
    let entry = products[productId];
    if (entry && entry.aliasOf) {
        defaultVariantLabel = entry.defaultVariant || null;
        productId = entry.aliasOf;
        entry = products[productId];
    }

    const product = entry;
    if (!product) {
        document.getElementById('product-title').innerText = "Product Not Found";
        return;
    }
    window.currentProduct = product;

    document.getElementById('product-title').innerText = product.title;
    document.getElementById('product-desc').innerText = product.description;
    document.getElementById('product-sale-price').innerText = product.salePrice;
    document.getElementById('product-original-price').innerText = product.originalPrice;
    document.getElementById('product-discount').innerText = product.discount;
    
    // Determine initial images based on variant
    let activeVariant = null;
    let images = product.images || [product.imgUrl];
    if (product.variants && product.variants.length > 0) {
        if (defaultVariantLabel) {
            activeVariant = product.variants.find(v => v.label === defaultVariantLabel) || product.variants[0];
        } else {
            activeVariant = product.variants[0];
        }
        images = activeVariant.images || images;
        window.currentVariantLabel = activeVariant.label;
    }

    document.getElementById('product-main-image').src = resolveImg(images[0]);
    
    const productInfo = document.querySelector('.product-details');
    if (productInfo && product.variantId) {
        productInfo.setAttribute('data-variant-id', product.variantId);
    }

        // Generate Thumbnails & Arrows
        const thumbnailsContainer = document.getElementById('product-thumbnails');
        let currentImageIndex = 0;
        
        const rebuildGallery = (newImages) => {
            images = newImages;
            currentImageIndex = 0;
            document.getElementById('product-main-image').src = resolveImg(images[0]);
            if (thumbnailsContainer) {
                thumbnailsContainer.innerHTML = '';
                images.forEach((img, index) => {
                    const thumb = document.createElement('div');
                    thumb.className = `thumbnail ${index === 0 ? 'active' : ''}`;
                    thumb.innerHTML = `<img src="${resolveImg(img)}" alt="Thumbnail ${index+1}">`;
                    thumb.addEventListener('click', () => {
                        updateMainImage(index);
                    });
                    thumbnailsContainer.appendChild(thumb);
                });
            }
            // Update arrow visibility
            const prevA = document.getElementById('gallery-prev');
            const nextA = document.getElementById('gallery-next');
            if (prevA && nextA) {
                if (images.length <= 1) {
                    prevA.style.setProperty('display', 'none', 'important');
                    nextA.style.setProperty('display', 'none', 'important');
                } else {
                    prevA.style.removeProperty('display');
                    nextA.style.removeProperty('display');
                }
            }
        };

        const updateMainImage = (index) => {
            currentImageIndex = index;
            document.getElementById('product-main-image').src = resolveImg(images[currentImageIndex]);
            const allThumbs = document.querySelectorAll('.thumbnail');
            allThumbs.forEach((t, i) => {
                t.classList.toggle('active', i === currentImageIndex);
            });
            if (allThumbs[currentImageIndex]) {
                allThumbs[currentImageIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        };

        const prevArrow = document.getElementById('gallery-prev');
        const nextArrow = document.getElementById('gallery-next');
        
        if (prevArrow && nextArrow) {
            if (images.length <= 1) {
                prevArrow.style.setProperty('display', 'none', 'important');
                nextArrow.style.setProperty('display', 'none', 'important');
            } else {
                prevArrow.addEventListener('click', () => {
                    let nextIndex = currentImageIndex - 1;
                    if (nextIndex < 0) nextIndex = images.length - 1;
                    updateMainImage(nextIndex);
                });
                
                nextArrow.addEventListener('click', () => {
                    let nextIndex = currentImageIndex + 1;
                    if (nextIndex >= images.length) nextIndex = 0;
                    updateMainImage(nextIndex);
                });
            }
        }

        if (thumbnailsContainer) {
            thumbnailsContainer.innerHTML = '';
            images.forEach((img, index) => {
                const thumb = document.createElement('div');
                thumb.className = `thumbnail ${index === 0 ? 'active' : ''}`;
                thumb.innerHTML = `<img src="${resolveImg(img)}" alt="Thumbnail ${index+1}">`;
                
                thumb.addEventListener('click', () => {
                    updateMainImage(index);
                });
                
                thumbnailsContainer.appendChild(thumb);
            });
        }

        // --- Variant Selector (color swatches) ---
        if (product.variants && product.variants.length > 1) {
            const variantSection = document.createElement('div');
            variantSection.id = 'product-variant-section';
            variantSection.style.cssText = 'margin-top: 1.25rem;';
            variantSection.innerHTML = `<h4 class="product-options__label" style="font-size: 0.95rem; margin-bottom: 0.5rem; color: #4B3621;">Color: <span id="selected-variant-label" style="font-weight: 600; color: #4B3621;">${activeVariant ? activeVariant.label : ''}</span></h4>`;
            const variantWrap = document.createElement('div');
            variantWrap.style.cssText = 'display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.5rem;';

            product.variants.forEach((variant) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                const isSelected = variant.label === (activeVariant && activeVariant.label);
                btn.className = 'variant-swatch-btn' + (isSelected ? ' active' : '');
                btn.setAttribute('data-variant', variant.label);
                btn.style.cssText = `
                    display: flex; align-items: center; gap: 0.6rem;
                    padding: 0.55rem 1.15rem; border-radius: 8px; cursor: pointer;
                    border: 2px solid ${isSelected ? '#4B3621' : '#d4c8bc'};
                    background: ${isSelected ? '#F5EFE6' : '#FAF9F6'};
                    transition: all 0.25s ease;
                    font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500; color: #4B3621;
                    box-shadow: ${isSelected ? '0 2px 6px rgba(75, 54, 33, 0.12)' : 'none'};
                `;
                const swatch = document.createElement('span');
                swatch.style.cssText = `
                    width: 22px; height: 22px; border-radius: 50%;
                    background: ${variant.color || '#ccc'};
                    border: 2px solid rgba(0,0,0,0.12); flex-shrink: 0;
                    ${variant.color === '#f5f0eb' ? 'box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15);' : ''}
                `;
                btn.appendChild(swatch);
                btn.appendChild(document.createTextNode(variant.label));

                btn.addEventListener('mouseenter', () => {
                    if (!btn.classList.contains('active')) {
                        btn.style.borderColor = '#8B7355';
                    }
                });
                btn.addEventListener('mouseleave', () => {
                    if (!btn.classList.contains('active')) {
                        btn.style.borderColor = '#d4c8bc';
                    }
                });

                btn.addEventListener('click', () => {
                    // Update active state
                    variantWrap.querySelectorAll('.variant-swatch-btn').forEach(b => {
                        b.classList.remove('active');
                        b.style.borderColor = '#d4c8bc';
                        b.style.background = '#FAF9F6';
                        b.style.boxShadow = 'none';
                    });
                    btn.classList.add('active');
                    btn.style.borderColor = '#4B3621';
                    btn.style.background = '#F5EFE6';
                    btn.style.boxShadow = '0 2px 6px rgba(75, 54, 33, 0.12)';
                    // Update selected variant label display
                    const labelSpan = document.getElementById('selected-variant-label');
                    if (labelSpan) labelSpan.textContent = variant.label;
                    // Swap gallery
                    rebuildGallery(variant.images || product.images || [product.imgUrl]);
                    // Update window variant tracking
                    window.currentVariantLabel = variant.label;
                });

                variantWrap.appendChild(btn);
            });
            variantSection.appendChild(variantWrap);

            // Insert before benefits or quantity
            const benefitsSec = document.getElementById('product-benefits-section');
            const quantitySec = document.querySelector('.product-quantity');
            const insertBefore = benefitsSec || quantitySec;
            if (insertBefore && insertBefore.parentNode) {
                insertBefore.parentNode.insertBefore(variantSection, insertBefore);
            }
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

        if (product.available === false) {
            if (addToCartBtn) {
                addToCartBtn.innerHTML = 'Out of Stock';
                addToCartBtn.disabled = true;
                addToCartBtn.style.cursor = 'not-allowed';
                addToCartBtn.style.opacity = '0.5';
                addToCartBtn.classList.remove('add-to-cart-btn');
                addToCartBtn.classList.remove('btn--primary');
            }
            const buyNowBtn = document.querySelector('.product-actions .buy-now-btn');
            if (buyNowBtn) {
                buyNowBtn.style.display = 'none';
            }
            // Hide quantity selector for out-of-stock products
            const qtySection = document.querySelector('.product-quantity');
            if (qtySection) {
                qtySection.style.display = 'none';
            }
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
    
    const isSoldOut = (card) => {
        const btn = card.querySelector('button');
        return btn && (btn.disabled || btn.textContent.toLowerCase().includes('out of stock'));
    };

    sortSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        let sortedCards = [...cards];

        sortedCards.sort((a, b) => {
            const aSold = isSoldOut(a) ? 1 : 0;
            const bSold = isSoldOut(b) ? 1 : 0;
            if (aSold !== bSold) return aSold - bSold;

            if (val === 'most-selling') {
                return (parseInt(a.dataset.order) || 0) - (parseInt(b.dataset.order) || 0);
            } else if (val === 'price-low') {
                return (parseFloat(a.dataset.price) || 0) - (parseFloat(b.dataset.price) || 0);
            } else if (val === 'price-high') {
                return (parseFloat(b.dataset.price) || 0) - (parseFloat(a.dataset.price) || 0);
            } else if (val === 'a-z') {
                return (a.dataset.title || '').localeCompare(b.dataset.title || '');
            } else if (val === 'z-a') {
                return (b.dataset.title || '').localeCompare(a.dataset.title || '');
            }
            return 0;
        });

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

            // Clear buy-now so cart checkout uses actual cart items
            localStorage.removeItem('restnest_buy_now');
            sessionStorage.removeItem('restnest_buy_now');

            window.location.href = basePath + 'checkout.html';
        });
    }

    updateCartUI();

    document.addEventListener('click', (e) => {
        // Prevent Buy Now buttons from triggering regular Add to Cart
        if (e.target.closest('.buy-now-btn')) return;

        // Strictly target .add-to-cart-btn (never unrelated .btn--primary like #writeReviewBtn or #submitReviewBtn)
        const btn = e.target.closest('.add-to-cart-btn');
        if (!btn || btn.disabled) return;

        const card = btn.closest('.product-card') || btn.closest('.products-slider__card') || document.querySelector('.product-details');

            if (card) {
                e.preventDefault();
                const titleEl = card.querySelector('.product-title') || card.querySelector('.products-slider__name') || document.getElementById('product-title');
                const priceEl = card.querySelector('.sale-price') || card.querySelector('.products-slider__sale') || document.getElementById('product-sale-price');
                const imgEl = card.querySelector('img') || document.getElementById('product-main-image');

                if (titleEl && priceEl && imgEl) {
                    let name = titleEl.textContent.trim();
                    if (window.currentVariantLabel && (card.classList.contains('product-details') || document.querySelector('.product-page'))) {
                        name = `${name} (${window.currentVariantLabel})`;
                    }
                    const price = parsePrice(priceEl.textContent) || 899.0;
                    const img = imgEl.getAttribute('src');
                    
                    let qty = 1;
                    const qtyInput = document.getElementById('qty-input');
                    if (qtyInput && (card.classList.contains('product-details') || document.querySelector('.product-page'))) {
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
                    const origHTML = btn.innerHTML;
                    btn.textContent = 'Added!';
                    btn.style.backgroundColor = '#4caf50';
                    btn.style.color = '#fff';
                    btn.style.borderColor = '#4caf50';
                    setTimeout(() => {
                        btn.innerHTML = origHTML;
                        btn.style.backgroundColor = '#4B3621';
                        btn.style.color = '#FAF9F6';
                        btn.style.borderColor = '#4B3621';
                    }, 1500);
                }
            }
    });

    const CATALOG_FALLBACK_PRICES = {
        "White Fiber Pillow": 899.0,
        "Serene Everyday Comfort Pillow": 899.0,
        "White Latex Pillow": 899.0,
        "Honeycomb Pillow": 899.0,
        "Ridge Textured Comfort Pillow": 899.0,
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
        "Slim Pillow": 899.0,
        "Form Slim Microfiber Pillow": 899.0,
        "Slim Microfiber Pillow": 1014.0,
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
        "Honeycomb Cushion": 899.0,
        "Glace Cotton Cushion": 899.0,
        "Slim Pipe Cushion": 899.0,
        "Soft Cushion Pack Of 2": 1065.0,
        "Orthopedic Cervical Memory Foam Cushion": 1175.0,
        "Slim Microfiber Cushion": 1014.0,
        "Premium White Glace Cotton Cushions": 1140.0,
        "ContourCare™ Memory Foam Pillow": 1175.0,
        "ContourCare Memory Foam Pillow": 1175.0,
        "ContourCare™ Memory Foam Cushion": 1270.0,
        "ContourCare Memory Foam Cushion": 1270.0,
        "White & Gold Glace Cotton Sleeping Pillows": 1110.0,
        "White & Gold Glace Cotton Sleeping Cushions": 1270.0,
        "Blue & White Polycotton Pillow": 1110.0,
        "Blue & White Polycotton Cushion": 1175.0,
        "Premium Polycotton Pillow With Recron Fiber Filling": 964.0,
        "Premium White Sleeping Cushion": 1386.0,
        "16x16 White Stripe Soft Cushions": 1110.0
    };

    // Buy Now: stores only this product and goes straight to checkout
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.buy-now-btn');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();

        const card = btn.closest('.product-card') || btn.closest('.products-slider__card') || document.querySelector('.product-details');
        const isProductDetailPage = !!document.querySelector('.product-page');

        let name = '';
        let price = 0;
        let img = '';
        let qty = 1;

        if (isProductDetailPage) {
            // Product detail page
            if (window.currentProduct) {
                name = window.currentProduct.title || '';
                price = parsePrice(window.currentProduct.salePrice || '');
                img = (window.currentProduct.images && window.currentProduct.images[0]) || window.currentProduct.imgUrl || '';
            }

            if (!name || name === 'Loading...') {
                const titleEl = document.getElementById('product-title');
                if (titleEl && titleEl.innerText.trim() && titleEl.innerText.trim() !== 'Loading...') {
                    name = titleEl.innerText.trim();
                }
            }

            if (window.currentVariantLabel && name && !name.includes(`(${window.currentVariantLabel})`)) {
                name = `${name} (${window.currentVariantLabel})`;
            }

            if (!price || price <= 0) {
                const priceEl = document.getElementById('product-sale-price');
                if (priceEl) price = parsePrice(priceEl.innerText);
            }

            const mainImgEl = document.getElementById('product-main-image');
            if (mainImgEl && mainImgEl.getAttribute('src')) {
                img = mainImgEl.getAttribute('src');
            } else if (!img) {
                img = '';
            }

            const qtyInput = document.getElementById('qty-input');
            if (qtyInput) {
                qty = parseInt(qtyInput.value, 10) || 1;
            }
        } else if (card) {
            // Card on category/home/slider page
            name = card.dataset.title || '';
            if (!name) {
                const titleEl = card.querySelector('.products-slider__name') || card.querySelector('.product-title');
                if (titleEl) name = titleEl.textContent.trim();
            }

            if (card.dataset.price) {
                price = parseFloat(card.dataset.price) || 0;
            }
            if (!price || price <= 0) {
                const priceEl = card.querySelector('.products-slider__sale') || card.querySelector('.sale-price');
                if (priceEl) price = parsePrice(priceEl.textContent);
            }

            const imgEl = card.querySelector('img');
            if (imgEl) img = imgEl.getAttribute('src') || '';
        }

        // Clean & ensure valid title
        name = name.trim();
        if (!name || name === 'Loading...') {
            name = 'Rest Nest Premium Pillow';
        }

        // Clean & ensure non-zero price
        if (!price || price <= 0 || isNaN(price)) {
            const stripped = name.replace(/^Rest Nest\s+/i, '').trim();
            price = CATALOG_FALLBACK_PRICES[name] || CATALOG_FALLBACK_PRICES[stripped] || 899.0;
        }

        // Clean image path
        if (img) {
            img = img.replace(/^(\.\.\/)+/, '').replace(/^(\.\/)+/, '');
        }
        if (!img || img === 'sold_out.jpg') {
            img = 'assets/logo-nav.png';
        } else if (!img.startsWith('assets/') && !img.startsWith('http') && !img.startsWith('/')) {
            img = 'assets/' + img;
        }

        if (qty < 1 || isNaN(qty)) qty = 1;

        // Store as single-item array in restnest_buy_now
        const buyNowItem = [{ name, price, img, quantity: qty }];
        localStorage.setItem('restnest_buy_now', JSON.stringify(buyNowItem));
        sessionStorage.setItem('restnest_buy_now', JSON.stringify(buyNowItem));

        // Meta Pixel: InitiateCheckout event
        if (typeof fbq === 'function') {
            fbq('track', 'InitiateCheckout', {
                content_name: name,
                content_type: 'product',
                value: price * qty,
                currency: 'INR'
            });
        }

        window.location.href = basePath + 'checkout.html';
    });

    // Disable Buy Now button when product is out of stock
    const outOfStockBtn = document.querySelector('.product-actions .btn--primary[disabled]');
    if (outOfStockBtn) {
        const buyNowBtn = document.querySelector('.product-actions .buy-now-btn');
        if (buyNowBtn) {
            buyNowBtn.disabled = true;
            buyNowBtn.style.cursor = 'not-allowed';
            buyNowBtn.style.opacity = '0.5';
        }
    }
})();
