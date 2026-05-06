const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function toPositiveNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function calculateInvoiceFinancials({ subtotalAmount, discountType, discountValue, paidAmount }) {
    const subtotal = roundMoney(Math.max(Number(subtotalAmount) || 0, 0));
    const normalizedDiscountType = discountType === 'percent' ? 'percent' : 'amount';
    const rawDiscountValue = toPositiveNumber(discountValue);
    const normalizedDiscountValue = normalizedDiscountType === 'percent'
        ? Math.min(rawDiscountValue, 100)
        : rawDiscountValue;

    let discountAmount = normalizedDiscountType === 'percent'
        ? subtotal * (normalizedDiscountValue / 100)
        : normalizedDiscountValue;
    discountAmount = roundMoney(Math.min(Math.max(discountAmount, 0), subtotal));

    const totalAmount = roundMoney(Math.max(subtotal - discountAmount, 0));
    const paid = roundMoney(toPositiveNumber(paidAmount));
    const remaining = roundMoney(Math.max(totalAmount - paid, 0));
    const balanceDelta = roundMoney(totalAmount - paid);

    return {
        subtotal_amount: subtotal,
        discount_type: normalizedDiscountType,
        discount_value: roundMoney(normalizedDiscountValue),
        discount_amount: discountAmount,
        total_amount: totalAmount,
        paid_amount: paid,
        remaining_amount: remaining,
        balance_delta: balanceDelta
    };
}

