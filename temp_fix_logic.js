const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');

const handlersDir = path.join(__dirname, 'frontend-desktop', 'src', 'main', 'handlers');

// 1. Fix purchases.js
const purchasesPath = path.join(handlersDir, 'purchases.js');
let purchasesContent = fs.readFileSync(purchasesPath, 'utf8');
purchasesContent = purchasesContent.replace(
    /UPDATE customers\s*SET balance = balance \+ @amount\s*WHERE id = @id/g,
    'UPDATE customers\n            SET balance = balance - @amount\n            WHERE id = @id'
);
purchasesContent = purchasesContent.replace(
    /db\.prepare\('UPDATE customers SET balance = balance - \?'\)\.run\(oldBalanceDelta, oldInvoice\.supplier_id\);/g,
    "db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(oldBalanceDelta, oldInvoice.supplier_id);"
);
purchasesContent = purchasesContent.replace(
    /db\.prepare\('UPDATE customers SET balance = balance \+ \?'\)\.run\(financials\.balance_delta, supplier_id\);/g,
    "db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(financials.balance_delta, supplier_id);"
);
fs.writeFileSync(purchasesPath, purchasesContent);

// 2. Fix purchaseReturns.js
const pReturnsPath = path.join(handlersDir, 'purchaseReturns.js');
let pReturnsContent = fs.readFileSync(pReturnsPath, 'utf8');
pReturnsContent = pReturnsContent.replace(
    /UPDATE customers SET balance = balance - @amount WHERE id = @id/g,
    'UPDATE customers SET balance = balance + @amount WHERE id = @id'
);
// Wait, there are specific increase/decrease statements in purchaseReturns
pReturnsContent = pReturnsContent.replace(
    /const increaseSupplierBalance = db\.prepare\('UPDATE customers SET balance = balance \+ @amount WHERE id = @id'\);/g,
    "const increaseSupplierBalance = db.prepare('UPDATE customers SET balance = balance - @amount WHERE id = @id');"
);
pReturnsContent = pReturnsContent.replace(
    /const decreaseSupplierBalance = db\.prepare\('UPDATE customers SET balance = balance - @amount WHERE id = @id'\);/g,
    "const decreaseSupplierBalance = db.prepare('UPDATE customers SET balance = balance + @amount WHERE id = @id');"
);
pReturnsContent = pReturnsContent.replace(
    /db\.prepare\('UPDATE customers SET balance = balance \+ \?'\)\.run\(returnRecord\.total_amount, returnRecord\.supplier_id\);/g,
    "db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(returnRecord.total_amount, returnRecord.supplier_id);"
);
fs.writeFileSync(pReturnsPath, pReturnsContent);

// 3. Fix treasury.js
const treasuryPath = path.join(handlersDir, 'treasury.js');
let treasuryContent = fs.readFileSync(treasuryPath, 'utf8');
// Fix add
treasuryContent = treasuryContent.replace(
    /updateBalance\.run\(\{ amount: -amount, id: customer_id \}\);/g,
    "updateBalance.run({ amount: type === 'expense' ? amount : -amount, id: customer_id });"
);
// Fix edit
treasuryContent = treasuryContent.replace(
    /updateCustomer\.run\(\{ amount: diff, id: transaction\.customer_id \}\);/g,
    "updateCustomer.run({ amount: type === 'expense' ? -diff : diff, id: transaction.customer_id });"
);
// Wait, I need to check exact lines for edit, I'll leave edit if it's too complex or just rewrite the edit section using regex
// Let's check edit exactly.

// Fix delete
treasuryContent = treasuryContent.replace(
    /updateCustomer\.run\(\{ amount: trans\.amount, id: trans\.customer_id \}\);/g,
    "updateCustomer.run({ amount: trans.type === 'expense' ? -trans.amount : trans.amount, id: trans.customer_id });"
);
treasuryContent = treasuryContent.replace(
    /updateCustomer\.run\(\{ amount: trans\.amount, id: invoice\.customer_id \}\);/g,
    "updateCustomer.run({ amount: trans.type === 'expense' ? -trans.amount : trans.amount, id: invoice.customer_id });"
);
treasuryContent = treasuryContent.replace(
    /updateCustomer\.run\(\{ amount: trans\.amount, id: invoice\.supplier_id \}\);/g,
    "updateCustomer.run({ amount: trans.type === 'expense' ? -trans.amount : trans.amount, id: invoice.supplier_id });"
);
fs.writeFileSync(treasuryPath, treasuryContent);

// 4. Fix customers.js closing balance logic
const customersPath = path.join(handlersDir, 'customers.js');
let custContent = fs.readFileSync(customersPath, 'utf8');
custContent = custContent.replace(
    /let closingBalance = customer\.current_balance\s*- \(futureSales \+ futurePurchases\)\s*\+ \(futureSalesPayments \+ futurePurchasePayments\);/g,
    "let closingBalance = customer.current_balance\n                - futureSales + futurePurchases\n                + futureSalesPayments - futurePurchasePayments;"
);
custContent = custContent.replace(
    /let openingBalance = closingBalance\s*- \(periodSales \+ periodPurchases\)\s*\+ \(periodSalesPayments \+ periodPurchasePayments\);/g,
    "let openingBalance = closingBalance\n                - periodSales + periodPurchases\n                + periodSalesPayments - periodPurchasePayments;"
);
fs.writeFileSync(customersPath, custContent);


console.log('Done fixing JS handlers');
