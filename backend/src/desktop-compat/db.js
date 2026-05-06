const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dataDir = process.env.BACKEND_DATA_DIR
    ? path.resolve(process.cwd(), process.env.BACKEND_DATA_DIR)
    : path.resolve(process.cwd(), 'data');

fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'accounting.db');
const db = new Database(dbPath);

function isExpectedAddColumnError(error) {
    return /duplicate column name/i.test(String(error?.message || ''));
}

function runAddColumnMigration(sql, table, column) {
    try {
        db.exec(sql);
    } catch (error) {
        if (isExpectedAddColumnError(error)) {
            return false;
        }

        console.error(`[db-migration] Unexpected error while adding "${column}" to "${table}": ${error.message}`);
        throw error;
    }

    return true;
}

const TREASURY_VOUCHER_SCHEME_KEY = 'treasury_voucher_scheme_v2';

function formatTreasuryVoucherNumber(prefix, number) {
    return `${prefix}-${String(number).padStart(4, '0')}`;
}

function applyTreasuryVoucherSchemeMigration() {
    const schemeApplied = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get(TREASURY_VOUCHER_SCHEME_KEY);

    if (!schemeApplied) {
        const rows = db.prepare(`
            SELECT id, type
            FROM treasury_transactions
            WHERE type IN ('income', 'expense')
            ORDER BY id ASC
        `).all();

        const updateVoucher = db.prepare('UPDATE treasury_transactions SET voucher_number = ? WHERE id = ?');
        const saveFlag = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

        const migrationTx = db.transaction(() => {
            let incomeCounter = 0;
            let expenseCounter = 0;

            for (const row of rows) {
                if (row.type === 'income') {
                    incomeCounter += 1;
                    updateVoucher.run(formatTreasuryVoucherNumber('RCV', incomeCounter), row.id);
                } else if (row.type === 'expense') {
                    expenseCounter += 1;
                    updateVoucher.run(formatTreasuryVoucherNumber('PAY', expenseCounter), row.id);
                }
            }

            saveFlag.run(TREASURY_VOUCHER_SCHEME_KEY, new Date().toISOString());
        });

        migrationTx();
    }

    db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_treasury_voucher_number_unique
        ON treasury_transactions(voucher_number)
        WHERE type IN ('income', 'expense')
          AND voucher_number IS NOT NULL
          AND voucher_number != ''
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_treasury_autogen_voucher
        AFTER INSERT ON treasury_transactions
        FOR EACH ROW
        WHEN NEW.type IN ('income', 'expense') AND (NEW.voucher_number IS NULL OR TRIM(NEW.voucher_number) = '')
        BEGIN
            UPDATE treasury_transactions
            SET voucher_number = CASE
                WHEN NEW.type = 'income' THEN (
                    'RCV-' || printf('%04d', COALESCE((
                        SELECT MAX(CAST(SUBSTR(voucher_number, 5) AS INTEGER))
                        FROM treasury_transactions
                        WHERE type = 'income'
                          AND id <> NEW.id
                          AND voucher_number GLOB 'RCV-[0-9]*'
                    ), 0) + 1)
                )
                WHEN NEW.type = 'expense' THEN (
                    'PAY-' || printf('%04d', COALESCE((
                        SELECT MAX(CAST(SUBSTR(voucher_number, 5) AS INTEGER))
                        FROM treasury_transactions
                        WHERE type = 'expense'
                          AND id <> NEW.id
                          AND voucher_number GLOB 'PAY-[0-9]*'
                    ), 0) + 1)
                )
                ELSE NEW.voucher_number
            END
            WHERE id = NEW.id;
        END
    `);
}

function initDB() {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Performance optimizations
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('cache_size = -16000');
    db.pragma('synchronous = NORMAL');

    // 1. Units Table (جدول الوحدات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `);

    // 2. Items Table (جدول الأصناف)
    db.exec(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT UNIQUE,
            unit_id INTEGER,
            cost_price REAL DEFAULT 0,
            sale_price REAL DEFAULT 0,
            stock_quantity REAL DEFAULT 0,
            reorder_level INTEGER DEFAULT 0,
            FOREIGN KEY (unit_id) REFERENCES units(id)
        )
    `);

    // Add reorder_level column if it doesn't exist
    try {
        db.exec("ALTER TABLE items ADD COLUMN reorder_level INTEGER DEFAULT 0");
    } catch (err) {
        // Column likely already exists
    }

    // Add is_deleted column if it doesn't exist
    try {
        db.exec("ALTER TABLE items ADD COLUMN is_deleted INTEGER DEFAULT 0");
    } catch (err) {
        // Column likely already exists
    }

    // 3. Customers Table (جدول العملاء)
    db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            balance REAL DEFAULT 0,
            type TEXT DEFAULT 'customer',
            code INTEGER
        )
    `);

    // Attempt to add 'type' column if it doesn't exist (for existing databases)
    try {
        db.exec("ALTER TABLE customers ADD COLUMN type TEXT DEFAULT 'customer'");
    } catch (err) {
        // Column likely already exists, ignore error
    }

    // Attempt to add 'code' column if it doesn't exist (for existing databases)
    try {
        db.exec("ALTER TABLE customers ADD COLUMN code INTEGER");
        // Backfill existing customers with sequential codes
        const rows = db.prepare("SELECT id FROM customers WHERE code IS NULL ORDER BY id ASC").all();
        const update = db.prepare("UPDATE customers SET code = ? WHERE id = ?");
        rows.forEach((row, i) => update.run(i + 1, row.id));
    } catch (err) {
        // Column likely already exists
    }

    // Attempt to add 'opening_balance' column if it doesn't exist (for existing databases)
    try {
        db.exec("ALTER TABLE customers ADD COLUMN opening_balance REAL DEFAULT 0");
        // Backfill: copy current balance as opening_balance for existing customers
        db.exec("UPDATE customers SET opening_balance = balance WHERE opening_balance = 0 AND balance != 0");
    } catch (err) {
        // Column likely already exists
    }

    // 4. Suppliers Table (جدول الموردين)
    db.exec(`
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            balance REAL DEFAULT 0
        )
    `);

    // 5. Purchase Invoices Table (جدول فواتير المشتريات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT,
            supplier_id INTEGER,
            invoice_date TEXT DEFAULT CURRENT_DATE,
            payment_type TEXT DEFAULT 'cash', -- 'cash' or 'credit'
            total_amount REAL DEFAULT 0,
            discount_type TEXT DEFAULT 'amount',
            discount_value REAL DEFAULT 0,
            discount_amount REAL DEFAULT 0,
            paid_amount REAL DEFAULT 0,
            remaining_amount REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES customers(id)
        )
    `);

    // Add columns if they don't exist
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN payment_type TEXT DEFAULT 'cash'", 'purchase_invoices', 'payment_type');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN paid_amount REAL DEFAULT 0", 'purchase_invoices', 'paid_amount');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN remaining_amount REAL DEFAULT 0", 'purchase_invoices', 'remaining_amount');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN discount_type TEXT DEFAULT 'amount'", 'purchase_invoices', 'discount_type');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN discount_value REAL DEFAULT 0", 'purchase_invoices', 'discount_value');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN discount_amount REAL DEFAULT 0", 'purchase_invoices', 'discount_amount');

    // 6. Purchase Invoice Details Table (جدول تفاصيل فاتورة المشتريات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_invoice_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER,
            item_id INTEGER,
            quantity REAL,
            cost_price REAL,
            total_price REAL,
            FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    `);

    // 7. Sales Invoices Table (جدول فواتير المبيعات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT,
            customer_id INTEGER,
            invoice_date TEXT DEFAULT CURRENT_DATE,
            payment_type TEXT DEFAULT 'cash', -- 'cash' or 'credit'
            total_amount REAL DEFAULT 0,
            discount_type TEXT DEFAULT 'amount',
            discount_value REAL DEFAULT 0,
            discount_amount REAL DEFAULT 0,
            paid_amount REAL DEFAULT 0,
            remaining_amount REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    `);

    // Add columns if they don't exist
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN payment_type TEXT DEFAULT 'cash'", 'sales_invoices', 'payment_type');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN paid_amount REAL DEFAULT 0", 'sales_invoices', 'paid_amount');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN remaining_amount REAL DEFAULT 0", 'sales_invoices', 'remaining_amount');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN discount_type TEXT DEFAULT 'amount'", 'sales_invoices', 'discount_type');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN discount_value REAL DEFAULT 0", 'sales_invoices', 'discount_value');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN discount_amount REAL DEFAULT 0", 'sales_invoices', 'discount_amount');

    // 8. Sales Invoice Details Table (جدول تفاصيل فاتورة المبيعات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_invoice_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER,
            item_id INTEGER,
            quantity REAL,
            sale_price REAL,
            total_price REAL,
            FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    `);

    // 9. Treasury Transactions Table (جدول حركات الخزينة)
    db.exec(`
        CREATE TABLE IF NOT EXISTS treasury_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- 'income' (قبض) or 'expense' (صرف)
            amount REAL NOT NULL,
            transaction_date TEXT DEFAULT CURRENT_DATE,
            description TEXT,
            related_invoice_id INTEGER, -- Optional: Link to sales/purchase invoice
            related_type TEXT, -- 'sales' or 'purchase'
            customer_id INTEGER, -- Link to customer (for direct payments)
            supplier_id INTEGER, -- Link to supplier (for direct payments)
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        )
    `);

    // Add columns if they don't exist
    runAddColumnMigration("ALTER TABLE treasury_transactions ADD COLUMN customer_id INTEGER REFERENCES customers(id)", 'treasury_transactions', 'customer_id');
    runAddColumnMigration("ALTER TABLE treasury_transactions ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)", 'treasury_transactions', 'supplier_id');
    runAddColumnMigration("ALTER TABLE treasury_transactions ADD COLUMN voucher_number TEXT", 'treasury_transactions', 'voucher_number');

    // 10. Sales Shift Closings Table (جدول إقفالات ورديات المبيعات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_shift_closings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            period_start_at TEXT,
            period_end_at TEXT NOT NULL,
            sales_paid_total REAL NOT NULL DEFAULT 0,
            customer_collections_total REAL NOT NULL DEFAULT 0,
            drawer_amount REAL,
            difference_amount REAL,
            notes TEXT,
            created_by TEXT,
            treasury_transaction_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT
        )
    `);

    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN period_start_at TEXT", 'sales_shift_closings', 'period_start_at');
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN period_end_at TEXT", 'sales_shift_closings', 'period_end_at');
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN sales_paid_total REAL NOT NULL DEFAULT 0", 'sales_shift_closings', 'sales_paid_total');
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN customer_collections_total REAL NOT NULL DEFAULT 0", 'sales_shift_closings', 'customer_collections_total');
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN drawer_amount REAL", 'sales_shift_closings', 'drawer_amount');
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN difference_amount REAL", 'sales_shift_closings', 'difference_amount');
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN notes TEXT", 'sales_shift_closings', 'notes');
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN created_by TEXT", 'sales_shift_closings', 'created_by');
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN treasury_transaction_id INTEGER", 'sales_shift_closings', 'treasury_transaction_id');
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP", 'sales_shift_closings', 'created_at');
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN updated_at TEXT", 'sales_shift_closings', 'updated_at');

    // 11. Settings Table (جدول الإعدادات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);
    applyTreasuryVoucherSchemeMigration();

    // 12. Warehouses Table (جدول المخازن)
    db.exec(`
        CREATE TABLE IF NOT EXISTS warehouses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `);

    // 13. Opening Balances Table (أرصدة أول المدة)
    db.exec(`
        CREATE TABLE IF NOT EXISTS opening_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            warehouse_id INTEGER NOT NULL,
            quantity REAL DEFAULT 0,
            cost_price REAL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        )
    `);

    // 14. Opening Balance Groups (مجموعات أرصدة أول المدة)
    db.exec(`
        CREATE TABLE IF NOT EXISTS opening_balance_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    try {
        db.exec("ALTER TABLE opening_balances ADD COLUMN group_id INTEGER REFERENCES opening_balance_groups(id) ON DELETE CASCADE");
    } catch (err) {
        // Column likely exists
    }

    // 15. Sales Returns Table (جدول مردودات المبيعات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_number TEXT,
            original_invoice_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            return_date TEXT DEFAULT CURRENT_DATE,
            total_amount REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (original_invoice_id) REFERENCES sales_invoices(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    `);

    // 16. Sales Return Details Table (جدول تفاصيل مردودات المبيعات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_return_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            total_price REAL NOT NULL,
            FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    `);

    // 17. Purchase Returns Table (جدول مردودات المشتريات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_number TEXT,
            original_invoice_id INTEGER NOT NULL,
            supplier_id INTEGER NOT NULL,
            return_date TEXT DEFAULT CURRENT_DATE,
            total_amount REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (original_invoice_id) REFERENCES purchase_invoices(id),
            FOREIGN KEY (supplier_id) REFERENCES customers(id)
        )
    `);

    // 18. Purchase Return Details Table (جدول تفاصيل مردودات المشتريات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_return_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            total_price REAL NOT NULL,
            FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    `);

    // 19. User Permissions Table (جدول صلاحيات المستخدمين)
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_permissions (
            user_id INTEGER NOT NULL,
            page TEXT NOT NULL,
            can_view INTEGER DEFAULT 0,
            can_add INTEGER DEFAULT 0,
            can_edit INTEGER DEFAULT 0,
            can_delete INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, page),
            FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        )
    `);

    // 20. Damaged Stock Logs Table (جدول التالف)
    db.exec(`
        CREATE TABLE IF NOT EXISTS damaged_stock_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            warehouse_id INTEGER,
            quantity REAL NOT NULL,
            reason TEXT NOT NULL,
            batch_no TEXT,
            expiry_date TEXT,
            notes TEXT,
            damaged_date TEXT DEFAULT CURRENT_DATE,
            cost_price REAL DEFAULT 0,
            loss_amount REAL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT,
            FOREIGN KEY (item_id) REFERENCES items(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        )
    `);

    // ── Performance Indexes ──
    db.exec(`CREATE INDEX IF NOT EXISTS idx_items_unit_id ON items(unit_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_items_is_deleted ON items(is_deleted)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_id ON sales_invoices(customer_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_invoices_invoice_date ON sales_invoices(invoice_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_invoices_invoice_number ON sales_invoices(invoice_number)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_invoice_details_invoice_id ON sales_invoice_details(invoice_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_invoice_details_item_id ON sales_invoice_details(item_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier_id ON purchase_invoices(supplier_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_date ON purchase_invoices(invoice_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_number ON purchase_invoices(invoice_number)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_invoice_details_invoice_id ON purchase_invoice_details(invoice_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_invoice_details_item_id ON purchase_invoice_details(item_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_treasury_transactions_date ON treasury_transactions(transaction_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_treasury_transactions_type ON treasury_transactions(type)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_treasury_transactions_customer_id ON treasury_transactions(customer_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_shift_closings_period_end_at ON sales_shift_closings(period_end_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_shift_closings_created_at ON sales_shift_closings(created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_returns_customer_id ON sales_returns(customer_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_returns_original_invoice_id ON sales_returns(original_invoice_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_return_details_return_id ON sales_return_details(return_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_return_details_item_id ON sales_return_details(item_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier_id ON purchase_returns(supplier_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_returns_original_invoice_id ON purchase_returns(original_invoice_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_return_details_return_id ON purchase_return_details(return_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_return_details_item_id ON purchase_return_details(item_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_opening_balances_item_id ON opening_balances(item_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_opening_balances_warehouse_id ON opening_balances(warehouse_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_damaged_stock_logs_item_id ON damaged_stock_logs(item_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_damaged_stock_logs_warehouse_id ON damaged_stock_logs(warehouse_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_damaged_stock_logs_damaged_date ON damaged_stock_logs(damaged_date)`);

    // ── Data Safety Guard Rails ──
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_items_non_negative_stock_insert
        BEFORE INSERT ON items
        FOR EACH ROW
        WHEN NEW.stock_quantity < 0
        BEGIN
            SELECT RAISE(ABORT, 'negative stock_quantity is not allowed');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_items_non_negative_stock_update
        BEFORE UPDATE OF stock_quantity ON items
        FOR EACH ROW
        WHEN NEW.stock_quantity < 0
        BEGIN
            SELECT RAISE(ABORT, 'negative stock_quantity is not allowed');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_damaged_stock_logs_positive_quantity_insert
        BEFORE INSERT ON damaged_stock_logs
        FOR EACH ROW
        WHEN NEW.quantity <= 0
        BEGIN
            SELECT RAISE(ABORT, 'damaged quantity must be greater than zero');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_damaged_stock_logs_positive_quantity_update
        BEFORE UPDATE OF quantity ON damaged_stock_logs
        FOR EACH ROW
        WHEN NEW.quantity <= 0
        BEGIN
            SELECT RAISE(ABORT, 'damaged quantity must be greater than zero');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_sales_invoice_number_unique_insert
        BEFORE INSERT ON sales_invoices
        FOR EACH ROW
        WHEN NEW.invoice_number IS NOT NULL
          AND TRIM(NEW.invoice_number) != ''
          AND EXISTS (
              SELECT 1
              FROM sales_invoices
              WHERE TRIM(invoice_number) = TRIM(NEW.invoice_number)
          )
        BEGIN
            SELECT RAISE(ABORT, 'duplicate sales invoice number');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_sales_invoice_number_unique_update
        BEFORE UPDATE OF invoice_number ON sales_invoices
        FOR EACH ROW
        WHEN NEW.invoice_number IS NOT NULL
          AND TRIM(NEW.invoice_number) != ''
          AND EXISTS (
              SELECT 1
              FROM sales_invoices
              WHERE TRIM(invoice_number) = TRIM(NEW.invoice_number)
                AND id <> OLD.id
          )
        BEGIN
            SELECT RAISE(ABORT, 'duplicate sales invoice number');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_purchase_invoice_number_unique_insert
        BEFORE INSERT ON purchase_invoices
        FOR EACH ROW
        WHEN NEW.invoice_number IS NOT NULL
          AND TRIM(NEW.invoice_number) != ''
          AND EXISTS (
              SELECT 1
              FROM purchase_invoices
              WHERE TRIM(invoice_number) = TRIM(NEW.invoice_number)
          )
        BEGIN
            SELECT RAISE(ABORT, 'duplicate purchase invoice number');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_purchase_invoice_number_unique_update
        BEFORE UPDATE OF invoice_number ON purchase_invoices
        FOR EACH ROW
        WHEN NEW.invoice_number IS NOT NULL
          AND TRIM(NEW.invoice_number) != ''
          AND EXISTS (
              SELECT 1
              FROM purchase_invoices
              WHERE TRIM(invoice_number) = TRIM(NEW.invoice_number)
                AND id <> OLD.id
          )
        BEGIN
            SELECT RAISE(ABORT, 'duplicate purchase invoice number');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_sales_return_number_unique_insert
        BEFORE INSERT ON sales_returns
        FOR EACH ROW
        WHEN NEW.return_number IS NOT NULL
          AND TRIM(NEW.return_number) != ''
          AND EXISTS (
              SELECT 1
              FROM sales_returns
              WHERE TRIM(return_number) = TRIM(NEW.return_number)
          )
        BEGIN
            SELECT RAISE(ABORT, 'duplicate sales return number');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_sales_return_number_unique_update
        BEFORE UPDATE OF return_number ON sales_returns
        FOR EACH ROW
        WHEN NEW.return_number IS NOT NULL
          AND TRIM(NEW.return_number) != ''
          AND EXISTS (
              SELECT 1
              FROM sales_returns
              WHERE TRIM(return_number) = TRIM(NEW.return_number)
                AND id <> OLD.id
          )
        BEGIN
            SELECT RAISE(ABORT, 'duplicate sales return number');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_purchase_return_number_unique_insert
        BEFORE INSERT ON purchase_returns
        FOR EACH ROW
        WHEN NEW.return_number IS NOT NULL
          AND TRIM(NEW.return_number) != ''
          AND EXISTS (
              SELECT 1
              FROM purchase_returns
              WHERE TRIM(return_number) = TRIM(NEW.return_number)
          )
        BEGIN
            SELECT RAISE(ABORT, 'duplicate purchase return number');
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_purchase_return_number_unique_update
        BEFORE UPDATE OF return_number ON purchase_returns
        FOR EACH ROW
        WHEN NEW.return_number IS NOT NULL
          AND TRIM(NEW.return_number) != ''
          AND EXISTS (
              SELECT 1
              FROM purchase_returns
              WHERE TRIM(return_number) = TRIM(NEW.return_number)
                AND id <> OLD.id
          )
        BEGIN
            SELECT RAISE(ABORT, 'duplicate purchase return number');
        END
    `);

    console.log('Database initialized at:', dbPath);
}

module.exports = {
    db,
    initDB
};
