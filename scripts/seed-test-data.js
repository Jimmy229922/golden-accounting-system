/**
 * Seed Test Data Script - Comprehensive
 * يملأ قاعدة البيانات ببيانات اختبار شاملة لجميع أقسام النظام
 * 
 * Usage: node scripts/seed-test-data.js
 *        node scripts/seed-test-data.js --clear   (مسح البيانات فقط)
 */

const path = require('path');
const Database = require('better-sqlite3');

// Resolve DB path (same as Electron app)
const userDataPath = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
const dbPath = path.join(userDataPath, 'accounting-system-desktop', 'accounting.db');

console.log(`[seed] DB path: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// ─────────────────────────────────────────────
// 0) ENSURE TABLES EXIST (same as db.js initDB)
// ─────────────────────────────────────────────
function ensureTables() {
    db.exec(`CREATE TABLE IF NOT EXISTS units (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`);
    db.exec(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, barcode TEXT UNIQUE, unit_id INTEGER,
        cost_price REAL DEFAULT 0, sale_price REAL DEFAULT 0, stock_quantity REAL DEFAULT 0,
        reorder_level INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0,
        FOREIGN KEY (unit_id) REFERENCES units(id)
    )`);
    try { db.exec("ALTER TABLE items ADD COLUMN reorder_level INTEGER DEFAULT 0"); } catch(e){}
    try { db.exec("ALTER TABLE items ADD COLUMN is_deleted INTEGER DEFAULT 0"); } catch(e){}

    db.exec(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, address TEXT,
        balance REAL DEFAULT 0, type TEXT DEFAULT 'customer', code INTEGER, opening_balance REAL DEFAULT 0
    )`);
    try { db.exec("ALTER TABLE customers ADD COLUMN type TEXT DEFAULT 'customer'"); } catch(e){}
    try { db.exec("ALTER TABLE customers ADD COLUMN code INTEGER"); } catch(e){}
    try { db.exec("ALTER TABLE customers ADD COLUMN opening_balance REAL DEFAULT 0"); } catch(e){}

    db.exec(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, address TEXT, balance REAL DEFAULT 0
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS purchase_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT, supplier_id INTEGER,
        invoice_date TEXT DEFAULT CURRENT_DATE, payment_type TEXT DEFAULT 'cash',
        total_amount REAL DEFAULT 0, paid_amount REAL DEFAULT 0, remaining_amount REAL DEFAULT 0,
        notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES customers(id)
    )`);
    try { db.exec("ALTER TABLE purchase_invoices ADD COLUMN payment_type TEXT DEFAULT 'cash'"); } catch(e){}
    try { db.exec("ALTER TABLE purchase_invoices ADD COLUMN paid_amount REAL DEFAULT 0"); } catch(e){}
    try { db.exec("ALTER TABLE purchase_invoices ADD COLUMN remaining_amount REAL DEFAULT 0"); } catch(e){}

    db.exec(`CREATE TABLE IF NOT EXISTS purchase_invoice_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER, item_id INTEGER,
        quantity REAL, cost_price REAL, total_price REAL,
        FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS sales_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT, customer_id INTEGER,
        invoice_date TEXT DEFAULT CURRENT_DATE, payment_type TEXT DEFAULT 'cash',
        total_amount REAL DEFAULT 0, paid_amount REAL DEFAULT 0, remaining_amount REAL DEFAULT 0,
        notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`);
    try { db.exec("ALTER TABLE sales_invoices ADD COLUMN payment_type TEXT DEFAULT 'cash'"); } catch(e){}
    try { db.exec("ALTER TABLE sales_invoices ADD COLUMN paid_amount REAL DEFAULT 0"); } catch(e){}
    try { db.exec("ALTER TABLE sales_invoices ADD COLUMN remaining_amount REAL DEFAULT 0"); } catch(e){}

    db.exec(`CREATE TABLE IF NOT EXISTS sales_invoice_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER, item_id INTEGER,
        quantity REAL, sale_price REAL, total_price REAL,
        FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS treasury_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, amount REAL NOT NULL,
        transaction_date TEXT DEFAULT CURRENT_DATE, description TEXT,
        related_invoice_id INTEGER, related_type TEXT,
        customer_id INTEGER, supplier_id INTEGER, voucher_number TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )`);
    try { db.exec("ALTER TABLE treasury_transactions ADD COLUMN customer_id INTEGER REFERENCES customers(id)"); } catch(e){}
    try { db.exec("ALTER TABLE treasury_transactions ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)"); } catch(e){}
    try { db.exec("ALTER TABLE treasury_transactions ADD COLUMN voucher_number TEXT"); } catch(e){}

    db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
    db.exec(`CREATE TABLE IF NOT EXISTS warehouses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`);

    db.exec(`CREATE TABLE IF NOT EXISTS opening_balance_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS opening_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, warehouse_id INTEGER NOT NULL,
        quantity REAL DEFAULT 0, cost_price REAL DEFAULT 0, group_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (group_id) REFERENCES opening_balance_groups(id) ON DELETE CASCADE
    )`);
    try { db.exec("ALTER TABLE opening_balances ADD COLUMN group_id INTEGER REFERENCES opening_balance_groups(id) ON DELETE CASCADE"); } catch(e){}

    db.exec(`CREATE TABLE IF NOT EXISTS sales_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT, return_number TEXT, original_invoice_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL, return_date TEXT DEFAULT CURRENT_DATE,
        total_amount REAL DEFAULT 0, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (original_invoice_id) REFERENCES sales_invoices(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS sales_return_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT, return_id INTEGER NOT NULL, item_id INTEGER NOT NULL,
        quantity REAL NOT NULL, price REAL NOT NULL, total_price REAL NOT NULL,
        FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT, return_number TEXT, original_invoice_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL, return_date TEXT DEFAULT CURRENT_DATE,
        total_amount REAL DEFAULT 0, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (original_invoice_id) REFERENCES purchase_invoices(id),
        FOREIGN KEY (supplier_id) REFERENCES customers(id)
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS purchase_return_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT, return_id INTEGER NOT NULL, item_id INTEGER NOT NULL,
        quantity REAL NOT NULL, price REAL NOT NULL, total_price REAL NOT NULL,
        FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`);
    console.log('[seed] Tables ensured.');
}

// ─────────────────────────────────────────────
// 1) CLEAR ALL EXISTING DATA
// ─────────────────────────────────────────────
function clearAllData() {
    console.log('[seed] Clearing all existing data...');
    db.pragma('foreign_keys = OFF');
    const tables = [
        'purchase_return_details', 'purchase_returns',
        'sales_return_details', 'sales_returns',
        'treasury_transactions',
        'sales_invoice_details', 'sales_invoices',
        'purchase_invoice_details', 'purchase_invoices',
        'opening_balances', 'opening_balance_groups',
        'items', 'warehouses', 'units',
        'suppliers', 'customers',
        'settings'
    ];
    for (const t of tables) {
        try { db.exec(`DELETE FROM ${t}`); } catch (e) { /* table may not exist */ }
    }
    try { db.exec("DELETE FROM sqlite_sequence"); } catch (e) {}
    db.pragma('foreign_keys = ON');
    console.log('[seed] All data cleared.');
}

