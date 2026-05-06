const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

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

        const insertBalance = db.prepare(`
            INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price)
            VALUES (@item_id, @warehouse_id, @quantity, @cost_price)
        `);

        const clearBalances = db.prepare('DELETE FROM opening_balances');
        const updateItemStock = db.prepare('UPDATE items SET stock_quantity = @qty, cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END WHERE id = @id');

        const tx = db.transaction((rows) => {
            clearBalances.run();

            const totalsByItem = {};
            rows.forEach((row) => {
                const quantity = Number(row.quantity) || 0;
                const cost_price = Number(row.cost_price) || 0;
                const item_id = Number(row.item_id);
                const warehouse_id = Number(row.warehouse_id);
                if (!item_id || !warehouse_id) return;

                insertBalance.run({ item_id, warehouse_id, quantity, cost_price });
                totalsByItem[item_id] = (totalsByItem[item_id] || 0) + quantity;
            });

            Object.entries(totalsByItem).forEach(([itemId, qty]) => {
                // Use last provided cost for that item if present
                const lastCost = rows.find((r) => Number(r.item_id) === Number(itemId) && Number(r.cost_price) > 0)?.cost_price || 0;
                updateItemStock.run({ id: Number(itemId), qty, cost_price: Number(lastCost) || 0 });
            });
        });

        try {
            tx(entries);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    const insertOpeningBalanceGroupStmt = db.prepare('INSERT INTO opening_balance_groups (notes) VALUES (?)');
    const updateOpeningBalanceGroupStmt = db.prepare('UPDATE opening_balance_groups SET notes = ? WHERE id = ?');
    const deleteOpeningBalanceGroupStmt = db.prepare('DELETE FROM opening_balance_groups WHERE id = ?');
    const getOpeningBalanceGroupStmt = db.prepare('SELECT * FROM opening_balance_groups WHERE id = ?');
    const getOpeningBalanceGroupsStmt = db.prepare(`
        SELECT
            obg.*,
            COALESCE(COUNT(ob.id), 0) AS entries_count,
            COALESCE(SUM(ob.quantity * ob.cost_price), 0) AS total_value
        FROM opening_balance_groups obg
        LEFT JOIN opening_balances ob ON ob.group_id = obg.id
        GROUP BY obg.id
        ORDER BY obg.created_at DESC, obg.id DESC
    `);
    const getOpeningBalanceGroupEntriesStmt = db.prepare(`
        SELECT ob.*, items.name AS item_name, warehouses.name AS warehouse_name
        FROM opening_balances ob
        LEFT JOIN items ON ob.item_id = items.id
        LEFT JOIN warehouses ON ob.warehouse_id = warehouses.id
        WHERE ob.group_id = ?
        ORDER BY ob.id ASC
    `);
    const getOpeningBalanceRawEntriesStmt = db.prepare('SELECT item_id, quantity FROM opening_balances WHERE group_id = ?');
    const deleteOpeningBalanceEntriesForGroupStmt = db.prepare('DELETE FROM opening_balances WHERE group_id = ?');
    const insertOpeningBalanceForGroupStmt = db.prepare(`
        INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price, group_id)
        VALUES (@item_id, @warehouse_id, @quantity, @cost_price, @group_id)
    `);
    const applyItemStockDeltaStmt = db.prepare(`
        UPDATE items
        SET stock_quantity = stock_quantity + @qty,
            cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END
        WHERE id = @id
    `);
    const applyItemStockOnlyDeltaStmt = db.prepare('UPDATE items SET stock_quantity = stock_quantity + @qty WHERE id = @id');

    function normalizeOpeningBalanceEntries(rawEntries) {
        const entries = Array.isArray(rawEntries) ? rawEntries : [];
        return entries
            .map((entry) => ({
                item_id: Number(entry.item_id),
                warehouse_id: Number(entry.warehouse_id),
                quantity: Number(entry.quantity) || 0,
                cost_price: Number(entry.cost_price) || 0
            }))
            .filter((entry) => entry.item_id > 0 && entry.warehouse_id > 0 && entry.quantity !== 0);
    }

    function applyGroupEntries(groupId, entries) {
        entries.forEach((entry) => {
            insertOpeningBalanceForGroupStmt.run({
                item_id: entry.item_id,
                warehouse_id: entry.warehouse_id,
                quantity: entry.quantity,
                cost_price: entry.cost_price,
                group_id: groupId
            });
            applyItemStockDeltaStmt.run({
                id: entry.item_id,
                qty: entry.quantity,
                cost_price: entry.cost_price
            });
        });
    }

    function reverseGroupEntries(groupId) {
        const rows = getOpeningBalanceRawEntriesStmt.all(groupId);
        rows.forEach((row) => {
            applyItemStockOnlyDeltaStmt.run({
                id: Number(row.item_id),
                qty: -1 * (Number(row.quantity) || 0)
            });
        });
        deleteOpeningBalanceEntriesForGroupStmt.run(groupId);
    }

    ipcMain.handle('add-opening-balance-group', (event, payload) => {
        const denied = requirePermission('opening-balance', 'add');
        if (denied) return denied;
        const notes = String(payload?.notes || '').trim();
        const entries = normalizeOpeningBalanceEntries(payload?.entries);

        if (entries.length === 0) {
            return { success: false, error: 'At least one opening balance entry is required' };
        }

        const tx = db.transaction(() => {
            const info = insertOpeningBalanceGroupStmt.run(notes);
            const groupId = Number(info.lastInsertRowid);
            applyGroupEntries(groupId, entries);
            return groupId;
        });

        try {
            const groupId = tx();
            return { success: true, groupId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-opening-balance-groups', () => {
        try {
            return getOpeningBalanceGroupsStmt.all();
        } catch (error) {
            return [];
        }
    });

    ipcMain.handle('get-opening-balance-group', (event, groupId) => {
        try {
            const group = getOpeningBalanceGroupStmt.get(groupId);
            if (!group) return { success: false, error: 'Group not found' };
            return { success: true, group };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-group-details', (event, groupId) => {
        try {
            const entries = getOpeningBalanceGroupEntriesStmt.all(groupId);
            return { success: true, entries };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-opening-balance-group', (event, payload) => {
        const denied = requirePermission('opening-balance', 'edit');
        if (denied) return denied;
        const groupId = Number(payload?.groupId || payload?.id);
        const notes = String(payload?.notes || '').trim();
        const entries = normalizeOpeningBalanceEntries(payload?.entries);

        if (!groupId) {
            return { success: false, error: 'Invalid group id' };
        }

        const existing = getOpeningBalanceGroupStmt.get(groupId);
        if (!existing) {
            return { success: false, error: 'Group not found' };
        }

        if (entries.length === 0) {
            return { success: false, error: 'At least one opening balance entry is required' };
        }

        const tx = db.transaction(() => {
            reverseGroupEntries(groupId);
            updateOpeningBalanceGroupStmt.run(notes, groupId);
            applyGroupEntries(groupId, entries);
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-opening-balance-group', (event, groupId) => {
        const denied = requirePermission('opening-balance', 'delete');
        if (denied) return denied;
        const normalizedGroupId = Number(groupId);
        if (!normalizedGroupId) {
            return { success: false, error: 'Invalid group id' };
        }

        const existing = getOpeningBalanceGroupStmt.get(normalizedGroupId);
        if (!existing) {
            return { success: false, error: 'Group not found' };
        }

        const tx = db.transaction(() => {
            reverseGroupEntries(normalizedGroupId);
            deleteOpeningBalanceGroupStmt.run(normalizedGroupId);
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Add single opening balance entry (Append mode)
    ipcMain.handle('add-opening-balance', (event, entry) => {
        const denied = requirePermission('opening-balance', 'add');
        if (denied) return denied;
        const { item_id, warehouse_id, quantity, cost_price } = entry;
        
        if (!item_id || !warehouse_id || !quantity) {
            return { success: false, error: 'Missing required fields' };
        }

        const insertStmt = db.prepare(`
            INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price)
            VALUES (@item_id, @warehouse_id, @quantity, @cost_price)
        `);

        const updateItemStmt = db.prepare(`
            UPDATE items SET stock_quantity = stock_quantity + @qty, cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END WHERE id = @id
        `);

        const tx = db.transaction(() => {
            insertStmt.run({ item_id, warehouse_id, quantity, cost_price });
            updateItemStmt.run({ id: item_id, qty: quantity, cost_price: cost_price || 0 });
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Update opening balance entry
    ipcMain.handle('update-opening-balance', (event, entry) => {
        const denied = requirePermission('opening-balance', 'edit');
        if (denied) return denied;
        const { id, item_id, warehouse_id, quantity, cost_price } = entry;
        
        const getOldStmt = db.prepare('SELECT item_id, quantity FROM opening_balances WHERE id = ?');
        const oldRow = getOldStmt.get(id);
        if (!oldRow) return { success: false, error: 'Entry not found' };

        const updateStmt = db.prepare(`
            UPDATE opening_balances 
            SET item_id = @item_id, warehouse_id = @warehouse_id, quantity = @quantity, cost_price = @cost_price
            WHERE id = @id
        `);

        const updateItemStockStmt = db.prepare('UPDATE items SET stock_quantity = stock_quantity + @diff WHERE id = @id');
        const updateItemCostStmt = db.prepare('UPDATE items SET cost_price = @cost_price WHERE id = @id');

        const tx = db.transaction(() => {
            const diff = quantity - oldRow.quantity;
            updateStmt.run({ id, item_id, warehouse_id, quantity, cost_price });
            
            updateItemStockStmt.run({ id: item_id, diff });
            
            if (cost_price > 0) {
                updateItemCostStmt.run({ id: item_id, cost_price });
            }
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete opening balance entry
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
