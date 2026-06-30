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

function applyBaskeelDiscountRounding(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const base = Math.floor(n);
    const fraction = n - base;
    return base + (fraction >= 0.5 ? 0.5 : 0);
}

function applyIntegerFiftyRounding(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const whole = Math.floor(n);
    const baseHundred = Math.floor(whole / 100) * 100;
    const tail = whole % 100;
    return baseHundred + (tail >= 50 ? 50 : 0);
}

const PURCHASE_WASTE_RATE = 0.01;
const PURCHASE_NET_FACTOR = 1 - PURCHASE_WASTE_RATE;

function normalizeWeightsList(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return { weights: [], method: 'normal', rate: 0 };

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return {
                    weights: parsed.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0),
                    method: 'normal',
                    rate: 0
                };
            } else if (parsed && typeof parsed === 'object') {
                return {
                    weights: Array.isArray(parsed.weights) ? parsed.weights.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0) : [],
                    method: parsed.method === 'rate' ? 'rate' : 'normal',
                    rate: Number.isFinite(Number(parsed.rate)) ? Number(parsed.rate) : 0
                };
            }
        } catch (_error) {
            return { weights: [], method: 'normal', rate: 0 };
        }
    }

    if (Array.isArray(value)) {
        return {
            weights: value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0),
            method: 'normal',
            rate: 0
        };
    }
    
    if (value && typeof value === 'object') {
        return {
            weights: Array.isArray(value.weights) ? value.weights.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0) : [],
            method: value.method === 'rate' ? 'rate' : 'normal',
            rate: Number.isFinite(Number(value.rate)) ? Number(value.rate) : 0
        };
    }

    return { weights: [], method: 'normal', rate: 0 };
}

function sumWeights(weights) {
    if (!Array.isArray(weights)) return 0;
    return weights.reduce((sum, value) => sum + value, 0);
}

