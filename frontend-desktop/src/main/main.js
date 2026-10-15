const { app, BrowserWindow, dialog, ipcMain, Menu, shell, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

// Handle uncaught exceptions to show errors when running from executable
process.on('uncaughtException', (error) => {
    try { if (db) db.close(); } catch (_) {}
    dialog.showErrorBox('Error', `An unexpected error occurred:\n${error.message}`);
    console.error(error);
});

// Prevent running multiple instances simultaneously
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock || process.argv.some(arg => arg.includes('--remote-debugging-port') || arg.includes('--inspect') || arg.includes('--remote-debugging-pipe'))) {
    app.quit();
}

let isAppStarting = true;

const PORTABLE_ROOT_FOLDER = 'APP_JS';
const PORTABLE_MARKER_FILE = 'app_root_path.txt';
const PORTABLE_SHORTCUT_NAME = 'تشغيل نظام الحسابات.lnk';
const LEGACY_PORTABLE_ROOT_FOLDER = 'APP_JS';
const LEGACY_PORTABLE_PROGRAM_FOLDER = '\u0628\u0631\u0646\u0627\u0645\u062c \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a';

function getPortableMarkerPath() {
    return path.join(path.dirname(process.execPath), PORTABLE_MARKER_FILE);
}

function readPortableRootFromMarker() {
    try {
        const markerPath = getPortableMarkerPath();
        if (!fs.existsSync(markerPath)) {
            return '';
        }

        const raw = fs.readFileSync(markerPath, 'utf8').trim();
        if (!raw) {
            return '';
        }

        return path.normalize(raw);
    } catch (_) {
        return '';
    }
}

function persistPortableRootToMarker(portableRoot) {
    try {
        if (!app.isPackaged) {
            return;
        }

        const markerPath = getPortableMarkerPath();
        fs.writeFileSync(markerPath, String(portableRoot || ''), 'utf8');
    } catch (_) {
    }
}

function getPortableRootPath() {
    const configuredRoot = (process.env.ACCOUNTING_SYSTEM_ROOT || '').trim();
    if (configuredRoot) {
        return path.normalize(configuredRoot);
    }

    const markerRoot = readPortableRootFromMarker();
    if (markerRoot) {
        return markerRoot;
    }

    if (app.isPackaged) {
        const driveRoot = path.parse(process.execPath).root;
        return path.join(driveRoot, PORTABLE_ROOT_FOLDER);
    }

    return path.resolve(__dirname, '../../..', PORTABLE_ROOT_FOLDER);
}

function ensurePortableRootStructure(portableRoot) {
    if (!portableRoot) {
        return;
    }

    fs.mkdirSync(portableRoot, { recursive: true });
    fs.mkdirSync(path.join(portableRoot, 'PIC'), { recursive: true });
    fs.mkdirSync(path.join(portableRoot, 'DATA'), { recursive: true });
    fs.mkdirSync(path.join(portableRoot, 'DATA', 'userData'), { recursive: true });

    if (!app.isPackaged) {
        return;
    }

    const shortcutPath = path.join(portableRoot, PORTABLE_SHORTCUT_NAME);
    shell.writeShortcutLink(shortcutPath, 'create', {
        target: process.execPath,
        icon: process.execPath,
        iconIndex: 0,
        description: 'تشغيل نظام الحسابات'
    });
}

function getPortablePrimaryDataPath(portableRoot) {
    return path.join(portableRoot, 'DATA');
}

function getPortableMirrorUserDataPath(portableRoot) {
    return path.join(portableRoot, 'DATA', 'userData');
}

