const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const AUTO_BACKUP_FOLDER_NAME = 'DATA';
const AUTO_BACKUP_FILE_NAME = 'accounting-auto-backup.db';
const QUIT_BACKUP_FALLBACK_FLAG_FILE_NAME = 'quit-backup-fallback-flag.json';
const PORTABLE_ROOT_FOLDER = 'APP_JS';
const PORTABLE_MARKER_FILE = 'app_root_path.txt';

function getProgramRootPath() {
    const configuredRoot = (process.env.ACCOUNTING_SYSTEM_ROOT || '').trim();
    if (configuredRoot) {
        return path.normalize(configuredRoot);
    }

    if (app.isPackaged) {
        try {
            const markerPath = path.join(path.dirname(process.execPath), PORTABLE_MARKER_FILE);
            if (fs.existsSync(markerPath)) {
                const raw = fs.readFileSync(markerPath, 'utf8').trim();
                if (raw) {
                    return path.normalize(raw);
                }
            }
        } catch (_) {
        }

        const driveRoot = path.parse(process.execPath).root;
        return path.join(driveRoot, PORTABLE_ROOT_FOLDER);
    }

    return path.resolve(__dirname, '../../..', PORTABLE_ROOT_FOLDER);
}

function removeFileIfExists(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function getBackupPaths() {
    const programRootPath = getProgramRootPath();
    const backupRootPath = path.join(programRootPath, AUTO_BACKUP_FOLDER_NAME);
    const backupFilePath = path.join(backupRootPath, AUTO_BACKUP_FILE_NAME);
    const fallbackFlagPath = path.join(backupRootPath, QUIT_BACKUP_FALLBACK_FLAG_FILE_NAME);
    return { programRootPath, backupRootPath, backupFilePath, fallbackFlagPath };
}

function writeQuitFallbackFlag(payload = {}) {
    try {
        const { backupRootPath, fallbackFlagPath } = getBackupPaths();
        fs.mkdirSync(backupRootPath, { recursive: true });

        fs.writeFileSync(
            fallbackFlagPath,
            JSON.stringify({
                mode: payload.mode || 'unknown',
                createdAt: new Date().toISOString(),
                backupPath: payload.backupPath || '',
                error: payload.error || ''
            }),
            'utf8'
        );
    } catch (error) {
        console.error('[auto-backup] Failed to write quit fallback flag:', error.message);
    }
}

function consumeQuitFallbackFlag() {
    try {
        const { fallbackFlagPath } = getBackupPaths();
        if (!fs.existsSync(fallbackFlagPath)) {
            return null;
        }

        const raw = fs.readFileSync(fallbackFlagPath, 'utf8');
        removeFileIfExists(fallbackFlagPath);

        if (!raw) {
            return { mode: 'unknown' };
        }

        try {
            return JSON.parse(raw);
        } catch (_) {
            return { mode: 'unknown' };
        }
    } catch (error) {
        console.error('[auto-backup] Failed to read quit fallback flag:', error.message);
        return null;
    }
}

function notifyQuitFallbackOnStartup() {
    const fallbackState = consumeQuitFallbackFlag();
    if (!fallbackState) {
        return;
    }

    if (fallbackState.mode === 'raw-copy-succeeded') {
        dialog.showErrorBox(
            'تنبيه النسخ الاحتياطي',
            'تم إغلاق البرنامج سابقًا باستخدام نسخة احتياطية بوضع الطوارئ.\nقد لا تشمل آخر التغييرات بالكامل.\nننصح بإنشاء نسخة احتياطية جديدة الآن.'
        );
        return;
    }

    dialog.showErrorBox(
        'تنبيه النسخ الاحتياطي',
        'تعذر إنشاء النسخ الاحتياطي المنظم أثناء الإغلاق السابق، ومحاولة الطوارئ لم تكتمل بالشكل المطلوب.\nيرجى إنشاء نسخة احتياطية جديدة فور فتح النظام.'
    );
}

function getUserDataBackupPath() {
    try {
        const dbDir = path.dirname(db.name);
        return path.join(dbDir, AUTO_BACKUP_FILE_NAME);
    } catch (e) {
        return null;
    }
}

function copyBackupToUserData(sourceBackupPath) {
    return sourceBackupPath;
}

function cleanupLegacyAutoBackups(backupRootPath) {
    try {
        const legacyEntries = fs.readdirSync(backupRootPath, { withFileTypes: true })
            .filter((entry) => {
                if (!entry.isFile()) return false;
                return entry.name.startsWith('accounting-auto-backup-');
            });

        for (const entry of legacyEntries) {
            const fullPath = path.join(backupRootPath, entry.name);
            try {
                fs.unlinkSync(fullPath);
                console.log(`[auto-backup] removed legacy backup file: ${entry.name}`);
            } catch (error) {
                console.error(`[auto-backup] failed to remove legacy backup ${entry.name}:`, error.message);
            }
        }
    } catch (error) {
        console.error('[auto-backup] cleanupLegacyAutoBackups error:', error.message);
    }
}

function runWalCheckpoint() {
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        console.log('[db] WAL checkpoint completed');
    } catch (error) {
        console.error('[db] WAL checkpoint failed:', error.message);
    }
}

function checkDatabaseIntegrity() {
    try {
        const result = db.pragma('integrity_check');
        const status = result && result[0] ? result[0].integrity_check : 'unknown';
        if (status === 'ok') {
            console.log('[db] Integrity check passed');
            return true;
        }
        console.error('[db] Integrity check FAILED:', status);
        return false;
    } catch (error) {
        console.error('[db] Integrity check error:', error.message);
        return false;
    }
}

