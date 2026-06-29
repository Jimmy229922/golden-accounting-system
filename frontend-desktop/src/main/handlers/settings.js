const { ipcMain, app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { requirePermission } = require('./auth');

const CUSTOMER_COLLECTION_PENDING_RELATED_TYPE = 'customer_collection_pending';
const CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE = 'customer_collection_shift_close';
const GITHUB_REPOSITORY_OWNER = 'Jimmy229922';
const GITHUB_REPOSITORY_NAME = 'golden-accounting-system';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPOSITORY_OWNER}/${GITHUB_REPOSITORY_NAME}/releases/latest`;
const GITHUB_RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPOSITORY_OWNER}/${GITHUB_REPOSITORY_NAME}/releases`;

function normalizeVersion(versionValue) {
    return String(versionValue || '')
        .trim()
        .replace(/^v/i, '');
}

function compareVersions(leftValue, rightValue) {
    const leftParts = normalizeVersion(leftValue).split('.').map((part) => Number(part) || 0);
    const rightParts = normalizeVersion(rightValue).split('.').map((part) => Number(part) || 0);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const left = leftParts[index] || 0;
        const right = rightParts[index] || 0;
        if (left > right) return 1;
        if (left < right) return -1;
    }

    return 0;
}

function getCurrentAppVersion() {
    return normalizeVersion(app.getVersion ? app.getVersion() : '0.0.0') || '0.0.0';
}

function getPortableUpdatesPath() {
    const portableRoot = String(process.env.ACCOUNTING_SYSTEM_ROOT || '').trim();
    if (portableRoot) {
        return path.join(portableRoot, 'UPDATES');
    }

    return path.join(app.getPath('downloads'), 'Accounting System Updates');
}

function selectWindowsInstallerAsset(assets = []) {
    const validAssets = Array.isArray(assets) ? assets.filter((asset) => {
        const name = String(asset?.name || '');
        return /\.exe$/i.test(name) && !/blockmap/i.test(name);
    }) : [];

    if (validAssets.length === 0) {
        return null;
    }

    const setupAsset = validAssets.find((asset) => /setup/i.test(String(asset.name || '')));
    return setupAsset || validAssets[0];
}

