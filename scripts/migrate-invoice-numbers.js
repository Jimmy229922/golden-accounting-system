/**
 * Migration Script: Update Invoice/Voucher Numbers to New Format
 * 
 * Old Format → New Format:
 * - Sales: numeric → SL-0001
 * - Purchase: numeric → PC-0001
 * - Sales Return: SR-001 → SR-0001
 * - Purchase Return: PR-001 → PR-0001
 * - Receipt: REC-00001 → RC-0001
 * - Payment: PAY-00001 → PY-0001
 */

const path = require('path');
const Database = require('better-sqlite3');
const os = require('os');
const fs = require('fs');

// Determine database path - try multiple locations
const homeDir = os.homedir();
const possiblePaths = [
    // 1. Electron userData path (accounting-system)
    path.join(homeDir, 'AppData', 'Roaming', 'accounting-system', 'accounting.db'),
    // 2. Electron userData path (accounting-system-desktop)
    path.join(homeDir, 'AppData', 'Roaming', 'accounting-system-desktop', 'accounting.db'),
    // 3. Custom data folder
    path.join(homeDir, 'accounting-system-data', 'accounting.db'),
    // 4. Command line argument
    process.argv[2]
].filter(p => p); // Remove undefined

console.log('🚀 Starting Invoice Number Migration...');
console.log('🔍 Searching for database...\n');

// Find existing database
let dbPath = null;
for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
        dbPath = testPath;
        console.log(`✅ Found database: ${dbPath}\n`);
        break;
    }
}

if (!dbPath) {
    console.error('❌ Database not found!');
    console.error('\nSearched in:');
    possiblePaths.forEach(p => console.error(`  - ${p}`));
    console.error('\n💡 You can specify the path manually:');
    console.error('   node scripts/migrate-invoice-numbers.js "C:\\path\\to\\accounting.db"');
    process.exit(1);
}

try {
    const db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Make sure voucher_number column exists in treasury_transactions
    console.log('\n🔧 Checking database schema...');
    try {
        db.exec("ALTER TABLE treasury_transactions ADD COLUMN voucher_number TEXT");
        console.log('   ✅ Added voucher_number column to treasury_transactions');
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log('   ✅ voucher_number column already exists');
        } else {
            throw err;
        }
    }
    
    // Start transaction
    const migrate = db.transaction(() => {
        console.log('\n1️⃣ Migrating Sales Invoices...');
        const salesInvoices = db.prepare('SELECT id, invoice_number FROM sales_invoices ORDER BY id').all();
        const updateSales = db.prepare('UPDATE sales_invoices SET invoice_number = ? WHERE id = ?');
        
        salesInvoices.forEach((inv, index) => {
            const newNumber = `SL-${String(index + 1).padStart(4, '0')}`;
            updateSales.run(newNumber, inv.id);
            console.log(`   ${inv.invoice_number} → ${newNumber}`);
        });
        console.log(`   ✅ Updated ${salesInvoices.length} sales invoices`);
        
        console.log('\n2️⃣ Migrating Purchase Invoices...');
        const purchaseInvoices = db.prepare('SELECT id, invoice_number FROM purchase_invoices ORDER BY id').all();
        const updatePurchase = db.prepare('UPDATE purchase_invoices SET invoice_number = ? WHERE id = ?');
        
        purchaseInvoices.forEach((inv, index) => {
            const newNumber = `PC-${String(index + 1).padStart(4, '0')}`;
            updatePurchase.run(newNumber, inv.id);
            console.log(`   ${inv.invoice_number} → ${newNumber}`);
        });
        console.log(`   ✅ Updated ${purchaseInvoices.length} purchase invoices`);
        
        console.log('\n3️⃣ Migrating Sales Returns...');
        const salesReturns = db.prepare('SELECT id, return_number FROM sales_returns ORDER BY id').all();
        const updateSalesReturn = db.prepare('UPDATE sales_returns SET return_number = ? WHERE id = ?');
        
        salesReturns.forEach((ret, index) => {
            const newNumber = `SR-${String(index + 1).padStart(4, '0')}`;
            updateSalesReturn.run(newNumber, ret.id);
            console.log(`   ${ret.return_number} → ${newNumber}`);
        });
        console.log(`   ✅ Updated ${salesReturns.length} sales returns`);
        
        console.log('\n4️⃣ Migrating Purchase Returns...');
        const purchaseReturns = db.prepare('SELECT id, return_number FROM purchase_returns ORDER BY id').all();
        const updatePurchaseReturn = db.prepare('UPDATE purchase_returns SET return_number = ? WHERE id = ?');
        
        purchaseReturns.forEach((ret, index) => {
            const newNumber = `PR-${String(index + 1).padStart(4, '0')}`;
            updatePurchaseReturn.run(newNumber, ret.id);
            console.log(`   ${ret.return_number} → ${newNumber}`);
        });
        console.log(`   ✅ Updated ${purchaseReturns.length} purchase returns`);
        
        console.log('\n5️⃣ Migrating Receipt Vouchers...');
        const receipts = db.prepare("SELECT id, voucher_number FROM treasury_transactions WHERE type = 'income' AND voucher_number IS NOT NULL ORDER BY id").all();
        const updateReceipt = db.prepare('UPDATE treasury_transactions SET voucher_number = ? WHERE id = ?');
        
        receipts.forEach((rec, index) => {
            const newNumber = `RC-${String(index + 1).padStart(4, '0')}`;
            updateReceipt.run(newNumber, rec.id);
            console.log(`   ${rec.voucher_number} → ${newNumber}`);
        });
        console.log(`   ✅ Updated ${receipts.length} receipt vouchers`);
        
        console.log('\n6️⃣ Migrating Payment Vouchers...');
        const payments = db.prepare("SELECT id, voucher_number FROM treasury_transactions WHERE type = 'expense' AND voucher_number IS NOT NULL ORDER BY id").all();
        const updatePayment = db.prepare('UPDATE treasury_transactions SET voucher_number = ? WHERE id = ?');
        
        payments.forEach((pay, index) => {
            const newNumber = `PY-${String(index + 1).padStart(4, '0')}`;
            updatePayment.run(newNumber, pay.id);
            console.log(`   ${pay.voucher_number} → ${newNumber}`);
        });
        console.log(`   ✅ Updated ${payments.length} payment vouchers`);
    });
    
    // Execute migration
    migrate();
    
    db.close();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Sales Invoices: SL-XXXX');
    console.log('   - Purchase Invoices: PC-XXXX');
    console.log('   - Sales Returns: SR-XXXX');
    console.log('   - Purchase Returns: PR-XXXX');
    console.log('   - Receipts: RC-XXXX');
    console.log('   - Payments: PY-XXXX');
    
} catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
}
