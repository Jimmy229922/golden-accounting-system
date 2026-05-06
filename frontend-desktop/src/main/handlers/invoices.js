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
            } else if (type === 'sales_return') {
                table = 'sales_returns';
                prefix = 'SR';
            } else if (type === 'purchase_return') {
                table = 'purchase_returns';
                prefix = 'PR';
            } else {
                // Default fallback
                table = type === 'sales' ? 'sales_invoices' : 'purchase_invoices';
                prefix = type === 'sales' ? 'SL' : 'PC';
            }

            const numberField = (type === 'sales_return' || type === 'purchase_return') ? 'return_number' : 'invoice_number';
            
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

    // Get invoice items with already-returned quantities
    ipcMain.handle('get-invoice-items-for-return', (event, { invoiceId, type }) => {
        try {
            if (type === 'sales') {
                const items = db.prepare(`
                    SELECT d.*, i.name as item_name, u.name as unit_name,
                        COALESCE((
                            SELECT SUM(srd.quantity)
                            FROM sales_return_details srd
                            JOIN sales_returns sr ON srd.return_id = sr.id
                            WHERE sr.original_invoice_id = d.invoice_id AND srd.item_id = d.item_id
                        ), 0) as returned_quantity
                    FROM sales_invoice_details d
                    LEFT JOIN items i ON d.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE d.invoice_id = ?
                `).all(invoiceId);
                return { success: true, items };
            } else {
                const items = db.prepare(`
                    SELECT d.*, i.name as item_name, u.name as unit_name,
                        COALESCE((
                            SELECT SUM(prd.quantity)
                            FROM purchase_return_details prd
                            JOIN purchase_returns pr ON prd.return_id = pr.id
                            WHERE pr.original_invoice_id = d.invoice_id AND prd.item_id = d.item_id
                        ), 0) as returned_quantity
                    FROM purchase_invoice_details d
                    LEFT JOIN items i ON d.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE d.invoice_id = ?
                `).all(invoiceId);
                return { success: true, items };
            }
        } catch (error) {
            return { success: false, error: error.message };
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

    ipcMain.handle('get-sales-return-details', (event, returnId) => {
        try {
            return db.prepare(`
                SELECT d.*, i.name as item_name
                FROM sales_return_details d
                LEFT JOIN items i ON d.item_id = i.id
                WHERE d.return_id = ?
            `).all(returnId);
        } catch (error) {
            console.error('[get-sales-return-details] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-purchase-return-details', (event, returnId) => {
        try {
            return db.prepare(`
                SELECT d.*, i.name as item_name
                FROM purchase_return_details d
                LEFT JOIN items i ON d.item_id = i.id
                WHERE d.return_id = ?
            `).all(returnId);
        } catch (error) {
            console.error('[get-purchase-return-details] Error:', error);
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
        const personIdField = isSales ? 'customer_id' : 'supplier_id';

        const invoice = db.prepare(`SELECT * FROM ${invoiceTable} WHERE id = ?`).get(id);
        if (!invoice) return { success: false, error: 'Invoice not found' };

        const details = db.prepare(`SELECT * FROM ${detailsTable} WHERE invoice_id = ?`).all(id);

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

            // 2. Reverse Balance
            if (isSales) {
                const salesBalanceDelta = (Number(invoice.total_amount) || 0) - (Number(invoice.paid_amount) || 0);
                if (salesBalanceDelta !== 0) {
                    db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(salesBalanceDelta, invoice[personIdField]);
                }
            } else {
                const purchaseBalanceDelta = (Number(invoice.total_amount) || 0) - (Number(invoice.paid_amount) || 0);
                if (purchaseBalanceDelta !== 0) {
                    db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(purchaseBalanceDelta, invoice[personIdField]);
                }
            }

            // 3. Reverse Treasury (if paid > 0)
            if (invoice.paid_amount > 0) {
                // Delete the treasury transaction
                db.prepare('DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = ?').run(id, type);
            }

            // 4. Delete Details
            db.prepare(`DELETE FROM ${detailsTable} WHERE invoice_id = ?`).run(id);

            // 5. Delete Invoice
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
