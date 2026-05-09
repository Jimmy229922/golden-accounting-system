const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const DEFAULT_PAGE_SIZE = 50;

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round(n + Number.EPSILON);
}

function getNextDocumentNumber() {
    const row = db.prepare(`
        SELECT document_number
        FROM remaining_under_collection_records
        WHERE document_number GLOB 'RUC-[0-9]*'
        ORDER BY CAST(SUBSTR(document_number, 5) AS INTEGER) DESC
        LIMIT 1
    `).get();

    const lastNumber = row ? Number(String(row.document_number).slice(4)) : 0;
    return `RUC-${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, '0')}`;
}

function normalizeDate(value) {
    const text = String(value || '').trim();
    return text || new Date().toISOString().slice(0, 10);
}

function normalizePayload(data = {}) {
    const invoiceTotal = Math.max(0, Number(data.invoice_total) || 0);
    const arrivalAmount = Math.max(0, Number(data.arrival_amount) || 0);
    const remainingAmount = Math.max(0, Number(data.remaining_amount) || 0);

    return {
        record_date: normalizeDate(data.record_date),
        statement: String(data.statement || '').trim(),
        invoice_total: roundMoney(invoiceTotal),
        arrival_date: normalizeDate(data.arrival_date),
        arrival_amount: roundMoney(arrivalAmount),
        remaining_amount: roundMoney(remainingAmount)
    };
}

function validatePayload(payload) {
    if (!payload.statement) {
        return 'البيان مطلوب';
    }

    if (payload.invoice_total <= 0) {
        return 'إجمالي الفاتورة غير صحيح';
    }

    return '';
}

function register() {
    ipcMain.handle('get-next-remaining-under-collection-number', () => {
        try {
            return { success: true, documentNumber: getNextDocumentNumber() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-remaining-under-collection-records', (event, params = {}) => {
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
            const total = db.prepare(`SELECT COUNT(*) as count FROM remaining_under_collection_records ${whereSql}`).get(args).count || 0;
            const totalAmount = db.prepare(`SELECT COALESCE(SUM(invoice_total), 0) as totalAmount FROM remaining_under_collection_records ${whereSql}`).get(args).totalAmount || 0;
            const rows = db.prepare(`
                SELECT id, document_number, record_date, statement, invoice_total,
                       arrival_date, arrival_amount, remaining_amount, is_collected, created_at
                FROM remaining_under_collection_records
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

    ipcMain.handle('save-remaining-under-collection-record', (event, data = {}) => {
        try {
            const payload = normalizePayload(data);
            const validationError = validatePayload(payload);
            if (validationError) {
                return { success: false, error: validationError };
            }

            const documentNumber = getNextDocumentNumber();
            const info = db.prepare(`
                INSERT INTO remaining_under_collection_records (
                    document_number, record_date, statement, invoice_total,
                    arrival_date, arrival_amount, remaining_amount
                )
                VALUES (
                    @document_number, @record_date, @statement, @invoice_total,
                    @arrival_date, @arrival_amount, @remaining_amount
                )
            `).run({ ...payload, document_number: documentNumber });

            return { success: true, id: info.lastInsertRowid, documentNumber };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-remaining-under-collection-record', (event, data = {}) => {
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

            const existing = db.prepare('SELECT id, document_number FROM remaining_under_collection_records WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            db.prepare(`
                UPDATE remaining_under_collection_records
                SET record_date = @record_date,
                    statement = @statement,
                    invoice_total = @invoice_total,
                    arrival_date = @arrival_date,
                    arrival_amount = @arrival_amount,
                    remaining_amount = @remaining_amount
                WHERE id = @id
            `).run({ ...payload, id });

            return { success: true, id, documentNumber: existing.document_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-remaining-under-collection-collected', (event, data = {}) => {
        try {
            const id = Number(data.id);
            if (!id) {
                return { success: false, error: 'معرف السجل غير صحيح' };
            }

            db.prepare('UPDATE remaining_under_collection_records SET is_collected = ? WHERE id = ?').run(data.is_collected ? 1 : 0, id);
            return { success: true, id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-remaining-under-collection-record', (event, recordId) => {
        try {
            const id = Number(recordId);
            if (!id) {
                return { success: false, error: 'معرف السجل غير صحيح' };
            }

            const existing = db.prepare('SELECT id FROM remaining_under_collection_records WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            db.prepare('DELETE FROM remaining_under_collection_records WHERE id = ?').run(id);
            return { success: true, id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-remaining-under-collection-pdf', async (event, payload = {}) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) {
                return { success: false, error: 'No active window found' };
            }

            const date = new Date().toISOString().slice(0, 10);
            const defaultName = String(payload.defaultName || `Remaining_Under_Collection_${date}.pdf`).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const defaultPath = path.join(app.getPath('documents'), defaultName);
            const { canceled, filePath } = await dialog.showSaveDialog(win, {
                title: 'حفظ ملف بيان المتبقي من تحت التحصيل PDF',
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
