const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'accounting.db');
const db = new Database(dbPath);

function isExpectedAddColumnError(error) {
    return /duplicate column name/i.test(String(error?.message || ''));
}

function isNonConstantDefaultAddColumnError(error) {
    return /non-constant default/i.test(String(error?.message || ''));
}

function buildFallbackAddColumnSql(sql) {
    return String(sql || '').replace(/\s+DEFAULT\s+CURRENT_TIMESTAMP\b/i, '');
}

function runAddColumnMigration(sql, table, column) {
    try {
        db.exec(sql);
    } catch (error) {
        if (isExpectedAddColumnError(error)) {
            return false;
        }

        if (isNonConstantDefaultAddColumnError(error)) {
            const fallbackSql = buildFallbackAddColumnSql(sql);
            if (fallbackSql && fallbackSql !== sql) {
                db.exec(fallbackSql);

                if (column === 'created_at') {
                    db.prepare(`UPDATE ${table} SET ${column} = CURRENT_TIMESTAMP WHERE ${column} IS NULL`).run();
                }

                return true;
            }
        }

        console.error(`[db-migration] Unexpected error while adding "${column}" to "${table}": ${error.message}`);
        throw error;
    }

    return true;
}

function tableExists(name) {
    const row = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
        LIMIT 1
    `).get(name);
    return Boolean(row);
}

function applyUnifiedPartiesSchemaReset() {
    const partiesExists = tableExists('parties');

    const fullResetTables = [
        'sales_invoice_details',
        'purchase_invoice_details',
        'sales_shift_closings',
        'local_sales',
        'treasury_transactions',
        'sales_invoices',
        'purchase_invoices',
        'sales_return_details',
        'sales_returns',
        'purchase_return_details',
        'purchase_returns',
        'suppliers',
        'customers',
        'parties'
    ];

    const obsoleteTables = [
        'sales_return_details',
        'sales_returns',
        'purchase_return_details',
        'purchase_returns',
        'suppliers'
    ];

    let tablesToDrop = [];
    if (!partiesExists) {
        const hasLegacySchema = fullResetTables.some((table) => tableExists(table));
        if (hasLegacySchema) {
            tablesToDrop = fullResetTables;
        }
    } else {
        tablesToDrop = obsoleteTables.filter((table) => tableExists(table));
    }

    if (!tablesToDrop.length) {
        return;
    }

    db.pragma('foreign_keys = OFF');
    try {
        const resetTx = db.transaction(() => {
            tablesToDrop.forEach((table) => {
                db.exec(`DROP TABLE IF EXISTS ${table}`);
            });
        });
        resetTx();
    } finally {
        db.pragma('foreign_keys = ON');
    }
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
    applyUnifiedPartiesSchemaReset();

    // 1. Units Table (جدول الوحدات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `);

    runAddColumnMigration("ALTER TABLE units ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP", "units", "created_at");
    runAddColumnMigration("ALTER TABLE units ADD COLUMN updated_at TEXT", "units", "updated_at");
    runAddColumnMigration("ALTER TABLE units ADD COLUMN created_by TEXT", "units", "created_by");
    runAddColumnMigration("ALTER TABLE units ADD COLUMN updated_by TEXT", "units", "updated_by");

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

    // 3. Parties Table (جدول الجهات الموحد)
    db.exec(`
        CREATE TABLE IF NOT EXISTS parties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            balance REAL DEFAULT 0,
            type TEXT DEFAULT 'customer',
            code INTEGER,
            opening_balance REAL DEFAULT 0
        )
    `);

    runAddColumnMigration("ALTER TABLE parties ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP", "parties", "created_at");
    runAddColumnMigration("ALTER TABLE parties ADD COLUMN updated_at TEXT", "parties", "updated_at");
    runAddColumnMigration("ALTER TABLE parties ADD COLUMN created_by TEXT", "parties", "created_by");
    runAddColumnMigration("ALTER TABLE parties ADD COLUMN updated_by TEXT", "parties", "updated_by");

    // Attempt to add 'type' column if it doesn't exist (for existing databases)
    try {
        db.exec("ALTER TABLE parties ADD COLUMN type TEXT DEFAULT 'customer'");
    } catch (err) {
        // Column likely already exists, ignore error
    }

    // Attempt to add 'code' column if it doesn't exist (for existing databases)
    try {
        db.exec("ALTER TABLE parties ADD COLUMN code INTEGER");
        const rows = db.prepare("SELECT id FROM parties WHERE code IS NULL ORDER BY id ASC").all();
        const update = db.prepare("UPDATE parties SET code = ? WHERE id = ?");
        rows.forEach((row, i) => update.run(i + 1, row.id));
    } catch (err) {
        // Column likely already exists
    }

    // Attempt to add 'opening_balance' column if it doesn't exist (for existing databases)
    try {
        db.exec("ALTER TABLE parties ADD COLUMN opening_balance REAL DEFAULT 0");
        db.exec("UPDATE parties SET opening_balance = balance WHERE opening_balance = 0 AND balance != 0");
    } catch (err) {
        // Column likely already exists
    }

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
            FOREIGN KEY (supplier_id) REFERENCES parties(id)
        )
    `);

    // Add columns if they don't exist
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN payment_type TEXT DEFAULT 'cash'", 'purchase_invoices', 'payment_type');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN paid_amount REAL DEFAULT 0", 'purchase_invoices', 'paid_amount');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN remaining_amount REAL DEFAULT 0", 'purchase_invoices', 'remaining_amount');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN discount_type TEXT DEFAULT 'amount'", 'purchase_invoices', 'discount_type');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN discount_value REAL DEFAULT 0", 'purchase_invoices', 'discount_value');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN discount_amount REAL DEFAULT 0", 'purchase_invoices', 'discount_amount');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP", 'purchase_invoices', 'created_at');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN updated_at TEXT", 'purchase_invoices', 'updated_at');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN created_by TEXT", 'purchase_invoices', 'created_by');
    runAddColumnMigration("ALTER TABLE purchase_invoices ADD COLUMN updated_by TEXT", 'purchase_invoices', 'updated_by');

    // 6. Purchase Invoice Details Table (جدول تفاصيل فاتورة المشتريات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_invoice_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER,
            item_id INTEGER,
            quantity REAL,
            raw_quantity REAL,
            raw_weights TEXT,
            cost_price REAL,
            total_price REAL,
            FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    `);
    runAddColumnMigration("ALTER TABLE purchase_invoice_details ADD COLUMN raw_quantity REAL DEFAULT 0", 'purchase_invoice_details', 'raw_quantity');
    runAddColumnMigration("ALTER TABLE purchase_invoice_details ADD COLUMN raw_weights TEXT DEFAULT '[]'", 'purchase_invoice_details', 'raw_weights');

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
            FOREIGN KEY (customer_id) REFERENCES parties(id)
        )
    `);

    // Add columns if they don't exist
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN payment_type TEXT DEFAULT 'cash'", 'sales_invoices', 'payment_type');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN paid_amount REAL DEFAULT 0", 'sales_invoices', 'paid_amount');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN remaining_amount REAL DEFAULT 0", 'sales_invoices', 'remaining_amount');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN discount_type TEXT DEFAULT 'amount'", 'sales_invoices', 'discount_type');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN discount_value REAL DEFAULT 0", 'sales_invoices', 'discount_value');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN discount_amount REAL DEFAULT 0", 'sales_invoices', 'discount_amount');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP", 'sales_invoices', 'created_at');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN updated_at TEXT", 'sales_invoices', 'updated_at');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN created_by TEXT", 'sales_invoices', 'created_by');
    runAddColumnMigration("ALTER TABLE sales_invoices ADD COLUMN updated_by TEXT", 'sales_invoices', 'updated_by');

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
            customer_id INTEGER, -- Link to party (for direct payments)
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES parties(id)
        )
    `);

    // Add columns if they don't exist
    runAddColumnMigration("ALTER TABLE treasury_transactions ADD COLUMN customer_id INTEGER REFERENCES parties(id) ON DELETE CASCADE", 'treasury_transactions', 'customer_id');
    runAddColumnMigration("ALTER TABLE treasury_transactions ADD COLUMN voucher_number TEXT", 'treasury_transactions', 'voucher_number');
    runAddColumnMigration("ALTER TABLE treasury_transactions ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP", 'treasury_transactions', 'created_at');
    runAddColumnMigration("ALTER TABLE treasury_transactions ADD COLUMN updated_at TEXT", 'treasury_transactions', 'updated_at');
    runAddColumnMigration("ALTER TABLE treasury_transactions ADD COLUMN created_by TEXT", 'treasury_transactions', 'created_by');
    runAddColumnMigration("ALTER TABLE treasury_transactions ADD COLUMN updated_by TEXT", 'treasury_transactions', 'updated_by');

    db.exec("DROP TABLE IF EXISTS petty_expenses_bags");
    db.exec("DROP TABLE IF EXISTS petty_expenses_inspection");
    db.exec("DROP TABLE IF EXISTS petty_expenses_shipping_clearance");
    db.exec("DROP TABLE IF EXISTS petty_expenses_operation");

    db.exec(`
        CREATE TABLE IF NOT EXISTS petty_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL DEFAULT 'general',
            document_number TEXT UNIQUE,
            expense_date TEXT DEFAULT CURRENT_DATE,
            amount REAL NOT NULL DEFAULT 0,
            statement TEXT NOT NULL,
            notes TEXT,
            treasury_transaction_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (treasury_transaction_id) REFERENCES treasury_transactions(id)
        )
    `);

    runAddColumnMigration("ALTER TABLE petty_expenses ADD COLUMN category TEXT DEFAULT 'general'", 'petty_expenses', 'category');
    runAddColumnMigration("ALTER TABLE petty_expenses ADD COLUMN updated_at TEXT", 'petty_expenses', 'updated_at');
    runAddColumnMigration("ALTER TABLE petty_expenses ADD COLUMN created_by TEXT", 'petty_expenses', 'created_by');
    runAddColumnMigration("ALTER TABLE petty_expenses ADD COLUMN updated_by TEXT", 'petty_expenses', 'updated_by');

    db.exec(`
        CREATE TABLE IF NOT EXISTS under_collection_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_number TEXT UNIQUE,
            record_date TEXT DEFAULT CURRENT_DATE,
            container_count INTEGER NOT NULL DEFAULT 0,
            container_20 INTEGER DEFAULT 0,
            container_40 INTEGER DEFAULT 0,
            statement TEXT NOT NULL,
            invoice_number TEXT NOT NULL,
            tons_count REAL NOT NULL DEFAULT 0,
            ton_price REAL NOT NULL DEFAULT 0,
            total_usd REAL NOT NULL DEFAULT 0,
            remaining_type TEXT DEFAULT 'percent',
            remaining_value REAL NOT NULL DEFAULT 0,
            remaining_usd REAL NOT NULL DEFAULT 0,
            is_collected INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    runAddColumnMigration("ALTER TABLE under_collection_records ADD COLUMN remaining_type TEXT DEFAULT 'percent'", 'under_collection_records', 'remaining_type');
    runAddColumnMigration("ALTER TABLE under_collection_records ADD COLUMN remaining_value REAL NOT NULL DEFAULT 0", 'under_collection_records', 'remaining_value');
    runAddColumnMigration("ALTER TABLE under_collection_records ADD COLUMN remaining_usd REAL NOT NULL DEFAULT 0", 'under_collection_records', 'remaining_usd');

    db.exec(`
        CREATE TABLE IF NOT EXISTS remaining_under_collection_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_number TEXT UNIQUE,
            record_date TEXT DEFAULT CURRENT_DATE,
            statement TEXT NOT NULL,
            invoice_total REAL NOT NULL DEFAULT 0,
            arrival_date TEXT DEFAULT CURRENT_DATE,
            arrival_amount REAL NOT NULL DEFAULT 0,
            remaining_amount REAL NOT NULL DEFAULT 0,
            is_collected INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS export_revenues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_number TEXT UNIQUE,
            record_date TEXT DEFAULT CURRENT_DATE,
            amount REAL NOT NULL DEFAULT 0,
            currency TEXT,
            exchange_rate REAL NOT NULL DEFAULT 0,
            amount_egp REAL NOT NULL DEFAULT 0,
            statement TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS local_sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_number TEXT UNIQUE,
            record_date TEXT DEFAULT CURRENT_DATE,
            customer_id INTEGER NOT NULL,
            quantity REAL NOT NULL DEFAULT 0,
            price REAL NOT NULL DEFAULT 0,
            total REAL NOT NULL DEFAULT 0,
            statement TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES parties(id)
        )
    `);

    runAddColumnMigration("ALTER TABLE local_sales ADD COLUMN updated_at TEXT", 'local_sales', 'updated_at');
    runAddColumnMigration("ALTER TABLE local_sales ADD COLUMN created_by TEXT", 'local_sales', 'created_by');
    runAddColumnMigration("ALTER TABLE local_sales ADD COLUMN updated_by TEXT", 'local_sales', 'updated_by');

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
    runAddColumnMigration("ALTER TABLE sales_shift_closings ADD COLUMN updated_by TEXT", 'sales_shift_closings', 'updated_by');

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
    db.exec(`INSERT OR IGNORE INTO warehouses (id, name) VALUES (1, '__main_warehouse__')`);

    runAddColumnMigration("ALTER TABLE warehouses ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP", 'warehouses', 'created_at');
    runAddColumnMigration("ALTER TABLE warehouses ADD COLUMN updated_at TEXT", 'warehouses', 'updated_at');
    runAddColumnMigration("ALTER TABLE warehouses ADD COLUMN created_by TEXT", 'warehouses', 'created_by');
    runAddColumnMigration("ALTER TABLE warehouses ADD COLUMN updated_by TEXT", 'warehouses', 'updated_by');

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

    runAddColumnMigration("ALTER TABLE opening_balances ADD COLUMN updated_at TEXT", 'opening_balances', 'updated_at');
    runAddColumnMigration("ALTER TABLE opening_balances ADD COLUMN created_by TEXT", 'opening_balances', 'created_by');
    runAddColumnMigration("ALTER TABLE opening_balances ADD COLUMN updated_by TEXT", 'opening_balances', 'updated_by');
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

    runAddColumnMigration("ALTER TABLE damaged_stock_logs ADD COLUMN created_by TEXT", 'damaged_stock_logs', 'created_by');
    runAddColumnMigration("ALTER TABLE damaged_stock_logs ADD COLUMN updated_by TEXT", 'damaged_stock_logs', 'updated_by');

    // ── Performance Indexes ──
    db.exec(`CREATE INDEX IF NOT EXISTS idx_items_unit_id ON items(unit_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_items_is_deleted ON items(is_deleted)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(type)`);
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
    db.exec(`CREATE INDEX IF NOT EXISTS idx_under_collection_records_date ON under_collection_records(record_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_under_collection_records_invoice_number ON under_collection_records(invoice_number)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_remaining_under_collection_records_date ON remaining_under_collection_records(record_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_remaining_under_collection_records_document_number ON remaining_under_collection_records(document_number)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_export_revenues_date ON export_revenues(record_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_export_revenues_document_number ON export_revenues(document_number)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_local_sales_date ON local_sales(record_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_local_sales_document_number ON local_sales(document_number)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_local_sales_customer_id ON local_sales(customer_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_shift_closings_period_end_at ON sales_shift_closings(period_end_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_shift_closings_created_at ON sales_shift_closings(created_at)`);
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

    // Inventory Transactions (أستاذ المخازن)
    db.exec(`
        CREATE TABLE IF NOT EXISTS inventory_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            warehouse_id INTEGER DEFAULT 1,
            transaction_type TEXT NOT NULL, -- 'opening_balance', 'purchase', 'sale', 'damaged'
            quantity REAL NOT NULL, -- Positive for incoming, negative for outgoing
            reference_id INTEGER,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    `);

    runAddColumnMigration("ALTER TABLE inventory_transactions ADD COLUMN updated_at TEXT", 'inventory_transactions', 'updated_at');
    runAddColumnMigration("ALTER TABLE inventory_transactions ADD COLUMN created_by TEXT", 'inventory_transactions', 'created_by');
    runAddColumnMigration("ALTER TABLE inventory_transactions ADD COLUMN updated_by TEXT", 'inventory_transactions', 'updated_by');
    db.exec(`UPDATE opening_balances SET warehouse_id = 1 WHERE warehouse_id IS NULL OR warehouse_id <> 1`);
    db.exec(`UPDATE damaged_stock_logs SET warehouse_id = 1 WHERE warehouse_id IS NULL OR warehouse_id <> 1`);
    db.exec(`UPDATE inventory_transactions SET warehouse_id = 1 WHERE warehouse_id IS NULL OR warehouse_id <> 1`);
    db.exec(`DELETE FROM warehouses WHERE id <> 1`);
    db.exec(`UPDATE warehouses SET name = 'المخزن الرئيسي' WHERE id = 1`);

    // Add triggers to automatically record inventory transactions
    // 1. Opening Balances
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_inventory_after_opening_balance_insert
        AFTER INSERT ON opening_balances
        FOR EACH ROW
        BEGIN
            INSERT INTO inventory_transactions (item_id, warehouse_id, transaction_type, quantity, reference_id, created_at)
            VALUES (NEW.item_id, NEW.warehouse_id, 'opening_balance', NEW.quantity, NEW.id, CURRENT_TIMESTAMP);
        END
    `);

    // 2. Purchases
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_inventory_after_purchase_detail_insert
        AFTER INSERT ON purchase_invoice_details
        FOR EACH ROW
        BEGIN
            INSERT INTO inventory_transactions (item_id, warehouse_id, transaction_type, quantity, reference_id, created_at)
            VALUES (NEW.item_id, 1, 'purchase', NEW.quantity, NEW.invoice_id, CURRENT_TIMESTAMP);
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_inventory_after_purchase_detail_delete
        AFTER DELETE ON purchase_invoice_details
        FOR EACH ROW
        BEGIN
            DELETE FROM inventory_transactions
            WHERE transaction_type = 'purchase' AND item_id = OLD.item_id AND reference_id = OLD.invoice_id AND quantity = OLD.quantity;
        END
    `);

    // 3. Sales
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_inventory_after_sales_detail_insert
        AFTER INSERT ON sales_invoice_details
        FOR EACH ROW
        BEGIN
            INSERT INTO inventory_transactions (item_id, warehouse_id, transaction_type, quantity, reference_id, created_at)
            VALUES (NEW.item_id, 1, 'sale', -NEW.quantity, NEW.invoice_id, CURRENT_TIMESTAMP);
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_inventory_after_sales_detail_delete
        AFTER DELETE ON sales_invoice_details
        FOR EACH ROW
        BEGIN
            DELETE FROM inventory_transactions
            WHERE transaction_type = 'sale' AND item_id = OLD.item_id AND reference_id = OLD.invoice_id AND quantity = -OLD.quantity;
        END
    `);

    // 4. Damaged Stock
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_inventory_after_damaged_stock_insert
        AFTER INSERT ON damaged_stock_logs
        FOR EACH ROW
        BEGIN
            INSERT INTO inventory_transactions (item_id, warehouse_id, transaction_type, quantity, reference_id, created_at)
            VALUES (NEW.item_id, NEW.warehouse_id, 'damaged', -NEW.quantity, NEW.id, CURRENT_TIMESTAMP);
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_inventory_after_damaged_stock_delete
        AFTER DELETE ON damaged_stock_logs
        FOR EACH ROW
        BEGIN
            DELETE FROM inventory_transactions
            WHERE transaction_type = 'damaged' AND item_id = OLD.item_id AND reference_id = OLD.id AND quantity = -OLD.quantity;
        END
    `);

    // Migrate old data if inventory_transactions is empty
    const hasTransactions = db.prepare('SELECT 1 FROM inventory_transactions LIMIT 1').get();
    if (!hasTransactions) {
        const resetTx = db.transaction(() => {
            // Opening balances
            db.exec(`
                INSERT INTO inventory_transactions (item_id, warehouse_id, transaction_type, quantity, reference_id, created_at)
                SELECT item_id, warehouse_id, 'opening_balance', quantity, id, CURRENT_TIMESTAMP
                FROM opening_balances
            `);
            // Purchases
            db.exec(`
                INSERT INTO inventory_transactions (item_id, warehouse_id, transaction_type, quantity, reference_id, created_at)
                SELECT pid.item_id, 1, 'purchase', pid.quantity, pid.invoice_id, pi.created_at
                FROM purchase_invoice_details pid
                JOIN purchase_invoices pi ON pid.invoice_id = pi.id
            `);
            // Sales
            db.exec(`
                INSERT INTO inventory_transactions (item_id, warehouse_id, transaction_type, quantity, reference_id, created_at)
                SELECT sid.item_id, 1, 'sale', -sid.quantity, sid.invoice_id, si.created_at
                FROM sales_invoice_details sid
                JOIN sales_invoices si ON sid.invoice_id = si.id
            `);
            // Damaged
            db.exec(`
                INSERT INTO inventory_transactions (item_id, warehouse_id, transaction_type, quantity, reference_id, created_at)
                SELECT item_id, warehouse_id, 'damaged', -quantity, id, CURRENT_TIMESTAMP
                FROM damaged_stock_logs
            `);
        });
        resetTx();
    }

    // Party Ledger (دفتر أستاذ الجهات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS party_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            party_id INTEGER NOT NULL,
            transaction_type TEXT NOT NULL, -- 'opening_balance', 'sales_invoice', 'purchase_invoice', 'treasury_income', 'treasury_expense'
            amount REAL NOT NULL, -- Positive = They owe us more (or we owe them less). Negative = They owe us less (or we owe them more).
            transaction_date TEXT DEFAULT CURRENT_DATE,
            reference_id INTEGER,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (party_id) REFERENCES parties(id)
        )
    `);

    runAddColumnMigration("ALTER TABLE party_ledger ADD COLUMN updated_at TEXT", 'party_ledger', 'updated_at');
    runAddColumnMigration("ALTER TABLE party_ledger ADD COLUMN created_by TEXT", 'party_ledger', 'created_by');
    runAddColumnMigration("ALTER TABLE party_ledger ADD COLUMN updated_by TEXT", 'party_ledger', 'updated_by');

    // Keep parties.balance derived from party_ledger so every screen reads the same number.
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_parties_balance_after_ledger_insert
        AFTER INSERT ON party_ledger
        FOR EACH ROW
        BEGIN
            UPDATE parties SET balance = balance + NEW.amount WHERE id = NEW.party_id;
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_parties_balance_after_ledger_delete
        AFTER DELETE ON party_ledger
        FOR EACH ROW
        BEGIN
            UPDATE parties SET balance = balance - OLD.amount WHERE id = OLD.party_id;
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_parties_balance_after_ledger_update
        AFTER UPDATE OF amount, party_id ON party_ledger
        FOR EACH ROW
        BEGIN
            UPDATE parties SET balance = balance - OLD.amount WHERE id = OLD.party_id;
            UPDATE parties SET balance = balance + NEW.amount WHERE id = NEW.party_id;
        END
    `);

    // 1. Sales Invoices
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_sales_invoice_insert
        AFTER INSERT ON sales_invoices
        FOR EACH ROW
        BEGIN
            INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
            VALUES (NEW.customer_id, 'sales_invoice', NEW.total_amount - NEW.paid_amount, NEW.invoice_date, NEW.id, NEW.created_at);
        END
    `);

    db.exec(`DROP TRIGGER IF EXISTS trg_party_ledger_after_sales_invoice_update`);
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_sales_invoice_update
        AFTER UPDATE OF total_amount, paid_amount, invoice_date, customer_id ON sales_invoices
        FOR EACH ROW
        BEGIN
            UPDATE party_ledger
            SET amount = NEW.total_amount - NEW.paid_amount,
                transaction_date = NEW.invoice_date,
                party_id = NEW.customer_id
            WHERE transaction_type = 'sales_invoice' AND reference_id = NEW.id;
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_sales_invoice_delete
        AFTER DELETE ON sales_invoices
        FOR EACH ROW
        BEGIN
            DELETE FROM party_ledger
            WHERE transaction_type = 'sales_invoice' AND reference_id = OLD.id;
        END
    `);

    // 2. Purchase Invoices
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_purchase_invoice_insert
        AFTER INSERT ON purchase_invoices
        FOR EACH ROW
        BEGIN
            INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
            VALUES (NEW.supplier_id, 'purchase_invoice', -(NEW.total_amount - NEW.paid_amount), NEW.invoice_date, NEW.id, NEW.created_at);
        END
    `);

    db.exec(`DROP TRIGGER IF EXISTS trg_party_ledger_after_purchase_invoice_update`);
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_purchase_invoice_update
        AFTER UPDATE OF total_amount, paid_amount, invoice_date, supplier_id ON purchase_invoices
        FOR EACH ROW
        BEGIN
            UPDATE party_ledger
            SET amount = -(NEW.total_amount - NEW.paid_amount),
                transaction_date = NEW.invoice_date,
                party_id = NEW.supplier_id
            WHERE transaction_type = 'purchase_invoice' AND reference_id = NEW.id;
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_purchase_invoice_delete
        AFTER DELETE ON purchase_invoices
        FOR EACH ROW
        BEGIN
            DELETE FROM party_ledger
            WHERE transaction_type = 'purchase_invoice' AND reference_id = OLD.id;
        END
    `);

    // 3. Treasury Transactions
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_treasury_insert
        AFTER INSERT ON treasury_transactions
        FOR EACH ROW
        WHEN NEW.customer_id IS NOT NULL
        BEGIN
            INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
            VALUES (
                NEW.customer_id, 
                CASE WHEN NEW.type = 'income' THEN 'treasury_income' ELSE 'treasury_expense' END,
                CASE WHEN NEW.type = 'income' THEN -NEW.amount ELSE NEW.amount END,
                NEW.transaction_date,
                NEW.id,
                NEW.created_at
            );
        END
    `);

    db.exec(`DROP TRIGGER IF EXISTS trg_party_ledger_after_treasury_update`);
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_treasury_update
        AFTER UPDATE OF amount, type, transaction_date, customer_id ON treasury_transactions
        FOR EACH ROW
        BEGIN
            UPDATE party_ledger
            SET amount = CASE WHEN NEW.type = 'income' THEN -NEW.amount ELSE NEW.amount END,
                transaction_type = CASE WHEN NEW.type = 'income' THEN 'treasury_income' ELSE 'treasury_expense' END,
                transaction_date = NEW.transaction_date,
                party_id = NEW.customer_id
            WHERE transaction_type IN ('treasury_income', 'treasury_expense') AND reference_id = NEW.id;

            DELETE FROM party_ledger
            WHERE NEW.customer_id IS NULL
              AND transaction_type IN ('treasury_income', 'treasury_expense')
              AND reference_id = NEW.id;

            INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
            SELECT
                NEW.customer_id,
                CASE WHEN NEW.type = 'income' THEN 'treasury_income' ELSE 'treasury_expense' END,
                CASE WHEN NEW.type = 'income' THEN -NEW.amount ELSE NEW.amount END,
                NEW.transaction_date,
                NEW.id,
                NEW.created_at
            WHERE NEW.customer_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM party_ledger
                  WHERE transaction_type IN ('treasury_income', 'treasury_expense')
                    AND reference_id = NEW.id
              );
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_treasury_delete
        AFTER DELETE ON treasury_transactions
        FOR EACH ROW
        WHEN OLD.customer_id IS NOT NULL
        BEGIN
            DELETE FROM party_ledger
            WHERE transaction_type IN ('treasury_income', 'treasury_expense') AND reference_id = OLD.id;
        END
    `);

    // 4. Opening Balances
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_party_insert
        AFTER INSERT ON parties
        FOR EACH ROW
        WHEN NEW.opening_balance != 0
        BEGIN
            INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
            VALUES (NEW.id, 'opening_balance', NEW.opening_balance, CURRENT_DATE, NEW.id, CURRENT_TIMESTAMP);
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_party_update_opening
        AFTER UPDATE OF opening_balance ON parties
        FOR EACH ROW
        WHEN NEW.opening_balance != OLD.opening_balance
        BEGIN
            UPDATE party_ledger
            SET amount = NEW.opening_balance
            WHERE transaction_type = 'opening_balance' AND party_id = NEW.id;
            
            INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
            SELECT NEW.id, 'opening_balance', NEW.opening_balance, CURRENT_DATE, NEW.id, CURRENT_TIMESTAMP
            WHERE NOT EXISTS (SELECT 1 FROM party_ledger WHERE transaction_type = 'opening_balance' AND party_id = NEW.id);
        END
    `);

    // 5. Local Sales
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_local_sale_insert
        AFTER INSERT ON local_sales
        FOR EACH ROW
        BEGIN
            INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
            VALUES (NEW.customer_id, 'local_sale', NEW.total, NEW.record_date, NEW.id, NEW.created_at);
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_local_sale_update
        AFTER UPDATE OF total, customer_id, record_date ON local_sales
        FOR EACH ROW
        BEGIN
            UPDATE party_ledger
            SET amount = NEW.total,
                party_id = NEW.customer_id,
                transaction_date = NEW.record_date
            WHERE transaction_type = 'local_sale' AND reference_id = NEW.id;
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_party_ledger_after_local_sale_delete
        AFTER DELETE ON local_sales
        FOR EACH ROW
        BEGIN
            DELETE FROM party_ledger
            WHERE transaction_type = 'local_sale' AND reference_id = OLD.id;
        END
    `);

    // Migrate old data if party_ledger is empty
    const hasPartyLedger = db.prepare('SELECT 1 FROM party_ledger LIMIT 1').get();
    if (!hasPartyLedger) {
        const resetPartyTx = db.transaction(() => {
            // Opening balances
            db.exec(`
                INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
                SELECT id, 'opening_balance', opening_balance, CURRENT_DATE, id, CURRENT_TIMESTAMP
                FROM parties
                WHERE opening_balance != 0
            `);
            // Sales Invoices
            db.exec(`
                INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
                SELECT customer_id, 'sales_invoice', total_amount - paid_amount, invoice_date, id, created_at
                FROM sales_invoices
            `);
            // Purchase Invoices
            db.exec(`
                INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
                SELECT supplier_id, 'purchase_invoice', -(total_amount - paid_amount), invoice_date, id, created_at
                FROM purchase_invoices
            `);
            // Treasury
            db.exec(`
                INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
                SELECT customer_id, 
                       CASE WHEN type = 'income' THEN 'treasury_income' ELSE 'treasury_expense' END,
                       CASE WHEN type = 'income' THEN -amount ELSE amount END,
                       transaction_date, id, created_at
                FROM treasury_transactions
                WHERE customer_id IS NOT NULL AND amount != 0
            `);
            // Local Sales
            db.exec(`
                INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
                SELECT customer_id, 'local_sale', total, record_date, id, created_at
                FROM local_sales
            `);
        });
        resetPartyTx();
    }

    db.exec(`
        INSERT INTO party_ledger (party_id, transaction_type, amount, transaction_date, reference_id, created_at)
        SELECT ls.customer_id, 'local_sale', ls.total, ls.record_date, ls.id, ls.created_at
        FROM local_sales ls
        WHERE NOT EXISTS (
            SELECT 1
            FROM party_ledger pl
            WHERE pl.transaction_type = 'local_sale'
              AND pl.reference_id = ls.id
        )
    `);

    db.exec(`
        UPDATE parties
        SET balance = COALESCE((
            SELECT SUM(pl.amount)
            FROM party_ledger pl
            WHERE pl.party_id = parties.id
        ), 0)
    `);

    console.log('Database initialized at:', dbPath);
}

module.exports = {
    db,
    initDB
};


