const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const preloadPath = path.join(rootDir, 'frontend-desktop', 'src', 'main', 'preload.js');
const publicContractPath = path.join(rootDir, 'backend', 'src', 'contracts', 'public-channels.json');
const localContractPath = path.join(rootDir, 'backend', 'src', 'contracts', 'local-electron-only-channels.json');
const frontendHandlersDir = path.join(rootDir, 'frontend-desktop', 'src', 'main', 'handlers');
const backendGeneratedHandlersDir = path.join(rootDir, 'backend', 'src', 'desktop-compat', 'generated', 'handlers');
const frontendArDictionaryPath = path.join(rootDir, 'frontend-desktop', 'src', 'renderer', 'assets', 'i18n', 'ar.json');
const backendDesktopCompatArDictionaryPath = path.join(rootDir, 'backend', 'src', 'desktop-compat', 'renderer', 'assets', 'i18n', 'ar.json');

const preloadSource = fs.readFileSync(preloadPath, 'utf8');
const invokeRegex = /invokeChannel\(\s*['"]([^'"]+)['"]/g;
const sendRegex = /ipcRenderer\.send\(\s*['"]([^'"]+)['"]/g;
const invokeLocalRegex = /ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g;

function collectChannels(regex) {
    const channels = new Set();
    let match = regex.exec(preloadSource);
    while (match) {
        channels.add(match[1]);
        match = regex.exec(preloadSource);
    }
    return channels;
}

function syncHandlers() {
    fs.mkdirSync(backendGeneratedHandlersDir, { recursive: true });

    const frontendFiles = fs.readdirSync(frontendHandlersDir)
        .filter((name) => name.endsWith('.js'));

    const frontendSet = new Set(frontendFiles);

    frontendFiles.forEach((fileName) => {
        const source = path.join(frontendHandlersDir, fileName);
        const target = path.join(backendGeneratedHandlersDir, fileName);
        fs.copyFileSync(source, target);
    });

    const existingGeneratedFiles = fs.readdirSync(backendGeneratedHandlersDir)
        .filter((name) => name.endsWith('.js'));

    existingGeneratedFiles.forEach((fileName) => {
        if (!frontendSet.has(fileName)) {
            fs.unlinkSync(path.join(backendGeneratedHandlersDir, fileName));
        }
    });

    return frontendFiles.length;
}

function syncGeneratedAssets() {
    fs.mkdirSync(path.dirname(backendDesktopCompatArDictionaryPath), { recursive: true });
    fs.copyFileSync(frontendArDictionaryPath, backendDesktopCompatArDictionaryPath);
}

const publicChannels = [...collectChannels(invokeRegex)].sort();
const localChannels = [...new Set([
    ...collectChannels(sendRegex),
    ...collectChannels(invokeLocalRegex)
])].sort();

fs.mkdirSync(path.dirname(publicContractPath), { recursive: true });
fs.writeFileSync(publicContractPath, `${JSON.stringify(publicChannels, null, 2)}\n`);
fs.writeFileSync(localContractPath, `${JSON.stringify(localChannels, null, 2)}\n`);

const syncedHandlersCount = syncHandlers();
syncGeneratedAssets();

console.log(`[sync] backend public RPC contract updated (${publicChannels.length} channels)`);
console.log(`[sync] backend local electron-only contract updated (${localChannels.length} channels)`);
console.log(`[sync] backend generated handlers synced (${syncedHandlersCount} files)`);
console.log('[sync] backend generated assets synced (ar.json)');
