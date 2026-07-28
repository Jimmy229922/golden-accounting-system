const { ipcMain, app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { requirePermission } = require('./auth');
const { markMainWindowClosingForUpdate } = require('../windowManager');

const CUSTOMER_COLLECTION_PENDING_RELATED_TYPE = 'customer_collection_pending';
const CUSTOMER_COLLECTION_SHIFT_CLOSE_RELATED_TYPE = 'customer_collection_shift_close';
const GITHUB_REPOSITORY_OWNER = 'Jimmy229922';
const GITHUB_REPOSITORY_NAME = 'golden-accounting-system';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPOSITORY_OWNER}/${GITHUB_REPOSITORY_NAME}/releases/latest`;
const GITHUB_RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPOSITORY_OWNER}/${GITHUB_REPOSITORY_NAME}/releases`;
const APP_UPDATE_PROGRESS_CHANNEL = 'app-update-download-progress';
const APP_UPDATE_MAX_DOWNLOAD_RETRIES = 3;
const APP_UPDATE_RETRY_DELAY_MS = 2000;
let appUpdateProgressState = {
    status: 'idle',
    latestVersion: '',
    assetName: '',
    downloadedBytes: 0,
    totalBytes: 0,
    percent: 0,
    error: '',
    message: '',
    retryAttempt: 0,
    maxRetries: APP_UPDATE_MAX_DOWNLOAD_RETRIES
};

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

function setAppUpdateProgressState(nextState = {}) {
    appUpdateProgressState = {
        ...appUpdateProgressState,
        ...nextState
    };
}

function getAppUpdateProgressState() {
    const status = String(appUpdateProgressState?.status || 'idle');
    return {
        ...appUpdateProgressState,
        isRunning: status === 'starting' || status === 'downloading' || status === 'retrying'
    };
}

function translateAppUpdateError(rawMessage, options = {}) {
    const message = String(rawMessage || '').trim();
    if (!message) {
        if (options.context === 'download') {
            return 'تعذر تنزيل ملف التحديث.';
        }
        return 'تعذر فحص التحديث.';
    }

    if (/[\u0600-\u06FF]/.test(message)) {
        return message;
    }

    const normalized = message.toLowerCase();
    const statusCode = Number(options.statusCode) || 0;

    if (statusCode === 404) {
        return options.context === 'download'
            ? 'ملف التحديث غير موجود على GitHub Releases.'
            : 'تعذر العثور على الإصدار المطلوب على GitHub Releases.';
    }

    if (statusCode === 403 || normalized.includes('rate limit')) {
        return 'GitHub رفض الطلب مؤقتًا. حاول مرة أخرى بعد قليل.';
    }

    if (statusCode === 429) {
        return 'تم تجاوز عدد طلبات التحديث المسموح بها مؤقتًا. حاول مرة أخرى بعد قليل.';
    }

    if (
        normalized.includes('failed to fetch') ||
        normalized.includes('fetch failed') ||
        normalized.includes('networkerror') ||
        normalized.includes('load failed')
    ) {
        return 'تعذر الاتصال بالإنترنت أو الوصول إلى GitHub Releases.';
    }

    if (
        normalized.includes('enotfound') ||
        normalized.includes('eai_again') ||
        normalized.includes('getaddrinfo')
    ) {
        return 'تعذر الوصول إلى GitHub. تحقق من اتصال الإنترنت.';
    }

    if (
        normalized.includes('timeout') ||
        normalized.includes('timed out') ||
        normalized.includes('etimedout')
    ) {
        return 'انتهت مهلة الاتصال أثناء التحديث. تحقق من سرعة الإنترنت ثم حاول مرة أخرى.';
    }

    if (
        normalized.includes('terminated') ||
        normalized.includes('econnreset') ||
        normalized.includes('socket hang up') ||
        normalized.includes('aborted')
    ) {
        return 'انقطع الاتصال أثناء تنزيل التحديث. حاول مرة أخرى.';
    }

    if (
        normalized.includes('eacces') ||
        normalized.includes('eperm') ||
        normalized.includes('access is denied')
    ) {
        return 'لا توجد صلاحية كافية لحفظ ملف التحديث على هذا الجهاز.';
    }

    if (options.context === 'download') {
        return 'حدث خطأ أثناء تنزيل ملف التحديث.';
    }

    return 'حدث خطأ أثناء فحص التحديث.';
}

