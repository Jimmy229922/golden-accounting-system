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
        FROM export_revenues
        WHERE document_number GLOB 'EXR-[0-9]*'
        ORDER BY CAST(SUBSTR(document_number, 5) AS INTEGER) DESC
        LIMIT 1
    `).get();

    const lastNumber = row ? Number(String(row.document_number).slice(4)) : 0;
    return `EXR-${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, '0')}`;
}

function normalizeDate(value) {
    const text = String(value || '').trim();
    return text || new Date().toISOString().slice(0, 10);
}

function normalizePayload(data = {}) {
    const amount = Number(data.amount) || 0;
    const exchangeRate = Number(data.exchange_rate) || 0;
    const amountEgp = roundMoney(amount * exchangeRate);
    const invoiceNumber = String(data.invoice_number || '').trim();
    const underCollectionId = data.under_collection_id ? Number(data.under_collection_id) : null;
    const discountUsd = (data.discount_usd !== undefined && data.discount_usd !== null && data.discount_usd !== '')
        ? Math.max(0, Number(data.discount_usd))
        : undefined;

    return {
        record_date: normalizeDate(data.record_date),
        amount: roundMoney(amount),
        currency: String(data.currency || 'دولار').trim(),
        exchange_rate: roundMoney(exchangeRate),
        amount_egp: amountEgp,
        statement: String(data.statement || '').trim(),
        invoice_number: invoiceNumber,
        under_collection_id: underCollectionId,
        discount_usd: discountUsd
    };
}

function validatePayload(payload) {
    if (payload.amount <= 0) {
        return 'قيمة المبلغ غير صحيحة';
    }

    if (payload.exchange_rate <= 0) {
        return 'قيمة الصرف غير صحيحة';
    }

    if (!payload.currency) {
        return 'العملة مطلوبة';
    }

    return '';
}

function syncUnderCollectionForInvoice(invoiceNumber, optionalDiscountUsd) {
    const inv = String(invoiceNumber || '').trim();
    if (!inv) return;

    const underRecords = db.prepare(`
        SELECT id, total_usd, discount_usd, net_usd
        FROM under_collection_records
        WHERE LOWER(TRIM(invoice_number)) = LOWER(?)
        ORDER BY id ASC
    `).all(inv);

    if (!underRecords.length) return;

    const paidRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as totalPaid
        FROM export_revenues
        WHERE LOWER(TRIM(invoice_number)) = LOWER(?)
    `).get(inv);

    const totalPaid = roundMoney(Number(paidRow?.totalPaid) || 0);
    const isCollected = totalPaid > 0 ? 1 : 0;

    for (const underRecord of underRecords) {
        let discountUsd = Number(underRecord.discount_usd) || 0;
        if (optionalDiscountUsd !== undefined && Number.isFinite(optionalDiscountUsd) && optionalDiscountUsd >= 0) {
            discountUsd = roundMoney(optionalDiscountUsd);
        }

        const totalUsd = Number(underRecord.total_usd) || 0;
        const netUsd = Math.max(0, roundMoney(totalUsd - discountUsd));
        const remainingUsd = Math.max(0, roundMoney(netUsd - totalPaid));
        const remainingValue = netUsd > 0 ? roundMoney((remainingUsd / netUsd) * 100) : 0;

        db.prepare(`
            UPDATE under_collection_records
            SET discount_usd = @discount_usd,
                net_usd = @net_usd,
                remaining_usd = @remaining_usd,
                remaining_value = @remaining_value,
                remaining_type = 'percent',
                is_collected = @is_collected
            WHERE id = @id
        `).run({
            discount_usd: discountUsd,
            net_usd: netUsd,
            remaining_usd: remainingUsd,
            remaining_value: remainingValue,
            is_collected: isCollected,
            id: underRecord.id
        });
    }
}

