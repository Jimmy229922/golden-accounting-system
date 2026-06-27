const { ipcMain } = require('electron');
const { db } = require('../db');
const { DEFAULT_WAREHOUSE_NAME } = require('./utils');
const { requirePermission } = require('./auth');

function register() {
    // Get all items
    ipcMain.handle('get-items', () => {
        try {
            const stmt = db.prepare(`
                SELECT items.*, units.name as unit_name
                FROM items
                LEFT JOIN units ON items.unit_id = units.id
                WHERE items.is_deleted = 0
                ORDER BY items.id DESC
            `);
            return stmt.all();
        } catch (error) {
            console.error('[get-items] Error:', error);
            return [];
        }
    });

    // Get item stock details (warehouse breakdown)
    ipcMain.handle('get-item-stock-details', (event, itemId) => {
        try {
            const stmt = db.prepare(`
                SELECT 
                    ob.id,
                    ob.warehouse_id,
                    w.name as warehouse_name,
                    ob.quantity,
                    ob.cost_price
                FROM opening_balances ob
                JOIN warehouses w ON ob.warehouse_id = w.id
                WHERE ob.item_id = ?
                ORDER BY w.name
            `);
            return stmt.all(itemId);
        } catch (error) {
            console.error('[get-item-stock-details] Error:', error);
            return [];
        }
    });

    const getActiveItemStmt = db.prepare(`
        SELECT id, name, stock_quantity, cost_price
        FROM items
        WHERE id = ? AND is_deleted = 0
    `);
    const getWarehouseByIdStmt = db.prepare('SELECT id, name FROM warehouses WHERE id = ?');
    const insertDamagedStockStmt = db.prepare(`
        INSERT INTO damaged_stock_logs (
            item_id,
            warehouse_id,
            quantity,
            reason,
            batch_no,
            expiry_date,
            notes,
            damaged_date,
            cost_price,
            loss_amount
        )
        VALUES (
            @item_id,
            @warehouse_id,
            @quantity,
            @reason,
            @batch_no,
            @expiry_date,
            @notes,
            @damaged_date,
            @cost_price,
            @loss_amount
        )
    `);
    const updateDamagedStockStmt = db.prepare(`
        UPDATE damaged_stock_logs
        SET item_id = @item_id,
            warehouse_id = @warehouse_id,
            quantity = @quantity,
            reason = @reason,
            batch_no = @batch_no,
            expiry_date = @expiry_date,
            notes = @notes,
            damaged_date = @damaged_date,
            cost_price = @cost_price,
            loss_amount = @loss_amount,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
    `);
    const getDamagedByIdStmt = db.prepare('SELECT * FROM damaged_stock_logs WHERE id = ?');
    const deleteDamagedByIdStmt = db.prepare('DELETE FROM damaged_stock_logs WHERE id = ?');
    const decreaseStockStmt = db.prepare('UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?');
    const increaseStockStmt = db.prepare('UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?');

    // Add a new item
    ipcMain.handle('add-item', (event, item) => {
        const denied = requirePermission('items', 'add');
        if (denied) return denied;
        const insertItem = db.prepare(`
            INSERT INTO items (name, barcode, unit_id, cost_price, sale_price, stock_quantity, reorder_level)
            VALUES (@name, @barcode, @unit_id, @cost_price, @sale_price, @stock_quantity, @reorder_level)
        `);
        const getNextAutoBarcode = db.prepare(`
            SELECT COALESCE(MAX(CAST(TRIM(barcode) AS INTEGER)), 999) + 1 AS next_barcode
            FROM items
            WHERE barcode IS NOT NULL
              AND TRIM(barcode) <> ''
              AND TRIM(barcode) NOT GLOB '*[^0-9]*'
              AND CAST(TRIM(barcode) AS INTEGER) >= 1000
              AND CAST(TRIM(barcode) AS INTEGER) <= 999999
        `);

        const getWarehouse = db.prepare('SELECT id FROM warehouses ORDER BY id ASC LIMIT 1');
        const createWarehouse = db.prepare('INSERT INTO warehouses (name) VALUES (?)');
        const insertBalance = db.prepare(`
            INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price)
            VALUES (?, ?, ?, ?)
        `);

        const tx = db.transaction((item) => {
            const normalizedBarcode = String(item.barcode || '').trim();
            const nextBarcodeRow = getNextAutoBarcode.get();
            const nextBarcodeValue = Number(nextBarcodeRow?.next_barcode);
            const itemToInsert = {
                ...item,
                barcode: normalizedBarcode || String(Number.isFinite(nextBarcodeValue) ? nextBarcodeValue : 1000)
            };

            const info = insertItem.run(itemToInsert);
            const itemId = info.lastInsertRowid;

            if (itemToInsert.stock_quantity > 0) {
                let warehouse = getWarehouse.get();
                if (!warehouse) {
                    const wInfo = createWarehouse.run(DEFAULT_WAREHOUSE_NAME);
                    warehouse = { id: wInfo.lastInsertRowid };
                }
                insertBalance.run(itemId, warehouse.id, itemToInsert.stock_quantity, itemToInsert.cost_price || 0);
            }
            return itemId;
        });

        try {
            const id = tx(item);
            return { success: true, id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Update an item
    ipcMain.handle('update-item', (event, item) => {
        const denied = requirePermission('items', 'edit');
        if (denied) return denied;
        try {
            // Removed stock_quantity from update to prevent manual override
            const stmt = db.prepare(`
                UPDATE items SET
                    name = @name,
                    barcode = @barcode,
                    unit_id = @unit_id,
                    cost_price = @cost_price,
                    sale_price = @sale_price,
                    reorder_level = @reorder_level
                WHERE id = @id
            `);
            stmt.run(item);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete an item (soft delete)
    ipcMain.handle('delete-item', (event, id) => {
        const denied = requirePermission('items', 'delete');
        if (denied) return denied;
        try {
            // Check for any references in sales_invoice_details or purchase_invoice_details
            const salesRef = db.prepare('SELECT COUNT(*) as count FROM sales_invoice_details WHERE item_id = ?').get(id);
            const purchaseRef = db.prepare('SELECT COUNT(*) as count FROM purchase_invoice_details WHERE item_id = ?').get(id);

            if (salesRef.count > 0 || purchaseRef.count > 0) {
                // Soft delete - mark as deleted instead of removing
                const stmt = db.prepare('UPDATE items SET is_deleted = 1 WHERE id = ?');
                stmt.run(id);
                return { success: true, softDeleted: true };
            }

            // delete related opening balances first
            db.prepare('DELETE FROM opening_balances WHERE item_id = ?').run(id);
            // Hard delete if no references
            const stmt = db.prepare('DELETE FROM items WHERE id = ?');
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Damaged stock log list
    ipcMain.handle('get-damaged-stock-entries', (event, filters = {}) => {
        const denied = requirePermission('inventory', 'view');
        if (denied) return denied;

        try {
            const conditions = [];
            const params = [];

            const itemId = Number(filters.item_id);
            if (Number.isFinite(itemId) && itemId > 0) {
                conditions.push('d.item_id = ?');
                params.push(itemId);
            }

            const fromDate = String(filters.from_date || '').trim();
            if (fromDate) {
                conditions.push('d.damaged_date >= ?');
                params.push(fromDate);
            }

            const toDate = String(filters.to_date || '').trim();
            if (toDate) {
                conditions.push('d.damaged_date <= ?');
                params.push(toDate);
            }

            const search = String(filters.search || '').trim();
            if (search) {
                conditions.push("(i.name LIKE ? OR IFNULL(i.barcode, '') LIKE ? OR IFNULL(d.reason, '') LIKE ? OR IFNULL(d.batch_no, '') LIKE ?)");
                const likeTerm = `%${search}%`;
                params.push(likeTerm, likeTerm, likeTerm, likeTerm);
            }

            const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const rows = db.prepare(`
                SELECT
                    d.*,
                    i.name AS item_name,
                    i.barcode AS item_barcode,
                    u.name AS unit_name,
                    w.name AS warehouse_name
                FROM damaged_stock_logs d
                JOIN items i ON d.item_id = i.id
                LEFT JOIN units u ON i.unit_id = u.id
                LEFT JOIN warehouses w ON d.warehouse_id = w.id
                ${whereClause}
                ORDER BY d.damaged_date DESC, d.id DESC
            `).all(...params);

            const stats = rows.reduce((acc, row) => {
                acc.totalQuantity += Number(row.quantity) || 0;
                acc.totalLoss += Number(row.loss_amount) || 0;
                return acc;
            }, { count: rows.length, totalQuantity: 0, totalLoss: 0 });

            return { success: true, entries: rows, stats };
        } catch (error) {
            console.error('[get-damaged-stock-entries] Error:', error);
            return { success: false, error: error.message, entries: [], stats: { count: 0, totalQuantity: 0, totalLoss: 0 } };
        }
    });

    // Add damaged stock entry (direct posting)
    ipcMain.handle('add-damaged-stock-entry', (event, payload = {}) => {
        const denied = requirePermission('inventory', 'add');
        if (denied) return denied;

        const itemId = Number(payload.item_id);
        const quantity = Number(payload.quantity);
        const reason = String(payload.reason || '').trim();
        const warehouseId = payload.warehouse_id ? Number(payload.warehouse_id) : null;
        const batchNo = String(payload.batch_no || '').trim() || null;
        const expiryDate = String(payload.expiry_date || '').trim() || null;
        const notes = String(payload.notes || '').trim() || null;
        const damagedDate = String(payload.damaged_date || '').trim() || new Date().toISOString().slice(0, 10);

        if (!Number.isFinite(itemId) || itemId <= 0) {
            return { success: false, error: 'الصنف غير صالح.' };
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return { success: false, error: 'الكمية يجب أن تكون أكبر من صفر.' };
        }

        if (!reason) {
            return { success: false, error: 'سبب التالف مطلوب.' };
        }

        const item = getActiveItemStmt.get(itemId);
        if (!item) {
            return { success: false, error: 'الصنف غير موجود.' };
        }

        const availableStock = Number(item.stock_quantity) || 0;
        if (quantity > availableStock) {
            return { success: false, error: `الصنف "${item.name}": الكمية المطلوبة للتالف (${quantity}) أكبر من المتاح (${availableStock}).` };
        }

        let normalizedWarehouseId = null;
        if (Number.isFinite(warehouseId) && warehouseId > 0) {
            const warehouse = getWarehouseByIdStmt.get(warehouseId);
            if (!warehouse) {
                return { success: false, error: 'المخزن غير موجود.' };
            }
            normalizedWarehouseId = warehouse.id;
        }

        const costPrice = Number.isFinite(Number(payload.cost_price)) && Number(payload.cost_price) > 0
            ? Number(payload.cost_price)
            : (Number(item.cost_price) || 0);
        const lossAmount = quantity * costPrice;

        const tx = db.transaction(() => {
            const info = insertDamagedStockStmt.run({
                item_id: itemId,
                warehouse_id: normalizedWarehouseId,
                quantity,
                reason,
                batch_no: batchNo,
                expiry_date: expiryDate,
                notes,
                damaged_date: damagedDate,
                cost_price: costPrice,
                loss_amount: lossAmount
            });

            decreaseStockStmt.run(quantity, itemId);
            return Number(info.lastInsertRowid);
        });

        try {
            const id = tx();
            return { success: true, id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Update damaged stock entry
    ipcMain.handle('update-damaged-stock-entry', (event, payload = {}) => {
        const denied = requirePermission('inventory', 'edit');
        if (denied) return denied;

        const id = Number(payload.id);
        const itemId = Number(payload.item_id);
        const quantity = Number(payload.quantity);
        const reason = String(payload.reason || '').trim();
        const warehouseId = payload.warehouse_id ? Number(payload.warehouse_id) : null;
        const batchNo = String(payload.batch_no || '').trim() || null;
        const expiryDate = String(payload.expiry_date || '').trim() || null;
        const notes = String(payload.notes || '').trim() || null;
        const damagedDate = String(payload.damaged_date || '').trim() || new Date().toISOString().slice(0, 10);

        if (!Number.isFinite(id) || id <= 0) {
            return { success: false, error: 'معرف سجل التالف غير صالح.' };
        }

        if (!Number.isFinite(itemId) || itemId <= 0) {
            return { success: false, error: 'الصنف غير صالح.' };
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return { success: false, error: 'الكمية يجب أن تكون أكبر من صفر.' };
        }

        if (!reason) {
            return { success: false, error: 'سبب التالف مطلوب.' };
        }

        const existing = getDamagedByIdStmt.get(id);
        if (!existing) {
            return { success: false, error: 'سجل التالف غير موجود.' };
        }

        const nextItem = getActiveItemStmt.get(itemId);
        if (!nextItem) {
            return { success: false, error: 'الصنف غير موجود.' };
        }

        let normalizedWarehouseId = null;
        if (Number.isFinite(warehouseId) && warehouseId > 0) {
            const warehouse = getWarehouseByIdStmt.get(warehouseId);
            if (!warehouse) {
                return { success: false, error: 'المخزن غير موجود.' };
            }
            normalizedWarehouseId = warehouse.id;
        }

        const currentStock = Number(nextItem.stock_quantity) || 0;
        const oldQty = Number(existing.quantity) || 0;

        if (Number(existing.item_id) === itemId) {
            const maxAllowed = currentStock + oldQty;
            if (quantity > maxAllowed) {
                return { success: false, error: `الصنف "${nextItem.name}": الكمية المطلوبة للتعديل (${quantity}) أكبر من المتاح (${maxAllowed}).` };
            }
        } else if (quantity > currentStock) {
            return { success: false, error: `الصنف "${nextItem.name}": الكمية المطلوبة (${quantity}) أكبر من المتاح (${currentStock}).` };
        }

        const costPrice = Number.isFinite(Number(payload.cost_price)) && Number(payload.cost_price) > 0
            ? Number(payload.cost_price)
            : (Number(nextItem.cost_price) || 0);
        const lossAmount = quantity * costPrice;

        const tx = db.transaction(() => {
            if (Number(existing.item_id) === itemId) {
                if (quantity > oldQty) {
                    decreaseStockStmt.run(quantity - oldQty, itemId);
                } else if (quantity < oldQty) {
                    increaseStockStmt.run(oldQty - quantity, itemId);
                }
            } else {
                increaseStockStmt.run(oldQty, Number(existing.item_id));
                decreaseStockStmt.run(quantity, itemId);
            }

            updateDamagedStockStmt.run({
                id,
                item_id: itemId,
                warehouse_id: normalizedWarehouseId,
                quantity,
                reason,
                batch_no: batchNo,
                expiry_date: expiryDate,
                notes,
                damaged_date: damagedDate,
                cost_price: costPrice,
                loss_amount: lossAmount
            });
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete damaged stock entry (admin only + restore quantity)
    ipcMain.handle('delete-damaged-stock-entry', (event, id) => {
        const denied = requirePermission('inventory', 'delete');
        if (denied) return denied;

        const normalizedId = Number(id);
        if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
            return { success: false, error: 'معرف سجل التالف غير صالح.' };
        }

        const existing = getDamagedByIdStmt.get(normalizedId);
        if (!existing) {
            return { success: false, error: 'سجل التالف غير موجود.' };
        }

        const tx = db.transaction(() => {
            deleteDamagedByIdStmt.run(normalizedId);
            increaseStockStmt.run(Number(existing.quantity) || 0, Number(existing.item_id));
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Get item movements (stock changes from invoices)
    ipcMain.handle('get-item-movements', (event, itemId) => {
        try {
            // الحصول على معلومات الصنف مع اسم الوحدة
            const item = db.prepare(`
                SELECT i.*, u.name as unit_name 
                FROM items i 
                LEFT JOIN units u ON i.unit_id = u.id 
                WHERE i.id = ?
            `).get(itemId);
            if (!item) {
                return { success: false, error: 'الصنف غير موجود' };
            }

            // حركات المشتريات (وارد)
            const purchases = db.prepare(`
                SELECT 
                    pid.id,
                    pi.invoice_number,
                    pi.invoice_date as date,
                    c.name as party_name,
                    pid.quantity,
                    pid.cost_price as price,
                    pid.total_price,
                    'purchase' as type,
                    'وارد - مشتريات' as type_label
                FROM purchase_invoice_details pid
                JOIN purchase_invoices pi ON pid.invoice_id = pi.id
                LEFT JOIN customers c ON pi.supplier_id = c.id
                WHERE pid.item_id = ?
                ORDER BY pi.invoice_date DESC
            `).all(itemId);

            // حركات المبيعات (صادر)
            const sales = db.prepare(`
                SELECT 
                    sid.id,
                    si.invoice_number,
                    si.invoice_date as date,
                    c.name as party_name,
                    sid.quantity,
                    sid.sale_price as price,
                    sid.total_price,
                    'sale' as type,
                    'صادر - مبيعات' as type_label
                FROM sales_invoice_details sid
                JOIN sales_invoices si ON sid.invoice_id = si.id
                LEFT JOIN customers c ON si.customer_id = c.id
                WHERE sid.item_id = ?
                ORDER BY si.invoice_date DESC
            `).all(itemId);

            // حركات مرتجعات المبيعات (وارد)
            const salesReturns = db.prepare(`
                SELECT 
                    srd.id,
                    CAST(sr.id AS TEXT) as invoice_number,
                    sr.return_date as date,
                    c.name as party_name,
                    srd.quantity,
                    srd.price,
                    (srd.quantity * srd.price) as total_price,
                    'sales_return' as type,
                    'وارد - مرتجع مبيعات' as type_label
                FROM sales_return_details srd
                JOIN sales_returns sr ON srd.return_id = sr.id
                LEFT JOIN customers c ON sr.customer_id = c.id
                WHERE srd.item_id = ?
                ORDER BY sr.return_date DESC
            `).all(itemId);

            // حركات مرتجعات المشتريات (صادر)
            const purchaseReturns = db.prepare(`
                SELECT 
                    prd.id,
                    CAST(pr.id AS TEXT) as invoice_number,
                    pr.return_date as date,
                    c.name as party_name,
                    prd.quantity,
                    prd.price,
                    (prd.quantity * prd.price) as total_price,
                    'purchase_return' as type,
                    'صادر - مرتجع مشتريات' as type_label
                FROM purchase_return_details prd
                JOIN purchase_returns pr ON prd.return_id = pr.id
                LEFT JOIN customers c ON pr.supplier_id = c.id
                WHERE prd.item_id = ?
                ORDER BY pr.return_date DESC
            `).all(itemId);

            // حركات بضاعة أول المدة (رصيد افتتاحي)
            const openingBalances = db.prepare(`
                SELECT 
                    ob.id,
                    'رصيد افتتاحي' as invoice_number,
                    ob.created_at as date,
                    w.name as party_name,
                    ob.quantity,
                    ob.cost_price as price,
                    (ob.quantity * ob.cost_price) as total_price,
                    'opening' as type,
                    'وارد - رصيد افتتاحي' as type_label
                FROM opening_balances ob
                LEFT JOIN warehouses w ON ob.warehouse_id = w.id
                WHERE ob.item_id = ?
                ORDER BY ob.created_at DESC
            `).all(itemId);

            // حركات التالف (صادر)
            const damagedMovements = db.prepare(`
                SELECT
                    d.id,
                    ('تالف-' || CAST(d.id AS TEXT)) as invoice_number,
                    d.damaged_date as date,
                    d.reason as party_name,
                    d.quantity,
                    d.cost_price as price,
                    d.loss_amount as total_price,
                    'damaged' as type,
                    'صادر - تالف' as type_label
                FROM damaged_stock_logs d
                WHERE d.item_id = ?
                ORDER BY d.damaged_date DESC
            `).all(itemId);

            // دمج جميع الحركات وترتيبها بالتاريخ
            const allMovements = [...purchases, ...sales, ...salesReturns, ...purchaseReturns, ...openingBalances, ...damagedMovements]
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            // حساب الإحصائيات
            const totalPurchased = purchases.reduce((sum, p) => sum + p.quantity, 0);
            const totalSold = sales.reduce((sum, s) => sum + s.quantity, 0);
            const totalOpening = openingBalances.reduce((sum, o) => sum + o.quantity, 0);
            const totalDamaged = damagedMovements.reduce((sum, d) => sum + d.quantity, 0);

            return {
                success: true,
                item: item,
                movements: allMovements,
                stats: {
                    totalPurchased,
                    totalSold,
                    totalOpening,
                    totalDamaged,
                    currentStock: item.stock_quantity || 0,
                    purchaseCount: purchases.length,
                    salesCount: sales.length,
                    damagedCount: damagedMovements.length
                }
            };
        } catch (error) {
            console.error('Error getting item movements:', error);
            return { success: false, error: error.message };
        }
    });

    // Get item transactions with running balance
    ipcMain.handle('get-item-transactions', (event, payload) => {
        try {
        const { itemId, warehouseId, startDate, endDate } = payload;
        
        // Get opening balance for this item/warehouse
        let openingQuery = `
            SELECT COALESCE(SUM(quantity), 0) as opening_qty
            FROM opening_balances
            WHERE item_id = ?
        `;
        const openingParams = [itemId];
        if (warehouseId) {
            openingQuery += ' AND warehouse_id = ?';
            openingParams.push(warehouseId);
        }
        const openingRow = db.prepare(openingQuery).get(...openingParams);
        const openingQty = openingRow ? openingRow.opening_qty : 0;

        // purchases (in)
        let purchaseQuery = `
            SELECT 
                'purchase' as type,
                pi.invoice_date as date,
                pi.invoice_number as ref,
                pid.quantity as qty_in,
                0 as qty_out,
                pid.cost_price as price,
                c.name as party
            FROM purchase_invoice_details pid
            JOIN purchase_invoices pi ON pid.invoice_id = pi.id
            LEFT JOIN customers c ON pi.supplier_id = c.id
            WHERE pid.item_id = ?
        `;
        const purchaseParams = [itemId];
        if (startDate) { purchaseQuery += ' AND pi.invoice_date >= ?'; purchaseParams.push(startDate); }
        if (endDate) { purchaseQuery += ' AND pi.invoice_date <= ?'; purchaseParams.push(endDate); }

        // sales (out)
        let salesQuery = `
            SELECT 
                'sale' as type,
                si.invoice_date as date,
                si.invoice_number as ref,
                0 as qty_in,
                sid.quantity as qty_out,
                sid.sale_price as price,
                c.name as party
            FROM sales_invoice_details sid
            JOIN sales_invoices si ON sid.invoice_id = si.id
            LEFT JOIN customers c ON si.customer_id = c.id
            WHERE sid.item_id = ?
        `;
        const salesParams = [itemId];
        if (startDate) { salesQuery += ' AND si.invoice_date >= ?'; salesParams.push(startDate); }
        if (endDate) { salesQuery += ' AND si.invoice_date <= ?'; salesParams.push(endDate); }

        // sales returns (in)
        let srQuery = `
            SELECT 
                'sales_return' as type,
                sr.return_date as date,
                CAST(sr.id AS TEXT) as ref,
                srd.quantity as qty_in,
                0 as qty_out,
                srd.price as price,
                c.name as party
            FROM sales_return_details srd
            JOIN sales_returns sr ON srd.return_id = sr.id
            LEFT JOIN customers c ON sr.customer_id = c.id
            WHERE srd.item_id = ?
        `;
        const srParams = [itemId];
        if (startDate) { srQuery += ' AND sr.return_date >= ?'; srParams.push(startDate); }
        if (endDate) { srQuery += ' AND sr.return_date <= ?'; srParams.push(endDate); }

        // purchase returns (out)
        let prQuery = `
            SELECT 
                'purchase_return' as type,
                pr.return_date as date,
                CAST(pr.id AS TEXT) as ref,
                0 as qty_in,
                prd.quantity as qty_out,
                prd.price as price,
                c.name as party
            FROM purchase_return_details prd
            JOIN purchase_returns pr ON prd.return_id = pr.id
            LEFT JOIN customers c ON pr.supplier_id = c.id
            WHERE prd.item_id = ?
        `;
        const prParams = [itemId];
        if (startDate) { prQuery += ' AND pr.return_date >= ?'; prParams.push(startDate); }
        if (endDate) { prQuery += ' AND pr.return_date <= ?'; prParams.push(endDate); }

        // damaged stock (out)
        let damagedQuery = `
            SELECT
                'damaged' as type,
                d.damaged_date as date,
                ('DAM-' || CAST(d.id AS TEXT)) as ref,
                0 as qty_in,
                d.quantity as qty_out,
                d.cost_price as price,
                d.reason as party
            FROM damaged_stock_logs d
            WHERE d.item_id = ?
        `;
        const damagedParams = [itemId];
        if (startDate) { damagedQuery += ' AND d.damaged_date >= ?'; damagedParams.push(startDate); }
        if (endDate) { damagedQuery += ' AND d.damaged_date <= ?'; damagedParams.push(endDate); }

        const purchases = db.prepare(purchaseQuery).all(...purchaseParams);
        const sales = db.prepare(salesQuery).all(...salesParams);
        const salesReturns = db.prepare(srQuery).all(...srParams);
        const purchaseReturns = db.prepare(prQuery).all(...prParams);
        const damaged = db.prepare(damagedQuery).all(...damagedParams);

        const allTx = [...purchases, ...sales, ...salesReturns, ...purchaseReturns, ...damaged]
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        let balance = openingQty;
        for (const tx of allTx) {
            balance = balance + tx.qty_in - tx.qty_out;
            tx.balance = balance;
        }

        return { openingQty, transactions: allTx };
        } catch (error) {
            console.error('[get-item-transactions] Error:', error);
            return { openingQty: 0, transactions: [] };
        }
    });
}

module.exports = { register };
