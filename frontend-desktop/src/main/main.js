const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
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
if (!gotTheLock) {
    app.quit();
}

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

try {
    const portableRoot = getPortableRootPath();
    ensurePortableRootStructure(portableRoot);
    persistPortableRootToMarker(portableRoot);
    process.env.ACCOUNTING_SYSTEM_ROOT = portableRoot;

    migrateLegacyPortableUserDataIfNeeded();
} catch (error) {
    console.error('[startup] portable root initialization failed:', error.message);
}

let initDB, setupIPC, db;

try {
    // Load modules inside try-catch to handle initialization errors
    ({ initDB, db } = require('./db'));
    ({ setupIPC } = require('./ipcHandlers'));

    // Initialize Database
    initDB();

    // Setup IPC Handlers
    setupIPC();
} catch (error) {
    dialog.showErrorBox('Startup Error', `Failed to initialize application:\n${error.message}`);
    process.exit(1);
}

const { runStartupChecks, handleQuitBackup, handleQuitBackupFallback } = require('./autoBackup');
const { openAppFlow, getMainWindow } = require('./windowManager');
const { INVITE_CODE, INVITE_DURATION_DAYS } = require('./inviteConfig');

let authSessionToken = null;
let isQuitBackupRunning = false;
let isQuitBackupCompleted = false;

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

app.whenReady().then(() => {
    if (!gotTheLock) return;

    // Remove the default app menu so Alt does not reveal a menu bar on Windows.
    Menu.setApplicationMenu(null);

    // Run DB integrity check + startup backup
    const shouldContinue = runStartupChecks();
    if (!shouldContinue) {
        app.relaunch();
        app.quit();
        return;
    }

    if (handleCliActivationMode()) {
        return;
    }

    ensureAutoActivationForFreshInstall();

    openAppFlow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            openAppFlow();
        }
    });
});

app.on('before-quit', (event) => {
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
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
