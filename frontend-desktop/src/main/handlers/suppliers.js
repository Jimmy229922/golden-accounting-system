const { ipcMain } = require('electron');
const { db } = require('../db');

function register() {
    // --- Suppliers Handlers ---

    ipcMain.handle('get-suppliers', () => {
        try {
            return db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all();
        } catch (error) {
            console.error('[get-suppliers] Error:', error);
            return [];
        }
    });

    ipcMain.handle('add-supplier', (event, supplier) => {
        try {
            const stmt = db.prepare('INSERT INTO suppliers (name, phone, address, balance) VALUES (@name, @phone, @address, @balance)');
            const info = stmt.run(supplier);
            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-supplier', (event, id) => {
        try {
            db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