function isRetryableAppUpdateError(error) {
    const statusCode = Number(error?.statusCode) || 0;
    if (statusCode === 408 || statusCode === 425 || statusCode === 429) {
        return true;
    }
    if (statusCode >= 500 && statusCode <= 599) {
        return true;
    }

    const normalized = String(error?.message || '').trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    return (
        normalized.includes('terminated') ||
        normalized.includes('failed to fetch') ||
        normalized.includes('fetch failed') ||
        normalized.includes('networkerror') ||
        normalized.includes('load failed') ||
        normalized.includes('enotfound') ||
        normalized.includes('eai_again') ||
        normalized.includes('getaddrinfo') ||
        normalized.includes('timeout') ||
        normalized.includes('timed out') ||
        normalized.includes('etimedout') ||
        normalized.includes('econnreset') ||
        normalized.includes('socket hang up') ||
        normalized.includes('aborted')
    );
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
        return { success: false, error: '\u062e\u062f\u0645\u0629 \u0627\u0644\u062a\u062d\u062f\u064a\u062b \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0625\u0635\u062f\u0627\u0631.' };
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
                error: translateAppUpdateError(payload?.message || rawBody, {
                    context: 'check',
                    statusCode: response.status
                })
            };
        }

        const latestVersion = normalizeVersion(payload.tag_name || payload.name || '');
        if (!latestVersion) {
            return { success: false, error: '\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0631\u0642\u0645 \u0625\u0635\u062f\u0627\u0631 \u0635\u0627\u0644\u062d \u062f\u0627\u062e\u0644 GitHub Releases.' };
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
        return {
            success: false,
            error: translateAppUpdateError(error?.message, { context: 'check' })
        };
    }
}
function emitAppUpdateProgress(target, payload = {}) {
    if (!target || typeof target.send !== 'function') {
        return;
    }

    try {
        target.send(APP_UPDATE_PROGRESS_CHANNEL, payload);
    } catch (_) {
    }
}

async function writeChunk(stream, chunk) {
    if (stream.write(chunk)) {
        return;
    }

    await new Promise((resolve, reject) => {
        stream.once('drain', resolve);
        stream.once('error', reject);
    });
}