function register() {
    ipcMain.handle('get-next-export-revenue-number', () => {
        try {
            return { success: true, documentNumber: getNextDocumentNumber() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-export-revenues', (event, params = {}) => {
        try {
            const pageSize = Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE);
            const page = Math.max(1, Number(params.page) || 1);
            const offset = (page - 1) * pageSize;
            const where = [];
            const args = {};

            if (params.startDate) {
                where.push('record_date >= @startDate');
                args.startDate = params.startDate;
            }

            if (params.endDate) {
                where.push('record_date <= @endDate');
                args.endDate = params.endDate;
            }

            if (params.invoiceNumber && String(params.invoiceNumber).trim()) {
                where.push('invoice_number LIKE @invoiceNumber');
                args.invoiceNumber = `%${String(params.invoiceNumber).trim()}%`;
            }

            if (params.statement && String(params.statement).trim()) {
                where.push('statement LIKE @statement');
                args.statement = `%${String(params.statement).trim()}%`;
            }

            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const total = db.prepare(`SELECT COUNT(*) as count FROM export_revenues ${whereSql}`).get(args).count || 0;
            const totals = db.prepare(`
                SELECT
                    COALESCE(SUM(amount), 0) as totalAmount,
                    COALESCE(SUM(amount_egp), 0) as totalEgp
                FROM export_revenues
                ${whereSql}
            `).get(args);
            const rows = db.prepare(`
                SELECT id, document_number, record_date, amount, currency,
                       exchange_rate, amount_egp, statement, invoice_number, under_collection_id, created_at
                FROM export_revenues
                ${whereSql}
                ORDER BY datetime(created_at) DESC, id DESC
                LIMIT @limit OFFSET @offset
            `).all({ ...args, limit: pageSize, offset });

            return {
                success: true,
                rows,
                total,
                totalAmount: roundMoney(totals.totalAmount),
                totalEgp: roundMoney(totals.totalEgp),
                page,
                pageSize,
                totalPages: Math.max(1, Math.ceil(total / pageSize))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-export-revenue', (event, data = {}) => {
        try {
            const payload = normalizePayload(data);
            const validationError = validatePayload(payload);
            if (validationError) {
                return { success: false, error: validationError };
            }

            if (payload.invoice_number && !payload.under_collection_id) {
                const under = db.prepare('SELECT id FROM under_collection_records WHERE TRIM(invoice_number) = ? ORDER BY id DESC LIMIT 1').get(payload.invoice_number);
                if (under) {
                    payload.under_collection_id = under.id;
                }
            }

            let resultId = null;
            let docNum = null;

            db.transaction(() => {
                const documentNumber = getNextDocumentNumber();
                docNum = documentNumber;
                const info = db.prepare(`
                    INSERT INTO export_revenues (
                        document_number, record_date, amount, currency,
                        exchange_rate, amount_egp, statement, invoice_number, under_collection_id
                    )
                    VALUES (
                        @document_number, @record_date, @amount, @currency,
                        @exchange_rate, @amount_egp, @statement, @invoice_number, @under_collection_id
                    )
                `).run({
                    document_number: documentNumber,
                    record_date: payload.record_date,
                    amount: payload.amount,
                    currency: payload.currency,
                    exchange_rate: payload.exchange_rate,
                    amount_egp: payload.amount_egp,
                    statement: payload.statement,
                    invoice_number: payload.invoice_number || null,
                    under_collection_id: payload.under_collection_id || null
                });

                resultId = info.lastInsertRowid;

                if (payload.invoice_number) {
                    syncUnderCollectionForInvoice(payload.invoice_number, payload.discount_usd);
                }
            })();

            return { success: true, id: resultId, documentNumber: docNum };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-export-revenue', (event, data = {}) => {
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

            const existing = db.prepare('SELECT id, document_number, invoice_number FROM export_revenues WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            if (payload.invoice_number && !payload.under_collection_id) {
                const under = db.prepare('SELECT id FROM under_collection_records WHERE TRIM(invoice_number) = ? ORDER BY id DESC LIMIT 1').get(payload.invoice_number);
                if (under) {
                    payload.under_collection_id = under.id;
                }
            }

            db.transaction(() => {
                db.prepare(`
                    UPDATE export_revenues
                    SET record_date = @record_date,
                        amount = @amount,
                        currency = @currency,
                        exchange_rate = @exchange_rate,
                        amount_egp = @amount_egp,
                        statement = @statement,
                        invoice_number = @invoice_number,
                        under_collection_id = @under_collection_id
                    WHERE id = @id
                `).run({
                    record_date: payload.record_date,
                    amount: payload.amount,
                    currency: payload.currency,
                    exchange_rate: payload.exchange_rate,
                    amount_egp: payload.amount_egp,
                    statement: payload.statement,
                    invoice_number: payload.invoice_number || null,
                    under_collection_id: payload.under_collection_id || null,
                    id
                });

                if (payload.invoice_number) {
                    syncUnderCollectionForInvoice(payload.invoice_number, payload.discount_usd);
                }

                if (existing.invoice_number && existing.invoice_number !== payload.invoice_number) {
                    syncUnderCollectionForInvoice(existing.invoice_number);
                }
            })();

            return { success: true, id, documentNumber: existing.document_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-export-revenue', (event, recordId) => {
        try {
            const id = Number(recordId);
            if (!id) {
                return { success: false, error: 'معرف السجل غير صحيح' };
            }

            const existing = db.prepare('SELECT id, invoice_number FROM export_revenues WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            db.transaction(() => {
                db.prepare('DELETE FROM export_revenues WHERE id = ?').run(id);

                if (existing.invoice_number) {
                    syncUnderCollectionForInvoice(existing.invoice_number);
                }
            })();

            return { success: true, id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-under-collection-invoice-details', (event, { invoiceNumber, exportRevenueId } = {}) => {
        try {
            const inv = String(invoiceNumber || '').trim();
            if (!inv) {
                return { success: true, found: false };
            }

            const underRecord = db.prepare(`
                SELECT id, document_number, record_date, container_count, container_20, container_40,
                       statement, invoice_number, tons_count, ton_price, total_usd,
                       discount_usd, net_usd, remaining_type, remaining_value, remaining_usd, is_collected
                FROM under_collection_records
                WHERE LOWER(TRIM(invoice_number)) = LOWER(?)
                ORDER BY id DESC
                LIMIT 1
            `).get(inv);

            if (!underRecord) {
                return { success: true, found: false };
            }

            const excludeId = Number(exportRevenueId) || null;
            const paidRow = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as paidBefore
                FROM export_revenues
                WHERE LOWER(TRIM(invoice_number)) = LOWER(?)
                  AND (? IS NULL OR id != ?)
            `).get(inv, excludeId, excludeId);

            const totalUsd = Number(underRecord.total_usd) || 0;
            const discountUsd = Number(underRecord.discount_usd) || 0;
            const netUsd = underRecord.net_usd !== undefined && underRecord.net_usd !== null && Number(underRecord.net_usd) > 0
                ? Number(underRecord.net_usd)
                : Math.max(0, roundMoney(totalUsd - discountUsd));
            const paidBefore = roundMoney(Number(paidRow?.paidBefore) || 0);
            const remainingBefore = Math.max(0, roundMoney(netUsd - paidBefore));
            const remainingPercentBefore = netUsd > 0 ? roundMoney((remainingBefore / netUsd) * 100) : 0;

            return {
                success: true,
                found: true,
                invoice: {
                    id: underRecord.id,
                    document_number: underRecord.document_number,
                    record_date: underRecord.record_date,
                    statement: underRecord.statement,
                    invoice_number: underRecord.invoice_number,
                    container_count: underRecord.container_count,
                    total_usd: totalUsd,
                    discount_usd: discountUsd,
                    net_usd: netUsd,
                    paidBefore,
                    remainingBefore,
                    remainingPercentBefore,
                    is_collected: Number(underRecord.is_collected) || 0
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    try {
        const linkedInvoices = db.prepare(`
            SELECT DISTINCT TRIM(invoice_number) as inv
            FROM export_revenues
            WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != ''
        `).all();

        for (const item of linkedInvoices) {
            if (item && item.inv) {
                syncUnderCollectionForInvoice(item.inv);
            }
        }
    } catch (_) {}

    ipcMain.handle('get-under-collection-invoices-for-export', () => {
        try {
            const rows = db.prepare(`
                SELECT 
                    u.id, 
                    u.document_number, 
                    u.record_date, 
                    u.statement, 
                    u.invoice_number,
                    u.total_usd, 
                    u.discount_usd, 
                    CASE 
                        WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd 
                        ELSE u.total_usd 
                    END as net_usd,
                    COALESCE(exp.total_paid, 0) as total_paid,
                    CASE 
                        WHEN u.is_collected = 1 AND u.remaining_usd > 0 AND COALESCE(exp.total_paid, 0) = 0 THEN u.remaining_usd
                        WHEN u.is_collected = 1 AND u.remaining_usd = 0 AND COALESCE(exp.total_paid, 0) = 0 THEN 0
                        ELSE MAX(0, (CASE WHEN u.net_usd > 0 OR u.discount_usd > 0 THEN u.net_usd ELSE u.total_usd END) - COALESCE(exp.total_paid, 0))
                    END as remaining_usd,
                    u.remaining_value, 
                    CASE 
                        WHEN COALESCE(exp.total_paid, 0) > 0 THEN 1 
                        ELSE u.is_collected 
                    END as is_collected
                FROM under_collection_records u
                LEFT JOIN (
                    SELECT TRIM(invoice_number) as inv_num, SUM(amount) as total_paid
                    FROM export_revenues
                    WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != ''
                    GROUP BY TRIM(invoice_number)
                ) exp ON TRIM(u.invoice_number) = exp.inv_num
                ORDER BY u.record_date DESC, u.id DESC
                LIMIT 100
            `).all();
            return { success: true, rows };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-export-revenues-pdf', async (event, payload = {}) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) {
                return { success: false, error: 'No active window found' };
            }

            const date = new Date().toISOString().slice(0, 10);
            const defaultName = String(payload.defaultName || `Export_Revenues_${date}.pdf`).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const defaultPath = path.join(app.getPath('documents'), defaultName);
            const { canceled, filePath } = await dialog.showSaveDialog(win, {
                title: 'حفظ ملف إيرادات التصدير PDF',
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