function register() {
    // --- Purchase Invoices Handlers ---

    ipcMain.handle('get-purchase-invoices', () => {
        try {
            return db.prepare(`
                SELECT pi.*, c.name as supplier_name 
                FROM purchase_invoices pi
                LEFT JOIN customers c ON pi.supplier_id = c.id
                ORDER BY pi.id DESC
            `).all();
        } catch (error) {
            console.error('[get-purchase-invoices] Error:', error);
            return [];
        }
    });

    ipcMain.handle('save-purchase-invoice', (event, invoiceData) => {
        const denied = requirePermission('purchases', 'add');
        if (denied) return denied;
        const { supplier_id, invoice_number, invoice_date, notes, items, payment_type, discount_type, discount_value, paid_amount } = invoiceData;

        let subtotalAmount = 0;
        for (const item of items) {
            subtotalAmount += Number(item.total_price) || 0;
        }

        const financials = calculateInvoiceFinancials({
            subtotalAmount,
            discountType: discount_type,
            discountValue: discount_value,
            paidAmount: paid_amount
        });

        const insertInvoice = db.prepare(`
            INSERT INTO purchase_invoices (supplier_id, invoice_number, invoice_date, total_amount, discount_type, discount_value, discount_amount, paid_amount, remaining_amount, payment_type, notes)
            VALUES (@supplier_id, @invoice_number, @invoice_date, @total_amount, @discount_type, @discount_value, @discount_amount, @paid_amount, @remaining_amount, @payment_type, @notes)
        `);

        const insertDetail = db.prepare(`
            INSERT INTO purchase_invoice_details (invoice_id, item_id, quantity, cost_price, total_price)
            VALUES (@invoice_id, @item_id, @quantity, @cost_price, @total_price)
        `);

        const updateItemStock = db.prepare(`
            UPDATE items 
            SET stock_quantity = stock_quantity + @quantity,
                cost_price = @cost_price 
            WHERE id = @item_id
        `);

        const insertTreasuryTransaction = db.prepare(`
            INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type, customer_id)
            VALUES ('expense', @amount, @date, @description, @invoice_id, 'purchase', @customer_id)
        `);

        const updateSupplierBalance = db.prepare(`
            UPDATE customers
            SET balance = balance - @amount
            WHERE id = @id
        `);

        const transaction = db.transaction((data) => {
            const info = insertInvoice.run({
                supplier_id: data.supplier_id,
                invoice_number: data.invoice_number,
                invoice_date: data.invoice_date,
                total_amount: financials.total_amount,
                discount_type: financials.discount_type,
                discount_value: financials.discount_value,
                discount_amount: financials.discount_amount,
                paid_amount: financials.paid_amount,
                remaining_amount: financials.remaining_amount,
                payment_type: data.payment_type,
                notes: data.notes
            });
            const invoiceId = info.lastInsertRowid;

            for (const item of data.items) {
                insertDetail.run({
                    invoice_id: invoiceId,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    cost_price: item.cost_price,
                    total_price: item.total_price
                });

                // Update item stock and cost price
                updateItemStock.run({
                    quantity: item.quantity,
                    cost_price: item.cost_price,
                    item_id: item.item_id
                });
            }

            if (financials.paid_amount > 0) {
                insertTreasuryTransaction.run({
                    amount: financials.paid_amount,
                    date: data.invoice_date,
                    description: `فاتورة شراء رقم ${data.invoice_number || invoiceId} (مدفوع ${financials.paid_amount.toFixed(2)})`,
                    invoice_id: invoiceId,
                    customer_id: data.supplier_id
                });
            }

            if (financials.balance_delta !== 0) {
                updateSupplierBalance.run({
                    amount: financials.balance_delta,
                    id: data.supplier_id
                });
            }

            return invoiceId;
        });

        try {
            const invoiceId = transaction(invoiceData);
            return { success: true, invoiceId };
        } catch (error) {
            console.error(error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-purchase-invoice', (event, invoiceData) => {
        const denied = requirePermission('purchases', 'edit');
        if (denied) return denied;
        const { id, supplier_id, invoice_number, invoice_date, notes, items, payment_type, discount_type, discount_value, paid_amount } = invoiceData;
        
        const oldInvoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(id);
        const oldDetails = db.prepare('SELECT * FROM purchase_invoice_details WHERE invoice_id = ?').all(id);

        if (!oldInvoice) return { success: false, error: 'Invoice not found' };

        let subtotalAmount = 0;
        for (const item of items) subtotalAmount += Number(item.total_price) || 0;

        const financials = calculateInvoiceFinancials({
            subtotalAmount,
            discountType: discount_type,
            discountValue: discount_value,
            paidAmount: paid_amount
        });

        const transaction = db.transaction(() => {
            // --- REVERSE OLD ---
            // Reverse Stock (Remove purchased items)
            for (const item of oldDetails) {
                db.prepare('UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?').run(item.quantity, item.item_id);
            }
            const oldBalanceDelta = roundMoney((Number(oldInvoice.total_amount) || 0) - (Number(oldInvoice.paid_amount) || 0));
            if (oldBalanceDelta !== 0) {
                db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(oldBalanceDelta, oldInvoice.supplier_id);
            }
            // Delete Treasury
            if (oldInvoice.paid_amount > 0) {
                db.prepare("DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = 'purchase'").run(id);
            }
            // Delete Details
            db.prepare('DELETE FROM purchase_invoice_details WHERE invoice_id = ?').run(id);

            // --- APPLY NEW ---
            db.prepare(`
                UPDATE purchase_invoices 
                SET supplier_id = @supplier_id, invoice_number = @invoice_number, invoice_date = @invoice_date, 
                    total_amount = @total_amount, discount_type = @discount_type, discount_value = @discount_value, discount_amount = @discount_amount,
                    paid_amount = @paid_amount, remaining_amount = @remaining_amount, 
                    payment_type = @payment_type, notes = @notes
                WHERE id = @id
            `).run({
                id,
                supplier_id,
                invoice_number,
                invoice_date,
                total_amount: financials.total_amount,
                discount_type: financials.discount_type,
                discount_value: financials.discount_value,
                discount_amount: financials.discount_amount,
                paid_amount: financials.paid_amount,
                remaining_amount: financials.remaining_amount,
                payment_type,
                notes
            });

            const insertDetail = db.prepare(`
                INSERT INTO purchase_invoice_details (invoice_id, item_id, quantity, cost_price, total_price)
                VALUES (@invoice_id, @item_id, @quantity, @cost_price, @total_price)
            `);
            const updateItemStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity + @quantity, cost_price = @cost_price WHERE id = @item_id');

            for (const item of items) {
                insertDetail.run({
                    invoice_id: id,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    cost_price: item.cost_price,
                    total_price: item.total_price
                });
                updateItemStock.run({ quantity: item.quantity, cost_price: item.cost_price, item_id: item.item_id });
            }

            if (financials.balance_delta !== 0) {
                db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(financials.balance_delta, supplier_id);
            }

            if (financials.paid_amount > 0) {
                db.prepare(`
                    INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type, customer_id)
                    VALUES ('expense', @amount, @date, @description, @invoice_id, 'purchase', @customer_id)
                `).run({
                    amount: financials.paid_amount,
                    date: invoice_date,
                    description: `تعديل فاتورة شراء رقم ${invoice_number || id} (مدفوع ${financials.paid_amount.toFixed(2)})`,
                    invoice_id: id,
                    customer_id: supplier_id
                });
            }
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
