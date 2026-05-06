const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

const CUSTOMER_COLLECTION_PENDING_RELATED_TYPE = 'customer_collection_pending';
const CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE = 'customer_collection_shift_close';

function register() {
    // --- Settings Handlers ---
    ipcMain.handle('get-settings', () => {
        try {
            const rows = db.prepare('SELECT * FROM settings').all();
            const settings = {};
            rows.forEach(row => {
                settings[row.key] = row.value;
            });
            return settings;
        } catch (error) {
            console.error('[get-settings] Error:', error);
            return {};
        }
    });

    ipcMain.handle('save-settings', (event, settings) => {
        const denied = requirePermission('settings', 'edit');
        if (denied) return denied;
        try {
            const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
            const transaction = db.transaction((data) => {
                for (const [key, value] of Object.entries(data)) {
                    stmt.run({ key, value });
                }
            });
            transaction(settings);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- Dashboard Handlers ---
    ipcMain.handle('get-dashboard-stats', (event, filters = {}) => {
        try {
            const now = new Date();
            const today = now.toISOString().slice(0, 10);
            const thisMonth = today.slice(0, 7);
            const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);
            const startDate = filters && filters.startDate ? String(filters.startDate) : '';
            const endDate = filters && filters.endDate ? String(filters.endDate) : '';

            function formatDateOnly(date) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            function buildRangeClause(column, start, end) {
                let clause = '';
                const params = [];
                if (start) {
                    clause += ` AND ${column} >= ?`;
                    params.push(start);
                }
                if (end) {
                    clause += ` AND ${column} <= ?`;
                    params.push(end);
                }
                return { clause, params };
            }

            const invoiceRange = buildRangeClause('invoice_date', startDate, endDate);
            const returnRange = buildRangeClause('return_date', startDate, endDate);
            const salesInvoiceRange = buildRangeClause('si.invoice_date', startDate, endDate);
            const salesReturnRange = buildRangeClause('sr.return_date', startDate, endDate);

            // --- Basic counts ---
            const customersCount = db.prepare("SELECT COUNT(*) as count FROM customers WHERE type IN ('customer', 'both')").get().count;
            const suppliersCount = db.prepare("SELECT COUNT(*) as count FROM customers WHERE type IN ('supplier', 'both')").get().count;
            const itemsCount = db.prepare("SELECT COUNT(*) as count FROM items WHERE is_deleted = 0").get().count;
            const stockValue = db.prepare("SELECT COALESCE(SUM(cost_price * stock_quantity), 0) as total FROM items WHERE is_deleted = 0").get().total;

            // --- Sales & Purchases ---
            const salesTotalToday = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_invoices WHERE invoice_date = ?").get(today).total;
            const salesReturnsTotalToday = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_returns WHERE return_date = ?").get(today).total;
            const salesToday = Math.max(0, salesTotalToday - salesReturnsTotalToday);

            const salesTotalMonth = db.prepare(`
                SELECT COALESCE(SUM(total_amount), 0) as total
                FROM sales_invoices WHERE 1=1${invoiceRange.clause}
            `).get(...invoiceRange.params).total;
            const salesReturnsTotalMonth = db.prepare(`
                SELECT COALESCE(SUM(total_amount), 0) as total
                FROM sales_returns WHERE 1=1${returnRange.clause}
            `).get(...returnRange.params).total;
            const salesMonth = Math.max(0, salesTotalMonth - salesReturnsTotalMonth);

            const purchasesTotalToday = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_invoices WHERE invoice_date = ?").get(today).total;
            const purchaseReturnsTotalToday = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_returns WHERE return_date = ?").get(today).total;
            const purchasesToday = Math.max(0, purchasesTotalToday - purchaseReturnsTotalToday);

            const purchasesTotalMonth = db.prepare(`
                SELECT COALESCE(SUM(total_amount), 0) as total
                FROM purchase_invoices WHERE 1=1${invoiceRange.clause}
            `).get(...invoiceRange.params).total;
            const purchaseReturnsTotalMonth = db.prepare(`
                SELECT COALESCE(SUM(total_amount), 0) as total
                FROM purchase_returns WHERE 1=1${returnRange.clause}
            `).get(...returnRange.params).total;
            const purchasesMonth = Math.max(0, purchasesTotalMonth - purchaseReturnsTotalMonth);

            // --- Net profit (sales revenue - COGS this month) ---
            const cogsMonthSales = db.prepare(`
                SELECT COALESCE(SUM(sid.quantity * i.cost_price), 0) as total
                FROM sales_invoice_details sid
                JOIN sales_invoices si ON sid.invoice_id = si.id
                JOIN items i ON sid.item_id = i.id
                WHERE 1=1${salesInvoiceRange.clause}
            `).get(...salesInvoiceRange.params).total;
            const cogsMonthReturns = db.prepare(`
                SELECT COALESCE(SUM(srd.quantity * i.cost_price), 0) as total
                FROM sales_return_details srd
                JOIN sales_returns sr ON srd.return_id = sr.id
                JOIN items i ON srd.item_id = i.id
                WHERE 1=1${salesReturnRange.clause}
            `).get(...salesReturnRange.params).total;
            const cogsMonth = Math.max(0, cogsMonthSales - cogsMonthReturns);
            const netProfit = salesMonth - cogsMonth;

            // --- Treasury balance ---
            const treasuryIncome = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM treasury_transactions
                WHERE type = 'income'
                  AND COALESCE(related_type, '') NOT IN ('${CUSTOMER_COLLECTION_PENDING_RELATED_TYPE}', '${CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE}')
            `).get().total;
            const treasuryExpense = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM treasury_transactions WHERE type = 'expense'").get().total;
            const treasuryBalance = treasuryIncome - treasuryExpense;

            // --- Receivables & Payables (Using standard balances calculation) ---
            const receivables = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM customers WHERE type IN ('customer', 'both') AND balance > 0").get().total;
            const payables = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM customers WHERE type IN ('supplier', 'both') AND balance > 0").get().total;

            // --- Chart data (last 30 days) ---
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
            const dailySales = db.prepare(`
                SELECT invoice_date as date, COALESCE(SUM(total_amount), 0) as total
                FROM sales_invoices WHERE invoice_date >= ?
                GROUP BY invoice_date ORDER BY invoice_date
            `).all(thirtyDaysAgo);
            const dailyPurchases = db.prepare(`
                SELECT invoice_date as date, COALESCE(SUM(total_amount), 0) as total
                FROM purchase_invoices WHERE invoice_date >= ?
                GROUP BY invoice_date ORDER BY invoice_date
            `).all(thirtyDaysAgo);

            // --- Recent transactions ---
            const recentSales = db.prepare(`
                SELECT si.id, si.invoice_number, si.invoice_date as date,
                       si.total_amount as amount, c.name as party_name, 'sale' as type
                FROM sales_invoices si
                LEFT JOIN customers c ON si.customer_id = c.id
                ORDER BY si.created_at DESC LIMIT 5
            `).all();
            const recentPurchases = db.prepare(`
                SELECT pi.id, pi.invoice_number, pi.invoice_date as date,
                       pi.total_amount as amount, c.name as party_name, 'purchase' as type
                FROM purchase_invoices pi
                LEFT JOIN customers c ON pi.supplier_id = c.id
                ORDER BY pi.created_at DESC LIMIT 5
            `).all();
            const recentTransactions = [...recentSales, ...recentPurchases]
                .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

            // --- Alerts ---
            const lowStockItems = db.prepare(`
                SELECT name, stock_quantity, reorder_level FROM items
                WHERE is_deleted = 0 AND reorder_level > 0 AND stock_quantity <= reorder_level
                ORDER BY stock_quantity ASC LIMIT 5
            `).all();
            const highReceivables = db.prepare(`
                SELECT c.name, COALESCE(SUM(si.remaining_amount), 0) as amount
                FROM sales_invoices si
                JOIN customers c ON si.customer_id = c.id
                WHERE si.remaining_amount > 0
                GROUP BY si.customer_id ORDER BY amount DESC LIMIT 3
            `).all();
            const oldInvoices = db.prepare(`
                SELECT invoice_number, remaining_amount as amount, invoice_date,
                       CAST(julianday('now') - julianday(invoice_date) AS INTEGER) as days_old
                FROM sales_invoices
                WHERE remaining_amount > 0 AND julianday('now') - julianday(invoice_date) > 30
                ORDER BY invoice_date ASC LIMIT 3
            `).all();

            // --- Today summary ---
            const todaySalesCount = db.prepare("SELECT COUNT(*) as count FROM sales_invoices WHERE invoice_date = ?").get(today).count;
            const todayPurchasesCount = db.prepare("SELECT COUNT(*) as count FROM purchase_invoices WHERE invoice_date = ?").get(today).count;
            const todayCollections = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM treasury_transactions
                WHERE type = 'income'
                  AND transaction_date = ?
                  AND COALESCE(related_type, '') NOT IN ('${CUSTOMER_COLLECTION_PENDING_RELATED_TYPE}', '${CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE}')
            `).get(today).total;
            const todayPaymentsTotal = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM treasury_transactions WHERE type = 'expense' AND transaction_date = ?").get(today).total;

            // --- Top selling items ---
            const topItems = db.prepare(`
                SELECT i.name, SUM(sid.quantity) as total_qty, SUM(sid.total_price) as total_value
                FROM sales_invoice_details sid
                JOIN items i ON sid.item_id = i.id
                GROUP BY sid.item_id ORDER BY total_qty DESC LIMIT 5
            `).all();

            // --- Trends (current vs previous period) ---
            let prevSalesMonth = salesMonth;
            let prevPurchasesMonth = purchasesMonth;

            if (startDate && endDate) {
                const rangeStart = new Date(`${startDate}T00:00:00`);
                const rangeEnd = new Date(`${endDate}T00:00:00`);

                if (!Number.isNaN(rangeStart.getTime()) && !Number.isNaN(rangeEnd.getTime()) && rangeEnd >= rangeStart) {
                    const rangeDays = Math.floor((rangeEnd - rangeStart) / 86400000) + 1;
                    const prevEnd = new Date(rangeStart.getTime() - 86400000);
                    const prevStart = new Date(prevEnd.getTime() - (rangeDays - 1) * 86400000);
                    const prevStartStr = formatDateOnly(prevStart);
                    const prevEndStr = formatDateOnly(prevEnd);
                    const prevInvoiceRange = buildRangeClause('invoice_date', prevStartStr, prevEndStr);
                    const prevReturnRange = buildRangeClause('return_date', prevStartStr, prevEndStr);

                    const prevSalesTotal = db.prepare(`
                        SELECT COALESCE(SUM(total_amount), 0) as total
                        FROM sales_invoices WHERE 1=1${prevInvoiceRange.clause}
                    `).get(...prevInvoiceRange.params).total;
                    const prevSalesReturns = db.prepare(`
                        SELECT COALESCE(SUM(total_amount), 0) as total
                        FROM sales_returns WHERE 1=1${prevReturnRange.clause}
                    `).get(...prevReturnRange.params).total;
                    prevSalesMonth = Math.max(0, prevSalesTotal - prevSalesReturns);

                    const prevPurchasesTotal = db.prepare(`
                        SELECT COALESCE(SUM(total_amount), 0) as total
                        FROM purchase_invoices WHERE 1=1${prevInvoiceRange.clause}
                    `).get(...prevInvoiceRange.params).total;
                    const prevPurchasesReturns = db.prepare(`
                        SELECT COALESCE(SUM(total_amount), 0) as total
                        FROM purchase_returns WHERE 1=1${prevReturnRange.clause}
                    `).get(...prevReturnRange.params).total;
                    prevPurchasesMonth = Math.max(0, prevPurchasesTotal - prevPurchasesReturns);
                }
            }

            function calcTrend(current, previous) {
                if (previous === 0) return current > 0 ? 100 : 0;
                return Math.round(((current - previous) / previous) * 100);
            }

            return {
                customersCount, suppliersCount, itemsCount, stockValue,
                salesToday, salesMonth, purchasesToday, purchasesMonth,
                netProfit, treasuryBalance, receivables, payables,
                chartData: { dailySales, dailyPurchases },
                recentTransactions,
                profitDetails: {
                    salesTotalMonth,
                    salesReturnsTotalMonth,
                    salesMonth,
                    cogsMonthSales,
                    cogsMonthReturns,
                    cogsMonth,
                    netProfit
                },
                alerts: { lowStockItems, highReceivables, oldInvoices },
                todaySummary: {
                    invoiceCount: todaySalesCount + todayPurchasesCount,
                    salesTotal: salesToday,
                    collections: todayCollections,
                    payments: todayPaymentsTotal
                },
                topItems,
                trends: {
                    salesMonth: calcTrend(salesMonth, prevSalesMonth),
                    purchasesMonth: calcTrend(purchasesMonth, prevPurchasesMonth)
                }
            };
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            return { customersCount: 0, suppliersCount: 0, itemsCount: 0, stockValue: 0 };
        }
    });
}

module.exports = { register };
