const fs = require('fs');

const srcPath = 'd:\\JS\\accounting-system\\frontend-desktop\\src\\renderer\\views\\sales-returns\\sales-returns.css';
const dstPath = 'd:\\JS\\accounting-system\\frontend-desktop\\src\\renderer\\views\\purchase-returns\\purchase-returns.css';

let css = '';
try {
   css = fs.readFileSync(srcPath, 'utf8');
} catch (e) {
   console.log('sales-returns.css not found, skipping css clone');
   process.exit(0);
}

css = css.replace(/\.sales-/g, '.purchase-');
css = css.replace(/\.customer-/g, '.supplier-');
// Adjust colours since sales is red/green, purchase is orange/teal - actually we only mapped --danger-color to --warning-color in HTML inline styles, but CSS variables are generic.

fs.writeFileSync(dstPath, css, 'utf8');
console.log('CSS cloned successfully!');
