import re

filePath = r'd:\JImmy Golden\frontend-desktop\src\main\autoBackup.js'

with open(filePath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace cleanupLegacyAutoBackups
old_cleanup = """function cleanupLegacyAutoBackups(backupRootPath) {
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
}"""

new_cleanup = """function cleanupLegacyAutoBackups(backupRootPath) {
}

function saveRotatedBackups(backupRootPath, sourceBackupFile) {
    try {
        if (!fs.existsSync(sourceBackupFile)) return;

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        
        const dailyDir = path.join(backupRootPath, 'backups', 'daily');
        fs.mkdirSync(dailyDir, { recursive: true });
        const dailyFile = path.join(dailyDir, `backup-${dateStr}.db`);
        fs.copyFileSync(sourceBackupFile, dailyFile);

        const dailyFiles = fs.readdirSync(dailyDir)
            .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
            .sort();
        while (dailyFiles.length > 14) {
            const oldest = dailyFiles.shift();
            try { fs.unlinkSync(path.join(dailyDir, oldest)); } catch (_) {}
        }

        const weeklyDir = path.join(backupRootPath, 'backups', 'weekly');
        fs.mkdirSync(weeklyDir, { recursive: true });
        const weekNum = Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
        const weeklyFile = path.join(weeklyDir, `backup-week-${now.getFullYear()}-${String(weekNum).padStart(2, '0')}.db`);
        fs.copyFileSync(sourceBackupFile, weeklyFile);

        const weeklyFiles = fs.readdirSync(weeklyDir)
            .filter(f => f.startsWith('backup-week-') && f.endsWith('.db'))
            .sort();
        while (weeklyFiles.length > 8) {
            const oldest = weeklyFiles.shift();
            try { fs.unlinkSync(path.join(weeklyDir, oldest)); } catch (_) {}
        }
    } catch (e) {
        console.error('[auto-backup] Rotation error:', e.message);
    }
}"""

content = content.replace(old_cleanup.replace('\r\n', '\n'), new_cleanup.replace('\r\n', '\n'))
content = content.replace(old_cleanup.replace('\n', '\r\n'), new_cleanup.replace('\n', '\r\n'))

# 2. Add saveRotatedBackups to createStartupBackup
old_startup = """                console.log('[auto-backup] Startup backup saved to DATA');
                copyBackupToUserData(backupFilePath);"""

new_startup = """                console.log('[auto-backup] Startup backup saved to DATA');
                copyBackupToUserData(backupFilePath);
                saveRotatedBackups(backupRootPath, backupFilePath);"""

content = content.replace(old_startup.replace('\r\n', '\n'), new_startup.replace('\r\n', '\n'))
content = content.replace(old_startup.replace('\n', '\r\n'), new_startup.replace('\n', '\r\n'))

# 3. Add saveRotatedBackups to createDataBackupBeforeQuit
old_quit = """    return db.backup(backupFilePath).then(() => {
        copyBackupToUserData(backupFilePath);
        return backupFilePath;
    });"""

new_quit = """    return db.backup(backupFilePath).then(() => {
        copyBackupToUserData(backupFilePath);
        saveRotatedBackups(backupRootPath, backupFilePath);
        return backupFilePath;
    });"""

content = content.replace(old_quit.replace('\r\n', '\n'), new_quit.replace('\r\n', '\n'))
content = content.replace(old_quit.replace('\n', '\r\n'), new_quit.replace('\n', '\r\n'))

with open(filePath, 'w', encoding='utf-8') as f:
    f.write(content)

print("autoBackup.js successfully updated!")
