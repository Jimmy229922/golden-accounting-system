const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function register() {
    // =============================================
    // === Sales Returns Handlers (مردودات المبيعات) ===
    // =============================================

    // Get all sales returns
    ipcMain.handle('get-sales-returns', () => {
        try {
            return db.prepare(`
                SELECT sr.*, c.name as customer_name, si.invoice_number as original_invoice_number
                FROM sales_returns sr
                LEFT JOIN customers c ON sr.customer_id = c.id
                LEFT JOIN sales_invoices si ON sr.original_invoice_id = si.id
                ORDER BY sr.id DESC
            `).all();
        } catch (error) {
            console.error('[get-sales-returns] Error:', error);
            return [];
        }
    });

    // Get sales invoices for a specific customer (for returns)
    ipcMain.handle('get-customer-sales-invoices', (event, customerId) => {
        try {
            return db.prepare(`
                SELECT si.*, c.name as customer_name
                FROM sales_invoices si
                LEFT JOIN customers c ON si.customer_id = c.id
                WHERE si.customer_id = ?
                ORDER BY si.invoice_date DESC
            `).all(customerId);
        } catch (error) {
            console.error('[get-customer-sales-invoices] Error:', error);
            return [];
        }
    });

    // Save sales return
    ipcMain.handle('save-sales-return', (event, returnData) => {
        const denied = requirePermission('sales-returns', 'add');
        if (denied) return denied;
        const { original_invoice_id, customer_id, return_number, return_date, notes, items } = returnData;

        let totalAmount = 0;
        for (const item of items) {
            totalAmount += item.total_price;
        }

        const insertReturn = db.prepare(`
            INSERT INTO sales_returns (return_number, original_invoice_id, customer_id, return_date, total_amount, notes)
            VALUES (@return_number, @original_invoice_id, @customer_id, @return_date, @total_amount, @notes)
        `);

        const insertDetail = db.prepare(`
            INSERT INTO sales_return_details (return_id, item_id, quantity, price, total_price)
            VALUES (@return_id, @item_id, @quantity, @price, @total_price)
        `);

        // Return items to stock
        const updateItemStock = db.prepare(`
            UPDATE items SET stock_quantity = stock_quantity + @quantity WHERE id = @item_id
        `);

        // Reduce customer balance (they owe less)
        const updateCustomerBalance = db.prepare(`
            UPDATE customers SET balance = balance - @amount WHERE id = @id
        `);

        // Treasury refund for cash sales
        const insertTreasuryTransaction = db.prepare(`
            INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
            VALUES ('expense', @amount, @date, @description, @invoice_id, 'sales_return')
        `);

        const transaction = db.transaction((data) => {
            const info = insertReturn.run({
                return_number: data.return_number,
                original_invoice_id: data.original_invoice_id,
                customer_id: data.customer_id,
                return_date: data.return_date,
                total_amount: totalAmount,
                notes: data.notes
            });
            const returnId = info.lastInsertRowid;

            for (const item of data.items) {
                insertDetail.run({
                    return_id: returnId,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    price: item.price,
                    total_price: item.total_price
                });

                // Return items to stock
                updateItemStock.run({
                    quantity: item.quantity,
                    item_id: item.item_id
                });
            }

            // Check original invoice payment type
            const originalInvoice = db.prepare('SELECT payment_type FROM sales_invoices WHERE id = ?').get(data.original_invoice_id);
            
            if (originalInvoice && originalInvoice.payment_type === 'cash') {
                // Refund from treasury
                insertTreasuryTransaction.run({
                    amount: totalAmount,
                    date: data.return_date,
                    description: `مردودات مبيعات - فاتورة رقم ${data.return_number} (مرتجع من فاتورة بيع)`,
                    invoice_id: returnId
                });
            } else {
                // Reduce customer balance
                updateCustomerBalance.run({
                    amount: totalAmount,
                    id: data.customer_id
                });
            }

            return returnId;
        });

        try {
            const returnId = transaction(returnData);
            return { success: true, returnId };
        } catch (error) {
            console.error('[save-sales-return] Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Update sales return
    ipcMain.handle('update-sales-return', (event, returnData) => {
        const denied = requirePermission('sales-returns', 'edit');
        if (denied) return denied;
        const { id, original_invoice_id, customer_id, return_number, return_date, notes, items } = returnData || {};
        const returnId = Number(id);
        if (!Number.isFinite(returnId) || returnId <= 0) {
            return { success: false, error: 'معرف المردود غير صالح' };
        }

        const normalizedItems = Array.isArray(items) ? items : [];
        if (normalizedItems.length === 0) {
            return { success: false, error: 'لا توجد أصناف للتحديث' };
        }

        let newTotalAmount = 0;
        for (const item of normalizedItems) {
            newTotalAmount += Number(item.total_price) || 0;
        }

        const getReturn = db.prepare('SELECT * FROM sales_returns WHERE id = ?');
        const getReturnDetails = db.prepare('SELECT * FROM sales_return_details WHERE return_id = ?');
        const getOriginalInvoice = db.prepare('SELECT payment_type FROM sales_invoices WHERE id = ?');

        const updateReturn = db.prepare(`
            UPDATE sales_returns
            SET return_number = @return_number,
                original_invoice_id = @original_invoice_id,
                customer_id = @customer_id,
                return_date = @return_date,
                total_amount = @total_amount,
                notes = @notes
            WHERE id = @id
        `);

        const deleteDetails = db.prepare('DELETE FROM sales_return_details WHERE return_id = ?');
        const insertDetail = db.prepare(`
            INSERT INTO sales_return_details (return_id, item_id, quantity, price, total_price)
            VALUES (@return_id, @item_id, @quantity, @price, @total_price)
        `);

        const addToStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity + @quantity WHERE id = @item_id');
        const subtractFromStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity - @quantity WHERE id = @item_id');

        const increaseCustomerBalance = db.prepare('UPDATE customers SET balance = balance + @amount WHERE id = @id');
        const decreaseCustomerBalance = db.prepare('UPDATE customers SET balance = balance - @amount WHERE id = @id');

        const deleteTreasuryTransaction = db.prepare("DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = 'sales_return'");
        const insertTreasuryTransaction = db.prepare(`
            INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
            VALUES ('expense', @amount, @date, @description, @invoice_id, 'sales_return')
        `);

        const transaction = db.transaction(() => {
            const existingReturn = getReturn.get(returnId);
            if (!existingReturn) {
                throw new Error('المردود غير موجود');
            }

            // Reverse previous effect (stock/balance/treasury) before applying new values.
            const previousDetails = getReturnDetails.all(returnId);
            previousDetails.forEach((detail) => {
                subtractFromStock.run({ quantity: detail.quantity, item_id: detail.item_id });
            });

            const oldInvoice = getOriginalInvoice.get(existingReturn.original_invoice_id);
            if (oldInvoice && oldInvoice.payment_type === 'cash') {
                deleteTreasuryTransaction.run(returnId);
            } else {
                increaseCustomerBalance.run({
                    amount: Number(existingReturn.total_amount) || 0,
                    id: existingReturn.customer_id
                });
            }

            // Apply new data.
            updateReturn.run({
                id: returnId,
                return_number,
                original_invoice_id,
                customer_id,
                return_date,
                total_amount: newTotalAmount,
                notes
            });

            deleteDetails.run(returnId);
            normalizedItems.forEach((item) => {
                insertDetail.run({
                    return_id: returnId,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    price: item.price,
                    total_price: item.total_price
                });

                addToStock.run({
                    quantity: item.quantity,
                    item_id: item.item_id
                });
            });

            const newInvoice = getOriginalInvoice.get(original_invoice_id);
            if (newInvoice && newInvoice.payment_type === 'cash') {
                deleteTreasuryTransaction.run(returnId);
                insertTreasuryTransaction.run({
                    amount: newTotalAmount,
                    date: return_date,
                    description: `مردودات مبيعات - فاتورة رقم ${return_number} (مرتجع من فاتورة بيع)`,
                    invoice_id: returnId
                });
            } else {
                decreaseCustomerBalance.run({
                    amount: newTotalAmount,
                    id: customer_id
                });
            }
        });

        try {
            transaction();
            return { success: true };
        } catch (error) {
            console.error('[update-sales-return] Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Delete sales return
    ipcMain.handle('delete-sales-return', (event, returnId) => {
        const denied = requirePermission('sales-returns', 'delete');
        if (denied) return denied;
        try {
            const returnRecord = db.prepare('SELECT * FROM sales_returns WHERE id = ?').get(returnId);
            if (!returnRecord) return { success: false, error: 'المرتجع غير موجود' };

            const details = db.prepare('SELECT * FROM sales_return_details WHERE return_id = ?').all(returnId);

            const transaction = db.transaction(() => {
                // Reverse stock changes
                const updateStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity - @quantity WHERE id = @item_id');
                for (const detail of details) {
                    updateStock.run({ quantity: detail.quantity, item_id: detail.item_id });
                }

                // Reverse balance changes
                const originalInvoice = db.prepare('SELECT payment_type FROM sales_invoices WHERE id = ?').get(returnRecord.original_invoice_id);
                if (originalInvoice && originalInvoice.payment_type === 'cash') {
                    // Delete treasury transaction
                    db.prepare("DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = 'sales_return'").run(returnId);
                } else {
                    db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(returnRecord.total_amount, returnRecord.customer_id);
                }

                // Delete return and its details
                db.prepare('DELETE FROM sales_return_details WHERE return_id = ?').run(returnId);
                db.prepare('DELETE FROM sales_returns WHERE id = ?').run(returnId);
            });

            transaction();
            return { success: true };
        } catch (error) {
            console.error('[delete-sales-return] Error:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
