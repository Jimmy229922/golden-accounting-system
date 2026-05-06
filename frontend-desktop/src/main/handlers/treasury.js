const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

const CUSTOMER_COLLECTION_PENDING_RELATED_TYPE = 'customer_collection_pending';
const CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE = 'customer_collection_shift_close';

function shouldDeferCustomerCollection(transaction = {}) {
    const customerId = Number(transaction.customer_id);
    return transaction.type === 'income'
        && Number.isFinite(customerId)
        && customerId > 0
        && Boolean(transaction.defer_to_sales_shift_close);
}

function getTreasuryVoucherPrefix(type) {
    if (type === 'income') return 'RCV';
    if (type === 'expense') return 'PAY';
    return null;
}

function getNextTreasuryVoucherNumberForType(type) {
    const prefix = getTreasuryVoucherPrefix(type);
    if (!prefix) return null;

    const maxResult = db.prepare(`
        SELECT MAX(CAST(SUBSTR(voucher_number, 5) AS INTEGER)) as max_num
        FROM treasury_transactions
        WHERE type = @type
          AND voucher_number GLOB @pattern
    `).get({
        type,
        pattern: `${prefix}-[0-9]*`
    });

    const nextNumber = Number(maxResult?.max_num || 0) + 1;
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

function getCurrentTreasuryBalance() {
    const income = Number(db.prepare(`
        SELECT SUM(amount) as total
        FROM treasury_transactions
        WHERE type = 'income'
          AND COALESCE(related_type, '') NOT IN ('${CUSTOMER_COLLECTION_PENDING_RELATED_TYPE}', '${CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE}')
    `).get().total || 0);
    const expense = Number(db.prepare("SELECT SUM(amount) as total FROM treasury_transactions WHERE type = 'expense'").get().total || 0);
    return income - expense;
}

function register() {
    // --- Treasury Handlers ---

    ipcMain.handle('get-treasury-balance', () => {
        try {
            return getCurrentTreasuryBalance();
        } catch (error) {
            console.error(error);
            return 0;
        }
    });

    ipcMain.handle('get-treasury-transactions', () => {
        try {
            return db.prepare('SELECT * FROM treasury_transactions ORDER BY transaction_date DESC, id DESC').all();
        } catch (error) {
            console.error('[get-treasury-transactions] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-next-treasury-voucher-number', (event, type) => {
        try {
            const voucher_number = getNextTreasuryVoucherNumberForType(type);
            if (!voucher_number) {
                return { success: false, error: 'Invalid treasury transaction type' };
            }
            return { success: true, voucher_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('add-treasury-transaction', (event, transaction) => {
        const denied = requirePermission('treasury', 'add');
        if (denied) return denied;
        try {
            const { type, amount, date, description, customer_id } = transaction;
            const related_type = shouldDeferCustomerCollection(transaction)
                ? CUSTOMER_COLLECTION_PENDING_RELATED_TYPE
                : null;
            const voucher_number = getNextTreasuryVoucherNumberForType(type);
            if (!voucher_number) {
                return { success: false, error: 'Invalid treasury transaction type' };
            }

            if (type === 'expense') {
                const currentBalance = getCurrentTreasuryBalance();
                if (currentBalance <= 0) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن رصيد الخزينة الحالي يساوي صفر.' };
                }

                const expenseAmount = Number(amount) || 0;
                if (expenseAmount > currentBalance) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن قيمة السحب أكبر من الرصيد المتاح في الخزينة.' };
                }
            }
            
            const stmt = db.prepare(`
                INSERT INTO treasury_transactions (type, amount, transaction_date, description, customer_id, voucher_number, related_type)
                VALUES (@type, @amount, @date, @description, @customer_id, @voucher_number, @related_type)
            `);

            const updateBalance = db.prepare(`
                UPDATE customers 
                SET balance = balance + @amount 
                WHERE id = @id
            `);

            const tx = db.transaction(() => {
                stmt.run({ type, amount, date, description, customer_id, voucher_number, related_type });
                
                if (customer_id) {
                    updateBalance.run({ amount: type === 'expense' ? amount : -amount, id: customer_id });
                }
            });

            tx();
            return { success: true, voucher_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-treasury-transaction', (event, transaction) => {
        const denied = requirePermission('treasury', 'edit');
        if (denied) return denied;
        try {
            const { id, type } = transaction;
            const existing = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'الحركة المطلوب تعديلها غير موجودة.' };
            }

            if (type === 'expense') {
                let balanceBeforeUpdate = getCurrentTreasuryBalance();
                if (existing.type === 'expense') {
                    balanceBeforeUpdate += Number(existing.amount) || 0;
                } else if (existing.type === 'income') {
                    balanceBeforeUpdate -= Number(existing.amount) || 0;
                }

                if (balanceBeforeUpdate <= 0) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن رصيد الخزينة الحالي يساوي صفر.' };
                }

                const expenseAmount = Number(transaction.amount) || 0;
                if (expenseAmount > balanceBeforeUpdate) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن قيمة السحب أكبر من الرصيد المتاح في الخزينة.' };
                }
            }

            const updateBalance = db.prepare(`
                UPDATE customers
                SET balance = balance + @amount
                WHERE id = @id
            `);

            const stmt = db.prepare(`
                UPDATE treasury_transactions 
                SET type = @type, amount = @amount, transaction_date = @date, description = @description, customer_id = @customer_id
                WHERE id = @id
            `);

            const tx = db.transaction(() => {
                // 1. Revert old balance effect
                if (existing.customer_id) {
                    updateBalance.run({ amount: existing.type === 'expense' ? -existing.amount : existing.amount, id: existing.customer_id });
                }

                // 2. Update transaction
                stmt.run(transaction);

                // 3. Apply new balance effect
                if (transaction.customer_id) {
                    updateBalance.run({ amount: type === 'expense' ? transaction.amount : -transaction.amount, id: transaction.customer_id });
                }
            });

            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-treasury-transaction', (event, id) => {
        const denied = requirePermission('treasury', 'delete');
        if (denied) return denied;
        const getTrans = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?');
        const deleteTrans = db.prepare('DELETE FROM treasury_transactions WHERE id = ?');
        
        // Sales Updates
        const updateSalesInvoice = db.prepare('UPDATE sales_invoices SET paid_amount = paid_amount - @amount, remaining_amount = remaining_amount + @amount WHERE id = @id');
        const updateCustomer = db.prepare('UPDATE customers SET balance = balance + @amount WHERE id = @id');
        const getSalesInvoice = db.prepare('SELECT customer_id FROM sales_invoices WHERE id = ?');

        // Purchase Updates
        const updatePurchaseInvoice = db.prepare('UPDATE purchase_invoices SET paid_amount = paid_amount - @amount, remaining_amount = remaining_amount + @amount WHERE id = @id');
        const getPurchaseInvoice = db.prepare('SELECT supplier_id FROM purchase_invoices WHERE id = ?');

        const tx = db.transaction(() => {
            const trans = getTrans.get(id);
            if (!trans) return; // Already deleted

            // Handle Direct Payments (linked via customer_id)
            if (trans.customer_id) {
                // When payment was added, we subtracted amount from balance.
                // Now we add it back.
                updateCustomer.run({ amount: trans.type === 'expense' ? -trans.amount : trans.amount, id: trans.customer_id });
            }

            if (trans.related_invoice_id) {
                if (trans.related_type === 'sales') {
                    // Revert Sales Payment
                    updateSalesInvoice.run({ amount: trans.amount, id: trans.related_invoice_id });
                    
                    const invoice = getSalesInvoice.get(trans.related_invoice_id);
                    if (invoice && invoice.customer_id) {
                        updateCustomer.run({ amount: trans.type === 'expense' ? -trans.amount : trans.amount, id: invoice.customer_id });
                    }
                } else if (trans.related_type === 'purchase') {
                    // Revert Purchase Payment
                    updatePurchaseInvoice.run({ amount: trans.amount, id: trans.related_invoice_id });
                    
                    const invoice = getPurchaseInvoice.get(trans.related_invoice_id);
                    if (invoice && invoice.supplier_id) {
                        updateCustomer.run({ amount: trans.type === 'expense' ? -trans.amount : trans.amount, id: invoice.supplier_id });
                    }
                }
            }

            deleteTrans.run(id);
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('search-treasury-by-voucher', (event, voucherNumber) => {
        try {
            const results = db.prepare(`
                SELECT t.*, c.name as customer_name
                FROM treasury_transactions t
                LEFT JOIN customers c ON t.customer_id = c.id
                WHERE t.voucher_number LIKE @search
                ORDER BY t.transaction_date DESC, t.id DESC
            `).all({ search: `%${voucherNumber}%` });
            return { success: true, results };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
