const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

// Wrap in async function to allow awaiting app.whenReady() if needed, 
// though top-level execution works in some contexts, explicit app handling is safer in Electron
async function main() {
    await app.whenReady();

    // Using the path discovered from the previous step
    const dbPath = 'C:\\Users\\gmyga\\AppData\\Roaming\\accounting-system\\accounting.db';
const db = new Database(dbPath);

console.log('Connecting to database at:', dbPath);

// Helper to run query safely
function run(query, params = []) {
    try {
        const stmt = db.prepare(query);
        return stmt.run(params);
    } catch (err) {
        console.error('Error running query:', query, err.message);
        return null;
    }
}

// 1. Warehouses
console.log('Seeding Warehouses...');
run("INSERT OR IGNORE INTO warehouses (name) VALUES ('المخزن الرئيسي')");

// 2. Units
console.log('Seeding Units...');
const units = ['قطعة', 'علبة', 'كرتونة', 'كيلو', 'لتر'];
const unitIds = {};
units.forEach(unit => {
    run("INSERT OR IGNORE INTO units (name) VALUES (?)", [unit]);
    const row = db.prepare("SELECT id FROM units WHERE name = ?").get(unit);
    if (row) unitIds[unit] = row.id;
});

// 3. Customers & Suppliers
console.log('Seeding Customers and Suppliers...');
const customers = [
    { name: 'عميل نقدي', type: 'customer', phone: '0000000000', address: '', balance: 0 },
    { name: 'سوبر ماركت الهدى', type: 'customer', phone: '01012345678', address: 'شارع التحرير', balance: 1000 },
    { name: 'شركة النور للتجارة', type: 'customer', phone: '01122334455', address: 'وسط البلد', balance: 500 },
    
    // Suppliers acting as customers (type='supplier')
    { name: 'شركة التوحيد', type: 'supplier', phone: '01233344455', address: 'المنطقة الصناعية', balance: 0 },
    { name: 'مؤسسة البركة', type: 'supplier', phone: '01555666777', address: 'العاشر من رمضان', balance: 2000 },
    { name: 'الشركة الهندسية', type: 'supplier', phone: '01099887766', address: 'مدينة نصر', balance: 0 }
];

customers.forEach(c => {
    const exists = db.prepare("SELECT id FROM customers WHERE name = ?").get(c.name);
    if (!exists) {
        run("INSERT INTO customers (name, phone, address, balance, type) VALUES (?, ?, ?, ?, ?)", 
            [c.name, c.phone, c.address, c.balance, c.type]);
    }
});

// Also seed 'suppliers' table independently as requested by analysis
const suppliersTableData = [
    { name: 'شركة التوحيد', phone: '01233344455', address: 'المنطقة الصناعية', balance: 0 },
    { name: 'مؤسسة البركة', phone: '01555666777', address: 'العاشر من رمضان', balance: 2000 },
    { name: 'الشركة الهندسية', phone: '01099887766', address: 'مدينة نصر', balance: 0 }
];

suppliersTableData.forEach(s => {
    const exists = db.prepare("SELECT id FROM suppliers WHERE name = ?").get(s.name);
    if (!exists) {
        run("INSERT INTO suppliers (name, phone, address, balance) VALUES (?, ?, ?, ?)",
            [s.name, s.phone, s.address, s.balance]);
    }
});

// 4. Items
console.log('Seeding Items...');
const items = [
    { name: 'سكر الأسرة 1 كيلو', unit: 'كيلو', barcode: '62210001', cost: 25, sale: 30, stock: 100 },
    { name: 'زيت عافية 1 لتر', unit: 'لتر', barcode: '62210002', cost: 100, sale: 110, stock: 50 },
    { name: 'شاي العروسة 40 جم', unit: 'علبة', barcode: '62210003', cost: 10, sale: 12, stock: 200 },
    { name: 'أرز الضحى 5 كيلو', unit: 'كيلو', barcode: '62210004', cost: 200, sale: 220, stock: 40 },
    { name: 'مكرونة الملكة 400 جم', unit: 'قطعة', barcode: '62210005', cost: 15, sale: 18, stock: 150 }
];

items.forEach(item => {
    const unitId = unitIds[item.unit] || unitIds['قطعة'];
    const exists = db.prepare("SELECT id FROM items WHERE barcode = ?").get(item.barcode);
    
    if (!exists) {
        const info = run("INSERT INTO items (name, barcode, unit_id, cost_price, sale_price, stock_quantity, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [item.name, item.barcode, unitId, item.cost, item.sale, item.stock, 10]);
        
        // Add opening balance for this item
        if (info && info.lastInsertRowid) {
            const itemId = info.lastInsertRowid;
            // Get main warehouse id
            const wRow = db.prepare("SELECT id FROM warehouses WHERE name = 'المخزن الرئيسي'").get();
            if (wRow) {
                run("INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price) VALUES (?, ?, ?, ?)",
                    [itemId, wRow.id, item.stock, item.cost]);
            }
        }
    }
});

console.log('Seeding completed successfully!');
    app.quit();
}

main();
