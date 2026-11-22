const { ipcMain } = require('electron');
const { db } = require('../db');

function register() {
    // Get all units
    ipcMain.handle('get-units', () => {
        try {
            const stmt = db.prepare('SELECT * FROM units ORDER BY id DESC');
            return stmt.all();
        } catch (error) {
            console.error('[get-units] Error:', error);
            return [];
        }
    });

    // Add a new unit
    ipcMain.handle('add-unit', (event, unitName) => {
        try {
            const stmt = db.prepare('INSERT INTO units (name) VALUES (?)');
            const info = stmt.run(unitName);
            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Update a unit
    ipcMain.handle('update-unit', (event, unit) => {
        try {
            const stmt = db.prepare('UPDATE units SET name = @name WHERE id = @id');
            stmt.run(unit);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete a unit
    ipcMain.handle('delete-unit', (event, id) => {
        try {
            const stmt = db.prepare('DELETE FROM units WHERE id = ?');
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
