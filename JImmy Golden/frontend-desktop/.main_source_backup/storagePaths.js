const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const STORAGE_PATHS_FILE = 'accounting-system-storage-paths.json';

function getStoragePathsConfigFile() {
    return path.join(app.getPath('appData'), STORAGE_PATHS_FILE);
}

function getCustomStoragePaths() {
    try {
        const configPath = getStoragePathsConfigFile();
        if (!fs.existsSync(configPath)) {
            return { databaseDir: '', backupDir: '' };
        }
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            databaseDir: parsed && typeof parsed.databaseDir === 'string' ? parsed.databaseDir.trim() : '',
            backupDir: parsed && typeof parsed.backupDir === 'string' ? parsed.backupDir.trim() : ''
        };
    } catch (_) {
        return { databaseDir: '', backupDir: '' };
    }
}

function saveCustomStoragePaths(partial = {}) {
    const current = getCustomStoragePaths();
    const next = {
        databaseDir: typeof partial.databaseDir === 'string' ? partial.databaseDir.trim() : current.databaseDir,
        backupDir: typeof partial.backupDir === 'string' ? partial.backupDir.trim() : current.backupDir
    };
    const configPath = getStoragePathsConfigFile();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf8');
    return next;
}

module.exports = {
    getCustomStoragePaths,
    saveCustomStoragePaths
};
