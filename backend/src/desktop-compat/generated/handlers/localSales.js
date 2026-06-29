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
        FROM local_sales
        WHERE document_number GLOB 'LSL-[0-9]*'
        ORDER BY CAST(SUBSTR(document_number, 5) AS INTEGER) DESC
        LIMIT 1
    `).get();

    const lastNumber = row ? Number(String(row.document_number).slice(4)) : 0;
    return `LSL-${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, '0')}`;
}

function normalizeDate(value) {
    const text = String(value || '').trim();
    return text || new Date().toISOString().slice(0, 10);
}

function normalizePayload(data = {}) {
    const quantity = Number(data.quantity) || 0;
    const price = Number(data.price) || 0;
    const total = roundMoney(quantity * price);

    return {
        record_date: normalizeDate(data.record_date),
        customer_id: Number(data.customer_id) || 0,
        quantity: roundMoney(quantity),
        price: roundMoney(price),
        total,
        statement: String(data.statement || '').trim()
    };
}

function validatePayload(payload) {
    if (!payload.customer_id) {
        return 'العميل مطلوب';
    }

    if (payload.quantity <= 0) {
        return 'الكمية غير صحيحة';
    }

    if (payload.price <= 0) {
        return 'السعر غير صحيح';
    }

    return '';
}

function ensureCustomerExists(customerId) {
    const customer = db.prepare('SELECT id FROM parties WHERE id = ?').get(customerId);
    return Boolean(customer);
}

function register() {
    ipcMain.handle('get-next-local-sale-number', () => {
        try {
            return { success: true, documentNumber: getNextDocumentNumber() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-local-sales', (event, params = {}) => {
        try {
            const pageSize = Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE);
            const page = Math.max(1, Number(params.page) || 1);
            const offset = (page - 1) * pageSize;
            const where = [];
            const args = {};

            if (params.startDate) {
                where.push('l.record_date >= @startDate');
                args.startDate = params.startDate;
            }

            if (params.endDate) {
                where.push('l.record_date <= @endDate');
                args.endDate = params.endDate;
            }

            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const total = db.prepare(`SELECT COUNT(*) as count FROM local_sales l ${whereSql}`).get(args).count || 0;
            const totals = db.prepare(`
                SELECT
                    COALESCE(SUM(l.quantity), 0) as totalQuantity,
                    COALESCE(SUM(l.total), 0) as totalAmount
                FROM local_sales l
                ${whereSql}
            `).get(args);
            const rows = db.prepare(`
                SELECT l.id, l.document_number, l.record_date, l.customer_id,
                       c.name as customer_name, l.quantity, l.price, l.total, l.statement, l.created_at
                FROM local_sales l
                LEFT JOIN parties c ON c.id = l.customer_id
                ${whereSql}
                ORDER BY l.id ASC
                LIMIT @limit OFFSET @offset
            `).all({ ...args, limit: pageSize, offset });

            return {
                success: true,
                rows,
                total,
                totalQuantity: roundMoney(totals.totalQuantity),
                totalAmount: roundMoney(totals.totalAmount),
                page,
                pageSize,
                totalPages: Math.max(1, Math.ceil(total / pageSize))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-local-sale', (event, data = {}) => {
        try {
            const payload = normalizePayload(data);
            const validationError = validatePayload(payload);
            if (validationError) {
                return { success: false, error: validationError };
            }

            if (!ensureCustomerExists(payload.customer_id)) {
                return { success: false, error: 'العميل غير موجود' };
            }

            const documentNumber = getNextDocumentNumber();
            const info = db.prepare(`
                INSERT INTO local_sales (
                    document_number, record_date, customer_id,
                    quantity, price, total, statement
                )
                VALUES (
                    @document_number, @record_date, @customer_id,
                    @quantity, @price, @total, @statement
                )
            `).run({ ...payload, document_number: documentNumber });

            return { success: true, id: info.lastInsertRowid, documentNumber };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-local-sale', (event, data = {}) => {
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

            if (!ensureCustomerExists(payload.customer_id)) {
                return { success: false, error: 'العميل غير موجود' };
            }

            const existing = db.prepare('SELECT id, document_number FROM local_sales WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            db.prepare(`
                UPDATE local_sales
                SET record_date = @record_date,
                    customer_id = @customer_id,
                    quantity = @quantity,
                    price = @price,
                    total = @total,
                    statement = @statement
                WHERE id = @id
            `).run({ ...payload, id });

            return { success: true, id, documentNumber: existing.document_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-local-sale', (event, recordId) => {
        try {
            const id = Number(recordId);
            if (!id) {
                return { success: false, error: 'معرف السجل غير صحيح' };
            }

            const existing = db.prepare('SELECT id FROM local_sales WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على السجل' };
            }

            db.prepare('DELETE FROM local_sales WHERE id = ?').run(id);
            return { success: true, id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-local-sales-pdf', async (event, payload = {}) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) {
                return { success: false, error: 'No active window found' };
            }

            const date = new Date().toISOString().slice(0, 10);
            const defaultName = String(payload.defaultName || `Local_Sales_${date}.pdf`).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const defaultPath = path.join(app.getPath('documents'), defaultName);
            const { canceled, filePath } = await dialog.showSaveDialog(win, {
                title: 'حفظ ملف المبيعات المحلية PDF',
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

