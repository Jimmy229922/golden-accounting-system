const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function register() {
    // --- Customers Handlers ---

    ipcMain.handle('get-customers', () => {
        try {
            return db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
        } catch (error) {
            console.error('[get-customers] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-debtor-creditor-report', (event, { startDate, endDate }) => {
        try {
        const customers = db.prepare('SELECT id, name, type, balance as current_balance, phone FROM customers ORDER BY name ASC').all();
        
        const sDate = startDate || '1900-01-01';
        const eDate = endDate || '9999-12-31';
        const futureDate = endDate || '9999-12-31';

        // Batch: Future sales per customer (1 query instead of N)
        const futureSalesMap = {};
        db.prepare(`
            SELECT customer_id, SUM(total_amount) as total 
            FROM sales_invoices 
            WHERE invoice_date > ? AND payment_type != 'cash'
            GROUP BY customer_id
        `).all(futureDate).forEach(r => { futureSalesMap[r.customer_id] = r.total; });

        // Batch: Future purchases per supplier
        const futurePurchasesMap = {};
        db.prepare(`
            SELECT supplier_id, SUM(total_amount) as total 
            FROM purchase_invoices 
            WHERE invoice_date > ? AND payment_type != 'cash'
            GROUP BY supplier_id
        `).all(futureDate).forEach(r => { futurePurchasesMap[r.supplier_id] = r.total; });

        // Batch: Future sales payments per customer
        const futureSalesPaymentsMap = {};
        db.prepare(`
            SELECT si.customer_id, SUM(tt.amount) as total 
            FROM treasury_transactions tt
            JOIN sales_invoices si ON tt.related_invoice_id = si.id
            WHERE tt.related_type = 'sales' 
            AND tt.transaction_date > ?
            GROUP BY si.customer_id
        `).all(futureDate).forEach(r => { futureSalesPaymentsMap[r.customer_id] = r.total; });

        // Batch: Future purchase payments per supplier
        const futurePurchasePaymentsMap = {};
        db.prepare(`
            SELECT pi.supplier_id, SUM(tt.amount) as total 
            FROM treasury_transactions tt
            JOIN purchase_invoices pi ON tt.related_invoice_id = pi.id
            WHERE tt.related_type = 'purchase' 
            AND tt.transaction_date > ?
            GROUP BY pi.supplier_id
        `).all(futureDate).forEach(r => { futurePurchasePaymentsMap[r.supplier_id] = r.total; });

        // Batch: Period sales per customer
        const periodSalesMap = {};
        db.prepare(`
            SELECT customer_id, SUM(total_amount) as total 
            FROM sales_invoices 
            WHERE invoice_date >= ? AND invoice_date <= ? AND payment_type != 'cash'
            GROUP BY customer_id
        `).all(sDate, eDate).forEach(r => { periodSalesMap[r.customer_id] = r.total; });

        // Batch: Period purchases per supplier
        const periodPurchasesMap = {};
        db.prepare(`
            SELECT supplier_id, SUM(total_amount) as total 
            FROM purchase_invoices 
            WHERE invoice_date >= ? AND invoice_date <= ? AND payment_type != 'cash'
            GROUP BY supplier_id
        `).all(sDate, eDate).forEach(r => { periodPurchasesMap[r.supplier_id] = r.total; });

        // Batch: Period sales payments per customer
        const periodSalesPaymentsMap = {};
        db.prepare(`
            SELECT si.customer_id, SUM(tt.amount) as total 
            FROM treasury_transactions tt
            JOIN sales_invoices si ON tt.related_invoice_id = si.id
            WHERE tt.related_type = 'sales' 
            AND tt.transaction_date >= ? AND tt.transaction_date <= ?
            GROUP BY si.customer_id
        `).all(sDate, eDate).forEach(r => { periodSalesPaymentsMap[r.customer_id] = r.total; });

        // Batch: Period purchase payments per supplier
        const periodPurchasePaymentsMap = {};
        db.prepare(`
            SELECT pi.supplier_id, SUM(tt.amount) as total 
            FROM treasury_transactions tt
            JOIN purchase_invoices pi ON tt.related_invoice_id = pi.id
            WHERE tt.related_type = 'purchase' 
            AND tt.transaction_date >= ? AND tt.transaction_date <= ?
            GROUP BY pi.supplier_id
        `).all(sDate, eDate).forEach(r => { periodPurchasePaymentsMap[r.supplier_id] = r.total; });

        const report = customers.map(customer => {
            const futureSales = futureSalesMap[customer.id] || 0;
            const futurePurchases = futurePurchasesMap[customer.id] || 0;
            const futureSalesPayments = futureSalesPaymentsMap[customer.id] || 0;
            const futurePurchasePayments = futurePurchasePaymentsMap[customer.id] || 0;
            const periodSales = periodSalesMap[customer.id] || 0;
            const periodPurchases = periodPurchasesMap[customer.id] || 0;
            const periodSalesPayments = periodSalesPaymentsMap[customer.id] || 0;
            const periodPurchasePayments = periodPurchasePaymentsMap[customer.id] || 0;
            
            // Closing Balance = Current - Future Increases + Future Decreases
            // Increases to Balance: Sales, Purchases
            // Decreases to Balance: Payments
            let closingBalance = customer.current_balance 
                - (futureSales + futurePurchases) 
                + (futureSalesPayments + futurePurchasePayments);
                
            // Opening Balance = Closing - Period Increases + Period Decreases
            let openingBalance = closingBalance 
                - (periodSales + periodPurchases) 
                + (periodSalesPayments + periodPurchasePayments);
                
            let debitAmount = 0;
            let creditAmount = 0;
            
            // Determine Debit/Credit for the period based on accounting logic
            // Customer: Debit = Sales, Credit = Payments
            // Supplier: Debit = Payments, Credit = Purchases
            
            if (customer.type === 'customer') {
                debitAmount = periodSales;
                creditAmount = periodSalesPayments;
            } else if (customer.type === 'supplier') {
                debitAmount = periodPurchasePayments;
                creditAmount = periodPurchases;
            } else {
                // Both
                debitAmount = periodSales + periodPurchasePayments;
                creditAmount = periodSalesPayments + periodPurchases;
            }
            
            return {
                ...customer,
                openingBalance,
                closingBalance,
                debitAmount,
                creditAmount
            };
        });
        
        return report;
        } catch (error) {
            console.error('[get-debtor-creditor-report] Error:', error);
            return [];
        }
    });

    ipcMain.handle('add-customer', (event, customer) => {
        const denied = requirePermission('customers', 'add');
        if (denied) return denied;
        try {
            const nextCode = db.prepare('SELECT COALESCE(MAX(code), 0) + 1 AS next FROM customers').get().next;
            customer.code = nextCode;
            customer.balance = customer.opening_balance;
            const stmt = db.prepare('INSERT INTO customers (name, phone, address, balance, opening_balance, type, code) VALUES (@name, @phone, @address, @balance, @opening_balance, @type, @code)');
            const info = stmt.run(customer);
            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-customer', (event, customer) => {
        const denied = requirePermission('customers', 'edit');
        if (denied) return denied;
        try {
            const existing = db.prepare('SELECT opening_balance FROM customers WHERE id = ?').get(customer.id);
            const oldOpening = existing ? (existing.opening_balance || 0) : 0;
            const newOpening = customer.opening_balance || 0;
            const diff = newOpening - oldOpening;
            const stmt = db.prepare('UPDATE customers SET name = @name, phone = @phone, address = @address, opening_balance = @opening_balance, balance = balance + @diff, type = @type WHERE id = @id');
            stmt.run({ ...customer, diff });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-customer', (event, id) => {
        const denied = requirePermission('customers', 'delete');
        if (denied) return denied;
        try {
            db.prepare('DELETE FROM customers WHERE id = ?').run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
