const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

async function main() {
    await app.whenReady();

    const dbPath = 'C:\\Users\\gmyga\\AppData\\Roaming\\accounting-system\\accounting.db';
    const db = new Database(dbPath);

    console.log('='.repeat(60));
    console.log('تحليل شامل لقاعدة البيانات');
    console.log('='.repeat(60));

    // 1. Check tables
    console.log('\n📊 الجداول الموجودة:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    tables.forEach(t => console.log('  -', t.name));

    // 2. Check sales_invoices
    console.log('\n📄 فواتير المبيعات (sales_invoices):');
    const salesCount = db.prepare('SELECT COUNT(*) as count FROM sales_invoices').get();
    const salesMax = db.prepare('SELECT MAX(id) as maxId FROM sales_invoices').get();
    console.log('  عدد الفواتير:', salesCount.count);
    console.log('  أعلى ID:', salesMax.maxId || 0);
    
    if (salesCount.count > 0) {
        const salesInvoices = db.prepare('SELECT * FROM sales_invoices').all();
        console.log('  الفواتير:');
        salesInvoices.forEach(inv => console.log('    ID:', inv.id, '| رقم:', inv.invoice_number, '| المبلغ:', inv.total_amount));
    }

    // 3. Check purchase_invoices
    console.log('\n📄 فواتير المشتريات (purchase_invoices):');
    const purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchase_invoices').get();
    const purchaseMax = db.prepare('SELECT MAX(id) as maxId FROM purchase_invoices').get();
    console.log('  عدد الفواتير:', purchaseCount.count);
    console.log('  أعلى ID:', purchaseMax.maxId || 0);

    if (purchaseCount.count > 0) {
        const purchaseInvoices = db.prepare('SELECT * FROM purchase_invoices').all();
        console.log('  الفواتير:');
        purchaseInvoices.forEach(inv => console.log('    ID:', inv.id, '| رقم:', inv.invoice_number, '| المبلغ:', inv.total_amount));
    }

    // 4. Check customers
    console.log('\n👥 العملاء والموردين (customers):');
    const customers = db.prepare('SELECT * FROM customers').all();
    customers.forEach(c => console.log('  ID:', c.id, '| النوع:', c.type, '| الاسم:', c.name, '| الرصيد:', c.balance));

    // 5. Check items
    console.log('\n📦 الأصناف (items):');
    const items = db.prepare('SELECT * FROM items WHERE is_deleted = 0').all();
    items.forEach(i => console.log('  ID:', i.id, '| الاسم:', i.name, '| المخزون:', i.stock_quantity, '| سعر البيع:', i.sale_price, '| سعر التكلفة:', i.cost_price));

    // 6. Check units
    console.log('\n📏 الوحدات (units):');
    const units = db.prepare('SELECT * FROM units').all();
    units.forEach(u => console.log('  ID:', u.id, '| الاسم:', u.name));

    // 7. Check treasury
    console.log('\n💰 حركات الخزينة (treasury_transactions):');
    const treasuryCount = db.prepare('SELECT COUNT(*) as count FROM treasury_transactions').get();
    console.log('  عدد الحركات:', treasuryCount.count);
    
    const income = db.prepare("SELECT SUM(amount) as total FROM treasury_transactions WHERE type = 'income'").get().total || 0;
    const expense = db.prepare("SELECT SUM(amount) as total FROM treasury_transactions WHERE type = 'expense'").get().total || 0;
    console.log('  إجمالي الدخل:', income);
    console.log('  إجمالي المصروفات:', expense);
    console.log('  رصيد الخزينة:', income - expense);

    // 8. Check opening_balances
    console.log('\n📋 أرصدة أول المدة (opening_balances):');
    const obCount = db.prepare('SELECT COUNT(*) as count FROM opening_balances').get();
    console.log('  عدد السجلات:', obCount.count);

    // 9. Check warehouses
    console.log('\n🏭 المخازن (warehouses):');
    const warehouses = db.prepare('SELECT * FROM warehouses').all();
    warehouses.forEach(w => console.log('  ID:', w.id, '| الاسم:', w.name));

    // 10. Check for sqlite_sequence (auto-increment tracker)
    console.log('\n🔢 sqlite_sequence (تتبع Auto-Increment):');
    try {
        const sequences = db.prepare("SELECT * FROM sqlite_sequence").all();
        sequences.forEach(s => console.log('  جدول:', s.name, '| آخر seq:', s.seq));
    } catch (e) {
        console.log('  لا يوجد جدول sqlite_sequence');
    }

    // 11. Consistency checks
    console.log('\n🔍 فحص التناسق:');
    
    // Check if items have valid units
    const itemsWithInvalidUnits = db.prepare(`
        SELECT items.id, items.name, items.unit_id 
        FROM items 
        LEFT JOIN units ON items.unit_id = units.id 
        WHERE units.id IS NULL AND items.unit_id IS NOT NULL AND items.is_deleted = 0
    `).all();
    if (itemsWithInvalidUnits.length > 0) {
        console.log('  ⚠️ أصناف بوحدات غير صحيحة:', itemsWithInvalidUnits.length);
    } else {
        console.log('  ✅ جميع الأصناف لها وحدات صحيحة');
    }

    // Check customer balances vs invoices
    const customersWithBalance = db.prepare("SELECT * FROM customers WHERE balance != 0").all();
    console.log('  عملاء لديهم رصيد:', customersWithBalance.length);

    // Check for orphan invoice details
    const orphanSalesDetails = db.prepare(`
        SELECT COUNT(*) as count FROM sales_invoice_details 
        WHERE invoice_id NOT IN (SELECT id FROM sales_invoices)
    `).get();
    if (orphanSalesDetails.count > 0) {
        console.log('  ⚠️ تفاصيل فواتير مبيعات يتيمة:', orphanSalesDetails.count);
    } else {
        console.log('  ✅ لا توجد تفاصيل فواتير مبيعات يتيمة');
    }

    const orphanPurchaseDetails = db.prepare(`
        SELECT COUNT(*) as count FROM purchase_invoice_details 
        WHERE invoice_id NOT IN (SELECT id FROM purchase_invoices)
    `).get();
    if (orphanPurchaseDetails.count > 0) {
        console.log('  ⚠️ تفاصيل فواتير مشتريات يتيمة:', orphanPurchaseDetails.count);
    } else {
        console.log('  ✅ لا توجد تفاصيل فواتير مشتريات يتيمة');
    }

    console.log('\n='.repeat(60));
    console.log('انتهى التحليل');
    console.log('='.repeat(60));

    app.quit();
}

main();
