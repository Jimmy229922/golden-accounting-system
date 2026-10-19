const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const DEFAULT_PAGE_SIZE = 50;

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getNextShipmentNumber() {
    const row = db.prepare(`
        SELECT shipment_number
        FROM external_work_shipments
        WHERE shipment_number GLOB 'EXT-[0-9]*'
        ORDER BY CAST(SUBSTR(shipment_number, 5) AS INTEGER) DESC
        LIMIT 1
    `).get();

    const lastNumber = row ? Number(String(row.shipment_number).slice(4)) : 0;
    return `EXT-${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, '0')}`;
}

function normalizeDate(value) {
    const text = String(value || '').trim();
    return text || new Date().toISOString().slice(0, 10);
}

function normalizePayload(data = {}) {
    const advanceAmountUsd = roundMoney(data.advance_amount_usd);
    const advanceRate = roundMoney(data.advance_rate);
    const advanceAmountEgp = roundMoney(advanceAmountUsd * advanceRate);

    const finalAmountUsd = roundMoney(data.final_amount_usd);
    const finalRate = roundMoney(data.final_rate);
    const finalAmountEgp = roundMoney(finalAmountUsd * finalRate);

    const totalAmountUsd = roundMoney(advanceAmountUsd + finalAmountUsd);
    const totalAmountEgp = roundMoney(advanceAmountEgp + finalAmountEgp);

    const shippingExpensesEgp = roundMoney(data.shipping_expenses_egp);
    const bankCommissionEgp = roundMoney(data.bank_commission_egp);

    const purchaseCostEgp = roundMoney(advanceAmountEgp + finalAmountEgp + bankCommissionEgp + shippingExpensesEgp);

    const quantityTons = Number(data.quantity_tons) || 0;
    const costPerTonEgp = quantityTons > 0 ? roundMoney(purchaseCostEgp / quantityTons) : 0;

    const totalCostsEgp = purchaseCostEgp;
    const netProfitEgp = roundMoney(totalAmountEgp - totalCostsEgp);

    return {
        shipment_number: String(data.shipment_number || '').trim() || getNextShipmentNumber(),
        shipment_date: normalizeDate(data.shipment_date),
        client_name: String(data.client_name || '').trim(),
        item_description: String(data.item_description || '').trim(),
        swift_reference: String(data.swift_reference || '').trim(),
        advance_amount_usd: advanceAmountUsd,
        advance_rate: advanceRate,
        advance_amount_egp: advanceAmountEgp,
        final_amount_usd: finalAmountUsd,
        final_rate: finalRate,
        final_amount_egp: finalAmountEgp,
        total_amount_usd: totalAmountUsd,
        total_amount_egp: totalAmountEgp,
        shipping_expenses_egp: shippingExpensesEgp,
        bank_commission_egp: bankCommissionEgp,
        purchase_cost_egp: purchaseCostEgp,
        agent_commission_egp: 0,
        quantity_tons: quantityTons,
        cost_per_ton_egp: costPerTonEgp,
        total_costs_egp: totalCostsEgp,
        net_profit_egp: netProfitEgp,
        statement: String(data.statement || '').trim(),
        notes: String(data.notes || '').trim()
    };
}

function validatePayload(payload, currentId = null) {
    if (!payload.shipment_number) {
        return 'يرجى إدخال رقم الشحنة';
    }

    const checkSql = currentId
        ? 'SELECT id FROM external_work_shipments WHERE shipment_number = ? AND id != ? LIMIT 1'
        : 'SELECT id FROM external_work_shipments WHERE shipment_number = ? LIMIT 1';
    const params = currentId ? [payload.shipment_number, currentId] : [payload.shipment_number];
    const existing = db.prepare(checkSql).get(...params);
    if (existing) {
        return 'رقم الشحنة مسجل مسبقاً، يرجى استخدام رقم آخر';
    }

    return null;
}

