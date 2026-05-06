const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

const SALES_SHIFT_CLOSE_RELATED_TYPE = 'sales_shift_close';
const CUSTOMER_COLLECTION_PENDING_RELATED_TYPE = 'customer_collection_pending';
const CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE = 'customer_collection_shift_close';

function toPositiveNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toNullableNonNegativeNumber(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    if (normalized === '') return null;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return roundMoney(parsed);
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

function getLastSalesShiftClosing() {
    return db.prepare(`
        SELECT id, period_end_at
        FROM sales_shift_closings
        ORDER BY id DESC
        LIMIT 1
    `).get();
}

function getSalesPaidTotalForPeriod(periodStartAt, periodEndAt) {
    if (periodStartAt) {
        const row = db.prepare(`
            SELECT COALESCE(SUM(paid_amount), 0) AS total_paid, COUNT(*) AS invoices_count
            FROM sales_invoices
            WHERE datetime(created_at) > datetime(@periodStartAt)
              AND datetime(created_at) <= datetime(@periodEndAt)
        `).get({ periodStartAt, periodEndAt });

        return {
            totalPaid: roundMoney(Number(row?.total_paid || 0)),
            invoicesCount: Number(row?.invoices_count || 0)
        };
    }

    const row = db.prepare(`
        SELECT COALESCE(SUM(paid_amount), 0) AS total_paid, COUNT(*) AS invoices_count
        FROM sales_invoices
        WHERE datetime(created_at) <= datetime(@periodEndAt)
    `).get({ periodEndAt });

    return {
        totalPaid: roundMoney(Number(row?.total_paid || 0)),
        invoicesCount: Number(row?.invoices_count || 0)
    };
}

function getDeferredCustomerCollectionsForPeriod(periodStartAt, periodEndAt) {
    if (periodStartAt) {
        const row = db.prepare(`
            SELECT
                COALESCE(SUM(amount), 0) AS total_amount,
                COUNT(*) AS collections_count
            FROM treasury_transactions
            WHERE type = 'income'
              AND related_type = @related_type
              AND datetime(created_at) > datetime(@periodStartAt)
              AND datetime(created_at) <= datetime(@periodEndAt)
        `).get({
            related_type: CUSTOMER_COLLECTION_PENDING_RELATED_TYPE,
            periodStartAt,
            periodEndAt
        });

        return {
            totalAmount: roundMoney(Number(row?.total_amount || 0)),
            collectionsCount: Number(row?.collections_count || 0)
        };
    }

    const row = db.prepare(`
        SELECT
            COALESCE(SUM(amount), 0) AS total_amount,
            COUNT(*) AS collections_count
        FROM treasury_transactions
        WHERE type = 'income'
          AND related_type = @related_type
          AND datetime(created_at) <= datetime(@periodEndAt)
    `).get({
        related_type: CUSTOMER_COLLECTION_PENDING_RELATED_TYPE,
        periodEndAt
    });

    return {
        totalAmount: roundMoney(Number(row?.total_amount || 0)),
        collectionsCount: Number(row?.collections_count || 0)
    };
}

function markDeferredCustomerCollectionsAsShiftClosed(periodStartAt, periodEndAt, shiftClosingId) {
    if (periodStartAt) {
        return db.prepare(`
            UPDATE treasury_transactions
            SET related_type = @next_related_type,
                related_invoice_id = @related_invoice_id
            WHERE type = 'income'
              AND related_type = @current_related_type
              AND datetime(created_at) > datetime(@period_start_at)
              AND datetime(created_at) <= datetime(@period_end_at)
        `).run({
            next_related_type: CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE,
            related_invoice_id: shiftClosingId,
            current_related_type: CUSTOMER_COLLECTION_PENDING_RELATED_TYPE,
            period_start_at: periodStartAt,
            period_end_at: periodEndAt
        });
    }

    return db.prepare(`
        UPDATE treasury_transactions
        SET related_type = @next_related_type,
            related_invoice_id = @related_invoice_id
        WHERE type = 'income'
          AND related_type = @current_related_type
          AND datetime(created_at) <= datetime(@period_end_at)
    `).run({
        next_related_type: CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE,
        related_invoice_id: shiftClosingId,
        current_related_type: CUSTOMER_COLLECTION_PENDING_RELATED_TYPE,
        period_end_at: periodEndAt
    });
}

function resetShiftClosedCustomerCollectionsToPending(shiftClosingId) {
    return db.prepare(`
        UPDATE treasury_transactions
        SET related_type = @next_related_type,
            related_invoice_id = NULL
        WHERE related_type = @current_related_type
          AND related_invoice_id = @related_invoice_id
    `).run({
        next_related_type: CUSTOMER_COLLECTION_PENDING_RELATED_TYPE,
        current_related_type: CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE,
        related_invoice_id: shiftClosingId
    });
}

function getSalesShiftClosingById(id) {
    return db.prepare(`
        SELECT
            sc.*,
            tt.amount AS treasury_amount,
            tt.transaction_date AS treasury_transaction_date
        FROM sales_shift_closings sc
        LEFT JOIN treasury_transactions tt ON tt.id = sc.treasury_transaction_id
        WHERE sc.id = ?
        LIMIT 1
    `).get(id);
}

function buildSalesShiftClosingDescription(shiftClosingId, amount, notes) {
    const notesText = String(notes || '').trim();
    const notesSuffix = notesText ? ` - ${notesText}` : '';
    return `اقفال وردية مبيعات رقم ${shiftClosingId} (مدفوع ${roundMoney(amount).toFixed(2)})${notesSuffix}`;
}

function register() {
    // --- Sales Invoices Handlers ---

    ipcMain.handle('get-sales-invoices', () => {
        try {
            return db.prepare(`
                SELECT si.*, c.name as customer_name 
                FROM sales_invoices si
                LEFT JOIN customers c ON si.customer_id = c.id
                ORDER BY si.id DESC
            `).all();
        } catch (error) {
            console.error('[get-sales-invoices] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-sales-shift-close-preview', () => {
        try {
            const periodEndAt = new Date().toISOString();
            const lastClosing = getLastSalesShiftClosing();
            const periodStartAt = lastClosing?.period_end_at || null;
            const salesPeriodTotals = getSalesPaidTotalForPeriod(periodStartAt, periodEndAt);
            const deferredCollectionsTotals = getDeferredCustomerCollectionsForPeriod(periodStartAt, periodEndAt);
            const totalTransferred = roundMoney(salesPeriodTotals.totalPaid + deferredCollectionsTotals.totalAmount);

            return {
                success: true,
                period_start_at: periodStartAt,
                period_end_at: periodEndAt,
                sales_paid_total: totalTransferred,
                sales_only_total: salesPeriodTotals.totalPaid,
                customer_collections_total: deferredCollectionsTotals.totalAmount,
                invoices_count: salesPeriodTotals.invoicesCount,
                customer_collections_count: deferredCollectionsTotals.collectionsCount
            };
        } catch (error) {
            console.error('[get-sales-shift-close-preview] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('create-sales-shift-closing', (event, payload = {}) => {
        try {
            const createdBy = String(payload.created_by || '').trim() || null;
            const notes = String(payload.notes || '').trim() || null;
            const periodEndAt = String(payload.period_end_at || '').trim() || new Date().toISOString();

            const lastClosing = getLastSalesShiftClosing();
            const periodStartAt = lastClosing?.period_end_at || null;
            const salesPeriodTotals = getSalesPaidTotalForPeriod(periodStartAt, periodEndAt);
            const deferredCollectionsTotals = getDeferredCustomerCollectionsForPeriod(periodStartAt, periodEndAt);
            const totalTransferred = roundMoney(salesPeriodTotals.totalPaid + deferredCollectionsTotals.totalAmount);
            const drawerAmount = toNullableNonNegativeNumber(payload.drawer_amount);
            const differenceAmount = drawerAmount === null ? null : roundMoney(drawerAmount - totalTransferred);

            const createTx = db.transaction(() => {
                const insertClosingInfo = db.prepare(`
                    INSERT INTO sales_shift_closings (
                        period_start_at,
                        period_end_at,
                        sales_paid_total,
                        customer_collections_total,
                        drawer_amount,
                        difference_amount,
                        notes,
                        created_by
                    ) VALUES (
                        @period_start_at,
                        @period_end_at,
                        @sales_paid_total,
                        @customer_collections_total,
                        @drawer_amount,
                        @difference_amount,
                        @notes,
                        @created_by
                    )
                `).run({
                    period_start_at: periodStartAt,
                    period_end_at: periodEndAt,
                    sales_paid_total: totalTransferred,
                    customer_collections_total: deferredCollectionsTotals.totalAmount,
                    drawer_amount: drawerAmount,
                    difference_amount: differenceAmount,
                    notes,
                    created_by: createdBy
                });

                const shiftClosingId = Number(insertClosingInfo.lastInsertRowid);

                const treasuryInfo = db.prepare(`
                    INSERT INTO treasury_transactions (
                        type,
                        amount,
                        transaction_date,
                        description,
                        related_invoice_id,
                        related_type
                    ) VALUES (
                        'income',
                        @amount,
                        @transaction_date,
                        @description,
                        @related_invoice_id,
                        '${SALES_SHIFT_CLOSE_RELATED_TYPE}'
                    )
                `).run({
                    amount: totalTransferred,
                    transaction_date: String(periodEndAt).slice(0, 10),
                    description: buildSalesShiftClosingDescription(shiftClosingId, totalTransferred, notes),
                    related_invoice_id: shiftClosingId
                });

                db.prepare('UPDATE sales_shift_closings SET treasury_transaction_id = ? WHERE id = ?')
                    .run(Number(treasuryInfo.lastInsertRowid), shiftClosingId);

                markDeferredCustomerCollectionsAsShiftClosed(periodStartAt, periodEndAt, shiftClosingId);

                return shiftClosingId;
            });

            const shiftClosingId = createTx();
            const createdClosing = getSalesShiftClosingById(shiftClosingId);

            return {
                success: true,
                closing: createdClosing
            };
        } catch (error) {
            console.error('[create-sales-shift-closing] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-sales-shift-closings', (event, payload = {}) => {
        try {
            const search = String(payload.search || '').trim();

            if (search) {
                const pattern = `%${search}%`;
                const closings = db.prepare(`
                    SELECT
                        sc.*,
                        tt.amount AS treasury_amount,
                        tt.transaction_date AS treasury_transaction_date
                    FROM sales_shift_closings sc
                    LEFT JOIN treasury_transactions tt ON tt.id = sc.treasury_transaction_id
                    WHERE CAST(sc.id AS TEXT) LIKE @pattern
                       OR COALESCE(sc.notes, '') LIKE @pattern
                       OR COALESCE(sc.created_by, '') LIKE @pattern
                       OR COALESCE(sc.period_start_at, '') LIKE @pattern
                       OR COALESCE(sc.period_end_at, '') LIKE @pattern
                    ORDER BY sc.id DESC
                `).all({ pattern });

                return {
                    success: true,
                    closings
                };
            }

            const closings = db.prepare(`
                SELECT
                    sc.*,
                    tt.amount AS treasury_amount,
                    tt.transaction_date AS treasury_transaction_date
                FROM sales_shift_closings sc
                LEFT JOIN treasury_transactions tt ON tt.id = sc.treasury_transaction_id
                ORDER BY sc.id DESC
            `).all();

            return {
                success: true,
                closings
            };
        } catch (error) {
            console.error('[get-sales-shift-closings] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-sales-shift-closing', (event, payload = {}) => {
        const id = Number(payload.id);
        if (!Number.isFinite(id) || id <= 0) {
            return { success: false, error: 'معرف الإقفال غير صالح.' };
        }

        const salesPaidRaw = Number(payload.sales_paid_total);
        if (!Number.isFinite(salesPaidRaw) || salesPaidRaw < 0) {
            return { success: false, error: 'قيمة إجمالي المدفوع غير صالحة.' };
        }

        try {
            const existing = db.prepare('SELECT * FROM sales_shift_closings WHERE id = ? LIMIT 1').get(id);
            if (!existing) {
                return { success: false, error: 'سجل الإقفال غير موجود.' };
            }

            const salesPaidTotal = roundMoney(salesPaidRaw);
            const existingCollectionsTotal = roundMoney(Number(existing.customer_collections_total) || 0);
            const payloadCollectionsRaw = Number(payload.customer_collections_total);
            const customerCollectionsTotal = Number.isFinite(payloadCollectionsRaw) && payloadCollectionsRaw >= 0
                ? roundMoney(payloadCollectionsRaw)
                : existingCollectionsTotal;
            const drawerAmount = toNullableNonNegativeNumber(payload.drawer_amount);
            const differenceAmount = drawerAmount === null ? null : roundMoney(drawerAmount - salesPaidTotal);
            const notes = String(payload.notes || '').trim() || null;
            const createdBy = String(payload.updated_by || payload.created_by || '').trim() || existing.created_by || null;
            const updatedAt = new Date().toISOString();
            const transactionDate = String(existing.period_end_at || updatedAt).slice(0, 10);

            const updateTx = db.transaction(() => {
                db.prepare(`
                    UPDATE sales_shift_closings
                    SET sales_paid_total = @sales_paid_total,
                        customer_collections_total = @customer_collections_total,
                        drawer_amount = @drawer_amount,
                        difference_amount = @difference_amount,
                        notes = @notes,
                        created_by = @created_by,
                        updated_at = @updated_at
                    WHERE id = @id
                `).run({
                    id,
                    sales_paid_total: salesPaidTotal,
                    customer_collections_total: customerCollectionsTotal,
                    drawer_amount: drawerAmount,
                    difference_amount: differenceAmount,
                    notes,
                    created_by: createdBy,
                    updated_at: updatedAt
                });

                const description = buildSalesShiftClosingDescription(id, salesPaidTotal, notes);

                const treasuryTransactionId = Number(existing.treasury_transaction_id) || 0;
                if (treasuryTransactionId > 0) {
                    const treasuryRow = db.prepare('SELECT id FROM treasury_transactions WHERE id = ? LIMIT 1').get(treasuryTransactionId);
                    if (treasuryRow) {
                        db.prepare(`
                            UPDATE treasury_transactions
                            SET amount = @amount,
                                transaction_date = @transaction_date,
                                description = @description,
                                related_invoice_id = @related_invoice_id,
                                related_type = '${SALES_SHIFT_CLOSE_RELATED_TYPE}'
                            WHERE id = @id
                        `).run({
                            id: treasuryTransactionId,
                            amount: salesPaidTotal,
                            transaction_date: transactionDate,
                            description,
                            related_invoice_id: id
                        });
                        return;
                    }
                }

                const treasuryInfo = db.prepare(`
                    INSERT INTO treasury_transactions (
                        type,
                        amount,
                        transaction_date,
                        description,
                        related_invoice_id,
                        related_type
                    ) VALUES (
                        'income',
                        @amount,
                        @transaction_date,
                        @description,
                        @related_invoice_id,
                        '${SALES_SHIFT_CLOSE_RELATED_TYPE}'
                    )
                `).run({
                    amount: salesPaidTotal,
                    transaction_date: transactionDate,
                    description,
                    related_invoice_id: id
                });

                db.prepare('UPDATE sales_shift_closings SET treasury_transaction_id = ? WHERE id = ?')
                    .run(Number(treasuryInfo.lastInsertRowid), id);
            });

            updateTx();

            return {
                success: true,
                closing: getSalesShiftClosingById(id)
            };
        } catch (error) {
            console.error('[update-sales-shift-closing] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-sales-shift-closing', (event, id) => {
        const closingId = Number(id);
        if (!Number.isFinite(closingId) || closingId <= 0) {
            return { success: false, error: 'معرف الإقفال غير صالح.' };
        }

        try {
            const existing = db.prepare('SELECT * FROM sales_shift_closings WHERE id = ? LIMIT 1').get(closingId);
            if (!existing) {
                return { success: false, error: 'سجل الإقفال غير موجود.' };
            }

            const deleteTx = db.transaction(() => {
                const treasuryTransactionId = Number(existing.treasury_transaction_id) || 0;
                if (treasuryTransactionId > 0) {
                    db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(treasuryTransactionId);
                } else {
                    db.prepare(`DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = '${SALES_SHIFT_CLOSE_RELATED_TYPE}'`)
                        .run(closingId);
                }

                resetShiftClosedCustomerCollectionsToPending(closingId);
                db.prepare('DELETE FROM sales_shift_closings WHERE id = ?').run(closingId);
            });

            deleteTx();
            return { success: true };
        } catch (error) {
            console.error('[delete-sales-shift-closing] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-sales-invoice', (event, invoiceData) => {
        const denied = requirePermission('sales', 'add');
        if (denied) return denied;
        const { customer_id, invoice_date, notes, items, payment_type, discount_type, discount_value, paid_amount } = invoiceData;
        let { invoice_number } = invoiceData;

        // Ensure invoice_number is always present (avoid empty/null numbers that bypass duplicate checks)
        if (!invoice_number || String(invoice_number).trim() === '') {
            const result = db.prepare('SELECT MAX(id) as maxId FROM sales_invoices').get();
            invoice_number = String((result.maxId || 0) + 1);
        }

        console.log(`[sales] save-sales-invoice invoice_number=${invoice_number} customer_id=${customer_id} items=${items?.length ?? 0}`);
        
        // Check for duplicate invoice number
        const existing = db.prepare('SELECT id FROM sales_invoices WHERE invoice_number = ?').get(invoice_number);
        if (existing) {
            console.log(`[sales] save-sales-invoice rejected duplicate invoice_number=${invoice_number} existing_id=${existing.id}`);
            return { success: false, error: 'رقم الفاتورة موجود مسبقاً' };
        }

        // Stock validation: prevent selling more than available
        const getStock = db.prepare('SELECT id, name, stock_quantity FROM items WHERE id = ?');
        for (const item of items) {
            const dbItem = getStock.get(item.item_id);
            if (!dbItem) {
                return { success: false, error: `الصنف غير موجود (ID: ${item.item_id})` };
            }
            if (item.quantity > dbItem.stock_quantity) {
                return { success: false, error: `الصنف "${dbItem.name}": الكمية المطلوبة (${item.quantity}) أكبر من المتاح (${dbItem.stock_quantity})` };
            }
        }

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
            INSERT INTO sales_invoices (customer_id, invoice_number, invoice_date, total_amount, discount_type, discount_value, discount_amount, paid_amount, remaining_amount, payment_type, notes)
            VALUES (@customer_id, @invoice_number, @invoice_date, @total_amount, @discount_type, @discount_value, @discount_amount, @paid_amount, @remaining_amount, @payment_type, @notes)
        `);

        const insertDetail = db.prepare(`
            INSERT INTO sales_invoice_details (invoice_id, item_id, quantity, sale_price, total_price)
            VALUES (@invoice_id, @item_id, @quantity, @sale_price, @total_price)
        `);

        const updateItemStock = db.prepare(`
            UPDATE items 
            SET stock_quantity = stock_quantity - @quantity
            WHERE id = @item_id
        `);

        const updateCustomerBalance = db.prepare(`
            UPDATE customers 
            SET balance = balance + @amount 
            WHERE id = @id
        `);

        const transaction = db.transaction((data) => {
            const info = insertInvoice.run({
                customer_id: data.customer_id,
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
                    sale_price: item.sale_price,
                    total_price: item.total_price
                });

                // Update item stock (subtract quantity)
                updateItemStock.run({
                    quantity: item.quantity,
                    item_id: item.item_id
                });
            }

            if (financials.balance_delta !== 0) {
                updateCustomerBalance.run({
                    amount: financials.balance_delta,
                    id: data.customer_id
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

    ipcMain.handle('update-sales-invoice', (event, invoiceData) => {
        const denied = requirePermission('sales', 'edit');
        if (denied) return denied;
        const { id, customer_id, invoice_number, invoice_date, notes, items, payment_type, discount_type, discount_value, paid_amount } = invoiceData;

        console.log(`[sales] update-sales-invoice id=${id} invoice_number=${invoice_number} customer_id=${customer_id} items=${items?.length ?? 0}`);
        
        // Check for duplicate invoice number (excluding current invoice)
        const existing = db.prepare('SELECT id FROM sales_invoices WHERE invoice_number = ? AND id != ?').get(invoice_number, id);
        if (existing) {
            console.log(`[sales] update-sales-invoice rejected duplicate invoice_number=${invoice_number} existing_id=${existing.id} current_id=${id}`);
            return { success: false, error: 'رقم الفاتورة موجود مسبقاً' };
        }

        // 1. Fetch Old Data
        const oldInvoice = db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(id);
        const oldDetails = db.prepare('SELECT * FROM sales_invoice_details WHERE invoice_id = ?').all(id);

        if (!oldInvoice) return { success: false, error: 'Invoice not found' };

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

        const transaction = db.transaction(() => {
            // --- REVERSE OLD EFFECTS ---
            
            // Reverse Stock (Add back sold items)
            for (const item of oldDetails) {
                db.prepare('UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.item_id);
            }

            // Stock validation after reversal: check new quantities fit
            const getStockForUpdate = db.prepare('SELECT id, name, stock_quantity FROM items WHERE id = ?');
            for (const item of items) {
                const dbItem = getStockForUpdate.get(item.item_id);
                if (!dbItem) {
                    throw new Error(`الصنف غير موجود (ID: ${item.item_id})`);
                }
                if (item.quantity > dbItem.stock_quantity) {
                    throw new Error(`الصنف "${dbItem.name}": الكمية المطلوبة (${item.quantity}) أكبر من المتاح (${dbItem.stock_quantity})`);
                }
            }

            const oldBalanceDelta = roundMoney((Number(oldInvoice.total_amount) || 0) - (Number(oldInvoice.paid_amount) || 0));
            if (oldBalanceDelta !== 0) {
                db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(oldBalanceDelta, oldInvoice.customer_id);
            }

            // Delete old Details
            db.prepare('DELETE FROM sales_invoice_details WHERE invoice_id = ?').run(id);

            // --- APPLY NEW EFFECTS ---

            // Update Invoice Header
            db.prepare(`
                UPDATE sales_invoices 
                SET customer_id = @customer_id, invoice_number = @invoice_number, invoice_date = @invoice_date, 
                    total_amount = @total_amount, discount_type = @discount_type, discount_value = @discount_value, discount_amount = @discount_amount,
                    paid_amount = @paid_amount, remaining_amount = @remaining_amount, 
                    payment_type = @payment_type, notes = @notes
                WHERE id = @id
            `).run({
                id,
                customer_id,
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

            // Insert New Details & Update Stock
            const insertDetail = db.prepare(`
                INSERT INTO sales_invoice_details (invoice_id, item_id, quantity, sale_price, total_price)
                VALUES (@invoice_id, @item_id, @quantity, @sale_price, @total_price)
            `);
            const updateItemStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity - @quantity WHERE id = @item_id');

            for (const item of items) {
                insertDetail.run({
                    invoice_id: id,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    sale_price: item.sale_price,
                    total_price: item.total_price
                });
                updateItemStock.run({ quantity: item.quantity, item_id: item.item_id });
            }

            if (financials.balance_delta !== 0) {
                db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(financials.balance_delta, customer_id);
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
