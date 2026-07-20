const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { NsisUpdater } = require('electron-updater');
const { db } = require('./db');

const GITHUB_REPOSITORY_OWNER = 'Jimmy229922';
const GITHUB_REPOSITORY_NAME = 'golden-accounting-system';
const APP_UPDATE_PROGRESS_CHANNEL = 'app-update-download-progress';
const UPDATE_PROVIDER = {
    provider: 'github',
    owner: GITHUB_REPOSITORY_OWNER,
    repo: GITHUB_REPOSITORY_NAME,
    vPrefixedTagName: true,
    private: false,
    channel: 'latest'
};

let updater = null;
let downloadedUpdatePath = '';

function emitAppUpdateProgress(target, payload = {}) {
    if (!target || typeof target.send !== 'function') {
        return;
    }

    try {
        target.send(APP_UPDATE_PROGRESS_CHANNEL, payload);
    } catch (_) {
    }
}

function normalizeVersion(versionValue) {
    return String(versionValue || '')
        .trim()
        .replace(/^v/i, '');
}

function getCurrentAppVersion() {
    return normalizeVersion(app.getVersion ? app.getVersion() : '0.0.0') || '0.0.0';
}

function getSafeUpdatesPath() {
    const portableRoot = String(process.env.ACCOUNTING_SYSTEM_ROOT || '').trim();
    if (portableRoot) {
        return path.join(portableRoot, 'UPDATES');
    }

    return path.join(app.getPath('downloads'), 'Accounting System Updates');
}

function createPreUpdateBackup() {
    const dbPath = db && db.name ? db.name : path.join(app.getPath('userData'), 'accounting.db');
    if (!dbPath || !fs.existsSync(dbPath)) {
        return '';
    }

    const backupDir = path.join(getSafeUpdatesPath(), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `pre-update-${Date.now()}.db`);

    if (db && typeof db.backup === 'function') {
        return db.backup(backupPath).then(() => backupPath);
    }

    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
}

function getUpdater() {
    if (updater) {
        return updater;
    }

    updater = new NsisUpdater(UPDATE_PROVIDER);
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.disableDifferentialDownload = false;
    updater.logger = {
        info: () => {},
        warn: () => {},
        error: () => {}
    };

    return updater;
}

function translateUpdaterError(error) {
    const message = String(error?.message || '').trim();
    const normalized = message.toLowerCase();

    if (normalized.includes('latest.yml') || normalized.includes('update-info')) {
        return 'ملفات التحديث التفاضلي غير مكتملة على GitHub Releases.';
    }

    if (normalized.includes('sha512') || normalized.includes('checksum')) {
        return 'ملف التحديث غير مطابق لبيانات التحقق. أعد رفع ملفات الإصدار من نفس عملية البناء.';
    }

    if (normalized.includes('blockmap')) {
        return 'ملف خريطة التحديث التفاضلي غير موجود أو غير متاح.';
    }

    if (
        normalized.includes('network') ||
        normalized.includes('fetch') ||
        normalized.includes('timeout') ||
        normalized.includes('econnreset') ||
        normalized.includes('enotfound')
    ) {
        return 'تعذر الاتصال بخدمة التحديث. تحقق من الإنترنت ثم حاول مرة أخرى.';
    }

    return message || 'تعذر تشغيل التحديث التفاضلي.';
}

async function checkDifferentialUpdate() {
    const appUpdater = getUpdater();
    const result = await appUpdater.checkForUpdates();
    const updateInfo = result && result.updateInfo ? result.updateInfo : null;

    if (!updateInfo) {
        return {
            success: true,
            updateAvailable: false,
            currentVersion: getCurrentAppVersion()
        };
    }

    return {
        success: true,
        updateAvailable: Boolean(result.isUpdateAvailable),
        currentVersion: getCurrentAppVersion(),
        latestVersion: normalizeVersion(updateInfo.version),
        releaseName: updateInfo.releaseName || updateInfo.version || '',
        publishedAt: updateInfo.releaseDate || '',
        differential: true
    };
}

async function downloadDifferentialUpdate(event) {
    const appUpdater = getUpdater();
    downloadedUpdatePath = '';

    await createPreUpdateBackup();

    const onProgress = (progress = {}) => {
        emitAppUpdateProgress(event.sender, {
            status: 'downloading',
            latestVersion: normalizeVersion(progress.version || ''),
            assetName: 'تحديث تفاضلي',
            downloadedBytes: Number(progress.transferred) || 0,
            totalBytes: Number(progress.total) || 0,
            percent: Math.max(0, Math.min(100, Math.round(Number(progress.percent) || 0))),
            message: ''
        });
    };

    const onDownloaded = (info = {}) => {
        downloadedUpdatePath = String(info.downloadedFile || '').trim();
    };

    appUpdater.on('download-progress', onProgress);
    appUpdater.on('update-downloaded', onDownloaded);

    try {
        const files = await appUpdater.downloadUpdate();
        const updatePath = downloadedUpdatePath || (Array.isArray(files) ? files[0] : '');

        emitAppUpdateProgress(event.sender, {
            status: 'completed',
            assetName: 'تحديث تفاضلي',
            percent: 100,
            message: 'اكتمل تنزيل التحديث.'
        });

        return {
            success: true,
            updateAvailable: true,
            path: '__electron_updater__',
            downloadedFile: updatePath,
            latestVersion: '',
            closeForInstall: true,
            differential: true
        };
    } finally {
        appUpdater.removeListener('download-progress', onProgress);
        appUpdater.removeListener('update-downloaded', onDownloaded);
    }
}

function quitAndInstallDifferentialUpdate() {
    getUpdater().quitAndInstall(false, true);
}

module.exports = {
    checkDifferentialUpdate,
    downloadDifferentialUpdate,
    quitAndInstallDifferentialUpdate,
    translateUpdaterError
};
