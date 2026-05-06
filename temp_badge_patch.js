const fs = require('fs');

function patchSales() {
    const file = 'd:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\views\\\\sales\\\\sales.bootstrap.js';
    let content = fs.readFileSync(file, 'utf8');

    const old1 = `    if (enteredQty > 0) {
        const remainingQty = Math.max(availableQty - enteredQty, 0);
        const overQty = Math.max(enteredQty - availableQty, 0);
        if (overQty > 0) {
            salesState.dom.selectedItemAvailability.classList.add('has-overage');
            salesState.dom.selectedItemAvailability.innerHTML = \`المتاح: \${formatQty(availableQty)} | المتبقي بعد الإدخال: \${formatQty(remainingQty)} | <span class="selected-item-overage">يوجد \${formatQty(overQty)} زيادة</span>\`;
            return;
        }

        salesState.dom.selectedItemAvailability.classList.remove('has-overage');
        salesState.dom.selectedItemAvailability.textContent = \`المتاح: \${formatQty(availableQty)} | المتبقي بعد الإدخال: \${formatQty(remainingQty)}\`;
        return;
    }

    salesState.dom.selectedItemAvailability.classList.remove('has-overage');
    salesState.dom.selectedItemAvailability.textContent = \`المتاح: \${formatQty(availableQty)}\`;
}`;

    const new1 = `    const badge = row.querySelector('.item-stock-badge');

    if (enteredQty > 0) {
        const remainingQty = Math.max(availableQty - enteredQty, 0);
        const overQty = Math.max(enteredQty - availableQty, 0);
        
        if (badge) {
            badge.className = overQty > 0 ? 'item-stock-badge warning' : 'item-stock-badge';
            badge.textContent = overQty > 0 ? \`متبقي: \${formatQty(remainingQty)} | زائد: \${formatQty(overQty)}\` : \`متبقي: \${formatQty(remainingQty)}\`;
        }

        if (overQty > 0) {
            if (salesState.dom.selectedItemAvailability) {
                salesState.dom.selectedItemAvailability.classList.add('has-overage');
                salesState.dom.selectedItemAvailability.innerHTML = \`المتاح: \${formatQty(availableQty)} | المتبقي بعد الإدخال: \${formatQty(remainingQty)} | <span class="selected-item-overage">يوجد \${formatQty(overQty)} زيادة</span>\`;
            }
            return;
        }

        if (salesState.dom.selectedItemAvailability) {
            salesState.dom.selectedItemAvailability.classList.remove('has-overage');
            salesState.dom.selectedItemAvailability.textContent = \`المتاح: \${formatQty(availableQty)} | المتبقي بعد الإدخال: \${formatQty(remainingQty)}\`;
        }
        return;
    }

    if (badge) {
        badge.className = 'item-stock-badge';
        badge.textContent = \`الحالي: \${formatQty(availableQty)}\`;
    }

    if (salesState.dom.selectedItemAvailability) {
        salesState.dom.selectedItemAvailability.classList.remove('has-overage');
        salesState.dom.selectedItemAvailability.textContent = \`المتاح: \${formatQty(availableQty)}\`;
    }
}`;

    content = content.replace(old1, new1);
    fs.writeFileSync(file, content, 'utf8');
}

function patchPurchases() {
    const file = 'd:\\\\JS\\\\accounting-system\\\\frontend-desktop\\\\src\\\\renderer\\\\views\\\\purchases\\\\purchases.js';
    let content = fs.readFileSync(file, 'utf8');

    const old1 = `    if (enteredQty > 0) {
        const expectedQty = availableQty + enteredQty;
        purchasesState.dom.selectedItemAvailability.textContent = \`المتاح الحالي: \${formatQty(availableQty)} | المتوقع بعد الإدخال: \${formatQty(expectedQty)}\`;
        return;
    }

    purchasesState.dom.selectedItemAvailability.textContent = \`المتاح الحالي: \${formatQty(availableQty)}\`;
}`;

    const new1 = `    const badge = row.querySelector('.item-stock-badge');

    if (enteredQty > 0) {
        const expectedQty = availableQty + enteredQty;
        if (badge) {
            badge.className = 'item-stock-badge';
            badge.textContent = \`المتوقع: \${formatQty(expectedQty)}\`;
        }
        if (purchasesState.dom.selectedItemAvailability) {
            purchasesState.dom.selectedItemAvailability.textContent = \`المتاح الحالي: \${formatQty(availableQty)} | المتوقع بعد الإدخال: \${formatQty(expectedQty)}\`;
        }
        return;
    }

    if (badge) {
        badge.className = 'item-stock-badge';
        badge.textContent = \`الحالي: \${formatQty(availableQty)}\`;
    }
    if (purchasesState.dom.selectedItemAvailability) {
        purchasesState.dom.selectedItemAvailability.textContent = \`المتاح الحالي: \${formatQty(availableQty)}\`;
    }
}`;

    content = content.replace(old1, new1);
    fs.writeFileSync(file, content, 'utf8');
}

patchSales();
patchPurchases();
console.log('patched successfully');
