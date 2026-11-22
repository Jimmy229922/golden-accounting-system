const fs = require('fs');
['dashboard/dashboard.css', 'items/items.css', 'customers/customers.css', 'opening-balance/opening-balance.css'].forEach(file => {
    let fullPath = 'd:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\views\\\\' + file.replace(/\//g, '\\\\');
    if (!fs.existsSync(fullPath)) return;
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Remove :root
    content = content.replace(/:root\s*\{[\s\S]*?\n\}/g, '');
    
    // Remove [data-theme="dark"] ONLY IF it contains --dash-gradient or --items-gradient 
    // Wait, the earlier CSS files had variables inside [data-theme="dark"] that we moved.
    // Dashboard had :root and [data-theme="dark"] var overrides at the top. Let's just remove the first [data-theme="dark"] occurring if it contains variables.
    content = content.replace(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/g, (match) => {
        if(match.includes('--dash-gradient') || match.includes('--items-gradient') || match.includes('--card-bg')) {
            return '';
        }
        return match; // keep if it contains normal CSS rules like .table tbody hover etc.
    });

    content = content.replace(/(?:\r?\n){3,}/g, '\n\n'); // clean multiple empty lines
    content = content.replace(/^\s*\n/gm, ''); // clean leading empty lines if any

    fs.writeFileSync(fullPath, content);
    console.log("Cleaned:", fullPath);
});