function register() {
    ipcMain.handle('get-next-external-work-shipment-number', () => {
        try {
            return { success: true, shipmentNumber: getNextShipmentNumber() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-external-work-shipments', (event, params = {}) => {
        try {
            const pageSize = Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE);
            const page = Math.max(1, Number(params.page) || 1);
            const offset = (page - 1) * pageSize;

            const conditions = [];
            const args = {};

            if (params.startDate) {
                conditions.push('shipment_date >= @startDate');
                args.startDate = params.startDate;
            }

            if (params.endDate) {
                conditions.push('shipment_date <= @endDate');
                args.endDate = params.endDate;
            }

            if (params.search) {
                conditions.push(`(
                    shipment_number LIKE @search
                    OR client_name LIKE @search
                    OR item_description LIKE @search
                    OR swift_reference LIKE @search
                    OR statement LIKE @search
                    OR notes LIKE @search
                )`);
                args.search = `%${String(params.search).trim()}%`;
            }

            const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

            const total = db.prepare(`SELECT COUNT(*) as count FROM external_work_shipments ${whereSql}`).get(args).count || 0;
            const statsRow = db.prepare(`
                SELECT 
                    COALESCE(SUM(total_amount_usd), 0) as totalSalesUsd,
                    COALESCE(SUM(total_amount_egp), 0) as totalSalesEgp,
                    COALESCE(SUM(purchase_cost_egp), 0) as totalPurchasesEgp,
                    COALESCE(SUM(shipping_expenses_egp), 0) as totalShippingEgp,
                    COALESCE(SUM(bank_commission_egp), 0) as totalBankFeesEgp,
                    COALESCE(SUM(quantity_tons), 0) as totalQuantityTons,
                    COALESCE(SUM(total_costs_egp), 0) as totalCostsEgp,
                    COALESCE(SUM(net_profit_egp), 0) as totalNetProfitEgp
                FROM external_work_shipments 
                ${whereSql}
            `).get(args) || {};

            const shipments = db.prepare(`
                SELECT 
                    s.*,
                    COALESCE(sales.sold_tons, 0) AS sold_tons,
                    ROUND(MAX(0, s.quantity_tons - COALESCE(sales.sold_tons, 0)), 3) AS remaining_tons,
                    COALESCE(sales.sales_count, 0) AS sales_count,
                    COALESCE(sales.total_sales_amount_egp, 0) AS total_sales_amount_egp,
                    COALESCE(sales.total_sales_cost_egp, 0) AS total_sales_cost_egp,
                    COALESCE(sales.total_sales_profit_egp, 0) AS total_sales_profit_egp
                FROM external_work_shipments s
                LEFT JOIN (
                    SELECT 
                        shipment_id,
                        COUNT(id) AS sales_count,
                        SUM(quantity_tons) AS sold_tons,
                        SUM(total_amount_egp) AS total_sales_amount_egp,
                        SUM(total_cost_egp) AS total_sales_cost_egp,
                        SUM(net_profit_egp) AS total_sales_profit_egp
                    FROM external_work_sales
                    GROUP BY shipment_id
                ) sales ON sales.shipment_id = s.id
                ${whereSql ? whereSql.replace(/\b(shipment_date|shipment_number|client_name|item_description|swift_reference|statement|notes)\b/g, 's.$1') : ''}
                ORDER BY s.shipment_date DESC, s.id DESC
                LIMIT @pageSize OFFSET @offset
            `).all({ ...args, pageSize, offset });

            const totalQty = Number(statsRow.totalQuantityTons) || 0;
            const avgCostPerTon = totalQty > 0 ? roundMoney(Number(statsRow.totalPurchasesEgp) / totalQty) : 0;

            const totalSoldRow = db.prepare(`
                SELECT COALESCE(SUM(sa.quantity_tons), 0) AS totalSoldTons
                FROM external_work_sales sa
                INNER JOIN external_work_shipments s ON s.id = sa.shipment_id
                ${whereSql ? whereSql.replace(/\b(shipment_date|shipment_number|client_name|item_description|swift_reference|statement|notes)\b/g, 's.$1') : ''}
            `).get(args) || {};
            const totalSoldTons = roundMoney(totalSoldRow.totalSoldTons);
            const totalRemainingTons = Math.max(0, roundMoney(totalQty - totalSoldTons));

            return {
                success: true,
                shipments,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize) || 1,
                stats: {
                    totalShipments: total,
                    totalSalesUsd: roundMoney(statsRow.totalSalesUsd),
                    totalSalesEgp: roundMoney(statsRow.totalSalesEgp),
                    totalPurchasesEgp: roundMoney(statsRow.totalPurchasesEgp),
                    totalShippingEgp: roundMoney(statsRow.totalShippingEgp),
                    totalBankFeesEgp: roundMoney(statsRow.totalBankFeesEgp),
                    totalQuantityTons: roundMoney(totalQty),
                    totalSoldTons: totalSoldTons,
                    totalRemainingTons: totalRemainingTons,
                    avgCostPerTon: avgCostPerTon,
                    totalCostsEgp: roundMoney(statsRow.totalCostsEgp),
                    totalNetProfitEgp: roundMoney(statsRow.totalNetProfitEgp)
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-external-work-shipment-by-id', (event, id) => {
        try {
            const shipment = db.prepare('SELECT * FROM external_work_shipments WHERE id = ?').get(id);
            if (!shipment) {
                return { success: false, error: 'لم يتم العثور على الشحنة' };
            }
            return { success: true, shipment };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-external-work-shipment', (event, data = {}) => {
        try {
            const payload = normalizePayload(data);
            const validationError = validatePayload(payload);
            if (validationError) {
                return { success: false, error: validationError };
            }

            const info = db.prepare(`
                INSERT INTO external_work_shipments (
                    shipment_number, shipment_date, client_name, item_description, swift_reference,
                    advance_amount_usd, advance_rate, advance_amount_egp,
                    final_amount_usd, final_rate, final_amount_egp,
                    total_amount_usd, total_amount_egp,
                    shipping_expenses_egp, bank_commission_egp, purchase_cost_egp, agent_commission_egp,
                    quantity_tons, cost_per_ton_egp,
                    total_costs_egp, net_profit_egp,
                    statement, notes
                ) VALUES (
                    @shipment_number, @shipment_date, @client_name, @item_description, @swift_reference,
                    @advance_amount_usd, @advance_rate, @advance_amount_egp,
                    @final_amount_usd, @final_rate, @final_amount_egp,
                    @total_amount_usd, @total_amount_egp,
                    @shipping_expenses_egp, @bank_commission_egp, @purchase_cost_egp, @agent_commission_egp,
                    @quantity_tons, @cost_per_ton_egp,
                    @total_costs_egp, @net_profit_egp,
                    @statement, @notes
                )
            `).run(payload);

            return { success: true, id: info.lastInsertRowid, shipment_number: payload.shipment_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-external-work-shipment', (event, data = {}) => {
        try {
            const id = Number(data.id);
            if (!id) {
                return { success: false, error: 'معرّف الشحنة غير صحيح' };
            }

            const existing = db.prepare('SELECT * FROM external_work_shipments WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على الشحنة للتعديل' };
            }

            const payload = normalizePayload({
                ...existing,
                ...data,
                shipment_number: data.shipment_number || existing.shipment_number
            });

            const validationError = validatePayload(payload, id);
            if (validationError) {
                return { success: false, error: validationError };
            }

            db.prepare(`
                UPDATE external_work_shipments SET
                    shipment_number = @shipment_number,
                    shipment_date = @shipment_date,
                    client_name = @client_name,
                    item_description = @item_description,
                    swift_reference = @swift_reference,
                    advance_amount_usd = @advance_amount_usd,
                    advance_rate = @advance_rate,
                    advance_amount_egp = @advance_amount_egp,
                    final_amount_usd = @final_amount_usd,
                    final_rate = @final_rate,
                    final_amount_egp = @final_amount_egp,
                    total_amount_usd = @total_amount_usd,
                    total_amount_egp = @total_amount_egp,
                    shipping_expenses_egp = @shipping_expenses_egp,
                    bank_commission_egp = @bank_commission_egp,
                    purchase_cost_egp = @purchase_cost_egp,
                    agent_commission_egp = @agent_commission_egp,
                    quantity_tons = @quantity_tons,
                    cost_per_ton_egp = @cost_per_ton_egp,
                    total_costs_egp = @total_costs_egp,
                    net_profit_egp = @net_profit_egp,
                    statement = @statement,
                    notes = @notes,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @id
            `).run({ ...payload, id });

            return { success: true, id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-external-work-shipment', (event, id) => {
        try {
            const shipmentId = Number(id);
            if (!shipmentId) {
                return { success: false, error: 'معرّف الشحنة غير صحيح' };
            }

            const existing = db.prepare('SELECT id FROM external_work_shipments WHERE id = ?').get(shipmentId);
            if (!existing) {
                return { success: false, error: 'لم يتم العثور على الشحنة للحذف' };
            }

            const linkedSales = db.prepare('SELECT COUNT(*) as count FROM external_work_sales WHERE shipment_id = ?').get(shipmentId);
            if (linkedSales && linkedSales.count > 0) {
                return {
                    success: false,
                    error: `لا يمكن حذف الشحنة لوجود ${linkedSales.count} إذن بيع مرتبط بها، يرجى حذف أذونات البيع أولاً`
                };
            }

            db.prepare('DELETE FROM external_work_shipments WHERE id = ?').run(shipmentId);
            return { success: true, id: shipmentId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-external-work-shipment-profitability', (event, id) => {
        try {
            const shipmentId = Number(id);
            if (!shipmentId) {
                return { success: false, error: 'معرّف الشحنة غير صحيح' };
            }

            const shipment = db.prepare('SELECT * FROM external_work_shipments WHERE id = ?').get(shipmentId);
            if (!shipment) {
                return { success: false, error: 'لم يتم العثور على الشحنة' };
            }

            const sales = db.prepare('SELECT * FROM external_work_sales WHERE shipment_id = ? ORDER BY sale_date DESC, id DESC').all(shipmentId);

            const totalSoldTons = roundMoney(sales.reduce((sum, s) => sum + (Number(s.quantity_tons) || 0), 0));
            const totalSalesAmountEgp = roundMoney(sales.reduce((sum, s) => sum + (Number(s.total_amount_egp) || 0), 0));
            const totalSalesCostEgp = roundMoney(sales.reduce((sum, s) => sum + (Number(s.total_cost_egp) || 0), 0));
            const totalProfitEgp = roundMoney(sales.reduce((sum, s) => sum + (Number(s.net_profit_egp) || 0), 0));
            const remainingTons = Math.max(0, roundMoney((Number(shipment.quantity_tons) || 0) - totalSoldTons));
            const remainingCostEgp = roundMoney(remainingTons * (Number(shipment.cost_per_ton_egp) || 0));
            const soldPercentage = shipment.quantity_tons > 0 ? Math.min(100, Math.round((totalSoldTons / shipment.quantity_tons) * 1000) / 10) : 0;

            return {
                success: true,
                shipment,
                sales,
                summary: {
                    totalPurchasedTons: Number(shipment.quantity_tons) || 0,
                    totalSoldTons,
                    remainingTons,
                    soldPercentage,
                    purchaseCostEgp: Number(shipment.purchase_cost_egp) || 0,
                    costPerTonEgp: Number(shipment.cost_per_ton_egp) || 0,
                    totalSalesAmountEgp,
                    totalSalesCostEgp,
                    totalProfitEgp,
                    remainingCostEgp,
                    salesCount: sales.length
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-external-work-shipments-pdf', async (event, payload = {}) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) {
                return { success: false, error: 'No active window found' };
            }

            const date = new Date().toISOString().slice(0, 10);
            const defaultName = String(payload.defaultName || `External_Work_Shipments_${date}.pdf`).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const defaultPath = path.join(app.getPath('documents'), defaultName);
            const { canceled, filePath } = await dialog.showSaveDialog(win, {
                title: 'حفظ تقرير شغل خارجي PDF',
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
