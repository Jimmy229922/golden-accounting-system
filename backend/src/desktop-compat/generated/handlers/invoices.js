const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function register() {
    ipcMain.handle('get-invoice-with-details', (event, { id, type }) => {
        try {
            const isSales = type === 'sales';
            const invoiceTable = isSales ? 'sales_invoices' : 'purchase_invoices';
            const detailsTable = isSales ? 'sales_invoice_details' : 'purchase_invoice_details';

            if (isSales) {
                console.log(`[sales] get-invoice-with-details id=${id}`);
            }
            
            const invoice = db.prepare(`SELECT * FROM ${invoiceTable} WHERE id = ?`).get(id);
            if (!invoice) return null;

            const details = db.prepare(`
                SELECT d.*, i.name as item_name, i.stock_quantity as current_stock 
                FROM ${detailsTable} d
                LEFT JOIN items i ON d.item_id = i.id
                WHERE d.invoice_id = ?
            `).all(id);

            return { ...invoice, items: details };
        } catch (error) {
            console.error('[get-invoice-with-details] Error:', error);
            return null;
        }
    });

    // --- Helper: Get Next Invoice Number ---
    ipcMain.handle('get-next-invoice-number', (event, type) => {
        try {
            let table, prefix;
            if (type === 'sales') {
                table = 'sales_invoices';
                prefix = 'SL';
            } else if (type === 'purchase') {
                table = 'purchase_invoices';
                prefix = 'PC';
            } else {
                // Default fallback
                table = type === 'sales' ? 'sales_invoices' : 'purchase_invoices';
                prefix = type === 'sales' ? 'SL' : 'PC';
            }

            const numberField = 'invoice_number';
            
            // Use COUNT to get actual number of invoices, not MAX(id) which can be misleading after deletions
            const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
            // Also get the max number to avoid duplicates
            const maxNumberResult = db.prepare(`SELECT MAX(CAST(${numberField} AS INTEGER)) as maxNum FROM ${table} WHERE ${numberField} GLOB '[0-9]*'`).get();
            
            const nextFromCount = (countResult.count || 0) + 1;
            const nextFromMaxNumber = (maxNumberResult.maxNum || 0) + 1;
            
            // Return the higher value to avoid duplicates with prefix
            const nextNumber = Math.max(nextFromCount, nextFromMaxNumber);
            return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
        } catch (error) {
            return '1';
        }
    });

    // Get specific invoice details
    ipcMain.handle('get-sales-invoice-details', (event, invoiceId) => {
        try {
            return db.prepare(`
                SELECT d.*, i.name as item_name
                FROM sales_invoice_details d
                LEFT JOIN items i ON d.item_id = i.id
                WHERE d.invoice_id = ?
            `).all(invoiceId);
        } catch (error) {
            console.error('[get-sales-invoice-details] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-purchase-invoice-details', (event, invoiceId) => {
        try {
            return db.prepare(`
                SELECT d.*, i.name as item_name
                FROM purchase_invoice_details d
                LEFT JOIN items i ON d.item_id = i.id
                WHERE d.invoice_id = ?
            `).all(invoiceId);
        } catch (error) {
            console.error('[get-purchase-invoice-details] Error:', error);
            return [];
        }
    });

    ipcMain.handle('delete-invoice', (event, { id, type }) => {
        const page = type === 'sales' ? 'sales' : 'purchases';
        const denied = requirePermission(page, 'delete');
        if (denied) return denied;
        const isSales = type === 'sales';
        const invoiceTable = isSales ? 'sales_invoices' : 'purchase_invoices';
        const detailsTable = isSales ? 'sales_invoice_details' : 'purchase_invoice_details';
        const invoice = db.prepare(`SELECT * FROM ${invoiceTable} WHERE id = ?`).get(id);
        if (!invoice) return { success: false, error: 'Invoice not found' };

        const details = db.prepare(`SELECT * FROM ${detailsTable} WHERE invoice_id = ?`).all(id);

        if (!isSales) {
            const getItemStock = db.prepare('SELECT id, name, stock_quantity FROM items WHERE id = ?');
            for (const item of details) {
                const dbItem = getItemStock.get(item.item_id);
                const currentStock = Number(dbItem?.stock_quantity) || 0;
                const invoiceQty = Number(item.quantity) || 0;
                if (currentStock - invoiceQty < 0) {
                    const itemName = dbItem?.name || `ID: ${item.item_id}`;
                    return {
                        success: false,
                        error: `لا يمكن حذف فاتورة الشراء لأن الصنف "${itemName}" تم بيع جزء من كميته أو استخدامه.`
                    };
                }
            }
        }

        const transaction = db.transaction(() => {
            // 1. Reverse Stock
            for (const item of details) {
                if (isSales) {
                    // Sales reduced stock, so add it back
                    db.prepare('UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.item_id);
                } else {
                    // Purchase added stock, so remove it
                    db.prepare('UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?').run(item.quantity, item.item_id);
                }
            }

            // 2. Reverse Treasury (if paid > 0)
            if (invoice.paid_amount > 0) {
                // Delete the treasury transaction
                db.prepare('DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = ?').run(id, type);
            }

            // 3. Delete Details
            db.prepare(`DELETE FROM ${detailsTable} WHERE invoice_id = ?`).run(id);

            // 4. Delete Invoice (party_ledger trigger handles balance automatically)
            db.prepare(`DELETE FROM ${invoiceTable} WHERE id = ?`).run(id);
        });

        try {
            transaction();
            return { success: true };
        } catch (error) {
            console.error(error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };

