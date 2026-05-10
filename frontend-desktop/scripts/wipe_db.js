const { app } = require('electron');
const Database = require('better-sqlite3');

async function main() {
    await app.whenReady();
    const dbPath = 'C:\\Users\\gmyga\\AppData\\Roaming\\accounting-system\\accounting.db';
    const db = new Database(dbPath);

    console.log('='.repeat(60));
    console.log('مسح قاعدة البيانات بالكامل...');
    console.log('='.repeat(60));

    const tables = [
        'items',
        'customers',
        'suppliers',
        'purchase_invoices',
        'purchase_invoice_details',
        'sales_invoices',
        'sales_invoice_details',
        'treasury_transactions',
        'petty_expenses',
        'petty_expenses_bags',
        'petty_expenses_inspection',
        'petty_expenses_shipping_clearance',
        'petty_expenses_operation',
        'under_collection_records',
        'remaining_under_collection_records',
        'sales_shift_closings',
        'opening_balances',
        'opening_balance_groups',
        'sales_returns',
        'sales_return_details',
        'purchase_returns',
        'purchase_return_details',
        'damaged_stock_logs'
    ];

    db.transaction(() => {
        for (const table of tables) {
            try {
                db.prepare(`DELETE FROM ${table}`).run();
                console.log(`تم مسح جدول: ${table}`);
            } catch (e) {
                console.log(`تجاهل جدول ${table} (قد لا يكون موجوداً)`);
            }
        }

        // Reset autoincrement sequences
        try {
            db.prepare("DELETE FROM sqlite_sequence").run();
            console.log("تم تصفير أرقام التسلسل (Auto Increment).");
        } catch (e) {
            console.log("تجاهل تصفير التسلسل.");
        }
    })();

    console.log('\n='.repeat(60));
    console.log('تم تصفير البرنامج بنجاح. جميع البيانات محذوفة الآن.');
    console.log('='.repeat(60));
    
    app.quit();
}

main();
