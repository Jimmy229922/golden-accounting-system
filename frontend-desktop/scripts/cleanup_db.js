const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

async function main() {
    await app.whenReady();

    const dbPath = 'C:\\Users\\gmyga\\AppData\\Roaming\\accounting-system\\accounting.db';
    const db = new Database(dbPath);

    console.log('='.repeat(60));
    console.log('تنظيف قاعدة البيانات');
    console.log('='.repeat(60));

    // 1. Delete weird units (IDs 30-43)
    console.log('\n🧹 حذف الوحدات الغريبة...');
    const weirdUnits = db.prepare("SELECT * FROM units WHERE id >= 30").all();
    console.log('  وحدات سيتم حذفها:', weirdUnits.length);
    
    // First check if any items use these units
    const itemsWithWeirdUnits = db.prepare("SELECT * FROM items WHERE unit_id >= 30").all();
    if (itemsWithWeirdUnits.length > 0) {
        console.log('  ⚠️ يوجد أصناف تستخدم هذه الوحدات، سيتم تحديثها للوحدة الافتراضية');
        // Get or create default unit
        let defaultUnit = db.prepare("SELECT id FROM units WHERE name = 'قطعة'").get();
        if (!defaultUnit) {
            db.prepare("INSERT INTO units (name) VALUES ('قطعة')").run();
            defaultUnit = db.prepare("SELECT id FROM units WHERE name = 'قطعة'").get();
        }
        if (defaultUnit) {
            db.prepare("UPDATE items SET unit_id = ? WHERE unit_id >= 30").run(defaultUnit.id);
            console.log('  ✅ تم تحديث الأصناف للوحدة الافتراضية');
        }
    }
    
    // Now safe to delete
    try {
        db.prepare("DELETE FROM units WHERE id >= 30").run();
        console.log('  ✅ تم حذف الوحدات الغريبة');
    } catch (e) {
        console.log('  ⚠️ لم يتم حذف بعض الوحدات:', e.message);
    }

    // 2. Reset sqlite_sequence for sales_invoices to match actual count
    console.log('\n🔧 إعادة ضبط تسلسل الفواتير...');
    
    // Get actual invoice count
    const salesCount = db.prepare('SELECT COUNT(*) as count FROM sales_invoices').get().count;
    const purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchase_invoices').get().count;
    
    // Update sequences - note: we can't directly reset sqlite_sequence safely,
    // but the code fix will handle this by using COUNT instead of MAX(id)
    
    console.log('  عدد فواتير المبيعات الفعلي:', salesCount);
    console.log('  عدد فواتير المشتريات الفعلي:', purchaseCount);
    console.log('  ✅ تم تحديث منطق حساب رقم الفاتورة في الكود');

    // 3. Check and report customer balances issues
    console.log('\n💰 فحص أرصدة العملاء...');
    const customersWithNegativeBalance = db.prepare("SELECT * FROM customers WHERE balance < 0 AND type = 'customer'").all();
    if (customersWithNegativeBalance.length > 0) {
        console.log('  ⚠️ عملاء برصيد سالب (يعني لهم حق عندنا):');
        customersWithNegativeBalance.forEach(c => console.log('    -', c.name, ':', c.balance));
    }
    
    const suppliersWithNegativeBalance = db.prepare("SELECT * FROM customers WHERE balance < 0 AND type = 'supplier'").all();
    if (suppliersWithNegativeBalance.length > 0) {
        console.log('  ⚠️ موردين برصيد سالب (يعني لنا حق عندهم):');
        suppliersWithNegativeBalance.forEach(c => console.log('    -', c.name, ':', c.balance));
    }

    // 4. Ensure default units exist
    console.log('\n📏 التأكد من وجود الوحدات الأساسية...');
    const requiredUnits = ['قطعة', 'علبة', 'كرتونة', 'كيلو', 'لتر', 'جرام', 'متر'];
    const insertUnit = db.prepare("INSERT OR IGNORE INTO units (name) VALUES (?)");
    requiredUnits.forEach(unit => {
        insertUnit.run(unit);
    });
    console.log('  ✅ تم التأكد من الوحدات الأساسية');

    // 5. Check stock quantities
    console.log('\n📦 فحص كميات المخزون...');
    const itemsWithNegativeStock = db.prepare("SELECT * FROM items WHERE stock_quantity < 0 AND is_deleted = 0").all();
    if (itemsWithNegativeStock.length > 0) {
        console.log('  ⚠️ أصناف بكمية مخزون سالبة:');
        itemsWithNegativeStock.forEach(i => console.log('    -', i.name, ':', i.stock_quantity));
    } else {
        console.log('  ✅ لا توجد أصناف بمخزون سالب');
    }

    // 6. Verify data after cleanup
    console.log('\n📊 التحقق بعد التنظيف:');
    const finalUnits = db.prepare('SELECT * FROM units ORDER BY id').all();
    console.log('  الوحدات المتبقية:');
    finalUnits.forEach(u => console.log('    ID:', u.id, '|', u.name));

    console.log('\n='.repeat(60));
    console.log('انتهى التنظيف');
    console.log('='.repeat(60));

    app.quit();
}

main();
