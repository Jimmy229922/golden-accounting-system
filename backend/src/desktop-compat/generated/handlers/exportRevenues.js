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

    return {
        record_date: normalizeDate(data.record_date),
        amount: roundMoney(amount),
        currency: String(data.currency || '').trim(),
        exchange_rate: roundMoney(exchangeRate),
        amount_egp: amountEgp,
        statement: String(data.statement || '').trim()
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
                       exchange_rate, amount_egp, statement, created_at
                FROM export_revenues
                ${whereSql}
                ORDER BY id ASC
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

            const documentNumber = getNextDocumentNumber();
            const info = db.prepare(`
                INSERT INTO export_revenues (
                    document_number, record_date, amount, currency,
                    exchange_rate, amount_egp, statement
                )
                VALUES (
                    @document_number, @record_date, @amount, @currency,
                    @exchange_rate, @amount_egp, @statement
                )
            `).run({ ...payload, document_number: documentNumber });

            return { success: true, id: info.lastInsertRowid, documentNumber };
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

            const existing = db.prepare('SELECT id, document_number FROM export_revenues WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            db.prepare(`
                UPDATE export_revenues
                SET record_date = @record_date,
                    amount = @amount,
                    currency = @currency,
                    exchange_rate = @exchange_rate,
                    amount_egp = @amount_egp,
                    statement = @statement
                WHERE id = @id
            `).run({ ...payload, id });

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

            const existing = db.prepare('SELECT id FROM export_revenues WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            db.prepare('DELETE FROM export_revenues WHERE id = ?').run(id);
            return { success: true, id };
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