function removePortableFileIfExists(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function configurePortableUserDataPath(portableRoot) {
    const primaryDataPath = getPortablePrimaryDataPath(portableRoot);
    fs.mkdirSync(primaryDataPath, { recursive: true });
    app.setPath('userData', primaryDataPath);
}

function getLegacyPortableUserDataPath() {
    const configuredRoot = (process.env.ACCOUNTING_SYSTEM_ROOT || '').trim();
    if (configuredRoot) {
        const normalizedConfiguredRoot = path.normalize(configuredRoot);
        const resolvedProgramRoot = path.basename(normalizedConfiguredRoot).toLowerCase() === 'app_js'
            ? path.join(normalizedConfiguredRoot, LEGACY_PORTABLE_PROGRAM_FOLDER)
            : normalizedConfiguredRoot;
        return path.join(resolvedProgramRoot, 'DATA', 'userData');
    }

    return path.join(
        app.getPath('desktop'),
        LEGACY_PORTABLE_ROOT_FOLDER,
        LEGACY_PORTABLE_PROGRAM_FOLDER,
        'DATA',
        'userData'
    );
}

function copyDirectoryContents(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) {
        return;
    }

    fs.mkdirSync(targetDir, { recursive: true });
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        if (entry.isDirectory()) {
            copyDirectoryContents(sourcePath, targetPath);
        } else if (entry.isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

function migrateLegacyPortableUserDataIfNeeded() {
    if (!app.isPackaged) {
        return;
    }

    const currentUserDataPath = app.getPath('userData');
    fs.mkdirSync(currentUserDataPath, { recursive: true });

    const currentDbPath = path.join(currentUserDataPath, 'accounting.db');
    if (fs.existsSync(currentDbPath)) {
        return;
    }

    const legacyUserDataPath = getLegacyPortableUserDataPath();
    if (!legacyUserDataPath) {
        return;
    }

    if (path.resolve(legacyUserDataPath) === path.resolve(currentUserDataPath)) {
        return;
    }

    const legacyDbPath = path.join(legacyUserDataPath, 'accounting.db');
    if (!fs.existsSync(legacyDbPath)) {
        return;
    }

    copyDirectoryContents(legacyUserDataPath, currentUserDataPath);
    console.log('[startup] migrated legacy portable userData to default userData path');
}

function restorePrimaryDatabaseFromMirrorIfNeeded(portableRoot) {
    const primaryDbPath = path.join(getPortablePrimaryDataPath(portableRoot), 'accounting.db');
    const mirrorDbPath = path.join(getPortableMirrorUserDataPath(portableRoot), 'accounting.db');

    if (fs.existsSync(primaryDbPath)) {
        try {
            const stats = fs.statSync(primaryDbPath);
            if (stats.size > 0) {
                return;
            }
        } catch (_) {
        }
    }

    if (!fs.existsSync(mirrorDbPath)) {
        return;
    }

    fs.mkdirSync(path.dirname(primaryDbPath), { recursive: true });
    removePortableFileIfExists(`${primaryDbPath}-shm`);
    removePortableFileIfExists(`${primaryDbPath}-wal`);
    fs.copyFileSync(mirrorDbPath, primaryDbPath);
    console.log('[startup] restored primary database from DATA/userData/accounting.db');
}

try {
    const portableRoot = getPortableRootPath();
    ensurePortableRootStructure(portableRoot);
    persistPortableRootToMarker(portableRoot);
    process.env.ACCOUNTING_SYSTEM_ROOT = portableRoot;
    configurePortableUserDataPath(portableRoot);

    migrateLegacyPortableUserDataIfNeeded();
    restorePrimaryDatabaseFromMirrorIfNeeded(portableRoot);
} catch (error) {
    console.error('[startup] portable root initialization failed:', error.message);
}

let initDB, setupIPC, setupAuthIPC, setupFullIPC, db;

try {
    // Load modules inside try-catch to handle initialization errors
    ({ initDB, db } = require('./db'));
    ({ setupIPC, setupAuthIPC, setupFullIPC } = require('./ipcHandlers'));

    // Initialize Database
    initDB();

    // Setup IPC Handlers
    setupAuthIPC();
} catch (error) {
    dialog.showErrorBox('Startup Error', `Failed to initialize application:\n${error.message}`);
    process.exit(1);
}

const { runStartupChecks, handleQuitBackup, handleQuitBackupFallback, stopPeriodicBackupTimer } = require('./autoBackup');
const { openAppFlow, getMainWindow, showSplashWindow, updateSplashStatus, closeSplashWindow } = require('./windowManager');
const { INVITE_CODE, INVITE_DURATION_DAYS } = require('./inviteConfig');
const licenseService = require('./licenseService');

let authSessionToken = null;
let isQuitBackupRunning = false;
let isQuitBackupCompleted = false;

function isQuittingForAppUpdate() {
    return Boolean(app.isQuittingForAppUpdate);
}

app.prepareForUpdateShutdown = () => {
    app.isQuittingForAppUpdate = true;
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (syncEngineInstance) {
        try { syncEngineInstance.close(); } catch (_) {}
        syncEngineInstance = null;
    }
    if (db) {
        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
            db.close();
        } catch (_) {}
    }
};

function getInviteSettingsMap() {
    const rows = db.prepare(
        "SELECT key, value FROM settings WHERE key IN ('invite_code', 'invite_expiry')"
    ).all();
    const map = {};
    rows.forEach((row) => {
        map[row.key] = row.value;
    });
    return map;
}

function activateInviteForDays(days) {
    const parsedDays = Number(days);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
        return { success: false, error: 'Invalid activation days' };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parsedDays);
    const expiresAtIso = expiresAt.toISOString();

    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
        const tx = db.transaction(() => {
            stmt.run({ key: 'invite_code', value: INVITE_CODE });
            stmt.run({ key: 'invite_expiry', value: expiresAtIso });
        });
        tx();
        return { success: true, expiresAt: expiresAtIso };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function ensureAutoActivationForFreshInstall() {
    try {
        const companyIdRow = db.prepare("SELECT value FROM settings WHERE key = 'company_id'").get();
        if (companyIdRow && companyIdRow.value === '715526d2-f05a-458f-8cf7-179ee172a7a1') {
            return false;
        }
        const licenseStatusRow = db.prepare("SELECT value FROM settings WHERE key = 'license_status'").get();
        if (licenseStatusRow && licenseStatusRow.value === 'lifetime') {
            return false;
        }

        // Upgrade legacy trial codes to V2
        const legacyCodes = ['INV-2026-R3-K9N4Q7W2-61ZT-MPL8-HSX5-7440', 'INV-2026-AX9F3Q7M-48ZP-CKD1-PLN7-TS9X-9931'];
        
        let inviteSettings = getInviteSettingsMap();
        if (legacyCodes.includes(inviteSettings.invite_code)) {
            // Delete the old static code so they get a fresh 15-day trial on the new system
            db.prepare("DELETE FROM settings WHERE key IN ('invite_code', 'invite_expiry', 'renew_count')").run();
            inviteSettings = {}; // force re-activation
        }

        const hasInviteCode = Boolean(inviteSettings.invite_code);
        if (hasInviteCode) {
            return false;
        }

        const result = activateInviteForDays(INVITE_DURATION_DAYS);
        if (result.success) {
            console.log(`[invite] auto-activated for ${INVITE_DURATION_DAYS} days until ${result.expiresAt}`);
            // Also set initial renew count for V2
            try {
                db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)')
                  .run({ key: 'renew_count', value: '0' });
            } catch (e) {
                console.error('Failed to set initial renew_count', e);
            }
            return true;
        }

        console.error('[invite] auto-activation failed:', result.error);
        return false;
    } catch (error) {
        console.error('[invite] auto-activation error:', error.message);
        return false;
    }
}

