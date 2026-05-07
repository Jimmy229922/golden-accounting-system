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
    const totalUsd = roundMoney(tonsCount * tonPrice);
    const remainingType = String(data.remaining_type || 'percent') === 'usd' ? 'usd' : 'percent';
    const remainingValue = Math.max(0, Number(data.remaining_value) || 0);
    const remainingUsd = remainingType === 'percent'
        ? roundMoney(totalUsd * remainingValue / 100)
        : roundMoney(remainingValue);

    return {
        record_date: normalizeDate(data.record_date),
        container_count: containerCount,
        container_20: isContainer20,
        container_40: isContainer40,
        statement: String(data.statement || '').trim(),
        invoice_number: String(data.invoice_number || '').trim(),
        tons_count: roundMoney(tonsCount),
        ton_price: roundMoney(tonPrice),
        total_usd: totalUsd,
        remaining_type: remainingType,
        remaining_value: roundMoney(remainingValue),
        remaining_usd: remainingUsd
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
                where.push('record_date >= @startDate');
                args.startDate = params.startDate;
            }

            if (params.endDate) {
                where.push('record_date <= @endDate');
                args.endDate = params.endDate;
            }

            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const total = db.prepare(`SELECT COUNT(*) as count FROM under_collection_records ${whereSql}`).get(args).count || 0;
            const totalAmount = db.prepare(`SELECT COALESCE(SUM(total_usd), 0) as totalAmount FROM under_collection_records ${whereSql}`).get(args).totalAmount || 0;
            const rows = db.prepare(`
                SELECT id, document_number, record_date, container_count, container_20, container_40,
                       statement, invoice_number, tons_count, ton_price, total_usd,
                       remaining_type, remaining_value, remaining_usd, is_collected, created_at
                FROM under_collection_records
                ${whereSql}
                ORDER BY record_date DESC, id DESC
                LIMIT @limit OFFSET @offset
            `).all({ ...args, limit: pageSize, offset });

            return {
                success: true,
                rows,
                total,
                totalAmount: roundMoney(totalAmount),
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

            const documentNumber = getNextDocumentNumber();
            const info = db.prepare(`
                INSERT INTO under_collection_records (
                    document_number, record_date, container_count, container_20, container_40,
                    statement, invoice_number, tons_count, ton_price, total_usd,
                    remaining_type, remaining_value, remaining_usd
                )
                VALUES (
                    @document_number, @record_date, @container_count, @container_20, @container_40,
                    @statement, @invoice_number, @tons_count, @ton_price, @total_usd,
                    @remaining_type, @remaining_value, @remaining_usd
                )
            `).run({ ...payload, document_number: documentNumber });

            return { success: true, id: info.lastInsertRowid, documentNumber };
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

            const existing = db.prepare('SELECT id, document_number FROM under_collection_records WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

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
                    remaining_type = @remaining_type,
                    remaining_value = @remaining_value,
                    remaining_usd = @remaining_usd
                WHERE id = @id
            `).run({ ...payload, id });

            return { success: true, id, documentNumber: existing.document_number };
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

            const existing = db.prepare('SELECT id FROM under_collection_records WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            db.prepare('DELETE FROM under_collection_records WHERE id = ?').run(id);
            return { success: true, id };
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