function autoRestoreFromDataBackup() {
    const { backupFilePath } = getBackupPaths();
    const userDataBackup = getUserDataBackupPath();

    // Check both locations: DATA folder and next to the database
    let sourceBackup = null;
    if (fs.existsSync(backupFilePath)) {
        sourceBackup = backupFilePath;
    } else if (userDataBackup && fs.existsSync(userDataBackup)) {
        sourceBackup = userDataBackup;
    }

    if (!sourceBackup) {
        console.error('[db-restore] No auto-backup found in DATA or userData to restore from');
        return false;
    }

    try {
        const dbPath = db.name;
        const corruptedBackup = dbPath + '.corrupted-' + Date.now();

        // Save the corrupted file for inspection
        db.close();
        if (fs.existsSync(dbPath)) {
            fs.renameSync(dbPath, corruptedBackup);
        }
        removeFileIfExists(`${dbPath}-shm`);
        removeFileIfExists(`${dbPath}-wal`);

        fs.copyFileSync(sourceBackup, dbPath);
        console.log(`[db-restore] Database restored from backup (${sourceBackup}). Corrupted file saved as: ${corruptedBackup}`);
        return true;
    } catch (error) {
        console.error('[db-restore] Auto-restore failed:', error.message);
        return false;
    }
}

function createStartupBackup() {
    const { backupRootPath, backupFilePath } = getBackupPaths();

    fs.mkdirSync(backupRootPath, { recursive: true });

    try {
        runWalCheckpoint();
        removeFileIfExists(`${backupFilePath}-shm`);
        removeFileIfExists(`${backupFilePath}-wal`);
        db.backup(backupFilePath)
            .then(() => {
                console.log('[auto-backup] Startup backup saved to DATA');
                copyBackupToUserData(backupFilePath);
            })
            .catch((err) => console.error('[auto-backup] Startup backup failed:', err.message));
    } catch (error) {
        console.error('[auto-backup] Startup backup error:', error.message);
    }
}

function createDataBackupBeforeQuit() {
    const { backupRootPath, backupFilePath } = getBackupPaths();

    fs.mkdirSync(backupRootPath, { recursive: true });

    runWalCheckpoint();

    removeFileIfExists(`${backupFilePath}-shm`);
    removeFileIfExists(`${backupFilePath}-wal`);

    // Use better-sqlite3's built-in .backup() for a safe, consistent database backup
    return db.backup(backupFilePath).then(() => {
        copyBackupToUserData(backupFilePath);
        return backupFilePath;
    });
}

/**
 * Run on app startup: cleanup legacy files, check DB integrity, restore or backup.
 * Returns true if the app should continue, false if it needs to relaunch.
 */
function runStartupChecks() {
    const { backupRootPath } = getBackupPaths();
    fs.mkdirSync(backupRootPath, { recursive: true });
    cleanupLegacyAutoBackups(backupRootPath);
    notifyQuitFallbackOnStartup();

    // Check database integrity on startup
    const dbHealthy = checkDatabaseIntegrity();
    if (!dbHealthy) {
        console.error('[startup] Database corruption detected! Attempting auto-restore...');
        const restored = autoRestoreFromDataBackup();
        if (restored) {
            dialog.showErrorBox(
                'تم استعادة البيانات',
                'تم اكتشاف مشكلة في قاعدة البيانات وتمت الاستعادة التلقائية من آخر نسخة احتياطية.\nسيتم إعادة تشغيل البرنامج الآن.'
            );
            return false; // Needs relaunch
        } else {
            dialog.showErrorBox(
                'خطأ في قاعدة البيانات',
                'تم اكتشاف مشكلة في قاعدة البيانات ولم يتم العثور على نسخة احتياطية للاستعادة.\nيرجى استخدام أداة الاستعادة (restore.cmd) يدوياً.'
            );
        }
    } else {
        // Database is healthy - create a startup backup
        createStartupBackup();
    }

    return true; // Continue normally
}

/**
 * Handle the before-quit backup. Returns a Promise.
 * Used by main.js in the 'before-quit' event.
 */
function handleQuitBackup() {
    return createDataBackupBeforeQuit();
}

/**
 * Fallback: raw file copy when db.backup() fails during quit.
 */
function handleQuitBackupFallback() {
    try {
        const { backupRootPath, backupFilePath } = getBackupPaths();
        fs.mkdirSync(backupRootPath, { recursive: true });
        const dbPath = db && db.name ? db.name : null;

        removeFileIfExists(`${backupFilePath}-shm`);
        removeFileIfExists(`${backupFilePath}-wal`);

        if (dbPath && fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, backupFilePath);
            console.log(`[auto-backup] Fallback copy succeeded: ${backupFilePath}`);
            copyBackupToUserData(backupFilePath);
            writeQuitFallbackFlag({ mode: 'raw-copy-succeeded', backupPath: backupFilePath });
        } else {
            console.error('[auto-backup] Could not locate database file for fallback copy');
            writeQuitFallbackFlag({ mode: 'raw-copy-db-missing' });
        }
    } catch (fallbackErr) {
        console.error('[auto-backup] Fallback copy also failed:', fallbackErr.message);
        writeQuitFallbackFlag({ mode: 'raw-copy-failed', error: fallbackErr.message });
    }
}

module.exports = {
    runStartupChecks,
    handleQuitBackup,
    handleQuitBackupFallback
};