function getCliActivationDays() {
    const args = process.argv.slice(1);

    if (args.includes('--activate-30-days')) {
        return 30;
    }

    const daysArg = args.find((arg) => arg.startsWith('--activate-days='));
    if (!daysArg) {
        return null;
    }

    const [, value] = daysArg.split('=');
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
}

function handleCliActivationMode() {
    const days = getCliActivationDays();
    if (!days) {
        return false;
    }

    const result = activateInviteForDays(days);
    if (!result.success) {
        dialog.showErrorBox('Activation Error', `Failed to activate invite period:\n${result.error}`);
        app.exit(1);
        return true;
    }

    console.log(`[invite] activated for ${days} days until ${result.expiresAt}`);
    app.exit(0);
    return true;
}

ipcMain.on('auth-session-token', (event, token) => {
    authSessionToken = typeof token === 'string' ? token : null;
});

ipcMain.handle('get-auth-session-token', () => {
    return authSessionToken;
});

ipcMain.handle('get-printers', async (event) => {
    if (typeof event.sender.getPrintersAsync === 'function') {
        return event.sender.getPrintersAsync();
    }
    if (typeof event.sender.getPrinters === 'function') {
        return event.sender.getPrinters();
    }
    return [];
});

ipcMain.handle('print-current-window', async (event, options = {}) => {
    const printOptions = {
        silent: Boolean(options.silent),
        printBackground: true,
        deviceName: typeof options.deviceName === 'string' ? options.deviceName : '',
        pageSize: 'A4'
    };

    return new Promise((resolve) => {
        event.sender.print(printOptions, (success, failureReason) => {
            resolve({
                success,
                error: success ? '' : (failureReason || 'Print failed')
            });
        });
    });
});

