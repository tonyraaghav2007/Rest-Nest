const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlFiles = [
    'index.html',
    'pillows.html',
    'mobile/index.html',
    'pillows/index.html',
    'cushions/index.html'
];
const jsonFile = 'assets/products.json';
const serverFile = 'server/index.js';

function cleanTitle(title) {
    let decoded = title.replace(/&amp;/g, '&');
    if (decoded.includes(' | ')) decoded = decoded.split(' | ')[0];
    if (decoded.includes(' – ')) decoded = decoded.split(' – ')[0];
    if (decoded.includes(' - ')) decoded = decoded.split(' - ')[0];
    decoded = decoded.replace(/^Rest\s*Nest\s+/i, '');
    return decoded.trim();
}

htmlFiles.forEach(file => {
    let p = path.join(dir, file);
    if (!fs.existsSync(p)) return;
    let content = fs.readFileSync(p, 'utf8');
    
    content = content.replace(/data-title="([^"]+)"/g, (match, p1) => {
        let newTitle = cleanTitle(p1).replace(/&/g, '&amp;');
        return `data-title="${newTitle}"`;
    });
    
    content = content.replace(/(<h3[^>]*class="products-slider__name"[^>]*>)(.*?)(<\/h3>)/gs, (match, p1, p2, p3) => {
        let newTitle = cleanTitle(p2).replace(/&/g, '&amp;');
        return `${p1}${newTitle}${p3}`;
    });
    
    content = content.replace(/alt="([^"]+)"/g, (match, p1) => {
        if (p1.includes(' | ') || p1.includes(' – ') || p1.includes(' - ')) {
            let newTitle = cleanTitle(p1).replace(/&/g, '&amp;');
            return `alt="${newTitle}"`;
        }
        return match;
    });

    fs.writeFileSync(p, content, 'utf8');
    console.log(`Updated ${file}`);
});

let jsonPath = path.join(dir, jsonFile);
let products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
for (let key in products) {
    if (products[key].title) {
        products[key].title = cleanTitle(products[key].title);
    }
}
fs.writeFileSync(jsonPath, JSON.stringify(products, null, 4), 'utf8');
console.log(`Updated ${jsonFile}`);

let serverPath = path.join(dir, serverFile);
let serverContent = fs.readFileSync(serverPath, 'utf8');
serverContent = serverContent.replace(/"([^"]+)": ([0-9.]+)/g, (match, p1, p2) => {
    if (p1.includes('Pillow') || p1.includes('Cushion') || p1.includes(' | ') || p1.includes(' – ')) {
        let newTitle = cleanTitle(p1);
        return `"${newTitle}": ${p2}`;
    }
    return match;
});
fs.writeFileSync(serverPath, serverContent, 'utf8');
console.log(`Updated ${serverFile}`);
