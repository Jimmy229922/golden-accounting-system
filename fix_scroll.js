const fs = require('fs');
const path = require('path');
const root = 'd:/JS/accounting-system/frontend-desktop/src/renderer/views';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if(file.endsWith('.html')) results.push(file);
        }
    });
    return results;
}

const files = walk(root);
let count = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;
    
    // 1. Ensure <html ... dir="ltr">
    content = content.replace(/<html([^>]*)>/i, (match, p1) => {
        let inner = p1.replace(/dir\s*=\s*['"][^'"]*['"]/gi, '').trim();
        return `<html ${inner} dir="ltr">`;
    });
    
    // 2. Ensure <body ... dir="rtl">
    content = content.replace(/<body([^>]*)>/i, (match, p1) => {
        let inner = p1.replace(/dir\s*=\s*['"][^'"]*['"]/gi, '').trim();
        return `<body ${inner} dir="rtl">`;
    });

    if (content !== original) {
        fs.writeFileSync(f, content);
        count++;
    }
});

console.log(`Updated ${count} HTML files to strictly use html[dir=ltr] and body[dir=rtl].`);