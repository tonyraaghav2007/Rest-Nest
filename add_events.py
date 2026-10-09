import os

# 1. script.js - AddToCart and ViewContent
script_path = r'c:\Users\legion-5pro\Documents\restie\script.js'
with open(script_path, 'r', encoding='utf-8') as f:
    content = f.read()

view_content_snippet = """        document.title = product.title + " – Cloudrest";

        // Meta Pixel: ViewContent event
        if (typeof fbq === 'function') {
            fbq('track', 'ViewContent', {
                content_name: product.title,
                content_category: 'product',
                value: parsePrice(product.salePrice),
                currency: 'INR'
            });
        }"""
content = content.replace('        document.title = product.title + " – Cloudrest";', view_content_snippet)

add_to_cart_snippet = """                    saveCart();
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
                    }"""
content = content.replace('                    saveCart();\n                    updateCartUI();\n                    openCart();', add_to_cart_snippet)

with open(script_path, 'w', encoding='utf-8') as f:
    f.write(content)


# 2. mobile/index.html - AddToCart
mobile_path = r'c:\Users\legion-5pro\Documents\restie\mobile\index.html'
with open(mobile_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('                    saveCart();\n                    updateCartUI();\n                    openCart();', add_to_cart_snippet)

with open(mobile_path, 'w', encoding='utf-8') as f:
    f.write(content)


# 3. checkout.js - InitiateCheckout and Purchase
checkout_path = r'c:\Users\legion-5pro\Documents\restie\checkout.js'
with open(checkout_path, 'r', encoding='utf-8') as f:
    content = f.read()

init_checkout_snippet = """    subtotalEl.textContent = formatPrice(totalAmount);
    totalEl.textContent = formatPrice(totalAmount);

    // Meta Pixel: InitiateCheckout event
    if (typeof fbq === 'function') {
        fbq('track', 'InitiateCheckout', {
            content_type: 'product',
            num_items: cart.reduce((sum, item) => sum + item.quantity, 0),
            value: totalAmount,
            currency: 'INR'
        });
    }"""
content = content.replace('    subtotalEl.textContent = formatPrice(totalAmount);\n    totalEl.textContent = formatPrice(totalAmount);', init_checkout_snippet)

purchase_snippet = """            showStatus('Order placed successfully! Redirecting...', 'success');

            // Meta Pixel: Purchase event
            if (typeof fbq === 'function') {
                fbq('track', 'Purchase', {
                    content_type: 'product',
                    num_items: cart.reduce((sum, item) => sum + item.quantity, 0),
                    value: totalAmount,
                    currency: 'INR'
                });
            }"""
content = content.replace("            showStatus('Order placed successfully! Redirecting...', 'success');", purchase_snippet)

with open(checkout_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Events successfully added.")