// Focus existing window when a second instance tries to launch
app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
        if (win.isMinimized()) win.restore();
        // win.focus(); // Disabled per request to prevent focus stealing
    }
});

app.whenReady().then(async () => {
    if (!gotTheLock) return;

    // Remove the default app menu so Alt does not reveal a menu bar on Windows.
    Menu.setApplicationMenu(null);

    showSplashWindow();
    updateSplashStatus('\u062c\u0627\u0631\u064d \u0641\u062d\u0635 \u0633\u0644\u0627\u0645\u0629 \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a...', 25);

    // Run DB integrity check + startup backup
    const shouldContinue = runStartupChecks();
    if (!shouldContinue) {
        isAppStarting = false;
        await closeSplashWindow();
        app.relaunch();
        app.quit();
        return;
    }

    if (handleCliActivationMode()) {
        isAppStarting = false;
        await closeSplashWindow();
        return;
    }

    await new Promise((r) => setTimeout(r, 350));
    updateSplashStatus('\u062c\u0627\u0631\u064d \u062a\u062c\u0647\u064a\u0632 \u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0646\u0638\u0627\u0645...', 60);
    licenseService.initLicenseForDatabase(db);
    ensureAutoActivationForFreshInstall();

    await new Promise((r) => setTimeout(r, 400));
    updateSplashStatus('\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0648\u0627\u062c\u0647\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645...', 85);

    await new Promise((r) => setTimeout(r, 350));
    updateSplashStatus('\u062c\u0627\u0647\u0632 \u0644\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645', 100);

    setImmediate(() => {
        try {
            setupFullIPC();
        } catch (e) {
            console.error('[startup] background IPC registration error:', e);
        }
    });

    await new Promise((r) => setTimeout(r, 300));

    await openAppFlow();
    isAppStarting = false;
    startBackgroundSyncEngine();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            openAppFlow();
        }
    });
});


let syncEngineInstance = null;
let syncTimer = null;
let heartbeatTimer = null;

function getOrInitializeCompanyId(accountingDb) {
    try {
        const saved = accountingDb.prepare("SELECT value FROM settings WHERE key = 'company_id'").get();
        if (saved && saved.value && String(saved.value).trim()) {
            return String(saved.value).trim();
        }

        const targetCompanyId = require('crypto').randomUUID();
        accountingDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('company_id', ?)").run(targetCompanyId);
        return targetCompanyId;
    } catch (_) {
        return null;
    }
}

let lastCloudRegistrationResult = null;

async function autoRegisterClientDeviceWithCloud(companyId, companyName, deviceId, publicKeyBase64, desktopVersion, enrollmentToken = null) {
    if (!app.isPackaged || typeof fetch !== 'function' || !companyId || !deviceId) return null;
    try {
        let token = enrollmentToken;
        if (!token) {
            try {
                const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'device_enrollment_token'").get();
                if (tokenRow && tokenRow.value) token = tokenRow.value.trim();
            } catch (_) {}
        }
        const response = await fetch('https://ryoqhtsdhfbydmejmaby.supabase.co/rest/v1/rpc/register_client_device', {
            method: 'POST',
            headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b3FodHNkaGZieWRtZWptYWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3Mjk2MzMsImV4cCI6MjEwNzMwNTYzM30.y0tjIyjZZlII6ge9xkFpzqhF5sZjSngpp4XOoVrrTs4',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b3FodHNkaGZieWRtZWptYWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3Mjk2MzMsImV4cCI6MjEwNzMwNTYzM30.y0tjIyjZZlII6ge9xkFpzqhF5sZjSngpp4XOoVrrTs4',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                p_company_id: companyId,
                p_company_name: companyName || null,
                p_device_id: deviceId,
                p_device_name: process.env.COMPUTERNAME || 'Windows-Desktop-POS',
                p_public_key: publicKeyBase64,
                p_desktop_version: desktopVersion || (app.getVersion ? app.getVersion() : '10.1.6'),
                p_enrollment_token: token || null
            }),
            signal: AbortSignal.timeout(6000)
        });
        if (!response.ok) return null;
        const res = await response.json();
        lastCloudRegistrationResult = res;
        return res;
    } catch (_) {
        return null;
    }
}