function normalizeCostPrice(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeRawQuantity(rawQuantity, fallbackNetQuantity) {
    const n = Number(rawQuantity);
    if (Number.isFinite(n) && n > 0) return n;

    const fallback = Number(fallbackNetQuantity);
    if (Number.isFinite(fallback) && fallback > 0) return fallback;

    return 0;
}

function calculateNetQuantity(rawQuantity, method = 'normal', rate = 0) {
    const net1Quantity = rawQuantity * PURCHASE_NET_FACTOR;
    if (method === 'rate') {
        const roundedNet1Quantity = Math.round(net1Quantity);
        return roundedNet1Quantity * (rate / 100);
    }
    return net1Quantity;
}

function normalizePurchaseItems(items) {
    const safeItems = Array.isArray(items) ? items : [];

    return safeItems.map((item) => {
        const weightsData = normalizeWeightsList(item.raw_weights);
        const rawFromWeights = sumWeights(weightsData.weights);
        const rawQuantity = normalizeRawQuantity(rawFromWeights || item.raw_quantity, item.quantity);
        const netQuantity = rawQuantity > 0 ? calculateNetQuantity(rawQuantity, weightsData.method, weightsData.rate) : 0;
        const costPrice = normalizeCostPrice(item.cost_price);
        const rawTotal = rawQuantity * costPrice;
        const totalPrice = netQuantity * costPrice;

        return {
            item_id: item.item_id,
            raw_quantity: rawQuantity,
            raw_weights: weightsData.method === 'normal' ? JSON.stringify(weightsData.weights) : JSON.stringify(weightsData),
            quantity: netQuantity,
            cost_price: costPrice,
            total_price: totalPrice,
            raw_total_price: rawTotal
        };
    });
}

function calculateInvoiceFinancials({ subtotalAmount, discountType, discountValue, paidAmount, finalAmount }) {
    const subtotal = roundMoney(Math.max(Number(subtotalAmount) || 0, 0));
    const normalizedDiscountType = discountType === 'percent' ? 'percent' : 'amount';
    const rawDiscountValue = toPositiveNumber(discountValue);
    const normalizedDiscountValue = normalizedDiscountType === 'percent'
        ? Math.min(rawDiscountValue, 100)
        : rawDiscountValue;

    let discountAmount = normalizedDiscountType === 'percent'
        ? subtotal * (normalizedDiscountValue / 100)
        : normalizedDiscountValue;
    discountAmount = Math.min(Math.max(discountAmount, 0), subtotal);
    if (normalizedDiscountType === 'percent' && normalizedDiscountValue === PURCHASE_WASTE_RATE * 100) {
        discountAmount = applyBaskeelDiscountRounding(discountAmount);
    }
    discountAmount = roundMoney(discountAmount);

    const parsedFinalAmount = Number(finalAmount);
    const hasFinalAmount = Number.isFinite(parsedFinalAmount) && parsedFinalAmount >= 0;
    const totalAmountRaw = hasFinalAmount
        ? roundMoney(Math.max(parsedFinalAmount, 0))
        : roundMoney(Math.max(subtotal - discountAmount, 0));
    const totalAmount = applyIntegerFiftyRounding(totalAmountRaw);
    if (hasFinalAmount) {
        discountAmount = roundMoney(Math.max(subtotal - totalAmount, 0));
    }
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
                LEFT JOIN parties c ON pi.supplier_id = c.id
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
        const { supplier_id, invoice_number, invoice_date, notes, items, payment_type, paid_amount } = invoiceData;
        const trimmedInvoiceNumber = String(invoice_number || '').trim();
        if (trimmedInvoiceNumber) {
            const duplicateInvoice = db.prepare('SELECT id FROM purchase_invoices WHERE TRIM(invoice_number) = TRIM(?) LIMIT 1').get(trimmedInvoiceNumber);
            if (duplicateInvoice) {
                return { success: false, error: 'رقم فاتورة الشراء موجود مسبقًا. يرجى إدخال رقم مختلف.' };
            }
        }

        const normalizedItems = normalizePurchaseItems(items);
        let rawSubtotalAmount = 0;
        let netSubtotalAmount = 0;
        for (const item of normalizedItems) {
            rawSubtotalAmount += Number(item.raw_total_price) || 0;
            netSubtotalAmount += Number(item.total_price) || 0;
        }

        const financials = calculateInvoiceFinancials({
            subtotalAmount: rawSubtotalAmount,
            discountType: 'percent',
            discountValue: PURCHASE_WASTE_RATE * 100,
            paidAmount: paid_amount,
            finalAmount: netSubtotalAmount
        });

        const insertInvoice = db.prepare(`
            INSERT INTO purchase_invoices (supplier_id, invoice_number, invoice_date, total_amount, discount_type, discount_value, discount_amount, paid_amount, remaining_amount, payment_type, notes)
            VALUES (@supplier_id, @invoice_number, @invoice_date, @total_amount, @discount_type, @discount_value, @discount_amount, @paid_amount, @remaining_amount, @payment_type, @notes)
        `);

        const insertDetail = db.prepare(`
            INSERT INTO purchase_invoice_details (invoice_id, item_id, raw_quantity, raw_weights, quantity, cost_price, total_price)
            VALUES (@invoice_id, @item_id, @raw_quantity, @raw_weights, @quantity, @cost_price, @total_price)
        `);

        const updateItemStock = db.prepare(`
            UPDATE items 
            SET stock_quantity = stock_quantity + @quantity,
                cost_price = @cost_price 
            WHERE id = @item_id
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

            for (const item of normalizedItems) {
                insertDetail.run({
                    invoice_id: invoiceId,
                    item_id: item.item_id,
                    raw_quantity: item.raw_quantity,
                    raw_weights: item.raw_weights,
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
        const { id, supplier_id, invoice_number, invoice_date, notes, items, payment_type, paid_amount } = invoiceData;
        
        const oldInvoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(id);
        const oldDetails = db.prepare('SELECT * FROM purchase_invoice_details WHERE invoice_id = ?').all(id);

        if (!oldInvoice) return { success: false, error: 'Invoice not found' };
        const trimmedInvoiceNumber = String(invoice_number || '').trim();
        if (trimmedInvoiceNumber) {
            const duplicateInvoice = db.prepare('SELECT id FROM purchase_invoices WHERE TRIM(invoice_number) = TRIM(?) AND id != ? LIMIT 1').get(trimmedInvoiceNumber, id);
            if (duplicateInvoice) {
                return { success: false, error: 'رقم فاتورة الشراء موجود مسبقًا. يرجى إدخال رقم مختلف.' };
            }
        }

        const normalizedItems = normalizePurchaseItems(items);
        let rawSubtotalAmount = 0;
        let netSubtotalAmount = 0;
        for (const item of normalizedItems) {
            rawSubtotalAmount += Number(item.raw_total_price) || 0;
            netSubtotalAmount += Number(item.total_price) || 0;
        }

        const financials = calculateInvoiceFinancials({
            subtotalAmount: rawSubtotalAmount,
            discountType: 'percent',
            discountValue: PURCHASE_WASTE_RATE * 100,
            paidAmount: paid_amount,
            finalAmount: netSubtotalAmount
        });

        const getItemStock = db.prepare('SELECT name, stock_quantity FROM items WHERE id = ?');
        const itemDeltas = new Map();
        for (const item of oldDetails) {
            itemDeltas.set(item.item_id, -(Number(item.quantity) || 0));
        }
        for (const item of normalizedItems) {
            const currentDelta = itemDeltas.get(item.item_id) || 0;
            itemDeltas.set(item.item_id, currentDelta + (Number(item.quantity) || 0));
        }
        for (const [itemId, delta] of itemDeltas.entries()) {
            if (delta < 0) {
                const dbItem = getItemStock.get(itemId);
                const currentStock = Number(dbItem?.stock_quantity) || 0;
                if (currentStock + delta < 0) {
                    const itemName = dbItem?.name || `ID: ${itemId}`;
                    return {
                        success: false,
                        error: `لا يمكن تعديل الفاتورة وتقليل الكمية. المخزون الحالي للصنف "${itemName}" لا يسمح (تم بيع جزء منه).`
                    };
                }
            }
        }

        const transaction = db.transaction(() => {
            // --- REVERSE OLD ---
            // Stock reversal moved to the end to prevent temporary negative values.
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
                INSERT INTO purchase_invoice_details (invoice_id, item_id, raw_quantity, raw_weights, quantity, cost_price, total_price)
                VALUES (@invoice_id, @item_id, @raw_quantity, @raw_weights, @quantity, @cost_price, @total_price)
            `);
            const updateItemStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity + @quantity, cost_price = @cost_price WHERE id = @item_id');

            for (const item of normalizedItems) {
                insertDetail.run({
                    invoice_id: id,
                    item_id: item.item_id,
                    raw_quantity: item.raw_quantity,
                    raw_weights: item.raw_weights,
                    quantity: item.quantity,
                    cost_price: item.cost_price,
                    total_price: item.total_price
                });
                updateItemStock.run({ quantity: item.quantity, cost_price: item.cost_price, item_id: item.item_id });
            }

            // Reverse Stock (Remove old purchased items)
            for (const item of oldDetails) {
                db.prepare('UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?').run(item.quantity, item.item_id);
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


