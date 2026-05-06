const { ipcMain } = require('electron');
const { db } = require('../db');

function register() {
    // --- Warehouses Handlers ---
    ipcMain.handle('get-warehouses', () => {
        try {
            return db.prepare('SELECT * FROM warehouses ORDER BY name ASC').all();
        } catch (error) {
            console.error('[get-warehouses] Error:', error);
            return [];
        }
    });

    ipcMain.handle('add-warehouse', (event, name) => {
        try {
            const stmt = db.prepare('INSERT INTO warehouses (name) VALUES (?)');
            const info = stmt.run(name);
            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-warehouse', (event, { id, name }) => {
        try {
            const stmt = db.prepare('UPDATE warehouses SET name = ? WHERE id = ?');
            stmt.run(name, id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-warehouse', (event, id) => {
        try {
            // Check if warehouse has items in opening balances
            const checkStmt = db.prepare('SELECT COUNT(*) as count FROM opening_balances WHERE warehouse_id = ?');
            const result = checkStmt.get(id);
            
            if (result.count > 0) {
                return { success: false, error: 'لا يمكن حذف المخزن لأنه يحتوي على أصناف مسجلة' };
            }

            const stmt = db.prepare('DELETE FROM warehouses WHERE id = ?');
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