async function fetchLatestReleaseDetails() {
    if (typeof fetch !== 'function') {
        return { success: false, error: 'خدمة التحديث غير متاحة في هذا الإصدار.' };
    }

    try {
        const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': 'Accounting-System-Desktop-Updater'
            }
        });

        const rawBody = await response.text();
        const payload = rawBody ? JSON.parse(rawBody) : {};

        if (!response.ok) {
            return {
                success: false,
                error: payload?.message || `تعذر قراءة آخر إصدار من GitHub (${response.status}).`
            };
        }

        const latestVersion = normalizeVersion(payload.tag_name || payload.name || '');
        if (!latestVersion) {
            return { success: false, error: 'لم يتم العثور على رقم إصدار صالح داخل GitHub Releases.' };
        }

        const installerAsset = selectWindowsInstallerAsset(payload.assets);
        const currentVersion = getCurrentAppVersion();

        return {
            success: true,
            currentVersion,
            latestVersion,
            updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
            releaseName: String(payload.name || payload.tag_name || latestVersion),
            publishedAt: payload.published_at || '',
            releaseUrl: String(payload.html_url || GITHUB_RELEASES_PAGE_URL),
            assetName: installerAsset?.name || '',
            downloadUrl: installerAsset?.browser_download_url || ''
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function downloadFileFromUrl(downloadUrl, destinationPath) {
    const response = await fetch(downloadUrl, {
        headers: {
            Accept: 'application/octet-stream',
            'User-Agent': 'Accounting-System-Desktop-Updater'
        }
    });

    if (!response.ok) {
        const rawBody = await response.text();
        throw new Error(rawBody || `تعذر تنزيل ملف التحديث (${response.status}).`);
    }

    const fileBuffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destinationPath, fileBuffer);
}

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

    ipcMain.handle('get-app-version', () => {
        return {
            success: true,
            version: getCurrentAppVersion()
        };
    });

    ipcMain.handle('check-app-update', async () => {
        return fetchLatestReleaseDetails();
    });

    ipcMain.handle('download-app-update', async () => {
        const releaseResult = await fetchLatestReleaseDetails();
        if (!releaseResult.success) {
            return releaseResult;
        }

        if (!releaseResult.updateAvailable) {
            return {
                success: true,
                updateAvailable: false,
                currentVersion: releaseResult.currentVersion,
                latestVersion: releaseResult.latestVersion
            };
        }

        if (!releaseResult.downloadUrl || !releaseResult.assetName) {
            return {
                success: false,
                error: 'تم العثور على إصدار جديد لكن بدون ملف تثبيت لويندوز داخل GitHub Releases.',
                releaseUrl: releaseResult.releaseUrl
            };
        }

        try {
            const updatesDir = getPortableUpdatesPath();
            fs.mkdirSync(updatesDir, { recursive: true });

            const targetPath = path.join(updatesDir, releaseResult.assetName);
            await downloadFileFromUrl(releaseResult.downloadUrl, targetPath);

            const openError = await shell.openPath(targetPath);
            return {
                success: openError === '',
                updateAvailable: true,
                path: targetPath,
                assetName: releaseResult.assetName,
                latestVersion: releaseResult.latestVersion,
                error: openError || ''
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                releaseUrl: releaseResult.releaseUrl
            };
        }
    });

    ipcMain.handle('open-app-release-page', async () => {
        try {
            await shell.openExternal(GITHUB_RELEASES_PAGE_URL);
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
            const salesInvoiceRange = buildRangeClause('si.invoice_date', startDate, endDate);

            // --- Basic counts ---
            const customersCount = db.prepare("SELECT COUNT(*) as count FROM parties WHERE type IN ('customer', 'both')").get().count;
            const suppliersCount = db.prepare("SELECT COUNT(*) as count FROM parties WHERE type IN ('supplier', 'both')").get().count;
            const itemsCount = db.prepare("SELECT COUNT(*) as count FROM items WHERE is_deleted = 0").get().count;
            const stockValue = db.prepare("SELECT COALESCE(SUM(cost_price * stock_quantity), 0) as total FROM items WHERE is_deleted = 0").get().total;

            // --- Sales & Purchases ---
            const salesTotalToday = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_invoices WHERE invoice_date = ?").get(today).total;
            const salesToday = salesTotalToday;

            const salesTotalMonth = db.prepare(`
                SELECT COALESCE(SUM(total_amount), 0) as total
                FROM sales_invoices WHERE 1=1${invoiceRange.clause}
            `).get(...invoiceRange.params).total;
            const salesMonth = salesTotalMonth;

            const purchasesTotalToday = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_invoices WHERE invoice_date = ?").get(today).total;
            const purchasesToday = purchasesTotalToday;

            const purchasesTotalMonth = db.prepare(`
                SELECT COALESCE(SUM(total_amount), 0) as total
                FROM purchase_invoices WHERE 1=1${invoiceRange.clause}
            `).get(...invoiceRange.params).total;
            const purchasesMonth = purchasesTotalMonth;

            // --- Net profit (sales revenue - COGS this month) ---
            const cogsMonthSales = db.prepare(`
                SELECT COALESCE(SUM(sid.quantity * i.cost_price), 0) as total
                FROM sales_invoice_details sid
                JOIN sales_invoices si ON sid.invoice_id = si.id
                JOIN items i ON sid.item_id = i.id
                WHERE 1=1${salesInvoiceRange.clause}
            `).get(...salesInvoiceRange.params).total;
            const cogsMonth = cogsMonthSales;
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
            const receivables = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM parties WHERE type IN ('customer', 'both') AND balance > 0").get().total;
            const payables = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM parties WHERE type IN ('supplier', 'both') AND balance > 0").get().total;

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
                LEFT JOIN parties c ON si.customer_id = c.id
                ORDER BY si.created_at DESC LIMIT 5
            `).all();
            const recentPurchases = db.prepare(`
                SELECT pi.id, pi.invoice_number, pi.invoice_date as date,
                       pi.total_amount as amount, c.name as party_name, 'purchase' as type
                FROM purchase_invoices pi
                LEFT JOIN parties c ON pi.supplier_id = c.id
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
                JOIN parties c ON si.customer_id = c.id
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

                    const prevSalesTotal = db.prepare(`
                        SELECT COALESCE(SUM(total_amount), 0) as total
                        FROM sales_invoices WHERE 1=1${prevInvoiceRange.clause}
                    `).get(...prevInvoiceRange.params).total;
                    prevSalesMonth = prevSalesTotal;

                    const prevPurchasesTotal = db.prepare(`
                        SELECT COALESCE(SUM(total_amount), 0) as total
                        FROM purchase_invoices WHERE 1=1${prevInvoiceRange.clause}
                    `).get(...prevInvoiceRange.params).total;
                    prevPurchasesMonth = prevPurchasesTotal;
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
                    salesMonth,
                    cogsMonthSales,
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