async function reportClientErrorToCloud(payload = {}) {
    if (!app.isPackaged || typeof fetch !== 'function') return null;
    try {
        const response = await fetch('https://ryoqhtsdhfbydmejmaby.supabase.co/rest/v1/rpc/report_client_error', {
            method: 'POST',
            headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b3FodHNkaGZieWRtZWptYWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3Mjk2MzMsImV4cCI6MjEwNzMwNTYzM30.y0tjIyjZZlII6ge9xkFpzqhF5sZjSngpp4XOoVrrTs4',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b3FodHNkaGZieWRtZWptYWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3Mjk2MzMsImV4cCI6MjEwNzMwNTYzM30.y0tjIyjZZlII6ge9xkFpzqhF5sZjSngpp4XOoVrrTs4',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                p_company_id: payload.companyId || null,
                p_device_id: payload.deviceId || null,
                p_company_name: payload.companyName || null,
                p_desktop_version: payload.desktopVersion || '10.1.0',
                p_severity: payload.severity || 'error',
                p_module: payload.module || 'sync',
                p_error_message: String(payload.errorMessage || 'Unknown error'),
                p_error_details: payload.errorDetails || {}
            }),
            signal: AbortSignal.timeout(6000)
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (_) {
        return null;
    }
}

ipcMain.removeHandler('check-initial-onboarding');
ipcMain.handle('check-initial-onboarding', async () => {
    try {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'onboarding_completed'").get();
        if (row && row.value === '1') {
            return { needed: false };
        }
        const nameRow = db.prepare("SELECT value FROM settings WHERE key IN ('companyName', 'company_name')").get();
        const hasCustomName = nameRow && nameRow.value && nameRow.value !== 'مؤسسة الذهب للمحاسبة' && nameRow.value !== 'مؤسسة جديدة' && nameRow.value !== 'اسم المؤسسة';
        if (hasCustomName) {
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_completed', '1')").run();
            return { needed: false };
        }
        return { needed: true };
    } catch (_) {
        return { needed: false };
    }
});

ipcMain.removeHandler('complete-initial-onboarding');
ipcMain.handle('complete-initial-onboarding', async (_event, data) => {
    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
        const transaction = db.transaction((items) => {
            for (const [key, value] of Object.entries(items)) {
                stmt.run({ key, value: String(value || '') });
            }
        });
        transaction({
            companyName: data.companyName || 'مؤسسة جديدة',
            companyPhone: data.companyPhone || '',
            companyAddress: data.companyAddress || '',
            companyActivity: data.companyActivity || '',
            onboarding_completed: '1'
        });

        const portableRoot = getPortableRootPath();
        const storageDir = path.join(portableRoot, 'DATA');
        const { loadOrCreateDeviceIdentity } = require('./sync/secureKeyStore');
        const identity = loadOrCreateDeviceIdentity(storageDir, safeStorage);
        const COMPANY_ID = getOrInitializeCompanyId(db);
        if (identity) {
            autoRegisterClientDeviceWithCloud(
                COMPANY_ID,
                data.companyName,
                identity.deviceId,
                identity.publicKeyBase64,
                app.getVersion ? app.getVersion() : '10.1.6'
            ).catch(() => {});
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.removeHandler('submit-enrollment-token');
ipcMain.handle('submit-enrollment-token', async (_event, token) => {
    try {
        const cleanToken = String(token || '').trim();
        if (!cleanToken) return { success: false, error: 'كود الربط مطلوب' };
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('device_enrollment_token', ?)").run(cleanToken);
        const COMPANY_ID = getOrInitializeCompanyId(db);
        const storageDir = path.join(getPortableRootPath(), 'DATA');
        const { loadOrCreateDeviceIdentity } = require('./sync/secureKeyStore');
        const identity = loadOrCreateDeviceIdentity(storageDir, safeStorage);
        let compName = 'مؤسسة الذهب للمحاسبة';
        try {
            const row = db.prepare("SELECT value FROM settings WHERE key IN ('companyName', 'company_name') LIMIT 1").get();
            if (row && row.value) compName = row.value;
        } catch (_) {}
        if (identity) {
            const regResult = await autoRegisterClientDeviceWithCloud(
                COMPANY_ID,
                compName,
                identity.deviceId,
                identity.publicKeyBase64,
                app.getVersion ? app.getVersion() : '10.1.6',
                cleanToken
            );
            return regResult || { success: false, error: 'تعذر الاتصال بالسحابة' };
        }
        return { success: false, error: 'تعذر قراءة هوية الجهاز' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

function startBackgroundSyncEngine() {
    ipcMain.removeHandler('trigger-manual-sync');
    ipcMain.handle('trigger-manual-sync', async (_event, options) => {
        if (options && options.getDiagnostics) {
            const diagnostics = syncEngineInstance ? syncEngineInstance.getSyncDiagnostics() : null;
            return {
                success: false,
                disabled: true,
                reason: 'المزامنة قيد التهيئة',
                registration: lastCloudRegistrationResult,
                diagnostics
            };
        }
        return { success: false, disabled: true, reason: 'المزامنة قيد التهيئة', registration: lastCloudRegistrationResult };
    });

    ipcMain.removeHandler('send-sync-diagnostic-report');
    ipcMain.handle('send-sync-diagnostic-report', async () => ({ success: false, reason: 'المزامنة قيد التهيئة' }));

    try {
        const { evaluateSyncGuard } = require('./sync/syncGuard');
        const { SyncEngine } = require('./sync/syncEngine');
        const { loadOrCreateDeviceIdentity, signPayload } = require('./sync/secureKeyStore');

        const portableRoot = getPortableRootPath();
        const storageDir = path.join(portableRoot, 'DATA');
        const dbPath = path.join(storageDir, 'accounting.db');

        const guard = evaluateSyncGuard({
            isPackaged: app.isPackaged,
            allowDevMode: false,
            dbPath,
            syncConfig: {
                enabled: true,
                targetUrl: 'https://ryoqhtsdhfbydmejmaby.supabase.co/functions/v1/sync-ingest',
                targetEnvironment: 'production'
            },
            environment: process.env.NODE_ENV || (app.isPackaged ? 'production' : 'development')
        });

        if (!guard.allowed) {
            ipcMain.removeHandler('trigger-manual-sync');
            ipcMain.handle('trigger-manual-sync', async () => ({ success: false, disabled: true, reason: guard.summary || 'المزامنة معطلة' }));
            return;
        }

        const identity = loadOrCreateDeviceIdentity(storageDir, safeStorage);
        if (!identity) {
            ipcMain.removeHandler('trigger-manual-sync');
            ipcMain.handle('trigger-manual-sync', async () => ({ success: false, disabled: true, reason: 'تعذر تحميل هوية الجهاز' }));
            return;
        }

        const COMPANY_ID = getOrInitializeCompanyId(db);
        const EDGE_URL = 'https://ryoqhtsdhfbydmejmaby.supabase.co/functions/v1/sync-ingest';

        syncEngineInstance = new SyncEngine({
            accountingDb: db,
            storageDir,
            companyId: COMPANY_ID,
            desktopVersion: (app.getVersion ? app.getVersion() : '10.1.0'),
            edgeFunctionUrl: EDGE_URL,
            keyStore: {
                deviceId: identity.deviceId,
                sign: (payloadStr) => signPayload(identity.privateKeyBase64, COMPANY_ID, payloadStr)
            }
        });

        let compName = 'مؤسسة الذهب للمحاسبة';
        try {
            const row = db.prepare("SELECT value FROM settings WHERE key IN ('companyName', 'company_name') LIMIT 1").get();
            if (row && row.value) compName = row.value;
        } catch (_) {}

        autoRegisterClientDeviceWithCloud(
            COMPANY_ID,
            compName,
            identity.deviceId,
            identity.publicKeyBase64,
            app.getVersion ? app.getVersion() : '10.1.0'
        ).catch(() => {});

        syncEngineInstance.dispatchOutbox().catch(() => {});

        let isSyncInProgress = false;
        let lastSyncStatus = { success: true, lastSyncAt: null };
        const triggerSyncNow = async (isManual = false) => {
            if (!syncEngineInstance) return { success: false, disabled: true, reason: 'المزامنة غير مفعلة' };
            if (isSyncInProgress) return { success: true, inProgress: true, ...lastSyncStatus };
            isSyncInProgress = true;
            try {
                let dispatchResult = null;
                if (syncEngineInstance.hasPendingOutbox()) {
                    dispatchResult = await syncEngineInstance.dispatchOutbox();
                }

                let generatedDelta = false;
                if (!syncEngineInstance.hasPendingOutbox()) {
                    const nextSeq = syncEngineInstance.getNextSeqNo();
                    const delta = syncEngineInstance.detectDeltaEvents(nextSeq, Boolean(isManual));
                    if (delta.events && delta.events.length > 0) {
                        generatedDelta = true;
                        syncEngineInstance.queueDeltaBatch(nextSeq, delta.events, delta.projection);
                        dispatchResult = await syncEngineInstance.dispatchOutbox();
                    }
                }

                const stillPending = syncEngineInstance.hasPendingOutbox();
                if (stillPending) {
                    const errReason = (dispatchResult && dispatchResult.lastError) ? dispatchResult.lastError : 'توجد حزم معلقة قيد إعادة المحاولة';
                    lastSyncStatus = { success: false, inProgress: false, pending: true, error: errReason, lastSyncAt: lastSyncStatus.lastSyncAt };
                    syncEngineInstance.logPeriodicSyncCheck(isManual, false, errReason);
                    reportClientErrorToCloud({
                        companyId: COMPANY_ID,
                        deviceId: identity.deviceId,
                        companyName: compName,
                        desktopVersion: (app.getVersion ? app.getVersion() : '10.1.0'),
                        severity: 'warn',
                        module: 'sync_dispatch',
                        errorMessage: errReason,
                        errorDetails: { isManual, dispatchResult }
                    }).catch(() => {});
                } else {
                    const didWork = generatedDelta || (dispatchResult && dispatchResult.processed > 0);
                    if (!didWork) {
                        if (isManual) {
                            await syncEngineInstance.pingHeartbeat();
                            syncEngineInstance.logManualSyncCheck(true, null);
                        } else {
                            syncEngineInstance.logPeriodicSyncCheck(false, true, null);
                        }
                    }
                    lastSyncStatus = { success: true, inProgress: false, lastSyncAt: new Date().toISOString() };
                }

                BrowserWindow.getAllWindows().forEach((win) => {
                    if (win && !win.isDestroyed() && win.webContents) {
                        win.webContents.send('cloud-sync-status', lastSyncStatus);
                    }
                });
                return lastSyncStatus;
            } catch (err) {
                lastSyncStatus = { success: false, inProgress: false, error: err.message, lastSyncAt: lastSyncStatus.lastSyncAt };
                if (syncEngineInstance) {
                    syncEngineInstance.logPeriodicSyncCheck(isManual, false, err.message);
                }
                reportClientErrorToCloud({
                    companyId: COMPANY_ID,
                    deviceId: identity.deviceId,
                    companyName: compName,
                    desktopVersion: (app.getVersion ? app.getVersion() : '10.1.0'),
                    severity: 'error',
                    module: 'sync_runtime',
                    errorMessage: err.message,
                    errorDetails: { stack: err.stack, isManual }
                }).catch(() => {});
                BrowserWindow.getAllWindows().forEach((win) => {
                    if (win && !win.isDestroyed() && win.webContents) {
                        win.webContents.send('cloud-sync-status', lastSyncStatus);
                    }
                });
                return lastSyncStatus;
            } finally {
                isSyncInProgress = false;
            }
        };

        ipcMain.removeHandler('trigger-manual-sync');
        ipcMain.handle('trigger-manual-sync', async (_event, options) => {
            if (options && options.getDiagnostics) {
                const diagnostics = syncEngineInstance ? syncEngineInstance.getSyncDiagnostics() : null;
                return {
                    ...lastSyncStatus,
                    registration: lastCloudRegistrationResult,
                    diagnostics
                };
            }
            if (options && options.statusOnly) {
                return {
                    ...lastSyncStatus,
                    registration: lastCloudRegistrationResult
                };
            }
            const syncRes = await triggerSyncNow(true);
            const diagnostics = syncEngineInstance ? syncEngineInstance.getSyncDiagnostics() : null;
            return {
                ...syncRes,
                registration: lastCloudRegistrationResult,
                diagnostics
            };
        });

        ipcMain.removeHandler('send-sync-diagnostic-report');
        ipcMain.handle('send-sync-diagnostic-report', async () => {
            if (!syncEngineInstance) return { success: false, reason: 'المزامنة غير مفعلة' };
            const diag = syncEngineInstance.getSyncDiagnostics ? syncEngineInstance.getSyncDiagnostics() : null;
            const hasError = !lastSyncStatus.success ||
                !!lastSyncStatus.error ||
                (diag && diag.counts && (diag.counts.failed > 0 || diag.counts.pending > 0)) ||
                (diag && Array.isArray(diag.recentBatches) && diag.recentBatches.some(b => b.status === 'failed' || !!b.last_error));

            if (!hasError) {
                return { success: false, noError: true, reason: 'المزامنة سليمة تماماً ولا توجد أخطاء للإرسال' };
            }

            return await reportClientErrorToCloud({
                companyId: COMPANY_ID,
                deviceId: identity.deviceId,
                companyName: compName,
                desktopVersion: (app.getVersion ? app.getVersion() : '10.1.0'),
                severity: 'error',
                module: 'diagnostic_report',
                errorMessage: lastSyncStatus.error || 'تقرير فني لوجود تعثر في المزامنة',
                errorDetails: {
                    diagnostics: diag,
                    computerName: process.env.COMPUTERNAME,
                    os: process.platform,
                    timestamp: new Date().toISOString()
                }
            });
        });

        syncTimer = setInterval(triggerSyncNow, 30000);
        triggerSyncNow();

        heartbeatTimer = setInterval(async () => {
            if (!syncEngineInstance) return;
            try {
                await syncEngineInstance.pingHeartbeat();
            } catch (_) {}
        }, 60000);
    } catch (err) {
        console.error('[sync-subsystem] Initialization error:', err);
        ipcMain.removeHandler('trigger-manual-sync');
        ipcMain.handle('trigger-manual-sync', async () => ({ success: false, disabled: true, error: err.message, reason: 'تعذر تشغيل محرك المزامنة', registration: lastCloudRegistrationResult }));
        ipcMain.removeHandler('send-sync-diagnostic-report');
        ipcMain.handle('send-sync-diagnostic-report', async () => ({ success: false, error: err.message, reason: 'تعذر تشغيل محرك المزامنة' }));
        reportClientErrorToCloud({
            companyId: null,
            deviceId: null,
            companyName: null,
            desktopVersion: (app.getVersion ? app.getVersion() : '10.1.6'),
            severity: 'error',
            module: 'sync_init',
            errorMessage: err.message,
            errorDetails: { stack: err.stack }
        }).catch(() => {});
    }
}
app.on('before-quit', (event) => {
    try { stopPeriodicBackupTimer(); } catch (_) {}
    if (isQuittingForAppUpdate()) {
        if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        if (syncEngineInstance) {
            try { syncEngineInstance.close(); } catch (_) {}
            syncEngineInstance = null;
        }
        isQuitBackupCompleted = true;
        isQuitBackupRunning = false;
        return;
    }
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (syncEngineInstance) {
        try { syncEngineInstance.close(); } catch (_) {}
        syncEngineInstance = null;
    }
    if (!gotTheLock) return;
    if (isQuitBackupCompleted || isQuitBackupRunning) {
        return;
    }

    event.preventDefault();
    isQuitBackupRunning = true;

    handleQuitBackup()
        .then((backupPath) => {
            console.log(`[auto-backup] Database backup updated at: ${backupPath}`);
            isQuitBackupCompleted = true;
            app.quit();
        })
        .catch((error) => {
            isQuitBackupRunning = false;
            console.error('[auto-backup] failed to create database backup before quit:', error);

            handleQuitBackupFallback();

            // Never block the user from closing the app
            isQuitBackupCompleted = true;
            app.quit();
        });
});

app.on('window-all-closed', () => {
    if (isAppStarting) return;
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