async function downloadFileFromUrl(downloadUrl, destinationPath, onProgress) {
    const response = await fetch(downloadUrl, {
        headers: {
            Accept: 'application/octet-stream',
            'User-Agent': 'Accounting-System-Desktop-Updater'
        }
    });

    if (!response.ok) {
        const rawBody = await response.text();
        const downloadError = new Error(rawBody || `\u062a\u0639\u0630\u0631 \u062a\u0646\u0632\u064a\u0644 \u0645\u0644\u0641 \u0627\u0644\u062a\u062d\u062f\u064a\u062b (${response.status}).`);
        downloadError.statusCode = response.status;
        throw downloadError;
    }

    const totalBytesRaw = Number(response.headers.get('content-length') || 0);
    const totalBytes = Number.isFinite(totalBytesRaw) && totalBytesRaw > 0 ? totalBytesRaw : 0;
    const reportProgress = (downloadedBytes, forcePercent = null) => {
        if (typeof onProgress !== 'function') {
            return;
        }

        const percent = forcePercent !== null
            ? forcePercent
            : (totalBytes > 0 ? Math.max(0, Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))) : null);

        onProgress({
            downloadedBytes,
            totalBytes,
            percent
        });
    };

    if (!response.body || typeof response.body.getReader !== 'function') {
        const fileBuffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(destinationPath, fileBuffer);
        reportProgress(fileBuffer.length, 100);
        return;
    }

    const reader = response.body.getReader();
    const fileStream = fs.createWriteStream(destinationPath);
    let downloadedBytes = 0;

    try {
        reportProgress(0, 0);

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            const chunk = Buffer.from(value);
            downloadedBytes += chunk.length;
            await writeChunk(fileStream, chunk);
            reportProgress(downloadedBytes);
        }

        await new Promise((resolve, reject) => {
            fileStream.once('error', reject);
            fileStream.end(resolve);
        });

        reportProgress(downloadedBytes, 100);
    } catch (error) {
        fileStream.destroy();
        try {
            if (fs.existsSync(destinationPath)) {
                fs.unlinkSync(destinationPath);
            }
        } catch (_) {
        }
        throw error;
    }
}
async function downloadFileFromUrlWithArabicErrors(downloadUrl, destinationPath, options = {}) {
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const onRetry = typeof options.onRetry === 'function' ? options.onRetry : null;

    for (let attempt = 1; attempt <= APP_UPDATE_MAX_DOWNLOAD_RETRIES; attempt += 1) {
        try {
            await downloadFileFromUrl(downloadUrl, destinationPath, (progressPayload) => {
                if (onProgress) {
                    onProgress({
                        ...progressPayload,
                        retryAttempt: attempt,
                        maxRetries: APP_UPDATE_MAX_DOWNLOAD_RETRIES
                    });
                }
            });

            return {
                retryAttempt: attempt,
                maxRetries: APP_UPDATE_MAX_DOWNLOAD_RETRIES
            };
        } catch (error) {
            const translatedError = translateAppUpdateError(error?.message, {
                context: 'download',
                statusCode: error?.statusCode
            });

            if (attempt >= APP_UPDATE_MAX_DOWNLOAD_RETRIES || !isRetryableAppUpdateError(error)) {
                throw new Error(translatedError);
            }

            if (onRetry) {
                onRetry({
                    status: 'retrying',
                    retryAttempt: attempt + 1,
                    maxRetries: APP_UPDATE_MAX_DOWNLOAD_RETRIES,
                    downloadedBytes: 0,
                    totalBytes: 0,
                    percent: 0,
                    error: '',
                    message: `\u0636\u0639\u0641 \u0641\u064a \u0627\u0644\u0627\u062a\u0635\u0627\u0644. \u062c\u0627\u0631\u064a \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 ${attempt + 1} \u0645\u0646 ${APP_UPDATE_MAX_DOWNLOAD_RETRIES}...`,
                    lastError: translatedError
                });
            }

            await sleep(APP_UPDATE_RETRY_DELAY_MS);
        }
    }
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

    ipcMain.handle('get-app-update-progress-state', () => {
        return {
            success: true,
            progress: getAppUpdateProgressState()
        };
    });

    ipcMain.handle('check-app-update', async () => {
        return fetchLatestReleaseDetails();
    });

    ipcMain.handle('download-app-update', async (event) => {
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
                error: '\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0625\u0635\u062f\u0627\u0631 \u062c\u062f\u064a\u062f \u0644\u0643\u0646 \u0628\u062f\u0648\u0646 \u0645\u0644\u0641 \u062a\u062b\u0628\u064a\u062a \u0644\u0648\u064a\u0646\u062f\u0648\u0632 \u062f\u0627\u062e\u0644 GitHub Releases.',
                releaseUrl: releaseResult.releaseUrl,
                openReleasePage: true
            };
        }

        try {
            const updatesDir = getPortableUpdatesPath();
            fs.mkdirSync(updatesDir, { recursive: true });

            const targetPath = path.join(updatesDir, releaseResult.assetName);
            setAppUpdateProgressState({
                status: 'starting',
                latestVersion: releaseResult.latestVersion,
                assetName: releaseResult.assetName,
                downloadedBytes: 0,
                totalBytes: 0,
                percent: 0,
                error: '',
                message: '\u062c\u0627\u0631\u064a \u0628\u062f\u0621 \u062a\u0646\u0632\u064a\u0644 \u0627\u0644\u062a\u062d\u062f\u064a\u062b...',
                retryAttempt: 1,
                maxRetries: APP_UPDATE_MAX_DOWNLOAD_RETRIES
            });
            emitAppUpdateProgress(event.sender, {
                status: 'starting',
                latestVersion: releaseResult.latestVersion,
                assetName: releaseResult.assetName,
                downloadedBytes: 0,
                totalBytes: 0,
                percent: 0,
                message: '\u062c\u0627\u0631\u064a \u0628\u062f\u0621 \u062a\u0646\u0632\u064a\u0644 \u0627\u0644\u062a\u062d\u062f\u064a\u062b...',
                retryAttempt: 1,
                maxRetries: APP_UPDATE_MAX_DOWNLOAD_RETRIES
            });

            const downloadMeta = await downloadFileFromUrlWithArabicErrors(releaseResult.downloadUrl, targetPath, {
                onProgress: (progressPayload) => {
                    setAppUpdateProgressState({
                        status: 'downloading',
                        latestVersion: releaseResult.latestVersion,
                        assetName: releaseResult.assetName,
                        ...progressPayload,
                        error: '',
                        message: ''
                    });
                    emitAppUpdateProgress(event.sender, {
                        status: 'downloading',
                        latestVersion: releaseResult.latestVersion,
                        assetName: releaseResult.assetName,
                        ...progressPayload,
                        message: ''
                    });
                },
                onRetry: (retryPayload) => {
                    setAppUpdateProgressState({
                        status: 'retrying',
                        latestVersion: releaseResult.latestVersion,
                        assetName: releaseResult.assetName,
                        ...retryPayload
                    });
                    emitAppUpdateProgress(event.sender, {
                        latestVersion: releaseResult.latestVersion,
                        assetName: releaseResult.assetName,
                        ...retryPayload
                    });
                }
            });

            setAppUpdateProgressState({
                status: 'completed',
                latestVersion: releaseResult.latestVersion,
                assetName: releaseResult.assetName,
                percent: 100,
                error: '',
                message: '\u0627\u0643\u062a\u0645\u0644 \u062a\u0646\u0632\u064a\u0644 \u0627\u0644\u062a\u062d\u062f\u064a\u062b.',
                retryAttempt: downloadMeta.retryAttempt,
                maxRetries: downloadMeta.maxRetries
            });
            emitAppUpdateProgress(event.sender, {
                status: 'completed',
                latestVersion: releaseResult.latestVersion,
                assetName: releaseResult.assetName,
                percent: 100,
                message: '\u0627\u0643\u062a\u0645\u0644 \u062a\u0646\u0632\u064a\u0644 \u0627\u0644\u062a\u062d\u062f\u064a\u062b.',
                retryAttempt: downloadMeta.retryAttempt,
                maxRetries: downloadMeta.maxRetries
            });

            return {
                success: true,
                updateAvailable: true,
                path: targetPath,
                assetName: releaseResult.assetName,
                latestVersion: releaseResult.latestVersion,
                closeForInstall: true
            };
        } catch (error) {
            setAppUpdateProgressState({
                status: 'error',
                latestVersion: releaseResult.latestVersion,
                assetName: releaseResult.assetName,
                error: error.message,
                message: error.message
            });
            emitAppUpdateProgress(event.sender, {
                status: 'error',
                latestVersion: releaseResult.latestVersion,
                assetName: releaseResult.assetName,
                error: error.message,
                message: error.message
            });
            return {
                success: false,
                error: error.message,
                releaseUrl: releaseResult.releaseUrl,
                openReleasePage: false
            };
        }
    });

    ipcMain.handle('quit-and-install-app-update', async (event, installerPath) => {
        try {
            const targetPath = String(installerPath || '').trim();
            if (!targetPath) {
                return { success: false, error: 'مسار ملف التثبيت غير صالح.' };
            }

            if (!fs.existsSync(targetPath)) {
                return { success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ù…Ù„Ù Ø§Ù„ØªØ«Ø¨ÙŠØª Ø¨Ø¹Ø¯ Ø§ÙƒØªÙ…Ø§Ù„ Ø§Ù„ØªØ­Ø¯ÙŠØ«.' };
            }

            app.isQuittingForAppUpdate = true;
            app.appUpdateInstallerPath = targetPath;
            markMainWindowClosingForUpdate();

            app.once('quit', () => {
                const installerToOpen = String(app.appUpdateInstallerPath || targetPath).trim();
                if (!installerToOpen) {
                    return;
                }
                shell.openPath(installerToOpen).catch(() => {});
            });

            app.quit();

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
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
                SELECT COALESCE(SUM(sid.quantity * COALESCE(NULLIF(sid.cost_price, 0), i.cost_price, 0)), 0) as total
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
            const payables = db.prepare("SELECT COALESCE(SUM(ABS(balance)), 0) as total FROM parties WHERE type IN ('supplier', 'both') AND balance < 0").get().total;

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


