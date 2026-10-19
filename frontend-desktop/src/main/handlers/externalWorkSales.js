const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const DEFAULT_PAGE_SIZE = 50;

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getNextSaleNumber() {
    const row = db.prepare(`
        SELECT sale_number
        FROM external_work_sales
        WHERE sale_number GLOB 'EXS-[0-9]*'
        ORDER BY CAST(SUBSTR(sale_number, 5) AS INTEGER) DESC
        LIMIT 1
    `).get();

    const lastNumber = row ? Number(String(row.sale_number).slice(4)) : 0;
    return `EXS-${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, '0')}`;
}

function normalizeDate(value) {
    const text = String(value || '').trim();
    return text || new Date().toISOString().slice(0, 10);
}

function getAvailableShipmentInfo(shipmentId, excludeSaleId = null) {
    const shipment = db.prepare('SELECT * FROM external_work_shipments WHERE id = ?').get(shipmentId);
    if (!shipment) return null;

    const soldRow = db.prepare(`
        SELECT COALESCE(SUM(quantity_tons), 0) AS sold_tons
        FROM external_work_sales
        WHERE shipment_id = ? ${excludeSaleId ? 'AND id != ?' : ''}
    `).get(...(excludeSaleId ? [shipmentId, excludeSaleId] : [shipmentId]));

    const soldTons = Number(soldRow?.sold_tons) || 0;
    const totalTons = Number(shipment.quantity_tons) || 0;
    const remainingTons = Math.max(0, Math.round((totalTons - soldTons + Number.EPSILON) * 1000) / 1000);

    return {
        ...shipment,
        sold_tons: soldTons,
        remaining_tons: remainingTons
    };
}

function normalizePayload(data = {}, currentId = null) {
    const shipmentId = Number(data.shipment_id) || 0;
    const shipment = shipmentId ? db.prepare('SELECT * FROM external_work_shipments WHERE id = ?').get(shipmentId) : null;

    const quantityTons = Number(data.quantity_tons) || 0;
    const unitPriceEgp = roundMoney(data.unit_price_egp);
    const totalAmountEgp = roundMoney(quantityTons * unitPriceEgp);

    const costPerTonEgp = shipment ? roundMoney(shipment.cost_per_ton_egp) : roundMoney(data.cost_per_ton_egp);
    const totalCostEgp = roundMoney(quantityTons * costPerTonEgp);
    const netProfitEgp = roundMoney(totalAmountEgp - totalCostEgp);

    return {
        sale_number: String(data.sale_number || '').trim() || getNextSaleNumber(),
        sale_date: normalizeDate(data.sale_date),
        customer_name: String(data.customer_name || '').trim(),
        shipment_id: shipmentId,
        shipment_number: shipment ? shipment.shipment_number : String(data.shipment_number || '').trim(),
        item_description: shipment ? shipment.item_description : String(data.item_description || '').trim(),
        quantity_tons: quantityTons,
        unit_price_egp: unitPriceEgp,
        total_amount_egp: totalAmountEgp,
        cost_per_ton_egp: costPerTonEgp,
        total_cost_egp: totalCostEgp,
        net_profit_egp: netProfitEgp,
        statement: String(data.statement || '').trim(),
        notes: String(data.notes || '').trim()
    };
}

function validatePayload(payload, currentId = null) {
    if (!payload.sale_number) {
        return 'يرجى إدخال رقم إذن البيع / الفاتورة';
    }

    if (!payload.customer_name) {
        return 'يرجى إدخال اسم العميل / المشتري';
    }

    if (!payload.shipment_id) {
        return 'يرجى اختيار شحنة المشتريات المرتبطة';
    }

    if (payload.quantity_tons <= 0) {
        return 'يرجى إدخال كمية صحيحة بالطن (أكبر من صفر)';
    }

    if (payload.unit_price_egp <= 0) {
        return 'يرجى إدخال سعر بيع صحيح للطن (أكبر من صفر)';
    }

    const shipmentInfo = getAvailableShipmentInfo(payload.shipment_id, currentId);
    if (!shipmentInfo) {
        return 'شحنة المشتريات المحددة غير موجودة';
    }

    if (payload.quantity_tons > (shipmentInfo.remaining_tons + 0.0001)) {
        return `الكمية المطلوبة (${payload.quantity_tons} طن) تتجاوز الكمية المتاحة في الشحنة (${shipmentInfo.remaining_tons} طن)`;
    }

    const checkSql = currentId
        ? 'SELECT id FROM external_work_sales WHERE sale_number = ? AND id != ? LIMIT 1'
        : 'SELECT id FROM external_work_sales WHERE sale_number = ? LIMIT 1';
    const params = currentId ? [payload.sale_number, currentId] : [payload.sale_number];
    const existing = db.prepare(checkSql).get(...params);
    if (existing) {
        return 'رقم إذن البيع مسجل مسبقاً، يرجى استخدام رقم آخر';
    }

    return null;
}

