const fs = require('fs');

['purchases/purchases.render.js', 'sales-returns/sales-returns.render.js', 'purchase-returns/purchase-returns.render.js'].forEach(file => {
    try {
        const fullPath = 'd:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\views\\\\' + file;
        let c = fs.readFileSync(fullPath, 'utf8');
        
        c = c.replace('row.innerHTML = `\n                <td>', 'row.innerHTML = `\n                <td class="row-index"></td>\n                <td>');
        
        fs.writeFileSync(fullPath, c, 'utf8');
        console.log('patched ' + file);
    } catch(e) {
        console.error(e);
    }
});

// For Sales Returns and Purchase Returns, let's fix the badge insertion.
['sales-returns/sales-returns.render.js', 'purchase-returns/purchase-returns.render.js'].forEach(file => {
    try {
        const fullPath = 'd:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\views\\\\' + file;
        let c = fs.readFileSync(fullPath, 'utf8');
        
        const targetStr = '${item.item_name || t(\'common.state.deletedItem\', \'Deleted Item\')}';
        
        if (c.includes(targetStr) && !c.includes('<span class="item-stock-badge empty"')) {
            c = c.replace(targetStr, targetStr + `\n                    <span class="item-stock-badge empty" data-item-id="\${item.item_id}"></span>`);
            fs.writeFileSync(fullPath, c, 'utf8');
            console.log('added badge ' + file);
        }
    } catch(e) {}
});
