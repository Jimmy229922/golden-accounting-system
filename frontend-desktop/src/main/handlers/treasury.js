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

function normalizeTreasuryType(type) {
    const normalizedType = String(type || '').trim();
    return normalizedType === 'income' || normalizedType === 'expense' ? normalizedType : null;
}

function normalizeTreasuryAmount(amount) {
    const normalizedAmount = Number(amount);
    return Number.isFinite(normalizedAmount) && normalizedAmount > 0 ? normalizedAmount : null;
}

function normalizeTreasuryCustomerId(customerId) {
    if (customerId === null || customerId === undefined || String(customerId).trim() === '') return null;
    const normalizedCustomerId = Number(customerId);
    return Number.isFinite(normalizedCustomerId) && normalizedCustomerId > 0 ? normalizedCustomerId : null;
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

    ipcMain.handle('get-treasury-transactions', (event, params = null) => {
        const hasPagination = params && typeof params === 'object';
        try {
            if (!hasPagination) {
                return db.prepare('SELECT * FROM treasury_transactions ORDER BY transaction_date DESC, id DESC').all();
            }

            const parsedPage = Number.parseInt(params.page, 10);
            const parsedPageSize = Number.parseInt(params.pageSize, 10);
            const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
            const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0
                ? Math.min(parsedPageSize, 100)
                : 50;
            const today = new Date().toISOString().slice(0, 10);
            const relatedTypeFilter = `COALESCE(related_type, '') NOT IN (?, ?)`;
            const filterParams = [
                CUSTOMER_COLLECTION_PENDING_RELATED_TYPE,
                CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE
            ];

            const totalRow = db
                .prepare(`SELECT COUNT(*) AS total FROM treasury_transactions WHERE ${relatedTypeFilter}`)
                .get(...filterParams);
            const total = Number(totalRow?.total || 0);
            const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
            const currentPage = Math.min(page, totalPages);
            const offset = (currentPage - 1) * pageSize;

            const rows = db
                .prepare(`
                    SELECT *
                    FROM treasury_transactions
                    WHERE ${relatedTypeFilter}
                    ORDER BY transaction_date DESC, id DESC
                    LIMIT ? OFFSET ?
                `)
                .all(...filterParams, pageSize, offset);

            const totalsRow = db
                .prepare(`
                    SELECT
                        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS totalIncome,
                        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS totalExpense,
                        COALESCE(SUM(CASE WHEN type = 'income' AND transaction_date = ? THEN amount ELSE 0 END), 0) AS todayIncome,
                        COALESCE(SUM(CASE WHEN type = 'expense' AND transaction_date = ? THEN amount ELSE 0 END), 0) AS todayExpense
                    FROM treasury_transactions
                    WHERE ${relatedTypeFilter}
                `)
                .get(today, today, ...filterParams);

            return {
                success: true,
                rows,
                total,
                page: currentPage,
                pageSize,
                totalPages,
                totalIncome: Number(totalsRow?.totalIncome || 0),
                totalExpense: Number(totalsRow?.totalExpense || 0),
                todayIncome: Number(totalsRow?.todayIncome || 0),
                todayExpense: Number(totalsRow?.todayExpense || 0)
            };
        } catch (error) {
            console.error('[get-treasury-transactions] Error:', error);
            return hasPagination
                ? { success: false, error: error.message || 'Failed to load treasury transactions' }
                : [];
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
            const normalizedType = normalizeTreasuryType(type);
            if (!normalizedType) {
                return { success: false, error: 'نوع حركة الخزينة غير صالح.' };
            }

            const normalizedAmount = normalizeTreasuryAmount(amount);
            if (normalizedAmount === null) {
                return { success: false, error: 'مبلغ حركة الخزينة يجب أن يكون أكبر من صفر.' };
            }

            const normalizedCustomerId = normalizeTreasuryCustomerId(customer_id);
            const related_type = shouldDeferCustomerCollection({ ...transaction, type: normalizedType, customer_id: normalizedCustomerId })
                ? CUSTOMER_COLLECTION_PENDING_RELATED_TYPE
                : null;
            const voucher_number = getNextTreasuryVoucherNumberForType(normalizedType);
            if (!voucher_number) {
                return { success: false, error: 'نوع حركة الخزينة غير صالح.' };
            }

            if (normalizedType === 'expense') {
                const currentBalance = getCurrentTreasuryBalance();
                if (currentBalance <= 0) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن رصيد الخزينة الحالي يساوي صفر.' };
                }

                if (normalizedAmount > currentBalance) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن قيمة السحب أكبر من الرصيد المتاح في الخزينة.' };
                }
            }
            
            const stmt = db.prepare(`
                INSERT INTO treasury_transactions (type, amount, transaction_date, description, customer_id, voucher_number, related_type)
                VALUES (@type, @amount, @date, @description, @customer_id, @voucher_number, @related_type)
            `);

            const tx = db.transaction(() => {
                stmt.run({ type: normalizedType, amount: normalizedAmount, date, description, customer_id: normalizedCustomerId, voucher_number, related_type });
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
            const normalizedType = normalizeTreasuryType(type);
            if (!normalizedType) {
                return { success: false, error: 'نوع حركة الخزينة غير صالح.' };
            }

            const normalizedAmount = normalizeTreasuryAmount(transaction.amount);
            if (normalizedAmount === null) {
                return { success: false, error: 'مبلغ حركة الخزينة يجب أن يكون أكبر من صفر.' };
            }

            const normalizedCustomerId = normalizeTreasuryCustomerId(transaction.customer_id);
            const existing = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'الحركة المطلوب تعديلها غير موجودة.' };
            }

            if (normalizedType === 'expense') {
                let balanceBeforeUpdate = getCurrentTreasuryBalance();
                if (existing.type === 'expense') {
                    balanceBeforeUpdate += Number(existing.amount) || 0;
                } else if (existing.type === 'income') {
                    balanceBeforeUpdate -= Number(existing.amount) || 0;
                }

                if (balanceBeforeUpdate <= 0) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن رصيد الخزينة الحالي يساوي صفر.' };
                }

                if (normalizedAmount > balanceBeforeUpdate) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن قيمة السحب أكبر من الرصيد المتاح في الخزينة.' };
                }
            }

            const stmt = db.prepare(`
                UPDATE treasury_transactions 
                SET type = @type, amount = @amount, transaction_date = @date, description = @description, customer_id = @customer_id
                WHERE id = @id
            `);

            const tx = db.transaction(() => {
                // 1. Update transaction
                stmt.run({ ...transaction, type: normalizedType, amount: normalizedAmount, customer_id: normalizedCustomerId });
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
        const getSalesInvoice = db.prepare('SELECT customer_id FROM sales_invoices WHERE id = ?');

        // Purchase Updates
        const updatePurchaseInvoice = db.prepare('UPDATE purchase_invoices SET paid_amount = paid_amount - @amount, remaining_amount = remaining_amount + @amount WHERE id = @id');
        const getPurchaseInvoice = db.prepare('SELECT supplier_id FROM purchase_invoices WHERE id = ?');

        const tx = db.transaction(() => {
            const trans = getTrans.get(id);
            if (!trans) return; // Already deleted
            const isInvoiceLinked = trans.related_invoice_id && (trans.related_type === 'sales' || trans.related_type === 'purchase');

            if (isInvoiceLinked) {
                if (trans.related_type === 'sales') {
                    updateSalesInvoice.run({ amount: trans.amount, id: trans.related_invoice_id });
                } else if (trans.related_type === 'purchase') {
                    updatePurchaseInvoice.run({ amount: trans.amount, id: trans.related_invoice_id });
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
                LEFT JOIN parties c ON t.customer_id = c.id
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