// ─────────────────────────────────────────────
// 2) SEED DATA
// ─────────────────────────────────────────────
function seedData() {
    console.log('[seed] Inserting comprehensive test data...\n');

    // ══════════════════════════════════════════
    //  وحدات القياس - Units
    // ══════════════════════════════════════════
    const insertUnit = db.prepare('INSERT INTO units (name) VALUES (?)');
    const unitNames = ['كيلو', 'قطعة', 'لتر', 'متر', 'علبة', 'كرتونة', 'طن', 'كيس', 'درزن', 'رول', 'جالون', 'صندوق'];
    const unitIds = {};
    for (const name of unitNames) {
        const info = insertUnit.run(name);
        unitIds[name] = Number(info.lastInsertRowid);
    }
    console.log(`  ✓ ${unitNames.length} units`);

    // ══════════════════════════════════════════
    //  المخازن - Warehouses
    // ══════════════════════════════════════════
    const insertWarehouse = db.prepare('INSERT INTO warehouses (name) VALUES (?)');
    const warehouseNames = ['المخزن الرئيسي', 'مخزن الفرع', 'المخزن البارد', 'مخزن المواد الخام', 'مخزن البضائع التالفة'];
    const warehouseIds = {};
    for (const name of warehouseNames) {
        const info = insertWarehouse.run(name);
        warehouseIds[name] = Number(info.lastInsertRowid);
    }
    console.log(`  ✓ ${warehouseNames.length} warehouses`);

    // ══════════════════════════════════════════
    //  العملاء والموردين - Customers & Suppliers
    // ══════════════════════════════════════════
    const insertCustomer = db.prepare(`
        INSERT INTO customers (name, phone, address, balance, type, code, opening_balance)
        VALUES (@name, @phone, @address, @balance, @type, @code, @opening_balance)
    `);
    const customers = [
        // عملاء
        { name: 'أحمد محمد علي', phone: '01012345678', address: 'القاهرة - مدينة نصر', balance: 0, type: 'customer', code: 1, opening_balance: 5000 },
        { name: 'محمد حسن إبراهيم', phone: '01123456789', address: 'الجيزة - الدقي', balance: 0, type: 'customer', code: 2, opening_balance: 3000 },
        { name: 'سارة أحمد عبدالله', phone: '01234567890', address: 'الإسكندرية - سموحة', balance: 0, type: 'customer', code: 3, opening_balance: 0 },
        { name: 'خالد عبدالرحمن', phone: '01098765432', address: 'المنصورة - شارع الجمهورية', balance: 0, type: 'customer', code: 4, opening_balance: 7500 },
        { name: 'فاطمة محمود', phone: '01567890123', address: 'أسيوط - وسط البلد', balance: 0, type: 'customer', code: 5, opening_balance: 0 },
        { name: 'ياسمين كامل', phone: '01056789012', address: 'الزقازيق - شارع فاروق', balance: 0, type: 'customer', code: 6, opening_balance: 1500 },
        { name: 'مصطفى السيد', phone: '01189012345', address: 'بورسعيد - حي الشرق', balance: 0, type: 'customer', code: 7, opening_balance: 0 },
        { name: 'هدى العربي', phone: '01290123456', address: 'الإسماعيلية - شارع الثورة', balance: 0, type: 'customer', code: 8, opening_balance: 2500 },
        { name: 'تامر فؤاد', phone: '01078901234', address: 'السويس - حي الأربعين', balance: 0, type: 'customer', code: 9, opening_balance: 4000 },
        { name: 'نورا خالد', phone: '01567123456', address: 'دمياط - شارع الكورنيش', balance: 0, type: 'customer', code: 10, opening_balance: 0 },
        { name: 'سوبر ماركت الهدى', phone: '0225501111', address: 'القاهرة - العباسية', balance: 0, type: 'customer', code: 11, opening_balance: 12000 },
        { name: 'ميني ماركت الأمانة', phone: '0335502222', address: 'الإسكندرية - المنتزه', balance: 0, type: 'customer', code: 12, opening_balance: 8000 },
        // عميل ومورد
        { name: 'عمر يوسف', phone: '01278901234', address: 'طنطا - شارع النحاس', balance: 0, type: 'both', code: 13, opening_balance: 2000 },
        { name: 'حسام الدين عبدالعزيز', phone: '01345678901', address: 'بنها - شارع الجلاء', balance: 0, type: 'both', code: 14, opening_balance: 4000 },
        { name: 'إبراهيم سعيد', phone: '01156789012', address: 'شبين الكوم - شارع البحر', balance: 0, type: 'both', code: 15, opening_balance: 6000 },
        // موردين
        { name: 'شركة النور للتجارة', phone: '0225551234', address: 'القاهرة - العباسية', balance: 0, type: 'supplier', code: 16, opening_balance: 0 },
        { name: 'مؤسسة الأمل للتوريدات', phone: '0235556789', address: 'الجيزة - فيصل', balance: 0, type: 'supplier', code: 17, opening_balance: 0 },
        { name: 'شركة المستقبل للأغذية', phone: '0245559876', address: '6 أكتوبر - المنطقة الصناعية', balance: 0, type: 'supplier', code: 18, opening_balance: 0 },
        { name: 'مصنع السلام للمنظفات', phone: '0255554321', address: 'العاشر من رمضان', balance: 0, type: 'supplier', code: 19, opening_balance: 0 },
        { name: 'شركة البركة للزيوت', phone: '0265558765', address: 'بدر - المنطقة الصناعية', balance: 0, type: 'supplier', code: 20, opening_balance: 0 },
        { name: 'مصانع الدلتا للورق', phone: '0405553456', address: 'المحلة الكبرى', balance: 0, type: 'supplier', code: 21, opening_balance: 0 },
        { name: 'شركة الوادي للمعلبات', phone: '0865557890', address: 'المنيا - المنطقة الصناعية', balance: 0, type: 'supplier', code: 22, opening_balance: 0 },
        { name: 'مؤسسة الشرق للأدوات', phone: '0625554567', address: 'الإسماعيلية - المنطقة الحرة', balance: 0, type: 'supplier', code: 23, opening_balance: 0 },
    ];
    const customerIds = {};
    for (const c of customers) {
        const info = insertCustomer.run(c);
        customerIds[c.name] = Number(info.lastInsertRowid);
    }
    console.log(`  ✓ ${customers.length} customers/suppliers`);

    // ══════════════════════════════════════════
    //  الأصناف - Items (42 صنف)
    // ══════════════════════════════════════════
    const insertItem = db.prepare(`
        INSERT INTO items (name, barcode, unit_id, cost_price, sale_price, stock_quantity, reorder_level, is_deleted)
        VALUES (@name, @barcode, @unit_id, @cost_price, @sale_price, @stock_quantity, @reorder_level, 0)
    `);
    const itemsData = [
        // مواد غذائية أساسية
        { name: 'أرز بسمتي', barcode: '6001001', unit_id: unitIds['كيلو'], cost_price: 35, sale_price: 45, stock_quantity: 0, reorder_level: 50 },
        { name: 'سكر أبيض', barcode: '6001002', unit_id: unitIds['كيلو'], cost_price: 22, sale_price: 28, stock_quantity: 0, reorder_level: 100 },
        { name: 'زيت عباد الشمس', barcode: '6001003', unit_id: unitIds['لتر'], cost_price: 55, sale_price: 70, stock_quantity: 0, reorder_level: 30 },
        { name: 'شاي أسود', barcode: '6001004', unit_id: unitIds['علبة'], cost_price: 40, sale_price: 55, stock_quantity: 0, reorder_level: 40 },
        { name: 'مكرونة اسباجتي', barcode: '6001005', unit_id: unitIds['كرتونة'], cost_price: 120, sale_price: 160, stock_quantity: 0, reorder_level: 20 },
        { name: 'دقيق فاخر', barcode: '6001006', unit_id: unitIds['كيس'], cost_price: 80, sale_price: 100, stock_quantity: 0, reorder_level: 25 },
        { name: 'طماطم معلبة', barcode: '6001007', unit_id: unitIds['كرتونة'], cost_price: 180, sale_price: 230, stock_quantity: 0, reorder_level: 15 },
        { name: 'تونة معلبة', barcode: '6001008', unit_id: unitIds['كرتونة'], cost_price: 350, sale_price: 420, stock_quantity: 0, reorder_level: 10 },
        { name: 'فول مدمس', barcode: '6001009', unit_id: unitIds['كرتونة'], cost_price: 150, sale_price: 195, stock_quantity: 0, reorder_level: 20 },
        { name: 'عدس أصفر', barcode: '6001010', unit_id: unitIds['كيلو'], cost_price: 45, sale_price: 58, stock_quantity: 0, reorder_level: 40 },
        { name: 'فاصوليا بيضاء', barcode: '6001011', unit_id: unitIds['كيلو'], cost_price: 50, sale_price: 65, stock_quantity: 0, reorder_level: 30 },
        { name: 'لوبيا جافة', barcode: '6001012', unit_id: unitIds['كيلو'], cost_price: 40, sale_price: 55, stock_quantity: 0, reorder_level: 30 },
        // زيوت ودهون
        { name: 'زيت ذرة', barcode: '6001013', unit_id: unitIds['لتر'], cost_price: 65, sale_price: 82, stock_quantity: 0, reorder_level: 25 },
        { name: 'سمن صناعي', barcode: '6001014', unit_id: unitIds['كيلو'], cost_price: 90, sale_price: 115, stock_quantity: 0, reorder_level: 20 },
        { name: 'زيت زيتون', barcode: '6001015', unit_id: unitIds['لتر'], cost_price: 180, sale_price: 230, stock_quantity: 0, reorder_level: 10 },
        // مشروبات
        { name: 'قهوة تركي', barcode: '6001016', unit_id: unitIds['علبة'], cost_price: 75, sale_price: 95, stock_quantity: 0, reorder_level: 20 },
        { name: 'نسكافيه كلاسيك', barcode: '6001017', unit_id: unitIds['علبة'], cost_price: 120, sale_price: 150, stock_quantity: 0, reorder_level: 15 },
        { name: 'شاي أخضر', barcode: '6001018', unit_id: unitIds['علبة'], cost_price: 35, sale_price: 48, stock_quantity: 0, reorder_level: 30 },
        { name: 'كاكاو بودرة', barcode: '6001019', unit_id: unitIds['علبة'], cost_price: 55, sale_price: 72, stock_quantity: 0, reorder_level: 15 },
        // توابل وبهارات
        { name: 'ملح طعام', barcode: '6001020', unit_id: unitIds['كيلو'], cost_price: 8, sale_price: 12, stock_quantity: 0, reorder_level: 100 },
        { name: 'فلفل أسود', barcode: '6001021', unit_id: unitIds['علبة'], cost_price: 25, sale_price: 35, stock_quantity: 0, reorder_level: 40 },
        { name: 'كمون ناعم', barcode: '6001022', unit_id: unitIds['علبة'], cost_price: 20, sale_price: 28, stock_quantity: 0, reorder_level: 40 },
        { name: 'كركم', barcode: '6001023', unit_id: unitIds['علبة'], cost_price: 18, sale_price: 25, stock_quantity: 0, reorder_level: 30 },
        // منظفات
        { name: 'صابون سائل', barcode: '6002001', unit_id: unitIds['لتر'], cost_price: 25, sale_price: 35, stock_quantity: 0, reorder_level: 50 },
        { name: 'مسحوق غسيل', barcode: '6002002', unit_id: unitIds['كيس'], cost_price: 65, sale_price: 85, stock_quantity: 0, reorder_level: 30 },
        { name: 'معطر ملابس', barcode: '6002003', unit_id: unitIds['لتر'], cost_price: 30, sale_price: 45, stock_quantity: 0, reorder_level: 20 },
        { name: 'مناديل ورقية', barcode: '6002004', unit_id: unitIds['كرتونة'], cost_price: 90, sale_price: 120, stock_quantity: 0, reorder_level: 15 },
        { name: 'كلور مطهر', barcode: '6002005', unit_id: unitIds['جالون'], cost_price: 35, sale_price: 48, stock_quantity: 0, reorder_level: 25 },
        { name: 'معجون أسنان', barcode: '6002006', unit_id: unitIds['قطعة'], cost_price: 20, sale_price: 28, stock_quantity: 0, reorder_level: 50 },
        { name: 'شامبو شعر', barcode: '6002007', unit_id: unitIds['قطعة'], cost_price: 35, sale_price: 48, stock_quantity: 0, reorder_level: 30 },
        { name: 'صابون يد سائل', barcode: '6002008', unit_id: unitIds['قطعة'], cost_price: 18, sale_price: 25, stock_quantity: 0, reorder_level: 40 },
        { name: 'سائل جلي', barcode: '6002009', unit_id: unitIds['لتر'], cost_price: 22, sale_price: 30, stock_quantity: 0, reorder_level: 40 },
        // أدوات
        { name: 'حبل غسيل', barcode: '6003001', unit_id: unitIds['متر'], cost_price: 5, sale_price: 8, stock_quantity: 0, reorder_level: 100 },
        { name: 'أكياس بلاستيك كبيرة', barcode: '6003002', unit_id: unitIds['كيس'], cost_price: 15, sale_price: 22, stock_quantity: 0, reorder_level: 50 },
        { name: 'صحون بلاستيك', barcode: '6003003', unit_id: unitIds['قطعة'], cost_price: 3, sale_price: 5, stock_quantity: 0, reorder_level: 200 },
        { name: 'أكواب ورقية', barcode: '6003004', unit_id: unitIds['صندوق'], cost_price: 40, sale_price: 55, stock_quantity: 0, reorder_level: 30 },
        { name: 'شوك بلاستيك', barcode: '6003005', unit_id: unitIds['كيس'], cost_price: 10, sale_price: 15, stock_quantity: 0, reorder_level: 60 },
        { name: 'مفرش طاولة', barcode: '6003006', unit_id: unitIds['رول'], cost_price: 25, sale_price: 35, stock_quantity: 0, reorder_level: 20 },
        { name: 'فوط مطبخ', barcode: '6003007', unit_id: unitIds['رول'], cost_price: 15, sale_price: 22, stock_quantity: 0, reorder_level: 40 },
        // ورقيات
        { name: 'مناديل جيب', barcode: '6003008', unit_id: unitIds['درزن'], cost_price: 12, sale_price: 18, stock_quantity: 0, reorder_level: 50 },
        { name: 'ورق ألومنيوم', barcode: '6003009', unit_id: unitIds['رول'], cost_price: 20, sale_price: 28, stock_quantity: 0, reorder_level: 25 },
        { name: 'ورق تغليف شفاف', barcode: '6003010', unit_id: unitIds['رول'], cost_price: 18, sale_price: 25, stock_quantity: 0, reorder_level: 25 },
    ];
    const itemIds = {};
    for (const [index, item] of itemsData.entries()) {
        const itemWithSeedBarcode = {
            ...item,
            barcode: String(1000 + index)
        };
        const info = insertItem.run(itemWithSeedBarcode);
        itemIds[item.name] = Number(info.lastInsertRowid);
    }
    console.log(`  ✓ ${itemsData.length} items`);

    // ══════════════════════════════════════════
    //  أرصدة أول المدة - Opening Balances
    // ══════════════════════════════════════════
    const insertOBGroup = db.prepare('INSERT INTO opening_balance_groups (notes, created_at) VALUES (?, ?)');
    const insertOB = db.prepare(`
        INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price, group_id)
        VALUES (@item_id, @warehouse_id, @quantity, @cost_price, @group_id)
    `);
    const updateItemStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?');

    const obGroup1 = insertOBGroup.run('رصيد افتتاحي - المخزن الرئيسي', '2025-12-31');
    const g1 = Number(obGroup1.lastInsertRowid);
    const obGroup2 = insertOBGroup.run('رصيد افتتاحي - مخزن الفرع', '2025-12-31');
    const g2 = Number(obGroup2.lastInsertRowid);
    const obGroup3 = insertOBGroup.run('رصيد افتتاحي - المخزن البارد', '2025-12-31');
    const g3 = Number(obGroup3.lastInsertRowid);

    const openingBalances = [
        // المخزن الرئيسي - كل الأصناف
        { item: 'أرز بسمتي', warehouse: 'المخزن الرئيسي', qty: 300, cost: 35, group: g1 },
        { item: 'سكر أبيض', warehouse: 'المخزن الرئيسي', qty: 600, cost: 22, group: g1 },
        { item: 'زيت عباد الشمس', warehouse: 'المخزن الرئيسي', qty: 200, cost: 55, group: g1 },
        { item: 'شاي أسود', warehouse: 'المخزن الرئيسي', qty: 150, cost: 40, group: g1 },
        { item: 'مكرونة اسباجتي', warehouse: 'المخزن الرئيسي', qty: 100, cost: 120, group: g1 },
        { item: 'دقيق فاخر', warehouse: 'المخزن الرئيسي', qty: 80, cost: 80, group: g1 },
        { item: 'طماطم معلبة', warehouse: 'المخزن الرئيسي', qty: 60, cost: 180, group: g1 },
        { item: 'تونة معلبة', warehouse: 'المخزن الرئيسي', qty: 40, cost: 350, group: g1 },
        { item: 'فول مدمس', warehouse: 'المخزن الرئيسي', qty: 80, cost: 150, group: g1 },
        { item: 'عدس أصفر', warehouse: 'المخزن الرئيسي', qty: 120, cost: 45, group: g1 },
        { item: 'فاصوليا بيضاء', warehouse: 'المخزن الرئيسي', qty: 90, cost: 50, group: g1 },
        { item: 'لوبيا جافة', warehouse: 'المخزن الرئيسي', qty: 80, cost: 40, group: g1 },
        { item: 'زيت ذرة', warehouse: 'المخزن الرئيسي', qty: 100, cost: 65, group: g1 },
        { item: 'سمن صناعي', warehouse: 'المخزن الرئيسي', qty: 60, cost: 90, group: g1 },
        { item: 'زيت زيتون', warehouse: 'المخزن الرئيسي', qty: 30, cost: 180, group: g1 },
        { item: 'قهوة تركي', warehouse: 'المخزن الرئيسي', qty: 50, cost: 75, group: g1 },
        { item: 'نسكافيه كلاسيك', warehouse: 'المخزن الرئيسي', qty: 40, cost: 120, group: g1 },
        { item: 'شاي أخضر', warehouse: 'المخزن الرئيسي', qty: 80, cost: 35, group: g1 },
        { item: 'كاكاو بودرة', warehouse: 'المخزن الرئيسي', qty: 30, cost: 55, group: g1 },
        { item: 'ملح طعام', warehouse: 'المخزن الرئيسي', qty: 250, cost: 8, group: g1 },
        { item: 'فلفل أسود', warehouse: 'المخزن الرئيسي', qty: 100, cost: 25, group: g1 },
        { item: 'كمون ناعم', warehouse: 'المخزن الرئيسي', qty: 100, cost: 20, group: g1 },
        { item: 'كركم', warehouse: 'المخزن الرئيسي', qty: 80, cost: 18, group: g1 },
        { item: 'صابون سائل', warehouse: 'المخزن الرئيسي', qty: 250, cost: 25, group: g1 },
        { item: 'مسحوق غسيل', warehouse: 'المخزن الرئيسي', qty: 120, cost: 65, group: g1 },
        { item: 'معطر ملابس', warehouse: 'المخزن الرئيسي', qty: 100, cost: 30, group: g1 },
        { item: 'مناديل ورقية', warehouse: 'المخزن الرئيسي', qty: 60, cost: 90, group: g1 },
        { item: 'كلور مطهر', warehouse: 'المخزن الرئيسي', qty: 80, cost: 35, group: g1 },
        { item: 'معجون أسنان', warehouse: 'المخزن الرئيسي', qty: 150, cost: 20, group: g1 },
        { item: 'شامبو شعر', warehouse: 'المخزن الرئيسي', qty: 80, cost: 35, group: g1 },
        { item: 'صابون يد سائل', warehouse: 'المخزن الرئيسي', qty: 120, cost: 18, group: g1 },
        { item: 'سائل جلي', warehouse: 'المخزن الرئيسي', qty: 100, cost: 22, group: g1 },
        { item: 'حبل غسيل', warehouse: 'المخزن الرئيسي', qty: 400, cost: 5, group: g1 },
        { item: 'أكياس بلاستيك كبيرة', warehouse: 'المخزن الرئيسي', qty: 200, cost: 15, group: g1 },
        { item: 'صحون بلاستيك', warehouse: 'المخزن الرئيسي', qty: 600, cost: 3, group: g1 },
        { item: 'أكواب ورقية', warehouse: 'المخزن الرئيسي', qty: 80, cost: 40, group: g1 },
        { item: 'شوك بلاستيك', warehouse: 'المخزن الرئيسي', qty: 150, cost: 10, group: g1 },
        { item: 'مفرش طاولة', warehouse: 'المخزن الرئيسي', qty: 50, cost: 25, group: g1 },
        { item: 'فوط مطبخ', warehouse: 'المخزن الرئيسي', qty: 100, cost: 15, group: g1 },
        { item: 'مناديل جيب', warehouse: 'المخزن الرئيسي', qty: 120, cost: 12, group: g1 },
        { item: 'ورق ألومنيوم', warehouse: 'المخزن الرئيسي', qty: 60, cost: 20, group: g1 },
        { item: 'ورق تغليف شفاف', warehouse: 'المخزن الرئيسي', qty: 60, cost: 18, group: g1 },
        // مخزن الفرع
        { item: 'أرز بسمتي', warehouse: 'مخزن الفرع', qty: 120, cost: 35, group: g2 },
        { item: 'سكر أبيض', warehouse: 'مخزن الفرع', qty: 250, cost: 22, group: g2 },
        { item: 'زيت عباد الشمس', warehouse: 'مخزن الفرع', qty: 80, cost: 55, group: g2 },
        { item: 'شاي أسود', warehouse: 'مخزن الفرع', qty: 60, cost: 40, group: g2 },
        { item: 'صابون سائل', warehouse: 'مخزن الفرع', qty: 100, cost: 25, group: g2 },
        { item: 'مسحوق غسيل', warehouse: 'مخزن الفرع', qty: 60, cost: 65, group: g2 },
        { item: 'دقيق فاخر', warehouse: 'مخزن الفرع', qty: 50, cost: 80, group: g2 },
        { item: 'ملح طعام', warehouse: 'مخزن الفرع', qty: 100, cost: 8, group: g2 },
        { item: 'قهوة تركي', warehouse: 'مخزن الفرع', qty: 25, cost: 75, group: g2 },
        { item: 'حبل غسيل', warehouse: 'مخزن الفرع', qty: 200, cost: 5, group: g2 },
        { item: 'كلور مطهر', warehouse: 'مخزن الفرع', qty: 40, cost: 35, group: g2 },
        { item: 'معجون أسنان', warehouse: 'مخزن الفرع', qty: 60, cost: 20, group: g2 },
        // المخزن البارد
        { item: 'طماطم معلبة', warehouse: 'المخزن البارد', qty: 30, cost: 180, group: g3 },
        { item: 'تونة معلبة', warehouse: 'المخزن البارد', qty: 20, cost: 350, group: g3 },
        { item: 'فول مدمس', warehouse: 'المخزن البارد', qty: 40, cost: 150, group: g3 },
        { item: 'زيت زيتون', warehouse: 'المخزن البارد', qty: 15, cost: 180, group: g3 },
    ];
    for (const ob of openingBalances) {
        const iid = itemIds[ob.item];
        const wid = warehouseIds[ob.warehouse];
        insertOB.run({ item_id: iid, warehouse_id: wid, quantity: ob.qty, cost_price: ob.cost, group_id: ob.group });
        updateItemStock.run(ob.qty, iid);
    }
    console.log(`  ✓ ${openingBalances.length} opening balances (3 groups)`);

    // ── Prepared statements for invoices ──
    const insertPurchaseInv = db.prepare(`
        INSERT INTO purchase_invoices (invoice_number, supplier_id, invoice_date, payment_type, total_amount, paid_amount, remaining_amount, notes)
        VALUES (@invoice_number, @supplier_id, @invoice_date, @payment_type, @total_amount, @paid_amount, @remaining_amount, @notes)
    `);
    const insertPurchaseDetail = db.prepare(`
        INSERT INTO purchase_invoice_details (invoice_id, item_id, quantity, cost_price, total_price)
        VALUES (@invoice_id, @item_id, @quantity, @cost_price, @total_price)
    `);
    const insertTreasury = db.prepare(`
        INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type, customer_id, supplier_id, voucher_number)
        VALUES (@type, @amount, @transaction_date, @description, @related_invoice_id, @related_type, @customer_id, @supplier_id, @voucher_number)
    `);
    const updateBalance = db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?');

    let rcCounter = 0;
    let pyCounter = 0;
    function nextRC() { rcCounter++; return `RC-${String(rcCounter).padStart(4, '0')}`; }
    function nextPY() { pyCounter++; return `PY-${String(pyCounter).padStart(4, '0')}`; }

    // ══════════════════════════════════════════
    //  فواتير المشتريات - Purchase Invoices (12 فاتورة)
    // ══════════════════════════════════════════
    const purchaseInvoices = [
        {
            num: 'PC-0001', supplier: 'شركة النور للتجارة', date: '2026-01-05', type: 'cash',
            notes: 'توريد أرز وسكر - دفعة يناير',
            items: [
                { name: 'أرز بسمتي', qty: 150, cost: 34 },
                { name: 'سكر أبيض', qty: 300, cost: 21 },
            ]
        },
        {
            num: 'PC-0002', supplier: 'مؤسسة الأمل للتوريدات', date: '2026-01-10', type: 'credit',
            notes: 'توريد زيوت ومكرونة - آجل',
            items: [
                { name: 'زيت عباد الشمس', qty: 100, cost: 53 },
                { name: 'مكرونة اسباجتي', qty: 40, cost: 115 },
                { name: 'زيت ذرة', qty: 60, cost: 63 },
            ]
        },
        {
            num: 'PC-0003', supplier: 'شركة المستقبل للأغذية', date: '2026-01-15', type: 'cash',
            notes: 'توريد معلبات - يناير',
            items: [
                { name: 'طماطم معلبة', qty: 35, cost: 175 },
                { name: 'تونة معلبة', qty: 25, cost: 340 },
                { name: 'فول مدمس', qty: 40, cost: 145 },
            ]
        },
        {
            num: 'PC-0004', supplier: 'مصنع السلام للمنظفات', date: '2026-01-18', type: 'cash',
            notes: 'توريد منظفات - دفعة يناير',
            items: [
                { name: 'صابون سائل', qty: 120, cost: 24 },
                { name: 'مسحوق غسيل', qty: 60, cost: 63 },
                { name: 'معطر ملابس', qty: 50, cost: 28 },
                { name: 'كلور مطهر', qty: 40, cost: 33 },
            ]
        },
        {
            num: 'PC-0005', supplier: 'شركة النور للتجارة', date: '2026-01-22', type: 'credit',
            notes: 'توريد شاي ودقيق وبهارات - آجل',
            items: [
                { name: 'شاي أسود', qty: 80, cost: 38 },
                { name: 'دقيق فاخر', qty: 50, cost: 78 },
                { name: 'ملح طعام', qty: 150, cost: 7.5 },
                { name: 'فلفل أسود', qty: 60, cost: 23 },
                { name: 'كمون ناعم', qty: 50, cost: 18 },
            ]
        },
        {
            num: 'PC-0006', supplier: 'شركة البركة للزيوت', date: '2026-01-25', type: 'cash',
            notes: 'توريد زيوت ودهون',
            items: [
                { name: 'زيت عباد الشمس', qty: 80, cost: 54 },
                { name: 'زيت ذرة', qty: 50, cost: 64 },
                { name: 'سمن صناعي', qty: 40, cost: 88 },
                { name: 'زيت زيتون', qty: 20, cost: 175 },
            ]
        },
        {
            num: 'PC-0007', supplier: 'مؤسسة الأمل للتوريدات', date: '2026-01-28', type: 'cash',
            notes: 'توريد أدوات بلاستيك وورقيات',
            items: [
                { name: 'حبل غسيل', qty: 250, cost: 4.5 },
                { name: 'أكياس بلاستيك كبيرة', qty: 120, cost: 14 },
                { name: 'صحون بلاستيك', qty: 400, cost: 2.8 },
                { name: 'أكواب ورقية', qty: 50, cost: 38 },
                { name: 'شوك بلاستيك', qty: 80, cost: 9 },
                { name: 'مفرش طاولة', qty: 30, cost: 23 },
            ]
        },
        {
            num: 'PC-0008', supplier: 'شركة الوادي للمعلبات', date: '2026-02-01', type: 'credit',
            notes: 'توريد معلبات وبقوليات - آجل فبراير',
            items: [
                { name: 'طماطم معلبة', qty: 30, cost: 178 },
                { name: 'تونة معلبة', qty: 20, cost: 345 },
                { name: 'فول مدمس', qty: 30, cost: 148 },
                { name: 'عدس أصفر', qty: 80, cost: 43 },
                { name: 'فاصوليا بيضاء', qty: 50, cost: 48 },
                { name: 'لوبيا جافة', qty: 40, cost: 38 },
            ]
        },
        {
            num: 'PC-0009', supplier: 'مصنع السلام للمنظفات', date: '2026-02-04', type: 'cash',
            notes: 'توريد عناية شخصية',
            items: [
                { name: 'معجون أسنان', qty: 100, cost: 19 },
                { name: 'شامبو شعر', qty: 60, cost: 33 },
                { name: 'صابون يد سائل', qty: 80, cost: 17 },
                { name: 'سائل جلي', qty: 60, cost: 21 },
            ]
        },
        {
            num: 'PC-0010', supplier: 'مؤسسة الشرق للأدوات', date: '2026-02-06', type: 'cash',
            notes: 'توريد ورقيات متنوعة',
            items: [
                { name: 'مناديل ورقية', qty: 40, cost: 88 },
                { name: 'فوط مطبخ', qty: 60, cost: 14 },
                { name: 'مناديل جيب', qty: 80, cost: 11 },
                { name: 'ورق ألومنيوم', qty: 40, cost: 19 },
                { name: 'ورق تغليف شفاف', qty: 40, cost: 17 },
            ]
        },
        {
            num: 'PC-0011', supplier: 'شركة النور للتجارة', date: '2026-02-08', type: 'cash',
            notes: 'توريد مشروبات ساخنة',
            items: [
                { name: 'قهوة تركي', qty: 30, cost: 73 },
                { name: 'نسكافيه كلاسيك', qty: 25, cost: 118 },
                { name: 'شاي أخضر', qty: 50, cost: 33 },
                { name: 'كاكاو بودرة', qty: 20, cost: 53 },
            ]
        },
        {
            num: 'PC-0012', supplier: 'مصانع الدلتا للورق', date: '2026-02-10', type: 'credit',
            notes: 'توريد ورقيات بالجملة - آجل',
            items: [
                { name: 'مناديل ورقية', qty: 50, cost: 87 },
                { name: 'مناديل جيب', qty: 100, cost: 10.5 },
                { name: 'فوط مطبخ', qty: 80, cost: 13.5 },
            ]
        },
    ];

    let purchaseInvIds = {};
    for (const inv of purchaseInvoices) {
        const suppId = customerIds[inv.supplier];
        let total = 0;
        for (const it of inv.items) total += it.qty * it.cost;

        const paid = inv.type === 'cash' ? total : 0;
        const remaining = inv.type === 'cash' ? 0 : total;

        const info = insertPurchaseInv.run({
            invoice_number: inv.num, supplier_id: suppId, invoice_date: inv.date,
            payment_type: inv.type, total_amount: total, paid_amount: paid,
            remaining_amount: remaining, notes: inv.notes
        });
        const invId = Number(info.lastInsertRowid);
        purchaseInvIds[inv.num] = invId;

        for (const it of inv.items) {
            const iid = itemIds[it.name];
            insertPurchaseDetail.run({ invoice_id: invId, item_id: iid, quantity: it.qty, cost_price: it.cost, total_price: it.qty * it.cost });
            updateItemStock.run(it.qty, iid);
            db.prepare('UPDATE items SET cost_price = ? WHERE id = ?').run(it.cost, iid);
        }

        if (inv.type === 'cash') {
            insertTreasury.run({ type: 'expense', amount: total, transaction_date: inv.date,
                description: `فاتورة شراء ${inv.num} (كاش)`, related_invoice_id: invId,
                related_type: 'purchase', customer_id: null, supplier_id: null, voucher_number: nextPY() });
        } else {
            updateBalance.run(total, suppId);
        }
    }
    console.log(`  ✓ ${purchaseInvoices.length} purchase invoices`);

    // ══════════════════════════════════════════
    //  فواتير المبيعات - Sales Invoices (20 فاتورة)
    // ══════════════════════════════════════════
    const insertSalesInv = db.prepare(`
        INSERT INTO sales_invoices (invoice_number, customer_id, invoice_date, payment_type, total_amount, paid_amount, remaining_amount, notes)
        VALUES (@invoice_number, @customer_id, @invoice_date, @payment_type, @total_amount, @paid_amount, @remaining_amount, @notes)
    `);
    const insertSalesDetail = db.prepare(`
        INSERT INTO sales_invoice_details (invoice_id, item_id, quantity, sale_price, total_price)
        VALUES (@invoice_id, @item_id, @quantity, @sale_price, @total_price)
    `);
    const subtractStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?');

    const salesInvoices = [
        {
            num: 'SL-0001', customer: 'أحمد محمد علي', date: '2026-01-08', type: 'cash',
            notes: 'بيع مواد غذائية أساسية',
            items: [
                { name: 'أرز بسمتي', qty: 30, price: 45 },
                { name: 'سكر أبيض', qty: 60, price: 28 },
                { name: 'زيت عباد الشمس', qty: 15, price: 70 },
            ]
        },
        {
            num: 'SL-0002', customer: 'محمد حسن إبراهيم', date: '2026-01-10', type: 'credit',
            notes: 'بيع بالآجل - معلبات ومكرونة',
            items: [
                { name: 'شاي أسود', qty: 25, price: 55 },
                { name: 'مكرونة اسباجتي', qty: 12, price: 160 },
                { name: 'دقيق فاخر', qty: 18, price: 100 },
            ]
        },
        {
            num: 'SL-0003', customer: 'سارة أحمد عبدالله', date: '2026-01-12', type: 'cash',
            notes: 'بيع منظفات متنوعة',
            items: [
                { name: 'صابون سائل', qty: 35, price: 35 },
                { name: 'مسحوق غسيل', qty: 18, price: 85 },
                { name: 'معطر ملابس', qty: 12, price: 45 },
                { name: 'كلور مطهر', qty: 10, price: 48 },
            ]
        },
        {
            num: 'SL-0004', customer: 'خالد عبدالرحمن', date: '2026-01-15', type: 'cash',
            notes: 'طلبية كبيرة - مواد غذائية',
            items: [
                { name: 'أرز بسمتي', qty: 60, price: 45 },
                { name: 'سكر أبيض', qty: 120, price: 28 },
                { name: 'طماطم معلبة', qty: 12, price: 230 },
                { name: 'تونة معلبة', qty: 10, price: 420 },
                { name: 'فول مدمس', qty: 15, price: 195 },
            ]
        },
        {
            num: 'SL-0005', customer: 'فاطمة محمود', date: '2026-01-18', type: 'credit',
            notes: 'بيع آجل - أدوات ومنظفات',
            items: [
                { name: 'حبل غسيل', qty: 60, price: 8 },
                { name: 'أكياس بلاستيك كبيرة', qty: 35, price: 22 },
                { name: 'صحون بلاستيك', qty: 120, price: 5 },
                { name: 'مناديل ورقية', qty: 12, price: 120 },
            ]
        },
        {
            num: 'SL-0006', customer: 'عمر يوسف', date: '2026-01-20', type: 'cash',
            notes: 'بيع زيوت ومعلبات',
            items: [
                { name: 'زيت عباد الشمس', qty: 25, price: 70 },
                { name: 'زيت ذرة', qty: 15, price: 82 },
                { name: 'طماطم معلبة', qty: 8, price: 230 },
                { name: 'مكرونة اسباجتي', qty: 6, price: 160 },
            ]
        },
        {
            num: 'SL-0007', customer: 'ياسمين كامل', date: '2026-01-22', type: 'cash',
            notes: 'بيع مشروبات وبهارات',
            items: [
                { name: 'شاي أسود', qty: 18, price: 55 },
                { name: 'قهوة تركي', qty: 8, price: 95 },
                { name: 'فلفل أسود', qty: 15, price: 35 },
                { name: 'كمون ناعم', qty: 12, price: 28 },
            ]
        },
        {
            num: 'SL-0008', customer: 'مصطفى السيد', date: '2026-01-25', type: 'cash',
            notes: 'بيع عناية شخصية',
            items: [
                { name: 'معجون أسنان', qty: 20, price: 28 },
                { name: 'شامبو شعر', qty: 10, price: 48 },
                { name: 'صابون يد سائل', qty: 15, price: 25 },
                { name: 'سائل جلي', qty: 12, price: 30 },
            ]
        },
        {
            num: 'SL-0009', customer: 'هدى العربي', date: '2026-01-28', type: 'credit',
            notes: 'بيع آجل - بقوليات وحبوب',
            items: [
                { name: 'عدس أصفر', qty: 25, price: 58 },
                { name: 'فاصوليا بيضاء', qty: 20, price: 65 },
                { name: 'لوبيا جافة', qty: 15, price: 55 },
                { name: 'أرز بسمتي', qty: 20, price: 45 },
            ]
        },
        {
            num: 'SL-0010', customer: 'تامر فؤاد', date: '2026-01-30', type: 'cash',
            notes: 'بيع متنوع - مواد غذائية',
            items: [
                { name: 'سكر أبيض', qty: 50, price: 28 },
                { name: 'دقيق فاخر', qty: 12, price: 100 },
                { name: 'ملح طعام', qty: 30, price: 12 },
                { name: 'زيت عباد الشمس', qty: 10, price: 70 },
            ]
        },
        {
            num: 'SL-0011', customer: 'نورا خالد', date: '2026-02-01', type: 'cash',
            notes: 'بيع ورقيات وأدوات',
            items: [
                { name: 'مناديل ورقية', qty: 8, price: 120 },
                { name: 'فوط مطبخ', qty: 15, price: 22 },
                { name: 'مناديل جيب', qty: 20, price: 18 },
                { name: 'ورق ألومنيوم', qty: 10, price: 28 },
                { name: 'ورق تغليف شفاف', qty: 10, price: 25 },
            ]
        },
        {
            num: 'SL-0012', customer: 'سوبر ماركت الهدى', date: '2026-02-02', type: 'credit',
            notes: 'طلبية جملة للسوبر ماركت - آجل',
            items: [
                { name: 'أرز بسمتي', qty: 80, price: 44 },
                { name: 'سكر أبيض', qty: 150, price: 27 },
                { name: 'زيت عباد الشمس', qty: 50, price: 68 },
                { name: 'شاي أسود', qty: 40, price: 53 },
                { name: 'مكرونة اسباجتي', qty: 20, price: 155 },
                { name: 'صابون سائل', qty: 50, price: 33 },
            ]
        },
        {
            num: 'SL-0013', customer: 'ميني ماركت الأمانة', date: '2026-02-04', type: 'credit',
            notes: 'طلبية ميني ماركت - آجل',
            items: [
                { name: 'فول مدمس', qty: 20, price: 190 },
                { name: 'طماطم معلبة', qty: 15, price: 225 },
                { name: 'تونة معلبة', qty: 12, price: 415 },
                { name: 'عدس أصفر', qty: 30, price: 56 },
                { name: 'فاصوليا بيضاء', qty: 20, price: 63 },
            ]
        },
        {
            num: 'SL-0014', customer: 'أحمد محمد علي', date: '2026-02-06', type: 'credit',
            notes: 'طلبية ثانية لأحمد - آجل',
            items: [
                { name: 'أرز بسمتي', qty: 35, price: 45 },
                { name: 'تونة معلبة', qty: 6, price: 420 },
                { name: 'صابون سائل', qty: 25, price: 35 },
                { name: 'نسكافيه كلاسيك', qty: 8, price: 150 },
            ]
        },
        {
            num: 'SL-0015', customer: 'حسام الدين عبدالعزيز', date: '2026-02-08', type: 'cash',
            notes: 'بيع منظفات بالجملة',
            items: [
                { name: 'مسحوق غسيل', qty: 30, price: 85 },
                { name: 'معطر ملابس', qty: 25, price: 45 },
                { name: 'كلور مطهر', qty: 20, price: 48 },
                { name: 'سائل جلي', qty: 18, price: 30 },
            ]
        },
        {
            num: 'SL-0016', customer: 'إبراهيم سعيد', date: '2026-02-09', type: 'cash',
            notes: 'بيع متنوع',
            items: [
                { name: 'شاي أخضر', qty: 15, price: 48 },
                { name: 'كاكاو بودرة', qty: 8, price: 72 },
                { name: 'كركم', qty: 10, price: 25 },
                { name: 'سمن صناعي', qty: 8, price: 115 },
            ]
        },
        {
            num: 'SL-0017', customer: 'محمد حسن إبراهيم', date: '2026-02-10', type: 'cash',
            notes: 'بيع مواد غذائية - كاش',
            items: [
                { name: 'سكر أبيض', qty: 45, price: 28 },
                { name: 'زيت عباد الشمس', qty: 18, price: 70 },
                { name: 'ملح طعام', qty: 25, price: 12 },
            ]
        },
        {
            num: 'SL-0018', customer: 'خالد عبدالرحمن', date: '2026-02-11', type: 'cash',
            notes: 'بيع أدوات وبلاستيك',
            items: [
                { name: 'أكياس بلاستيك كبيرة', qty: 40, price: 22 },
                { name: 'صحون بلاستيك', qty: 80, price: 5 },
                { name: 'شوك بلاستيك', qty: 30, price: 15 },
                { name: 'أكواب ورقية', qty: 15, price: 55 },
                { name: 'مفرش طاولة', qty: 8, price: 35 },
            ]
        },
        {
            num: 'SL-0019', customer: 'سوبر ماركت الهدى', date: '2026-02-12', type: 'cash',
            notes: 'طلبية كاش للسوبر ماركت',
            items: [
                { name: 'معجون أسنان', qty: 30, price: 28 },
                { name: 'شامبو شعر', qty: 15, price: 48 },
                { name: 'صابون يد سائل', qty: 25, price: 25 },
                { name: 'مناديل ورقية', qty: 10, price: 120 },
            ]
        },
        {
            num: 'SL-0020', customer: 'ياسمين كامل', date: '2026-02-14', type: 'cash',
            notes: 'بيع متنوع',
            items: [
                { name: 'قهوة تركي', qty: 5, price: 95 },
                { name: 'شاي أسود', qty: 10, price: 55 },
                { name: 'دقيق فاخر', qty: 8, price: 100 },
                { name: 'أرز بسمتي', qty: 15, price: 45 },
            ]
        },
    ];

    let salesInvIds = {};
    for (const inv of salesInvoices) {
        const custId = customerIds[inv.customer];
        let total = 0;
        for (const it of inv.items) total += it.qty * it.price;

        const paid = inv.type === 'cash' ? total : 0;
        const remaining = inv.type === 'cash' ? 0 : total;

        const info = insertSalesInv.run({
            invoice_number: inv.num, customer_id: custId, invoice_date: inv.date,
            payment_type: inv.type, total_amount: total, paid_amount: paid,
            remaining_amount: remaining, notes: inv.notes
        });
        const invId = Number(info.lastInsertRowid);
        salesInvIds[inv.num] = invId;

        for (const it of inv.items) {
            const iid = itemIds[it.name];
            insertSalesDetail.run({ invoice_id: invId, item_id: iid, quantity: it.qty, sale_price: it.price, total_price: it.qty * it.price });
            subtractStock.run(it.qty, iid);
        }

        if (inv.type === 'cash') {
            insertTreasury.run({ type: 'income', amount: total, transaction_date: inv.date,
                description: `فاتورة بيع ${inv.num} (كاش)`, related_invoice_id: invId,
                related_type: 'sales', customer_id: null, supplier_id: null, voucher_number: nextRC() });
        } else {
            updateBalance.run(total, custId);
        }
    }
    console.log(`  ✓ ${salesInvoices.length} sales invoices`);

    // ══════════════════════════════════════════
    //  حركات خزينة مستقلة - Direct Treasury (20 حركة)
    // ══════════════════════════════════════════
    const directPayments = [
        // تحصيلات من عملاء
        { type: 'income', amount: 2000, date: '2026-01-14', desc: 'تحصيل جزئي من محمد حسن إبراهيم', customer: 'محمد حسن إبراهيم' },
        { type: 'income', amount: 5000, date: '2026-01-20', desc: 'تحصيل من خالد عبدالرحمن - رصيد افتتاحي', customer: 'خالد عبدالرحمن' },
        { type: 'income', amount: 3000, date: '2026-01-25', desc: 'تحصيل من أحمد محمد علي - رصيد سابق', customer: 'أحمد محمد علي' },
        { type: 'income', amount: 1500, date: '2026-01-30', desc: 'تحصيل من هدى العربي', customer: 'هدى العربي' },
        { type: 'income', amount: 4000, date: '2026-02-05', desc: 'تحصيل من سوبر ماركت الهدى', customer: 'سوبر ماركت الهدى' },
        { type: 'income', amount: 2500, date: '2026-02-08', desc: 'تحصيل من ميني ماركت الأمانة', customer: 'ميني ماركت الأمانة' },
        { type: 'income', amount: 2000, date: '2026-02-10', desc: 'تحصيل من فاطمة محمود', customer: 'فاطمة محمود' },
        { type: 'income', amount: 3500, date: '2026-02-12', desc: 'تحصيل من تامر فؤاد - رصيد افتتاحي', customer: 'تامر فؤاد' },
        // سداد لموردين
        { type: 'expense', amount: 4000, date: '2026-01-22', desc: 'سداد جزئي لمؤسسة الأمل للتوريدات', customer: 'مؤسسة الأمل للتوريدات' },
        { type: 'expense', amount: 3000, date: '2026-02-01', desc: 'سداد لشركة النور للتجارة', customer: 'شركة النور للتجارة' },
        { type: 'expense', amount: 5000, date: '2026-02-06', desc: 'سداد لشركة الوادي للمعلبات', customer: 'شركة الوادي للمعلبات' },
        { type: 'expense', amount: 2500, date: '2026-02-10', desc: 'سداد لمصانع الدلتا للورق', customer: 'مصانع الدلتا للورق' },
        // مصاريف عامة
        { type: 'expense', amount: 1500, date: '2026-01-15', desc: 'مصاريف نقل بضاعة - يناير', customer: null },
        { type: 'expense', amount: 800, date: '2026-01-25', desc: 'صيانة مكيفات المخزن', customer: null },
        { type: 'expense', amount: 2000, date: '2026-02-01', desc: 'إيجار المخزن - فبراير', customer: null },
        { type: 'expense', amount: 600, date: '2026-02-05', desc: 'فاتورة كهرباء المحل', customer: null },
        { type: 'expense', amount: 350, date: '2026-02-08', desc: 'مستلزمات مكتبية', customer: null },
        { type: 'expense', amount: 1200, date: '2026-02-12', desc: 'مصاريف نقل بضاعة - فبراير', customer: null },
        // إيرادات أخرى
        { type: 'income', amount: 500, date: '2026-02-03', desc: 'بيع كراتين فارغة', customer: null },
        { type: 'income', amount: 300, date: '2026-02-09', desc: 'تأجير جزء من المخزن ليوم', customer: null },
    ];
    for (const p of directPayments) {
        const custId = p.customer ? customerIds[p.customer] : null;
        const vn = p.type === 'income' ? nextRC() : nextPY();
        insertTreasury.run({ type: p.type, amount: p.amount, transaction_date: p.date,
            description: p.desc, related_invoice_id: null, related_type: null,
            customer_id: custId, supplier_id: null, voucher_number: vn });
        if (custId) {
            if (p.type === 'income') {
                updateBalance.run(-p.amount, custId);
            } else {
                updateBalance.run(-p.amount, custId);
            }
        }
    }
    console.log(`  ✓ ${directPayments.length} direct treasury transactions`);

    // ══════════════════════════════════════════
    //  مرتجعات المبيعات - Sales Returns (5 مرتجعات)
    // ══════════════════════════════════════════
    const insertSalesReturn = db.prepare(`
        INSERT INTO sales_returns (return_number, original_invoice_id, customer_id, return_date, total_amount, notes)
        VALUES (@return_number, @original_invoice_id, @customer_id, @return_date, @total_amount, @notes)
    `);
    const insertSRDetail = db.prepare(`
        INSERT INTO sales_return_details (return_id, item_id, quantity, price, total_price)
        VALUES (@return_id, @item_id, @quantity, @price, @total_price)
    `);

    // مرتجع 1: SL-0001 - أرز معيب
    {
        const custId = customerIds['أحمد محمد علي'];
        const invId = salesInvIds['SL-0001'];
        const retTotal = 8 * 45;
        const info = insertSalesReturn.run({ return_number: 'SR-0001', original_invoice_id: invId, customer_id: custId,
            return_date: '2026-01-15', total_amount: retTotal, notes: 'مرتجع أرز - عيب في التغليف' });
        const retId = Number(info.lastInsertRowid);
        insertSRDetail.run({ return_id: retId, item_id: itemIds['أرز بسمتي'], quantity: 8, price: 45, total_price: retTotal });
        updateItemStock.run(8, itemIds['أرز بسمتي']);
        updateBalance.run(-retTotal, custId);
        insertTreasury.run({ type: 'expense', amount: retTotal, transaction_date: '2026-01-15',
            description: 'مرتجع مبيعات - SR-0001', related_invoice_id: invId, related_type: 'sales',
            customer_id: custId, supplier_id: null, voucher_number: nextPY() });
    }

    // مرتجع 2: SL-0003 - منظفات تالفة
    {
        const custId = customerIds['سارة أحمد عبدالله'];
        const invId = salesInvIds['SL-0003'];
        const retTotal = 6 * 35 + 4 * 85;
        const info = insertSalesReturn.run({ return_number: 'SR-0002', original_invoice_id: invId, customer_id: custId,
            return_date: '2026-01-20', total_amount: retTotal, notes: 'مرتجع صابون ومسحوق غسيل - تالف' });
        const retId = Number(info.lastInsertRowid);
        insertSRDetail.run({ return_id: retId, item_id: itemIds['صابون سائل'], quantity: 6, price: 35, total_price: 210 });
        insertSRDetail.run({ return_id: retId, item_id: itemIds['مسحوق غسيل'], quantity: 4, price: 85, total_price: 340 });
        updateItemStock.run(6, itemIds['صابون سائل']);
        updateItemStock.run(4, itemIds['مسحوق غسيل']);
        updateBalance.run(-retTotal, custId);
        insertTreasury.run({ type: 'expense', amount: retTotal, transaction_date: '2026-01-20',
            description: 'مرتجع مبيعات - SR-0002', related_invoice_id: invId, related_type: 'sales',
            customer_id: custId, supplier_id: null, voucher_number: nextPY() });
    }

    // مرتجع 3: SL-0004 - طماطم وتونة
    {
        const custId = customerIds['خالد عبدالرحمن'];
        const invId = salesInvIds['SL-0004'];
        const retTotal = 3 * 230 + 2 * 420;
        const info = insertSalesReturn.run({ return_number: 'SR-0003', original_invoice_id: invId, customer_id: custId,
            return_date: '2026-01-25', total_amount: retTotal, notes: 'مرتجع معلبات - تاريخ صلاحية' });
        const retId = Number(info.lastInsertRowid);
        insertSRDetail.run({ return_id: retId, item_id: itemIds['طماطم معلبة'], quantity: 3, price: 230, total_price: 690 });
        insertSRDetail.run({ return_id: retId, item_id: itemIds['تونة معلبة'], quantity: 2, price: 420, total_price: 840 });
        updateItemStock.run(3, itemIds['طماطم معلبة']);
        updateItemStock.run(2, itemIds['تونة معلبة']);
        updateBalance.run(-retTotal, custId);
        insertTreasury.run({ type: 'expense', amount: retTotal, transaction_date: '2026-01-25',
            description: 'مرتجع مبيعات - SR-0003', related_invoice_id: invId, related_type: 'sales',
            customer_id: custId, supplier_id: null, voucher_number: nextPY() });
    }

    // مرتجع 4: SL-0012 - مكرونة للسوبر ماركت
    {
        const custId = customerIds['سوبر ماركت الهدى'];
        const invId = salesInvIds['SL-0012'];
        const retTotal = 5 * 155;
        const info = insertSalesReturn.run({ return_number: 'SR-0004', original_invoice_id: invId, customer_id: custId,
            return_date: '2026-02-08', total_amount: retTotal, notes: 'مرتجع مكرونة - كراتين تالفة' });
        const retId = Number(info.lastInsertRowid);
        insertSRDetail.run({ return_id: retId, item_id: itemIds['مكرونة اسباجتي'], quantity: 5, price: 155, total_price: retTotal });
        updateItemStock.run(5, itemIds['مكرونة اسباجتي']);
        updateBalance.run(-retTotal, custId);
        insertTreasury.run({ type: 'expense', amount: retTotal, transaction_date: '2026-02-08',
            description: 'مرتجع مبيعات - SR-0004', related_invoice_id: invId, related_type: 'sales',
            customer_id: custId, supplier_id: null, voucher_number: nextPY() });
    }

    // مرتجع 5: SL-0008 - شامبو
    {
        const custId = customerIds['مصطفى السيد'];
        const invId = salesInvIds['SL-0008'];
        const retTotal = 3 * 48;
        const info = insertSalesReturn.run({ return_number: 'SR-0005', original_invoice_id: invId, customer_id: custId,
            return_date: '2026-02-02', total_amount: retTotal, notes: 'مرتجع شامبو - عيب في العبوات' });
        const retId = Number(info.lastInsertRowid);
        insertSRDetail.run({ return_id: retId, item_id: itemIds['شامبو شعر'], quantity: 3, price: 48, total_price: retTotal });
        updateItemStock.run(3, itemIds['شامبو شعر']);
        updateBalance.run(-retTotal, custId);
        insertTreasury.run({ type: 'expense', amount: retTotal, transaction_date: '2026-02-02',
            description: 'مرتجع مبيعات - SR-0005', related_invoice_id: invId, related_type: 'sales',
            customer_id: custId, supplier_id: null, voucher_number: nextPY() });
    }
    console.log('  ✓ 5 sales returns');

    // ══════════════════════════════════════════
    //  مرتجعات المشتريات - Purchase Returns (4 مرتجعات)
    // ══════════════════════════════════════════
    const insertPurchaseReturn = db.prepare(`
        INSERT INTO purchase_returns (return_number, original_invoice_id, supplier_id, return_date, total_amount, notes)
        VALUES (@return_number, @original_invoice_id, @supplier_id, @return_date, @total_amount, @notes)
    `);
    const insertPRDetail = db.prepare(`
        INSERT INTO purchase_return_details (return_id, item_id, quantity, price, total_price)
        VALUES (@return_id, @item_id, @quantity, @price, @total_price)
    `);

    // مرتجع مشتريات 1: PC-0003 - طماطم معلبة
    {
        const suppId = customerIds['شركة المستقبل للأغذية'];
        const invId = purchaseInvIds['PC-0003'];
        const retTotal = 8 * 175;
        const info = insertPurchaseReturn.run({ return_number: 'PR-0001', original_invoice_id: invId, supplier_id: suppId,
            return_date: '2026-01-22', total_amount: retTotal, notes: 'مرتجع طماطم معلبة - تاريخ صلاحية قريب' });
        const retId = Number(info.lastInsertRowid);
        insertPRDetail.run({ return_id: retId, item_id: itemIds['طماطم معلبة'], quantity: 8, price: 175, total_price: retTotal });
        subtractStock.run(8, itemIds['طماطم معلبة']);
        insertTreasury.run({ type: 'income', amount: retTotal, transaction_date: '2026-01-22',
            description: 'مرتجع مشتريات - PR-0001', related_invoice_id: invId, related_type: 'purchase',
            customer_id: null, supplier_id: null, voucher_number: nextRC() });
    }

    // مرتجع مشتريات 2: PC-0004 - منظفات
    {
        const suppId = customerIds['مصنع السلام للمنظفات'];
        const invId = purchaseInvIds['PC-0004'];
        const retTotal = 10 * 24 + 5 * 63;
        const info = insertPurchaseReturn.run({ return_number: 'PR-0002', original_invoice_id: invId, supplier_id: suppId,
            return_date: '2026-01-28', total_amount: retTotal, notes: 'مرتجع صابون ومسحوق - عيب تصنيع' });
        const retId = Number(info.lastInsertRowid);
        insertPRDetail.run({ return_id: retId, item_id: itemIds['صابون سائل'], quantity: 10, price: 24, total_price: 240 });
        insertPRDetail.run({ return_id: retId, item_id: itemIds['مسحوق غسيل'], quantity: 5, price: 63, total_price: 315 });
        subtractStock.run(10, itemIds['صابون سائل']);
        subtractStock.run(5, itemIds['مسحوق غسيل']);
        insertTreasury.run({ type: 'income', amount: retTotal, transaction_date: '2026-01-28',
            description: 'مرتجع مشتريات - PR-0002', related_invoice_id: invId, related_type: 'purchase',
            customer_id: null, supplier_id: null, voucher_number: nextRC() });
    }

    // مرتجع مشتريات 3: PC-0008 - بقوليات
    {
        const suppId = customerIds['شركة الوادي للمعلبات'];
        const invId = purchaseInvIds['PC-0008'];
        const retTotal = 10 * 43 + 8 * 48;
        const info = insertPurchaseReturn.run({ return_number: 'PR-0003', original_invoice_id: invId, supplier_id: suppId,
            return_date: '2026-02-07', total_amount: retTotal, notes: 'مرتجع عدس وفاصوليا - رطوبة عالية' });
        const retId = Number(info.lastInsertRowid);
        insertPRDetail.run({ return_id: retId, item_id: itemIds['عدس أصفر'], quantity: 10, price: 43, total_price: 430 });
        insertPRDetail.run({ return_id: retId, item_id: itemIds['فاصوليا بيضاء'], quantity: 8, price: 48, total_price: 384 });
        subtractStock.run(10, itemIds['عدس أصفر']);
        subtractStock.run(8, itemIds['فاصوليا بيضاء']);
        insertTreasury.run({ type: 'income', amount: retTotal, transaction_date: '2026-02-07',
            description: 'مرتجع مشتريات - PR-0003', related_invoice_id: invId, related_type: 'purchase',
            customer_id: null, supplier_id: null, voucher_number: nextRC() });
    }

    // مرتجع مشتريات 4: PC-0009 - عناية شخصية
    {
        const suppId = customerIds['مصنع السلام للمنظفات'];
        const invId = purchaseInvIds['PC-0009'];
        const retTotal = 12 * 19;
        const info = insertPurchaseReturn.run({ return_number: 'PR-0004', original_invoice_id: invId, supplier_id: suppId,
            return_date: '2026-02-10', total_amount: retTotal, notes: 'مرتجع معجون أسنان - عبوات مكسورة' });
        const retId = Number(info.lastInsertRowid);
        insertPRDetail.run({ return_id: retId, item_id: itemIds['معجون أسنان'], quantity: 12, price: 19, total_price: retTotal });
        subtractStock.run(12, itemIds['معجون أسنان']);
        insertTreasury.run({ type: 'income', amount: retTotal, transaction_date: '2026-02-10',
            description: 'مرتجع مشتريات - PR-0004', related_invoice_id: invId, related_type: 'purchase',
            customer_id: null, supplier_id: null, voucher_number: nextRC() });
    }
    console.log('  ✓ 4 purchase returns');

    // ══════════════════════════════════════════
    //  الإعدادات - Settings
    // ══════════════════════════════════════════
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('company_name', 'شركة الحسابات المتقدمة للتجارة');
    insertSetting.run('company_phone', '0225559999');
    insertSetting.run('company_address', 'القاهرة - شارع التحرير - عمارة 15 - الدور الثالث');
    insertSetting.run('currency', 'جنيه');
    insertSetting.run('tax_rate', '0');
    insertSetting.run('invoice_footer', 'شكراً لتعاملكم معنا - البضاعة المباعة لا ترد ولا تستبدل');
    insertSetting.run('fiscal_year_start', '2026-01-01');
    console.log('  ✓ Settings configured');

    // ══════════════════════════════════════════
    //  ملخص - Summary
    // ══════════════════════════════════════════
    const stats = {
        units: db.prepare('SELECT COUNT(*) as c FROM units').get().c,
        warehouses: db.prepare('SELECT COUNT(*) as c FROM warehouses').get().c,
        customers: db.prepare("SELECT COUNT(*) as c FROM customers WHERE type IN ('customer','both')").get().c,
        suppliers: db.prepare("SELECT COUNT(*) as c FROM customers WHERE type IN ('supplier','both')").get().c,
        items: db.prepare('SELECT COUNT(*) as c FROM items WHERE is_deleted = 0').get().c,
        openingBalanceGroups: db.prepare('SELECT COUNT(*) as c FROM opening_balance_groups').get().c,
        openingBalances: db.prepare('SELECT COUNT(*) as c FROM opening_balances').get().c,
        purchaseInvoices: db.prepare('SELECT COUNT(*) as c FROM purchase_invoices').get().c,
        salesInvoices: db.prepare('SELECT COUNT(*) as c FROM sales_invoices').get().c,
        salesReturns: db.prepare('SELECT COUNT(*) as c FROM sales_returns').get().c,
        purchaseReturns: db.prepare('SELECT COUNT(*) as c FROM purchase_returns').get().c,
        treasuryTransactions: db.prepare('SELECT COUNT(*) as c FROM treasury_transactions').get().c,
        treasuryBalance: db.prepare("SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END), 0) as bal FROM treasury_transactions").get().bal,
    };

    console.log('\n════════════════════════════════════════════════');
    console.log('  ملخص البيانات التجريبية الشاملة');
    console.log('════════════════════════════════════════════════');
    console.log(`  وحدات القياس:         ${stats.units}`);
    console.log(`  المخازن:               ${stats.warehouses}`);
    console.log(`  العملاء:               ${stats.customers}`);
    console.log(`  الموردين:              ${stats.suppliers}`);
    console.log(`  الأصناف:               ${stats.items}`);
    console.log(`  مجموعات أرصدة أول المدة: ${stats.openingBalanceGroups}`);
    console.log(`  أرصدة أول المدة:       ${stats.openingBalances}`);
    console.log(`  فواتير المشتريات:      ${stats.purchaseInvoices}`);
    console.log(`  فواتير المبيعات:       ${stats.salesInvoices}`);
    console.log(`  مرتجعات المبيعات:      ${stats.salesReturns}`);
    console.log(`  مرتجعات المشتريات:     ${stats.purchaseReturns}`);
    console.log(`  حركات الخزينة:         ${stats.treasuryTransactions}`);
    console.log(`  رصيد الخزينة:          ${stats.treasuryBalance.toLocaleString()} جنيه`);
    console.log('════════════════════════════════════════════════\n');
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
const clearOnly = process.argv.includes('--clear');

try {
    ensureTables();
} catch (error) {
    console.error('[seed] Failed to ensure tables:', error.message);
    process.exit(1);
}

const runAll = db.transaction(() => {
    clearAllData();
    if (!clearOnly) {
        seedData();
    }
});

try {
    runAll();
    console.log(clearOnly ? '[seed] Data cleared successfully.' : '[seed] ✅ Comprehensive test data seeded successfully!');
} catch (error) {
    console.error('[seed] ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
} finally {
    db.close();
}
