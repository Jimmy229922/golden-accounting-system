const { ipcMain } = require('electron');
const { db } = require('../db');

function register() {
    // --- Warehouses Handlers ---
    ipcMain.handle('get-warehouses', () => {
        try {
            return db.prepare('SELECT * FROM warehouses WHERE id = 1').all();
        } catch (error) {
            console.error('[get-warehouses] Error:', error);
            return [];
        }
    });
}

module.exports = { register };
