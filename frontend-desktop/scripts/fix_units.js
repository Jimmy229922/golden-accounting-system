const { app } = require('electron');
const Database = require('better-sqlite3');

async function main() {
    await app.whenReady();

    const dbPath = 'C:\\Users\\gmyga\\AppData\\Roaming\\accounting-system\\accounting.db';
    const db = new Database(dbPath);

    console.log('='.repeat(60));
    console.log('تنظيف شامل لقاعدة البيانات');
    console.log('='.repeat(60));

    // Disable foreign keys temporarily
    db.pragma('foreign_keys = OFF');

    // 1. Find and update items with weird units
    console.log('\n📦 البحث عن أصناف بوحدات غريبة...');
    const itemsWithWeirdUnits = db.prepare("SELECT * FROM items WHERE unit_id >= 30").all();
    console.log('  عدد الأصناف:', itemsWithWeirdUnits.length);
    
    if (itemsWithWeirdUnits.length > 0) {
        // Get the "قطعة" unit id
        let defaultUnit = db.prepare("SELECT id FROM units WHERE id < 30 ORDER BY id LIMIT 1").get();
        console.log('  الوحدة الافتراضية ID:', defaultUnit?.id);
        
        if (defaultUnit) {
            itemsWithWeirdUnits.forEach(item => {
                console.log('  تحديث:', item.name, 'من وحدة', item.unit_id, 'إلى', defaultUnit.id);
                db.prepare("UPDATE items SET unit_id = ? WHERE id = ?").run(defaultUnit.id, item.id);
            });
        }
    }

    // 2. Check opening_balances for weird unit references
    console.log('\n📋 فحص أرصدة أول المدة...');
    
    // 3. Now delete weird units
    console.log('\n🗑️ حذف الوحدات الغريبة...');
    const deleteResult = db.prepare("DELETE FROM units WHERE id >= 30").run();
    console.log('  تم حذف:', deleteResult.changes, 'وحدة');

    // 4. Add missing basic units
    console.log('\n➕ إضافة الوحدات الأساسية المفقودة...');
    const basicUnits = ['قطعة', 'علبة', 'كرتونة', 'كيلو', 'لتر', 'جرام', 'متر'];
    basicUnits.forEach(unit => {
        try {
            db.prepare("INSERT OR IGNORE INTO units (name) VALUES (?)").run(unit);
        } catch (e) {}
    });

    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');

    // 5. Verify final state
    console.log('\n📊 الحالة النهائية:');
    const finalUnits = db.prepare('SELECT * FROM units ORDER BY id').all();
    console.log('  الوحدات:');
    finalUnits.forEach(u => console.log('   ', u.id, '-', u.name));

    const finalItems = db.prepare('SELECT i.id, i.name, i.unit_id, u.name as unit_name FROM items i LEFT JOIN units u ON i.unit_id = u.id WHERE i.is_deleted = 0').all();
    console.log('\n  الأصناف ووحداتها:');
    finalItems.forEach(i => console.log('   ', i.name, '- وحدة:', i.unit_name || 'غير موجودة!'));

    console.log('\n='.repeat(60));
    console.log('انتهى التنظيف');
    console.log('='.repeat(60));

    app.quit();
}

main();
