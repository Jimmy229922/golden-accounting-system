const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function register() {
    // =============================================
    // === Purchase Returns Handlers (مردودات المشتريات) ===
    // =============================================

    // Get all purchase returns
    ipcMain.handle('get-purchase-returns', () => {
        try {
            return db.prepare(`
                SELECT pr.*, c.name as supplier_name, pi.invoice_number as original_invoice_number
                FROM purchase_returns pr
                LEFT JOIN customers c ON pr.supplier_id = c.id
                LEFT JOIN purchase_invoices pi ON pr.original_invoice_id = pi.id
                ORDER BY pr.id DESC
            `).all();
        } catch (error) {
            console.error('[get-purchase-returns] Error:', error);
            return [];
        }
    });

    // Get purchase invoices for a specific supplier (for returns)
    ipcMain.handle('get-supplier-purchase-invoices', (event, supplierId) => {
        try {
            return db.prepare(`
                SELECT pi.*, c.name as supplier_name
                FROM purchase_invoices pi
                LEFT JOIN customers c ON pi.supplier_id = c.id
                WHERE pi.supplier_id = ?
                ORDER BY pi.invoice_date DESC
            `).all(supplierId);
        } catch (error) {
            console.error('[get-supplier-purchase-invoices] Error:', error);
            return [];
        }
    });

    // Save purchase return
    ipcMain.handle('save-purchase-return', (event, returnData) => {
        const denied = requirePermission('purchase-returns', 'add');
        if (denied) return denied;
        const { original_invoice_id, supplier_id, return_number, return_date, notes, items } = returnData;

        let totalAmount = 0;
        for (const item of items) {
            totalAmount += item.total_price;
        }

        // Stock validation: prevent returning more than available in stock
        const getStock = db.prepare('SELECT id, name, stock_quantity FROM items WHERE id = ?');
        for (const item of items) {
            const dbItem = getStock.get(item.item_id);
            if (!dbItem) {
                return { success: false, error: `الصنف غير موجود (ID: ${item.item_id})` };
            }
            if (item.quantity > dbItem.stock_quantity) {
                return { success: false, error: `الصنف "${dbItem.name}": الكمية المطلوبة للإرجاع (${item.quantity}) أكبر من المتاح (${dbItem.stock_quantity})` };
            }
        }

        const insertReturn = db.prepare(`
            INSERT INTO purchase_returns (return_number, original_invoice_id, supplier_id, return_date, total_amount, notes)
            VALUES (@return_number, @original_invoice_id, @supplier_id, @return_date, @total_amount, @notes)
        `);

        const insertDetail = db.prepare(`
            INSERT INTO purchase_return_details (return_id, item_id, quantity, price, total_price)
            VALUES (@return_id, @item_id, @quantity, @price, @total_price)
        `);

        // Remove items from stock
        const updateItemStock = db.prepare(`
            UPDATE items SET stock_quantity = stock_quantity - @quantity WHERE id = @item_id
        `);

        // Reduce supplier balance (we owe less)
        const updateSupplierBalance = db.prepare(`
            UPDATE customers SET balance = balance + @amount WHERE id = @id
        `);

        // Treasury income for cash purchases
        const insertTreasuryTransaction = db.prepare(`
            INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
            VALUES ('income', @amount, @date, @description, @invoice_id, 'purchase_return')
        `);

        const transaction = db.transaction((data) => {
            const info = insertReturn.run({
                return_number: data.return_number,
                original_invoice_id: data.original_invoice_id,
                supplier_id: data.supplier_id,
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

                // Remove items from stock
                updateItemStock.run({
                    quantity: item.quantity,
                    item_id: item.item_id
                });
            }

            // Check original invoice payment type
            const originalInvoice = db.prepare('SELECT payment_type FROM purchase_invoices WHERE id = ?').get(data.original_invoice_id);
            
            if (originalInvoice && originalInvoice.payment_type === 'cash') {
                // Refund to treasury
                insertTreasuryTransaction.run({
                    amount: totalAmount,
                    date: data.return_date,
                    description: `مردودات مشتريات - فاتورة رقم ${data.return_number} (مرتجع من فاتورة شراء)`,
                    invoice_id: returnId
                });
            } else {
                // Reduce supplier balance
                updateSupplierBalance.run({
                    amount: totalAmount,
                    id: data.supplier_id
                });
            }

            return returnId;
        });

        try {
            const returnId = transaction(returnData);
            return { success: true, returnId };
        } catch (error) {
            console.error('[save-purchase-return] Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Update purchase return
    ipcMain.handle('update-purchase-return', (event, returnData) => {
        const denied = requirePermission('purchase-returns', 'edit');
        if (denied) return denied;
        const { id, original_invoice_id, supplier_id, return_number, return_date, notes, items } = returnData || {};
        const returnId = Number(id);
        if (!Number.isFinite(returnId) || returnId <= 0) {
            return { success: false, error: 'معرف المردود غير صالح' };
        }

        const normalizedItems = Array.isArray(items) ? items : [];
        if (normalizedItems.length === 0) {
            return { success: false, error: 'لا توجد أصناف للتحديث' };
        }

        const existingReturn = db.prepare('SELECT * FROM purchase_returns WHERE id = ?').get(returnId);
        if (!existingReturn) {
            return { success: false, error: 'المردود غير موجود' };
        }

        const oldDetails = db.prepare('SELECT * FROM purchase_return_details WHERE return_id = ?').all(returnId);
        const oldDetailsByItem = new Map();
        oldDetails.forEach((detail) => {
            const key = Number(detail.item_id);
            oldDetailsByItem.set(key, (oldDetailsByItem.get(key) || 0) + (Number(detail.quantity) || 0));
        });

        // Validate stock using current stock + old return quantity (because old quantity will be restored first).
        const getStock = db.prepare('SELECT id, name, stock_quantity FROM items WHERE id = ?');
        for (const item of normalizedItems) {
            const dbItem = getStock.get(item.item_id);
            if (!dbItem) {
                return { success: false, error: `الصنف غير موجود (ID: ${item.item_id})` };
            }

            const oldQty = oldDetailsByItem.get(Number(item.item_id)) || 0;
            const maxAllowed = (Number(dbItem.stock_quantity) || 0) + oldQty;
            const requested = Number(item.quantity) || 0;
            if (requested > maxAllowed) {
                return {
                    success: false,
                    error: `الصنف "${dbItem.name}": الكمية المطلوبة للإرجاع (${requested}) أكبر من المتاح (${maxAllowed})`
                };
            }
        }

        let newTotalAmount = 0;
        for (const item of normalizedItems) {
            newTotalAmount += Number(item.total_price) || 0;
        }

        const getOriginalInvoice = db.prepare('SELECT payment_type FROM purchase_invoices WHERE id = ?');
        const updateReturn = db.prepare(`
            UPDATE purchase_returns
            SET return_number = @return_number,
                original_invoice_id = @original_invoice_id,
                supplier_id = @supplier_id,
                return_date = @return_date,
                total_amount = @total_amount,
                notes = @notes
            WHERE id = @id
        `);
        const deleteDetails = db.prepare('DELETE FROM purchase_return_details WHERE return_id = ?');
        const insertDetail = db.prepare(`
            INSERT INTO purchase_return_details (return_id, item_id, quantity, price, total_price)
            VALUES (@return_id, @item_id, @quantity, @price, @total_price)
        `);

        const addToStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity + @quantity WHERE id = @item_id');
        const subtractFromStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity - @quantity WHERE id = @item_id');

        const increaseSupplierBalance = db.prepare('UPDATE customers SET balance = balance - @amount WHERE id = @id');
        const decreaseSupplierBalance = db.prepare('UPDATE customers SET balance = balance + @amount WHERE id = @id');

        const deleteTreasuryTransaction = db.prepare("DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = 'purchase_return'");
        const insertTreasuryTransaction = db.prepare(`
            INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
            VALUES ('income', @amount, @date, @description, @invoice_id, 'purchase_return')
        `);

        const transaction = db.transaction(() => {
            // Reverse previous effect (stock/balance/treasury) before applying new values.
            oldDetails.forEach((detail) => {
                addToStock.run({ quantity: detail.quantity, item_id: detail.item_id });
            });

            const oldInvoice = getOriginalInvoice.get(existingReturn.original_invoice_id);
            if (oldInvoice && oldInvoice.payment_type === 'cash') {
                deleteTreasuryTransaction.run(returnId);
            } else {
                increaseSupplierBalance.run({
                    amount: Number(existingReturn.total_amount) || 0,
                    id: existingReturn.supplier_id
                });
            }

            // Apply new data.
            updateReturn.run({
                id: returnId,
                return_number,
                original_invoice_id,
                supplier_id,
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

                subtractFromStock.run({
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
                    description: `مردودات مشتريات - فاتورة رقم ${return_number} (مرتجع من فاتورة شراء)`,
                    invoice_id: returnId
                });
            } else {
                decreaseSupplierBalance.run({
                    amount: newTotalAmount,
                    id: supplier_id
                });
            }
        });

        try {
            transaction();
            return { success: true };
        } catch (error) {
            console.error('[update-purchase-return] Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Delete purchase return
    ipcMain.handle('delete-purchase-return', (event, returnId) => {
        const denied = requirePermission('purchase-returns', 'delete');
        if (denied) return denied;
        try {
            const returnRecord = db.prepare('SELECT * FROM purchase_returns WHERE id = ?').get(returnId);
            if (!returnRecord) return { success: false, error: 'المرتجع غير موجود' };

            const details = db.prepare('SELECT * FROM purchase_return_details WHERE return_id = ?').all(returnId);

            const transaction = db.transaction(() => {
                // Reverse stock changes (add back)
                const updateStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity + @quantity WHERE id = @item_id');
                for (const detail of details) {
                    updateStock.run({ quantity: detail.quantity, item_id: detail.item_id });
                }

                // Reverse balance changes
                const originalInvoice = db.prepare('SELECT payment_type FROM purchase_invoices WHERE id = ?').get(returnRecord.original_invoice_id);
                if (originalInvoice && originalInvoice.payment_type === 'cash') {
                    db.prepare("DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = 'purchase_return'").run(returnId);
                } else {
                    db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(returnRecord.total_amount, returnRecord.supplier_id);
                }

                // Delete return and its details
                db.prepare('DELETE FROM purchase_return_details WHERE return_id = ?').run(returnId);
                db.prepare('DELETE FROM purchase_returns WHERE id = ?').run(returnId);
            });

            transaction();
            return { success: true };
        } catch (error) {
            console.error('[delete-purchase-return] Error:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
