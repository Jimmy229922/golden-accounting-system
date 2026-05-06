const fs = require('fs');
const path = require('path');
const dir = 'd:/JS/accounting-system/frontend-desktop/src/renderer/views';

function walk(rootDir) {
    const files = [];
    for (const file of fs.readdirSync(rootDir, { withFileTypes: true })) {
        const fullPath = path.join(rootDir, file.name);
        if (file.isDirectory()) {
            files.push(...walk(fullPath));
        } else if (fullPath.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    return files;
}

let count = 0;
const files = walk(dir);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if it has dir="rtl" on html
    if (content.includes('dir="rtl"') && content.includes('<html')) {
        // Remove dir="rtl" from html
        content = content.replace(/<html([^>]*)dir="rtl"([^>]*)>/i, '<html$1$2>');
        
        // Add dir="rtl" to body
        content = content.replace(/<body([^>]*)>/i, '<body$1 dir="rtl">');
        
        fs.writeFileSync(file, content);
        count++;
    }
});

console.log(`Updated ${count} html files.`);