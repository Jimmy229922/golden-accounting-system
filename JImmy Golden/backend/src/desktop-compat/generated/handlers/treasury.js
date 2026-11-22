const { app, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hasFeature } = require('../licenseService');

const TREASURY_ATTACHMENTS_FEATURE = 'treasury_attachments';
const MAX_ATTACHMENTS_PER_TRANSACTION = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIMES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf'
};

function getTreasuryImagesDir() {
    const portableRoot = path.dirname(app.getPath('userData'));
    const dir = path.join(portableRoot, 'Image');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function safeUnlinkAttachmentFile(fileName) {
    if (!fileName) return;
    try {
        const safeName = path.basename(String(fileName));
        const fullPath = path.join(getTreasuryImagesDir(), safeName);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    } catch (_) {}
}
const { db } = require('../db');
const { requirePermission } = require('./auth');

const CUSTOMER_COLLECTION_PENDING_RELATED_TYPE = 'customer_collection_pending';
const CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE = 'customer_collection_shift_close';

function shouldDeferCustomerCollection(transaction = {}) {
    const customerId = Number(transaction.customer_id);
    return transaction.type === 'income'
        && Number.isFinite(customerId)
        && customerId > 0
        && Boolean(transaction.defer_to_sales_shift_close);
}

function getTreasuryVoucherPrefix(type) {
    if (type === 'income') return 'RCV';
    if (type === 'expense') return 'PAY';
    return null;
}

function getNextTreasuryVoucherNumberForType(type) {
    const prefix = getTreasuryVoucherPrefix(type);
    if (!prefix) return null;

    const maxResult = db.prepare(`
        SELECT MAX(CAST(SUBSTR(voucher_number, 5) AS INTEGER)) as max_num
        FROM treasury_transactions
        WHERE type = @type
          AND voucher_number GLOB @pattern
    `).get({
        type,
        pattern: `${prefix}-[0-9]*`
    });

    const nextNumber = Number(maxResult?.max_num || 0) + 1;
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

function getCurrentTreasuryBalance() {
    const income = Number(db.prepare(`
        SELECT SUM(amount) as total
        FROM treasury_transactions
        WHERE type = 'income'
          AND COALESCE(related_type, '') NOT IN ('${CUSTOMER_COLLECTION_PENDING_RELATED_TYPE}', '${CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE}')
    `).get().total || 0);
    const expense = Number(db.prepare("SELECT SUM(amount) as total FROM treasury_transactions WHERE type = 'expense'").get().total || 0);
    return income - expense;
}

function normalizeTreasuryType(type) {
    const normalizedType = String(type || '').trim();
    return normalizedType === 'income' || normalizedType === 'expense' ? normalizedType : null;
}

function normalizeTreasuryAmount(amount) {
    const normalizedAmount = Number(amount);
    return Number.isFinite(normalizedAmount) && normalizedAmount > 0 ? normalizedAmount : null;
}

function normalizeTreasuryCustomerId(customerId) {
    if (customerId === null || customerId === undefined || String(customerId).trim() === '') return null;
    const normalizedCustomerId = Number(customerId);
    return Number.isFinite(normalizedCustomerId) && normalizedCustomerId > 0 ? normalizedCustomerId : null;
}

function register() {
    // --- Treasury Handlers ---

    ipcMain.handle('get-treasury-balance', () => {
        try {
            return getCurrentTreasuryBalance();
        } catch (error) {
            console.error(error);
            return 0;
        }
    });

    ipcMain.handle('get-treasury-transactions', (event, params = null) => {
        const hasPagination = params && typeof params === 'object';
        try {
            if (!hasPagination) {
                return db.prepare('SELECT * FROM treasury_transactions ORDER BY transaction_date DESC, id DESC').all();
            }

            const parsedPage = Number.parseInt(params.page, 10);
            const parsedPageSize = Number.parseInt(params.pageSize, 10);
            const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
            const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0
                ? Math.min(parsedPageSize, 100)
                : 50;
            const today = new Date().toISOString().slice(0, 10);
            const relatedTypeFilter = `COALESCE(related_type, '') NOT IN (?, ?)`;
            const filterParams = [
                CUSTOMER_COLLECTION_PENDING_RELATED_TYPE,
                CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE
            ];

            const totalRow = db
                .prepare(`SELECT COUNT(*) AS total FROM treasury_transactions WHERE ${relatedTypeFilter}`)
                .get(...filterParams);
            const total = Number(totalRow?.total || 0);
            const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
            const currentPage = Math.min(page, totalPages);
            const offset = (currentPage - 1) * pageSize;

            const rows = db
                .prepare(`
                    SELECT *
                    FROM treasury_transactions
                    WHERE ${relatedTypeFilter}
                    ORDER BY transaction_date DESC, id DESC
                    LIMIT ? OFFSET ?
                `)
                .all(...filterParams, pageSize, offset);

            const totalsRow = db
                .prepare(`
                    SELECT
                        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS totalIncome,
                        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS totalExpense,
                        COALESCE(SUM(CASE WHEN type = 'income' AND transaction_date = ? THEN amount ELSE 0 END), 0) AS todayIncome,
                        COALESCE(SUM(CASE WHEN type = 'expense' AND transaction_date = ? THEN amount ELSE 0 END), 0) AS todayExpense
                    FROM treasury_transactions
                    WHERE ${relatedTypeFilter}
                `)
                .get(today, today, ...filterParams);

            return {
                success: true,
                rows,
                total,
                page: currentPage,
                pageSize,
                totalPages,
                totalIncome: Number(totalsRow?.totalIncome || 0),
                totalExpense: Number(totalsRow?.totalExpense || 0),
                todayIncome: Number(totalsRow?.todayIncome || 0),
                todayExpense: Number(totalsRow?.todayExpense || 0)
            };
        } catch (error) {
            console.error('[get-treasury-transactions] Error:', error);
            return hasPagination
                ? { success: false, error: error.message || 'Failed to load treasury transactions' }
                : [];
        }
    });

    ipcMain.handle('get-next-treasury-voucher-number', (event, type) => {
        try {
            const voucher_number = getNextTreasuryVoucherNumberForType(type);
            if (!voucher_number) {
                return { success: false, error: 'Invalid treasury transaction type' };
            }
            return { success: true, voucher_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('add-treasury-transaction', (event, transaction) => {
        const denied = requirePermission('treasury', 'add');
        if (denied) return denied;
        try {
            const { type, amount, date, description, customer_id } = transaction;
            const normalizedType = normalizeTreasuryType(type);
            if (!normalizedType) {
                return { success: false, error: 'نوع حركة الخزينة غير صالح.' };
            }

            const normalizedAmount = normalizeTreasuryAmount(amount);
            if (normalizedAmount === null) {
                return { success: false, error: 'مبلغ حركة الخزينة يجب أن يكون أكبر من صفر.' };
            }

            const normalizedCustomerId = normalizeTreasuryCustomerId(customer_id);
            const related_type = shouldDeferCustomerCollection({ ...transaction, type: normalizedType, customer_id: normalizedCustomerId })
                ? CUSTOMER_COLLECTION_PENDING_RELATED_TYPE
                : null;
            const voucher_number = getNextTreasuryVoucherNumberForType(normalizedType);
            if (!voucher_number) {
                return { success: false, error: 'نوع حركة الخزينة غير صالح.' };
            }

            if (normalizedType === 'expense') {
                const currentBalance = getCurrentTreasuryBalance();
                if (currentBalance <= 0) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن رصيد الخزينة الحالي يساوي صفر.' };
                }

                if (normalizedAmount > currentBalance) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن قيمة السحب أكبر من الرصيد المتاح في الخزينة.' };
                }
            }
            
            const stmt = db.prepare(`
                INSERT INTO treasury_transactions (type, amount, transaction_date, description, customer_id, voucher_number, related_type)
                VALUES (@type, @amount, @date, @description, @customer_id, @voucher_number, @related_type)
            `);

            const tx = db.transaction(() => {
                const insertInfo = stmt.run({ type: normalizedType, amount: normalizedAmount, date, description, customer_id: normalizedCustomerId, voucher_number, related_type });
                return Number(insertInfo.lastInsertRowid);
            });

            const insertedId = tx();
            return { success: true, id: insertedId, voucher_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-treasury-transaction', (event, transaction) => {
        const denied = requirePermission('treasury', 'edit');
        if (denied) return denied;
        try {
            const { id, type } = transaction;
            const normalizedType = normalizeTreasuryType(type);
            if (!normalizedType) {
                return { success: false, error: 'نوع حركة الخزينة غير صالح.' };
            }

            const normalizedAmount = normalizeTreasuryAmount(transaction.amount);
            if (normalizedAmount === null) {
                return { success: false, error: 'مبلغ حركة الخزينة يجب أن يكون أكبر من صفر.' };
            }

            const existing = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'الحركة المطلوب تعديلها غير موجودة.' };
            }

            const hasCustomerField = Object.prototype.hasOwnProperty.call(transaction, 'customer_id');
            const normalizedCustomerId = hasCustomerField
                ? normalizeTreasuryCustomerId(transaction.customer_id)
                : existing.customer_id;

            if (normalizedType === 'expense') {
                let balanceBeforeUpdate = getCurrentTreasuryBalance();
                if (existing.type === 'expense') {
                    balanceBeforeUpdate += Number(existing.amount) || 0;
                } else if (existing.type === 'income') {
                    balanceBeforeUpdate -= Number(existing.amount) || 0;
                }

                if (balanceBeforeUpdate <= 0) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن رصيد الخزينة الحالي يساوي صفر.' };
                }

                if (normalizedAmount > balanceBeforeUpdate) {
                    return { success: false, error: 'لا يمكن تسجيل حركة سحب لأن قيمة السحب أكبر من الرصيد المتاح في الخزينة.' };
                }
            }

            const stmt = db.prepare(`
                UPDATE treasury_transactions 
                SET type = @type, amount = @amount, transaction_date = @date, description = @description, customer_id = @customer_id
                WHERE id = @id
            `);

            const tx = db.transaction(() => {
                // 1. Update transaction
                stmt.run({ ...transaction, type: normalizedType, amount: normalizedAmount, customer_id: normalizedCustomerId });
            });

            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-treasury-transaction', (event, id) => {
        const denied = requirePermission('treasury', 'delete');
        if (denied) return denied;
        const getTrans = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?');
        const deleteTrans = db.prepare('DELETE FROM treasury_transactions WHERE id = ?');
        
        // Sales Updates
        const updateSalesInvoice = db.prepare('UPDATE sales_invoices SET paid_amount = paid_amount - @amount, remaining_amount = remaining_amount + @amount WHERE id = @id');
        const getSalesInvoice = db.prepare('SELECT customer_id FROM sales_invoices WHERE id = ?');

        // Purchase Updates
        const updatePurchaseInvoice = db.prepare('UPDATE purchase_invoices SET paid_amount = paid_amount - @amount, remaining_amount = remaining_amount + @amount WHERE id = @id');
        const getPurchaseInvoice = db.prepare('SELECT supplier_id FROM purchase_invoices WHERE id = ?');

        const filesToDelete = db.prepare('SELECT file_name FROM treasury_attachments WHERE transaction_id = ?').all(id);
        const deleteAttachments = db.prepare('DELETE FROM treasury_attachments WHERE transaction_id = ?');
        const tx = db.transaction(() => {
            const trans = getTrans.get(id);
            if (!trans) return; // Already deleted
            const isInvoiceLinked = trans.related_invoice_id && (trans.related_type === 'sales' || trans.related_type === 'purchase');

            if (isInvoiceLinked) {
                if (trans.related_type === 'sales') {
                    updateSalesInvoice.run({ amount: trans.amount, id: trans.related_invoice_id });
                } else if (trans.related_type === 'purchase') {
                    updatePurchaseInvoice.run({ amount: trans.amount, id: trans.related_invoice_id });
                }
            }

            deleteAttachments.run(id);
            deleteTrans.run(id);
        });

        try {
            tx();
            filesToDelete.forEach((row) => safeUnlinkAttachmentFile(row.file_name));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-treasury-attachments', (event, transactionId) => {
        if (!hasFeature(db, TREASURY_ATTACHMENTS_FEATURE)) {
            return { success: false, attachments: [], error: 'هذه الميزة غير مفعّلة لهذا الحساب.' };
        }
        try {
            const txId = Number(transactionId);
            if (!Number.isFinite(txId) || txId <= 0) {
                return { success: true, attachments: [] };
            }
            const attachments = db.prepare(`
                SELECT id, transaction_id, file_name, original_name, mime_type, file_size, created_at
                FROM treasury_attachments
                WHERE transaction_id = ?
                ORDER BY id ASC
            `).all(txId);
            return { success: true, attachments };
        } catch (error) {
            return { success: false, attachments: [], error: error.message };
        }
    });

    ipcMain.handle('get-treasury-attachment-counts', (event, transactionIds) => {
        if (!hasFeature(db, TREASURY_ATTACHMENTS_FEATURE)) {
            return { success: true, enabled: false, counts: {} };
        }
        try {
            const ids = Array.isArray(transactionIds)
                ? [...new Set(transactionIds.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0))]
                : [];
            if (ids.length === 0) {
                return { success: true, enabled: true, counts: {} };
            }
            const placeholders = ids.map(() => '?').join(',');
            const rows = db.prepare(`
                SELECT transaction_id, COUNT(*) AS cnt
                FROM treasury_attachments
                WHERE transaction_id IN (${placeholders})
                GROUP BY transaction_id
            `).all(...ids);
            const counts = {};
            rows.forEach((r) => {
                counts[Number(r.transaction_id)] = Number(r.cnt || 0);
            });
            return { success: true, enabled: true, counts };
        } catch (error) {
            return { success: false, enabled: true, counts: {}, error: error.message };
        }
    });

    ipcMain.handle('save-treasury-attachments', (event, payload = {}) => {
        const denied = requirePermission('treasury', 'add');
        if (denied) return denied;
        if (!hasFeature(db, TREASURY_ATTACHMENTS_FEATURE)) {
            return { success: false, error: 'هذه الميزة غير مفعّلة لهذا الحساب.' };
        }
        try {
            const txId = Number(payload.transactionId);
            const files = Array.isArray(payload.files) ? payload.files : [];
            if (!Number.isFinite(txId) || txId <= 0) {
                return { success: false, error: 'معرّف السند غير صالح.' };
            }
            const txRow = db.prepare('SELECT id FROM treasury_transactions WHERE id = ?').get(txId);
            if (!txRow) {
                return { success: false, error: 'السند غير موجود.' };
            }
            if (files.length === 0) {
                return { success: true, attachments: [] };
            }

            const existingCountRow = db.prepare('SELECT COUNT(*) AS cnt FROM treasury_attachments WHERE transaction_id = ?').get(txId);
            const existingCount = Number(existingCountRow?.cnt || 0);
            if (existingCount + files.length > MAX_ATTACHMENTS_PER_TRANSACTION) {
                return { success: false, error: `الحد الأقصى للمرفقات هو ${MAX_ATTACHMENTS_PER_TRANSACTION} ملفات لكل سند.` };
            }

            const imagesDir = getTreasuryImagesDir();
            const prepared = [];

            for (const file of files) {
                const mimeType = String(file?.mimeType || '').trim().toLowerCase();
                const ext = ALLOWED_ATTACHMENT_MIMES[mimeType];
                if (!ext) {
                    return { success: false, error: 'نوع الملف غير مدعوم. المسموح به: صور (JPG, PNG, WEBP) أو PDF فقط.' };
                }

                const rawBase64 = String(file?.base64Data || '').replace(/^data:[^;]+;base64,/, '');
                if (!rawBase64) {
                    return { success: false, error: 'بيانات الملف فارغة.' };
                }

                const buffer = Buffer.from(rawBase64, 'base64');
                const maxLimit = mimeType === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
                if (buffer.length > maxLimit) {
                    const maxMb = Math.round(maxLimit / (1024 * 1024));
                    return { success: false, error: `حجم الملف يتجاوز الحد المسموح (${maxMb} ميجابايت).` };
                }

                const uniqueFileName = `tx_${txId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`;
                const originalName = path.basename(String(file?.originalName || uniqueFileName)).slice(0, 180);
                prepared.push({ uniqueFileName, originalName, mimeType, buffer });
            }

            const writtenFiles = [];
            try {
                for (const item of prepared) {
                    fs.writeFileSync(path.join(imagesDir, item.uniqueFileName), item.buffer);
                    writtenFiles.push(item.uniqueFileName);
                }

                const insertStmt = db.prepare(`
                    INSERT INTO treasury_attachments (transaction_id, file_name, original_name, mime_type, file_size)
                    VALUES (?, ?, ?, ?, ?)
                `);

                const inserted = db.transaction(() => {
                    return prepared.map((item) => {
                        const info = insertStmt.run(txId, item.uniqueFileName, item.originalName, item.mimeType, item.buffer.length);
                        return {
                            id: Number(info.lastInsertRowid),
                            transaction_id: txId,
                            file_name: item.uniqueFileName,
                            original_name: item.originalName,
                            mime_type: item.mimeType,
                            file_size: item.buffer.length
                        };
                    });
                })();

                return { success: true, attachments: inserted };
            } catch (writeErr) {
                writtenFiles.forEach((f) => safeUnlinkAttachmentFile(f));
                throw writeErr;
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('read-treasury-attachment', (event, attachmentId) => {
        if (!hasFeature(db, TREASURY_ATTACHMENTS_FEATURE)) {
            return { success: false, error: 'هذه الميزة غير مفعّلة لهذا الحساب.' };
        }
        try {
            const id = Number(attachmentId);
            const row = db.prepare('SELECT * FROM treasury_attachments WHERE id = ?').get(id);
            if (!row) {
                return { success: false, error: 'المرفق غير موجود.' };
            }
            const fullPath = path.join(getTreasuryImagesDir(), path.basename(row.file_name));
            if (!fs.existsSync(fullPath)) {
                return { success: false, error: 'ملف المرفق غير موجود داخل مجلد Image.' };
            }
            const buffer = fs.readFileSync(fullPath);
            const dataUrl = `data:${row.mime_type};base64,${buffer.toString('base64')}`;
            return {
                success: true,
                attachment: {
                    id: row.id,
                    transaction_id: row.transaction_id,
                    file_name: row.file_name,
                    original_name: row.original_name,
                    mime_type: row.mime_type,
                    file_size: row.file_size,
                    created_at: row.created_at,
                    dataUrl
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-treasury-attachment-external', async (event, attachmentId) => {
        if (!hasFeature(db, TREASURY_ATTACHMENTS_FEATURE)) {
            return { success: false, error: 'هذه الميزة غير مفعّلة لهذا الحساب.' };
        }
        try {
            const id = Number(attachmentId);
            const row = db.prepare('SELECT * FROM treasury_attachments WHERE id = ?').get(id);
            if (!row) {
                return { success: false, error: 'المرفق غير موجود.' };
            }
            const fullPath = path.join(getTreasuryImagesDir(), path.basename(row.file_name));
            if (!fs.existsSync(fullPath)) {
                return { success: false, error: 'ملف المرفق غير موجود داخل مجلد Image.' };
            }
            const openErr = await shell.openPath(fullPath);
            if (openErr) {
                return { success: false, error: openErr };
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-treasury-attachment', (event, attachmentId) => {
        const denied = requirePermission('treasury', 'edit');
        if (denied) return denied;
        if (!hasFeature(db, TREASURY_ATTACHMENTS_FEATURE)) {
            return { success: false, error: 'هذه الميزة غير مفعّلة لهذا الحساب.' };
        }
        try {
            const id = Number(attachmentId);
            const row = db.prepare('SELECT * FROM treasury_attachments WHERE id = ?').get(id);
            if (!row) {
                return { success: false, error: 'المرفق غير موجود.' };
            }
            db.prepare('DELETE FROM treasury_attachments WHERE id = ?').run(id);
            safeUnlinkAttachmentFile(row.file_name);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('search-treasury-by-voucher', (event, voucherNumber) => {
        try {
            const results = db.prepare(`
                SELECT t.*, c.name as customer_name
                FROM treasury_transactions t
                LEFT JOIN parties c ON t.customer_id = c.id
                WHERE t.voucher_number LIKE @search
                ORDER BY t.transaction_date DESC, t.id DESC
            `).all({ search: `%${voucherNumber}%` });
            return { success: true, results };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };


