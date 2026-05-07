const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const DEFAULT_PAGE_SIZE = 50;

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getCurrentTreasuryBalance() {
    const income = Number(db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM treasury_transactions WHERE type = 'income'").get().total || 0);
    const expense = Number(db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM treasury_transactions WHERE type = 'expense'").get().total || 0);
    return roundMoney(income - expense);
}

function getNextDocumentNumber() {
    const row = db.prepare(`
        SELECT document_number
        FROM petty_expenses_bags
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

function register() {
    ipcMain.handle('get-next-bags-expense-number', () => {
        try {
            return { success: true, documentNumber: getNextDocumentNumber() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-bags-expenses', (event, params = {}) => {
        try {
            const pageSize = Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE);
            const page = Math.max(1, Number(params.page) || 1);
            const offset = (page - 1) * pageSize;
            const where = [];
            const args = {};

            if (params.startDate) {
                where.push('expense_date >= @startDate');
                args.startDate = params.startDate;
            }

            if (params.endDate) {
                where.push('expense_date <= @endDate');
                args.endDate = params.endDate;
            }

            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const total = db.prepare(`SELECT COUNT(*) as count FROM petty_expenses_bags ${whereSql}`).get(args).count || 0;
            const totalAmount = db.prepare(`SELECT COALESCE(SUM(amount), 0) as totalAmount FROM petty_expenses_bags ${whereSql}`).get(args).totalAmount || 0;
            const rows = db.prepare(`
                SELECT id, document_number, expense_date, amount, statement, notes, created_at
                FROM petty_expenses_bags
                ${whereSql}
                ORDER BY expense_date DESC, id DESC
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

    ipcMain.handle('save-bags-expense', (event, data = {}) => {
        try {
            const amount = roundMoney(data.amount);
            const statement = String(data.statement || '').trim();
            const notes = String(data.notes || '').trim();
            const expenseDate = normalizeDate(data.expense_date);

            if (amount <= 0) {
                return { success: false, error: 'قيمة الشكاير غير صحيحة' };
            }

            if (!statement) {
                return { success: false, error: 'البيان مطلوب' };
            }

            const currentBalance = getCurrentTreasuryBalance();
            if (amount > currentBalance) {
                return { success: false, error: 'قيمة الشكاير أكبر من رصيد الخزينة المتاح' };
            }

            const tx = db.transaction(() => {
                const documentNumber = getNextDocumentNumber();
                const expenseInfo = db.prepare(`
                    INSERT INTO petty_expenses_bags (document_number, expense_date, amount, statement, notes)
                    VALUES (@document_number, @expense_date, @amount, @statement, @notes)
                `).run({
                    document_number: documentNumber,
                    expense_date: expenseDate,
                    amount,
                    statement,
                    notes
                });

                const expenseId = expenseInfo.lastInsertRowid;
                const treasuryInfo = db.prepare(`
                    INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
                    VALUES ('expense', @amount, @transaction_date, @description, @related_invoice_id, 'petty_expenses_bags')
                `).run({
                    amount,
                    transaction_date: expenseDate,
                    description: `شكاير ${documentNumber} - ${statement}`,
                    related_invoice_id: expenseId
                });

                db.prepare('UPDATE petty_expenses_bags SET treasury_transaction_id = ? WHERE id = ?').run(treasuryInfo.lastInsertRowid, expenseId);
                return { id: expenseId, documentNumber };
            });

            const result = tx();
            return { success: true, ...result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-bags-expense', (event, data = {}) => {
        try {
            const expenseId = Number(data.id);
            if (!expenseId) {
                return { success: false, error: 'معرف الشكاير غير صحيح' };
            }

            const amount = roundMoney(data.amount);
            const statement = String(data.statement || '').trim();
            const notes = String(data.notes || '').trim();
            const expenseDate = normalizeDate(data.expense_date);

            if (amount <= 0) {
                return { success: false, error: 'قيمة الشكاير غير صحيحة' };
            }

            if (!statement) {
                return { success: false, error: 'البيان مطلوب' };
            }

            const existing = db.prepare(`
                SELECT id, document_number, amount, treasury_transaction_id
                FROM petty_expenses_bags
                WHERE id = ?
            `).get(expenseId);

            if (!existing) {
                return { success: false, error: 'لم يتم العثور على مستند الشكاير' };
            }

            const currentBalance = getCurrentTreasuryBalance();
            const availableBalance = roundMoney(currentBalance + (Number(existing.amount) || 0));
            if (amount > availableBalance) {
                return { success: false, error: 'قيمة الشكاير أكبر من رصيد الخزينة المتاح' };
            }

            const tx = db.transaction(() => {
                db.prepare(`
                    UPDATE petty_expenses_bags
                    SET expense_date = @expense_date,
                        amount = @amount,
                        statement = @statement,
                        notes = @notes
                    WHERE id = @id
                `).run({
                    id: expenseId,
                    expense_date: expenseDate,
                    amount,
                    statement,
                    notes
                });

                const description = `شكاير ${existing.document_number} - ${statement}`;
                if (existing.treasury_transaction_id) {
                    db.prepare(`
                        UPDATE treasury_transactions
                        SET amount = @amount,
                            transaction_date = @transaction_date,
                            description = @description
                        WHERE id = @id
                    `).run({
                        id: existing.treasury_transaction_id,
                        amount,
                        transaction_date: expenseDate,
                        description
                    });
                } else {
                    const treasuryInfo = db.prepare(`
                        INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
                        VALUES ('expense', @amount, @transaction_date, @description, @related_invoice_id, 'petty_expenses_bags')
                    `).run({
                        amount,
                        transaction_date: expenseDate,
                        description,
                        related_invoice_id: expenseId
                    });

                    db.prepare('UPDATE petty_expenses_bags SET treasury_transaction_id = ? WHERE id = ?').run(treasuryInfo.lastInsertRowid, expenseId);
                }

                return { id: expenseId, documentNumber: existing.document_number };
            });

            const result = tx();
            return { success: true, ...result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-bags-expense', (event, expenseId) => {
        try {
            const id = Number(expenseId);
            if (!id) {
                return { success: false, error: 'معرف الشكاير غير صحيح' };
            }

            const existing = db.prepare(`
                SELECT id, treasury_transaction_id
                FROM petty_expenses_bags
                WHERE id = ?
            `).get(id);

            if (!existing) {
                return { success: false, error: 'لم يتم العثور على مستند الشكاير' };
            }

            const tx = db.transaction(() => {
                db.prepare('DELETE FROM petty_expenses_bags WHERE id = ?').run(id);
                if (existing.treasury_transaction_id) {
                    db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(existing.treasury_transaction_id);
                }
                return { id };
            });

            const result = tx();
            return { success: true, ...result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-bags-expenses-pdf', async (event, payload = {}) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) {
                return { success: false, error: 'No active window found' };
            }

            const date = new Date().toISOString().slice(0, 10);
            const defaultName = String(payload.defaultName || `Bags_Expenses_${date}.pdf`).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const defaultPath = path.join(app.getPath('documents'), defaultName);
            const { canceled, filePath } = await dialog.showSaveDialog(win, {
                title: 'حفظ ملف الشكاير PDF',
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
