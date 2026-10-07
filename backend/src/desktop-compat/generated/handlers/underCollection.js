const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const DEFAULT_PAGE_SIZE = 50;

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getNextDocumentNumber() {
    const row = db.prepare(`
        SELECT document_number
        FROM under_collection_records
        WHERE document_number GLOB 'UC-[0-9]*'
        ORDER BY CAST(SUBSTR(document_number, 4) AS INTEGER) DESC
        LIMIT 1
    `).get();

    const lastNumber = row ? Number(String(row.document_number).slice(3)) : 0;
    return `UC-${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, '0')}`;
}

function getCurrentTreasuryBalance() {
    const income = Number(db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM treasury_transactions 
        WHERE type = 'income'
          AND COALESCE(related_type, '') NOT IN ('customer_collection_pending', 'customer_collection_shift_close')
    `).get().total || 0);
    const expense = Number(db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM treasury_transactions WHERE type = 'expense'").get().total || 0);
    return roundMoney(income - expense);
}

function getNextPettyExpenseNumber() {
    const row = db.prepare(`
        SELECT document_number
        FROM petty_expenses
        WHERE document_number GLOB 'NTH-[0-9]*'
        ORDER BY CAST(SUBSTR(document_number, 5) AS INTEGER) DESC
        LIMIT 1
    `).get();

    const lastNumber = row ? Number(String(row.document_number).slice(4)) : 0;
    return `NTH-${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, '0')}`;
}

function normalizeDate(value) {
    const text = String(value || '').trim();
    return text || new Date().toISOString().slice(0, 10);
}

function normalizePayload(data = {}) {
    const containerCount = Math.max(0, Math.floor(Number(data.container_count) || 0));
    const isContainer20 = data.container_20 ? 1 : 0;
    const isContainer40 = data.container_40 ? 1 : 0;
    const tonsCount = Number(data.tons_count) || 0;
    const tonPrice = Number(data.ton_price) || 0;
    const totalUsd = Number(data.total_usd) > 0 ? roundMoney(data.total_usd) : roundMoney(tonsCount * tonPrice);
    const discountUsd = roundMoney(Math.max(0, Number(data.discount_usd) || 0));
    const netUsd = roundMoney(Math.max(0, totalUsd - discountUsd));
    const remainingType = String(data.remaining_type || 'percent') === 'usd' ? 'usd' : 'percent';
    const remainingValue = Math.max(0, Number(data.remaining_value) || 0);
    const remainingUsd = remainingType === 'percent'
        ? roundMoney(netUsd * remainingValue / 100)
        : roundMoney(remainingValue);

    let itemsJson = null;
    if (typeof data.items_json === 'string' && data.items_json.trim()) {
        itemsJson = data.items_json.trim();
    } else if (Array.isArray(data.items_json) && data.items_json.length) {
        itemsJson = JSON.stringify(data.items_json);
    }

    return {
        record_date: normalizeDate(data.record_date),
        container_count: containerCount,
        container_20: isContainer20,
        container_40: isContainer40,
        statement: String(data.statement || '').trim(),
        invoice_number: String(data.invoice_number || '').trim(),
        tons_count: tonsCount,
        ton_price: roundMoney(tonPrice),
        total_usd: totalUsd,
        discount_usd: discountUsd,
        net_usd: netUsd,
        remaining_type: remainingType,
        remaining_value: roundMoney(remainingValue),
        remaining_usd: remainingUsd,
        items_json: itemsJson
    };
}

function validatePayload(payload) {
    if (payload.container_count <= 0) {
        return 'عدد الحاويات مطلوب';
    }

    if (!payload.container_20 && !payload.container_40) {
        return 'نوع الحاوية مطلوب';
    }

    if (!payload.statement) {
        return 'البيان مطلوب';
    }

    if (!payload.invoice_number) {
        return 'رقم الفاتورة مطلوب';
    }

    if (payload.tons_count <= 0) {
        return 'عدد الأطنان غير صحيح';
    }

    if (payload.ton_price <= 0) {
        return 'السعر غير صحيح';
    }

    if (payload.discount_usd < 0) {
        return 'قيمة الخصم غير صحيحة';
    }

    if (payload.discount_usd > payload.total_usd) {
        return 'قيمة الخصم لا يمكن أن تتجاوز إجمالي الفاتورة';
    }

    return '';
}

function register() {
    ipcMain.handle('get-next-under-collection-number', () => {
        try {
            return { success: true, documentNumber: getNextDocumentNumber() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-under-collection-records', (event, params = {}) => {
        try {
            const pageSize = Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE);
            const page = Math.max(1, Number(params.page) || 1);
            const offset = (page - 1) * pageSize;
            const where = [];
            const args = {};

            if (params.startDate) {
                where.push('u.record_date >= @startDate');
                args.startDate = params.startDate;
            }

            if (params.endDate) {
                where.push('u.record_date <= @endDate');
                args.endDate = params.endDate;
            }

            if (params.invoiceNumber && String(params.invoiceNumber).trim()) {
                where.push('u.invoice_number LIKE @invoiceNumber');
                args.invoiceNumber = `%${String(params.invoiceNumber).trim()}%`;
            }

            if (params.statement && String(params.statement).trim()) {
                where.push('u.statement LIKE @statement');
                args.statement = `%${String(params.statement).trim()}%`;
            }

            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const summary = db.prepare(`
                SELECT 
                    COUNT(*) as totalCount,
                    COALESCE(SUM(CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END), 0) as totalAmount,
                    COALESCE(SUM(
                        CASE 
                            WHEN COALESCE(exp.total_paid, 0) > 0 THEN 
                                MIN(COALESCE(exp.total_paid, 0), (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END))
                            WHEN u.is_collected = 1 THEN 
                                CASE 
                                    WHEN u.remaining_usd > 0 THEN MAX(0, (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END) - u.remaining_usd)
                                    ELSE (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END)
                                END
                            ELSE 0
                        END
                    ), 0) as totalCollected,
                    COALESCE(SUM(
                        CASE 
                            WHEN COALESCE(exp.total_paid, 0) > 0 THEN 
                                MAX(0, (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END) - COALESCE(exp.total_paid, 0))
                            WHEN u.is_collected = 1 THEN 
                                CASE 
                                    WHEN u.remaining_usd > 0 THEN MIN(u.remaining_usd, (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END))
                                    ELSE 0
                                END
                            ELSE (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END)
                        END
                    ), 0) as totalRemaining
                FROM under_collection_records u
                LEFT JOIN (
                    SELECT LOWER(TRIM(invoice_number)) as inv_clean, SUM(amount) as total_paid
                    FROM export_revenues
                    WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != ''
                    GROUP BY LOWER(TRIM(invoice_number))
                ) exp ON LOWER(TRIM(u.invoice_number)) = exp.inv_clean
                ${whereSql}
            `).get(args) || {};
            const total = summary.totalCount || 0;
            const totalAmount = summary.totalAmount || 0;
            const totalCollected = summary.totalCollected || 0;
            const totalRemaining = summary.totalRemaining || 0;
            const rows = db.prepare(`
                SELECT 
                    u.id, 
                    u.document_number, 
                    u.record_date, 
                    u.container_count, 
                    u.container_20, 
                    u.container_40,
                    u.statement, 
                    u.invoice_number, 
                    u.tons_count, 
                    u.ton_price, 
                    u.total_usd,
                    u.discount_usd, 
                    CASE 
                        WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd 
                        ELSE u.total_usd 
                    END as net_usd,
                    COALESCE(exp.total_paid, 0) as total_paid,
                    CASE 
                        WHEN COALESCE(exp.total_paid, 0) > 0 THEN 
                            MAX(0, (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END) - COALESCE(exp.total_paid, 0))
                        WHEN u.is_collected = 1 AND u.remaining_usd > 0 THEN u.remaining_usd
                        WHEN u.is_collected = 1 AND u.remaining_usd = 0 THEN 0
                        ELSE (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END)
                    END as remaining_usd,
                    CASE 
                        WHEN (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END) > 0 THEN
                            ROUND((CASE 
                                WHEN COALESCE(exp.total_paid, 0) > 0 THEN 
                                    MAX(0, (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END) - COALESCE(exp.total_paid, 0))
                                WHEN u.is_collected = 1 AND u.remaining_usd > 0 THEN u.remaining_usd
                                WHEN u.is_collected = 1 AND u.remaining_usd = 0 THEN 0
                                ELSE (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END)
                            END) / (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END) * 100, 2)
                        ELSE 0
                    END as remaining_value,
                    'percent' as remaining_type,
                    CASE 
                        WHEN COALESCE(exp.total_paid, 0) > 0 THEN 1 
                        ELSE u.is_collected 
                    END as is_collected,
                    u.operation_expense_id, 
                    u.items_json, 
                    u.created_at
                FROM under_collection_records u
                LEFT JOIN (
                    SELECT LOWER(TRIM(invoice_number)) as inv_clean, SUM(amount) as total_paid
                    FROM export_revenues
                    WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != ''
                    GROUP BY LOWER(TRIM(invoice_number))
                ) exp ON LOWER(TRIM(u.invoice_number)) = exp.inv_clean
                ${whereSql}
                ORDER BY u.record_date DESC, u.id DESC
                LIMIT @limit OFFSET @offset
            `).all({ ...args, limit: pageSize, offset });

            return {
                success: true,
                rows,
                total,
                totalAmount: roundMoney(totalAmount),
                totalCollected: roundMoney(totalCollected),
                totalRemaining: roundMoney(totalRemaining),
                page,
                pageSize,
                totalPages: Math.max(1, Math.ceil(total / pageSize))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-under-collection-record', (event, data = {}) => {
        try {
            const payload = normalizePayload(data);
            const validationError = validatePayload(payload);
            if (validationError) {
                return { success: false, error: validationError };
            }

            const operationAmount = roundMoney(payload.tons_count * 2000);
            if (operationAmount > 0) {
                const currentBalance = getCurrentTreasuryBalance();
                if (operationAmount > currentBalance) {
                    return { success: false, error: `قيمة مصروف التشغيل (${operationAmount}) أكبر من رصيد الخزينة المتاح (${currentBalance})` };
                }
            }

            const tx = db.transaction(() => {
                const documentNumber = getNextDocumentNumber();
                const info = db.prepare(`
                    INSERT INTO under_collection_records (
                        document_number, record_date, container_count, container_20, container_40,
                        statement, invoice_number, tons_count, ton_price, total_usd,
                        discount_usd, net_usd,
                        remaining_type, remaining_value, remaining_usd, items_json
                    )
                    VALUES (
                        @document_number, @record_date, @container_count, @container_20, @container_40,
                        @statement, @invoice_number, @tons_count, @ton_price, @total_usd,
                        @discount_usd, @net_usd,
                        @remaining_type, @remaining_value, @remaining_usd, @items_json
                    )
                `).run({ ...payload, document_number: documentNumber });

                const underCollectionId = info.lastInsertRowid;
                let operationExpenseId = null;

                if (operationAmount > 0) {
                    const opDocumentNumber = getNextPettyExpenseNumber();
                    const expenseInfo = db.prepare(`
                        INSERT INTO petty_expenses (category, document_number, expense_date, amount, statement, notes, invoice_number, under_collection_id)
                        VALUES ('operation', @document_number, @expense_date, @amount, @statement, @notes, @invoice_number, @under_collection_id)
                    `).run({
                        document_number: opDocumentNumber,
                        expense_date: payload.record_date,
                        amount: operationAmount,
                        statement: payload.statement,
                        notes: 'مسجلة تلقائياً عن طريق تحت التحصيل',
                        invoice_number: payload.invoice_number,
                        under_collection_id: underCollectionId
                    });

                    operationExpenseId = expenseInfo.lastInsertRowid;

                    const treasuryInfo = db.prepare(`
                        INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
                        VALUES ('expense', @amount, @transaction_date, @description, @related_invoice_id, NULL)
                    `).run({
                        amount: operationAmount,
                        transaction_date: payload.record_date,
                        description: `مصروفات تشغيل ${opDocumentNumber} - ${payload.statement}`,
                        related_invoice_id: operationExpenseId
                    });

                    db.prepare('UPDATE petty_expenses SET treasury_transaction_id = ? WHERE id = ?').run(treasuryInfo.lastInsertRowid, operationExpenseId);
                    db.prepare('UPDATE under_collection_records SET operation_expense_id = ? WHERE id = ?').run(operationExpenseId, underCollectionId);
                }

                return { id: underCollectionId, documentNumber, operationExpenseId };
            });

            const result = tx();
            return { success: true, ...result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-under-collection-record', (event, data = {}) => {
        try {
            const id = Number(data.id);
            if (!id) {
                return { success: false, error: 'معرف السجل غير صحيح' };
            }

            const payload = normalizePayload(data);
            const validationError = validatePayload(payload);
            if (validationError) {
                return { success: false, error: validationError };
            }

            const existing = db.prepare('SELECT id, document_number, operation_expense_id FROM under_collection_records WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            const newOpAmount = roundMoney(payload.tons_count * 2000);
            let existingOp = null;
            if (existing.operation_expense_id) {
                existingOp = db.prepare('SELECT id, document_number, amount, treasury_transaction_id FROM petty_expenses WHERE id = ?').get(existing.operation_expense_id);
            }

            const oldOpAmount = existingOp ? Number(existingOp.amount) || 0 : 0;
            const diff = roundMoney(newOpAmount - oldOpAmount);
            if (diff > 0) {
                const currentBalance = getCurrentTreasuryBalance();
                if (diff > currentBalance) {
                    return { success: false, error: `الزيادة في مصروف التشغيل (${diff}) أكبر من رصيد الخزينة المتاح (${currentBalance})` };
                }
            }

            const tx = db.transaction(() => {
                db.prepare(`
                    UPDATE under_collection_records
                    SET record_date = @record_date,
                        container_count = @container_count,
                        container_20 = @container_20,
                        container_40 = @container_40,
                        statement = @statement,
                        invoice_number = @invoice_number,
                        tons_count = @tons_count,
                        ton_price = @ton_price,
                        total_usd = @total_usd,
                        discount_usd = @discount_usd,
                        net_usd = @net_usd,
                        remaining_type = @remaining_type,
                        remaining_value = @remaining_value,
                        remaining_usd = @remaining_usd,
                        items_json = @items_json
                    WHERE id = @id
                `).run({ ...payload, id });

                if (existing.operation_expense_id && existingOp) {
                    db.prepare(`
                        UPDATE petty_expenses
                        SET expense_date = @expense_date,
                            amount = @amount,
                            statement = @statement,
                            invoice_number = @invoice_number
                        WHERE id = @id
                    `).run({
                        id: existing.operation_expense_id,
                        expense_date: payload.record_date,
                        amount: newOpAmount,
                        statement: payload.statement,
                        invoice_number: payload.invoice_number
                    });

                    if (existingOp.treasury_transaction_id) {
                        db.prepare(`
                            UPDATE treasury_transactions
                            SET amount = @amount,
                                transaction_date = @transaction_date,
                                description = @description
                            WHERE id = @id
                        `).run({
                            id: existingOp.treasury_transaction_id,
                            amount: newOpAmount,
                            transaction_date: payload.record_date,
                            description: `مصروفات تشغيل ${existingOp.document_number} - ${payload.statement}`
                        });
                    }
                } else if (!existing.operation_expense_id && newOpAmount > 0) {
                    const opDocumentNumber = getNextPettyExpenseNumber();
                    const expenseInfo = db.prepare(`
                        INSERT INTO petty_expenses (category, document_number, expense_date, amount, statement, notes, invoice_number, under_collection_id)
                        VALUES ('operation', @document_number, @expense_date, @amount, @statement, @notes, @invoice_number, @under_collection_id)
                    `).run({
                        document_number: opDocumentNumber,
                        expense_date: payload.record_date,
                        amount: newOpAmount,
                        statement: payload.statement,
                        notes: 'مسجلة تلقائياً عن طريق تحت التحصيل',
                        invoice_number: payload.invoice_number,
                        under_collection_id: id
                    });

                    const operationExpenseId = expenseInfo.lastInsertRowid;
                    const treasuryInfo = db.prepare(`
                        INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
                        VALUES ('expense', @amount, @transaction_date, @description, @related_invoice_id, NULL)
                    `).run({
                        amount: newOpAmount,
                        transaction_date: payload.record_date,
                        description: `مصروفات تشغيل ${opDocumentNumber} - ${payload.statement}`,
                        related_invoice_id: operationExpenseId
                    });

                    db.prepare('UPDATE petty_expenses SET treasury_transaction_id = ? WHERE id = ?').run(treasuryInfo.lastInsertRowid, operationExpenseId);
                    db.prepare('UPDATE under_collection_records SET operation_expense_id = ? WHERE id = ?').run(operationExpenseId, id);
                }

                return { id, documentNumber: existing.document_number };
            });

            const result = tx();
            return { success: true, ...result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-under-collection-collected', (event, data = {}) => {
        try {
            const id = Number(data.id);
            if (!id) {
                return { success: false, error: 'معرف السجل غير صحيح' };
            }

            db.prepare('UPDATE under_collection_records SET is_collected = ? WHERE id = ?').run(data.is_collected ? 1 : 0, id);
            return { success: true, id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-under-collection-record', (event, recordId) => {
        try {
            const id = Number(recordId);
            if (!id) {
                return { success: false, error: 'معرف السجل غير صحيح' };
            }

            const existing = db.prepare('SELECT id, operation_expense_id FROM under_collection_records WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            const tx = db.transaction(() => {
                if (existing.operation_expense_id) {
                    const existingOp = db.prepare('SELECT id, treasury_transaction_id FROM petty_expenses WHERE id = ?').get(existing.operation_expense_id);
                    if (existingOp) {
                        if (existingOp.treasury_transaction_id) {
                            db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(existingOp.treasury_transaction_id);
                        }
                        db.prepare('DELETE FROM petty_expenses WHERE id = ?').run(existing.operation_expense_id);
                    }
                }

                db.prepare('DELETE FROM under_collection_records WHERE id = ?').run(id);
                return { id };
            });

            const result = tx();
            return { success: true, ...result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-under-collection-pdf', async (event, payload = {}) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) {
                return { success: false, error: 'No active window found' };
            }

            const date = new Date().toISOString().slice(0, 10);
            const defaultName = String(payload.defaultName || `Under_Collection_${date}.pdf`).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const defaultPath = path.join(app.getPath('documents'), defaultName);
            const { canceled, filePath } = await dialog.showSaveDialog(win, {
                title: 'حفظ ملف تحت التحصيل PDF',
                defaultPath,
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });

            if (canceled || !filePath) {
                return { success: false, canceled: true };
            }

            const pdfBuffer = await event.sender.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                landscape: true,
                marginsType: 0,
                preferCSSPageSize: true
            });

            fs.writeFileSync(filePath, pdfBuffer);
            return { success: true, filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