function register() {
    ipcMain.handle('get-next-external-work-sale-number', () => {
        try {
            return { success: true, saleNumber: getNextSaleNumber() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-external-work-available-shipments', (event, params = {}) => {
        try {
            const excludeSaleId = params && params.excludeSaleId ? Number(params.excludeSaleId) : null;
            const shipments = db.prepare(`
                SELECT 
                    s.id,
                    s.shipment_number,
                    s.shipment_date,
                    s.item_description,
                    s.quantity_tons,
                    s.cost_per_ton_egp,
                    s.purchase_cost_egp,
                    COALESCE(SUM(sa.quantity_tons), 0) AS sold_tons
                FROM external_work_shipments s
                LEFT JOIN external_work_sales sa ON sa.shipment_id = s.id ${excludeSaleId ? 'AND sa.id != ?' : ''}
                GROUP BY s.id
                ORDER BY s.id DESC
            `).all(...(excludeSaleId ? [excludeSaleId] : []));

            const list = shipments.map((s) => {
                const total = Number(s.quantity_tons) || 0;
                const sold = Number(s.sold_tons) || 0;
                const remaining = Math.max(0, Math.round((total - sold + Number.EPSILON) * 1000) / 1000);
                return {
                    id: s.id,
                    shipment_number: s.shipment_number,
                    shipment_date: s.shipment_date,
                    item_description: s.item_description,
                    quantity_tons: total,
                    cost_per_ton_egp: Number(s.cost_per_ton_egp) || 0,
                    purchase_cost_egp: Number(s.purchase_cost_egp) || 0,
                    sold_tons: sold,
                    remaining_tons: remaining
                };
            });

            return { success: true, shipments: list };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-external-work-sales', (event, params = {}) => {
        try {
            const pageSize = Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE);
            const page = Math.max(1, Number(params.page) || 1);
            const offset = (page - 1) * pageSize;

            const whereConditions = [];
            const args = {};

            if (params.search && String(params.search).trim()) {
                const term = `%${String(params.search).trim()}%`;
                whereConditions.push(`(
                    sale_number LIKE @term
                    OR customer_name LIKE @term
                    OR shipment_number LIKE @term
                    OR item_description LIKE @term
                    OR statement LIKE @term
                    OR notes LIKE @term
                )`);
                args.term = term;
            }

            if (params.startDate) {
                whereConditions.push('sale_date >= @startDate');
                args.startDate = params.startDate;
            }

            if (params.endDate) {
                whereConditions.push('sale_date <= @endDate');
                args.endDate = params.endDate;
            }

            if (params.shipmentId) {
                whereConditions.push('shipment_id = @shipmentId');
                args.shipmentId = Number(params.shipmentId);
            }

            const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as count FROM external_work_sales ${whereSql}`).get(args).count || 0;

            const sales = db.prepare(`
                SELECT *
                FROM external_work_sales
                ${whereSql}
                ORDER BY sale_date DESC, id DESC
                LIMIT @pageSize OFFSET @offset
            `).all({ ...args, pageSize, offset });

            const statsRow = db.prepare(`
                SELECT
                    COUNT(*) as totalSalesCount,
                    COALESCE(SUM(quantity_tons), 0) as totalSoldTons,
                    COALESCE(SUM(total_amount_egp), 0) as totalSalesAmountEgp,
                    COALESCE(SUM(total_cost_egp), 0) as totalCostEgp,
                    COALESCE(SUM(net_profit_egp), 0) as totalNetProfitEgp
                FROM external_work_sales
                ${whereSql}
            `).get(args);

            const totalSoldTons = Number(statsRow.totalSoldTons) || 0;
            const totalSalesAmount = Number(statsRow.totalSalesAmountEgp) || 0;
            const avgSalePricePerTon = totalSoldTons > 0 ? roundMoney(totalSalesAmount / totalSoldTons) : 0;

            const stats = {
                totalSalesCount: Number(statsRow.totalSalesCount) || 0,
                totalSoldTons: totalSoldTons,
                totalSalesAmountEgp: totalSalesAmount,
                totalCostEgp: Number(statsRow.totalCostEgp) || 0,
                totalNetProfitEgp: Number(statsRow.totalNetProfitEgp) || 0,
                avgSalePricePerTon: avgSalePricePerTon
            };

            return {
                success: true,
                sales,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize) || 1,
                stats
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-external-work-sale-by-id', (event, id) => {
        try {
            const sale = db.prepare('SELECT * FROM external_work_sales WHERE id = ?').get(id);
            if (!sale) {
                return { success: false, error: 'لم يتم العثور على إذن البيع' };
            }
            return { success: true, sale };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-external-work-sale', (event, data = {}) => {
        try {
            const payload = normalizePayload(data);
            const validationError = validatePayload(payload);
            if (validationError) {
                return { success: false, error: validationError };
            }

            const info = db.prepare(`
                INSERT INTO external_work_sales (
                    sale_number, sale_date, customer_name,
                    shipment_id, shipment_number, item_description,
                    quantity_tons, unit_price_egp, total_amount_egp,
                    cost_per_ton_egp, total_cost_egp, net_profit_egp,
                    statement, notes
                ) VALUES (
                    @sale_number, @sale_date, @customer_name,
                    @shipment_id, @shipment_number, @item_description,
                    @quantity_tons, @unit_price_egp, @total_amount_egp,
                    @cost_per_ton_egp, @total_cost_egp, @net_profit_egp,
                    @statement, @notes
                )
            `).run(payload);

            return { success: true, id: info.lastInsertRowid, sale_number: payload.sale_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-external-work-sale', (event, data = {}) => {
        try {
            const id = Number(data.id);
            if (!id) {
                return { success: false, error: 'معرّف البيع غير صحيح' };
            }

            const existing = db.prepare('SELECT * FROM external_work_sales WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على إذن البيع للتعديل' };
            }

            const payload = normalizePayload({
                ...existing,
                ...data,
                sale_number: data.sale_number || existing.sale_number
            }, id);

            const validationError = validatePayload(payload, id);
            if (validationError) {
                return { success: false, error: validationError };
            }

            db.prepare(`
                UPDATE external_work_sales SET
                    sale_number = @sale_number,
                    sale_date = @sale_date,
                    customer_name = @customer_name,
                    shipment_id = @shipment_id,
                    shipment_number = @shipment_number,
                    item_description = @item_description,
                    quantity_tons = @quantity_tons,
                    unit_price_egp = @unit_price_egp,
                    total_amount_egp = @total_amount_egp,
                    cost_per_ton_egp = @cost_per_ton_egp,
                    total_cost_egp = @total_cost_egp,
                    net_profit_egp = @net_profit_egp,
                    statement = @statement,
                    notes = @notes,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @id
            `).run({ ...payload, id });

            return { success: true, id, sale_number: payload.sale_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-external-work-sale', (event, id) => {
        try {
            const saleId = Number(id);
            if (!saleId) {
                return { success: false, error: 'معرّف البيع غير صحيح' };
            }

            const existing = db.prepare('SELECT id FROM external_work_sales WHERE id = ?').get(saleId);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على إذن البيع المراد حذفه' };
            }

            db.prepare('DELETE FROM external_work_sales WHERE id = ?').run(saleId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-external-work-sales-pdf', async (event, options = {}) => {
        try {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (!focusedWindow) {
                return { success: false, error: 'النافذة غير نشطة للطباعة' };
            }

            const defaultFileName = options.defaultName || `External_Work_Sales_${new Date().toISOString().slice(0, 10)}.pdf`;
            const { canceled, filePath } = await dialog.showSaveDialog(focusedWindow, {
                title: 'تصدير كشف مبيعات الشغل الخارجي إلى PDF',
                defaultPath: path.join(app.getPath('documents'), defaultFileName),
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
            });

            if (canceled || !filePath) {
                return { success: false, canceled: true };
            }

            const pdfData = await focusedWindow.webContents.printToPDF({
                printBackground: true,
                landscape: true,
                pageSize: 'A4',
                margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
            });

            await fs.promises.writeFile(filePath, pdfData);
            return { success: true, filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
