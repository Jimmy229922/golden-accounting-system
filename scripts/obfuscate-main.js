const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('../frontend-desktop/node_modules/javascript-obfuscator');

const rootDir = path.resolve(__dirname, '..');
const mainDir = path.join(rootDir, 'frontend-desktop', 'src', 'main');
const backupDir = path.join(rootDir, 'frontend-desktop', '.main_source_backup');

function getAllJsFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'assets') {
                getAllJsFiles(fullPath, arrayOfFiles);
            }
        } else if (file.endsWith('.js')) {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function obfuscateMain() {
    if (fs.existsSync(backupDir)) {
        console.warn('[OBFUSCATE] Previous backup found. Restoring first to be safe...');
        restoreMain();
    }

    console.log('[OBFUSCATE] Backing up clean source to .main_source_backup...');
    copyRecursive(mainDir, backupDir);

    const files = getAllJsFiles(mainDir);
    console.log(`[OBFUSCATE] Obfuscating ${files.length} main process files...`);

    for (const file of files) {
        const originalCode = fs.readFileSync(file, 'utf8');
        try {
            const result = JavaScriptObfuscator.obfuscate(originalCode, {
                compact: true,
                target: 'node',
                controlFlowFlattening: false,
                deadCodeInjection: false,
                stringArray: true,
                stringArrayThreshold: 0.8,
                stringArrayEncoding: ['base64'],
                renameGlobals: false,
                identifierNamesGenerator: 'hexadecimal'
            });
            fs.writeFileSync(file, result.getObfuscatedCode(), 'utf8');
        } catch (err) {
            console.error(`[OBFUSCATE ERROR] Failed to obfuscate ${file}:`, err.message);
            restoreMain();
            throw err;
        }
    }
    console.log('[OBFUSCATE] All files successfully obfuscated for packaging.');
}

function restoreMain() {
    if (!fs.existsSync(backupDir)) {
        return;
    }
    console.log('[OBFUSCATE] Restoring clean source from .main_source_backup...');
    copyRecursive(backupDir, mainDir);
    fs.rmSync(backupDir, { recursive: true, force: true });
    console.log('[OBFUSCATE] Clean source restored successfully.');
}

// Trap unexpected exits to guarantee restoration
process.on('SIGINT', () => { restoreMain(); process.exit(1); });
process.on('SIGTERM', () => { restoreMain(); process.exit(1); });
process.on('uncaughtException', (err) => {
    restoreMain();
    console.error(err);
    process.exit(1);
});

module.exports = {
    obfuscateMain,
    restoreMain
};

if (require.main === module) {
    const action = process.argv[2];
    if (action === 'restore') {
        restoreMain();
    } else {
        obfuscateMain();
    }
}
