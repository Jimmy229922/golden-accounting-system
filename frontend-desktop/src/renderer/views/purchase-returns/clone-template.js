const fs = require('fs');
const sourcePath = 'd:\\JS\\accounting-system\\frontend-desktop\\src\\renderer\\views\\sales-returns\\sales-returns.render.js';
const targetPath = 'd:\\JS\\accounting-system\\frontend-desktop\\src\\renderer\\views\\purchase-returns\\purchase-returns.render.js';

let content = fs.readFileSync(sourcePath, 'utf8');

// Replace identifiers
content = content.replace(/salesReturns/g, 'purchaseReturns');
content = content.replace(/sales-/g, 'purchase-');
content = content.replace(/salesContent/g, 'purchaseContent'); // in case
content = content.replace(/customerSelect/g, 'supplierSelect');
content = content.replace(/Customer/g, 'Supplier');
content = content.replace(/customer-due-value/g, 'supplier-due-value');
content = content.replace(/sale_price/g, 'cost_price');

// Replace Arabic text
content = content.replace(/مردودات المبيعات/g, 'مردودات المشتريات');
content = content.replace(/مرتجع مبيعات/g, 'مرتجع مشتريات');
content = content.replace(/العميل/g, 'المورد');
content = content.replace(/الكمية المباعة/g, 'الكمية المشتراة');
// Adjust subtle text changes
content = content.replace(/للفواتير/g, 'لفواتير الشراء');

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Template cloned successfully!');
