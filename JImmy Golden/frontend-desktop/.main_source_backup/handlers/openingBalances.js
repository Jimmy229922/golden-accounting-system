const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');
const MAIN_WAREHOUSE_ID = 1;

function register() {
    // --- Opening Balances Handlers ---
    ipcMain.handle('get-opening-balances', () => {
        try {
            const stmt = db.prepare(`
                SELECT ob.*, items.name AS item_name, warehouses.name AS warehouse_name
                FROM opening_balances ob
                LEFT JOIN items ON ob.item_id = items.id
                LEFT JOIN warehouses ON ob.warehouse_id = warehouses.id
                ORDER BY ob.created_at DESC
            `);
            return stmt.all();
        } catch (error) {
            console.error('[get-opening-balances] Error:', error);
            return [];
        }
    });

    ipcMain.handle('save-opening-balances', (event, payload) => {
        const denied = requirePermission('opening-balance', 'add');
        if (denied) return denied;
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];
        const normalizedEntries = entries
            .map((entry) => ({
                item_id: Number(entry?.item_id),
                quantity: Number(entry?.quantity) || 0,
                cost_price: Number(entry?.cost_price) || 0
            }))
            .filter((entry) => entry.item_id > 0 && entry.quantity > 0);

        if (normalizedEntries.length === 0) {
            return { success: false, error: 'At least one opening balance entry is required' };
        }

        const insertBalance = db.prepare(`
            INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price)
            VALUES (@item_id, @warehouse_id, @quantity, @cost_price)
        `);
        const updateItemStock = db.prepare(`
            UPDATE items
            SET stock_quantity = stock_quantity + @qty,
                cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END
            WHERE id = @id
        `);

        const tx = db.transaction((rows) => {
            rows.forEach((row) => {
                insertBalance.run({
                    item_id: row.item_id,
                    warehouse_id: MAIN_WAREHOUSE_ID,
                    quantity: row.quantity,
                    cost_price: row.cost_price
                });
                updateItemStock.run({
                    id: row.item_id,
                    qty: row.quantity,
                    cost_price: row.cost_price
                });
            });
        });

        try {
            tx(normalizedEntries);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('add-opening-balance', (event, entry) => {
        const denied = requirePermission('opening-balance', 'add');
        if (denied) return denied;
        const itemId = Number(entry?.item_id);
        const quantity = Number(entry?.quantity) || 0;
        const costPrice = Number(entry?.cost_price) || 0;

        if (!itemId || quantity <= 0) {
            return { success: false, error: 'Missing required fields' };
        }

        const insertStmt = db.prepare(`
            INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price)
            VALUES (@item_id, @warehouse_id, @quantity, @cost_price)
        `);
        const updateItemStmt = db.prepare(`
            UPDATE items
            SET stock_quantity = stock_quantity + @qty,
                cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END
            WHERE id = @id
        `);

        const tx = db.transaction(() => {
            insertStmt.run({
                item_id: itemId,
                warehouse_id: MAIN_WAREHOUSE_ID,
                quantity,
                cost_price: costPrice
            });
            updateItemStmt.run({ id: itemId, qty: quantity, cost_price: costPrice });
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-opening-balance', (event, entry) => {
        const denied = requirePermission('opening-balance', 'edit');
        if (denied) return denied;
        const id = Number(entry?.id);
        const quantity = Number(entry?.quantity) || 0;
        const costPrice = Number(entry?.cost_price) || 0;

        if (!id || quantity <= 0) {
            return { success: false, error: 'Invalid entry data' };
        }

        const getOldStmt = db.prepare('SELECT item_id, quantity FROM opening_balances WHERE id = ?');
        const oldRow = getOldStmt.get(id);
        if (!oldRow) return { success: false, error: 'Entry not found' };

        const itemId = Number(entry?.item_id) || Number(oldRow.item_id);
        const updateStmt = db.prepare(`
            UPDATE opening_balances
            SET item_id = @item_id, warehouse_id = @warehouse_id, quantity = @quantity, cost_price = @cost_price
            WHERE id = @id
        `);
        const updateItemStockStmt = db.prepare('UPDATE items SET stock_quantity = stock_quantity + @diff WHERE id = @id');
        const updateItemCostStmt = db.prepare('UPDATE items SET cost_price = @cost_price WHERE id = @id');

        const tx = db.transaction(() => {
            const diff = quantity - Number(oldRow.quantity || 0);
            updateStmt.run({
                id,
                item_id: itemId,
                warehouse_id: MAIN_WAREHOUSE_ID,
                quantity,
                cost_price: costPrice
            });
            updateItemStockStmt.run({ id: itemId, diff });

            if (costPrice > 0) {
                updateItemCostStmt.run({ id: itemId, cost_price: costPrice });
            }
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-opening-balance', (event, id) => {
        const denied = requirePermission('opening-balance', 'delete');
        if (denied) return denied;
        const getStmt = db.prepare('SELECT item_id, quantity FROM opening_balances WHERE id = ?');
        const row = getStmt.get(id);
        if (!row) return { success: false, error: 'Entry not found' };

        const deleteStmt = db.prepare('DELETE FROM opening_balances WHERE id = ?');
        const updateItemStmt = db.prepare('UPDATE items SET stock_quantity = stock_quantity - @qty WHERE id = @id');

        const tx = db.transaction(() => {
            deleteStmt.run(id);
            updateItemStmt.run({ id: row.item_id, qty: row.quantity });
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
