const fs = require('fs');
const path = require('path');

const PUBLIC_CONTRACT_PATH = path.resolve(__dirname, '../contracts/public-channels.json');
const LOCAL_ELECTRON_ONLY_CONTRACT_PATH = path.resolve(__dirname, '../contracts/local-electron-only-channels.json');

function readContractFile(contractPath) {
    const raw = fs.readFileSync(contractPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error(`Invalid channel contract format in ${contractPath}`);
    }
    return parsed.slice().sort();
}

function extractInvokeChannels() {
    return readContractFile(PUBLIC_CONTRACT_PATH);
}

function extractLocalElectronOnlyChannels() {
    return readContractFile(LOCAL_ELECTRON_ONLY_CONTRACT_PATH);
}

module.exports = {
    extractInvokeChannels,
    extractLocalElectronOnlyChannels,
    CONTRACT_PATH: PUBLIC_CONTRACT_PATH,
    PUBLIC_CONTRACT_PATH,
    LOCAL_ELECTRON_ONLY_CONTRACT_PATH
};
