const fs = require('fs');
const path = require('path');
const Module = require('module');
const { extractInvokeChannels, extractLocalElectronOnlyChannels } = require('./extractChannels');

const BACKEND_COMPAT_DIR = path.resolve(__dirname, '../desktop-compat');

let runtimeState;

function getDataDir() {
    const configured = process.env.BACKEND_DATA_DIR;
    const resolved = configured
        ? path.resolve(process.cwd(), configured)
        : path.resolve(process.cwd(), 'data');

    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
}

function buildMockElectron(handlerMap) {
    const listeners = new Map();
    const dataDir = getDataDir();

    const ipcMain = {
        handle(channel, handler) {
            handlerMap.set(channel, handler);
        },
        on(channel, handler) {
            listeners.set(channel, handler);
        },
        once(channel, handler) {
            listeners.set(channel, handler);
        },
        removeListener(channel) {
            listeners.delete(channel);
        }
    };

    const app = {
        getPath(name) {
            if (name === 'userData' || name === 'documents') {
                return dataDir;
            }
            return dataDir;
        },
        relaunch() {},
        exit() {},
        quit() {},
        whenReady() {
            return Promise.resolve();
        }
    };

    const dialog = {
        showErrorBox() {},
        async showSaveDialog() {
            return { canceled: true };
        },
        async showOpenDialog() {
            return { canceled: true, filePaths: [] };
        },
        async showMessageBox() {
            return { response: 0 };
        }
    };

    const BrowserWindow = {
        fromWebContents() {
            return null;
        }
    };

    return { ipcMain, app, dialog, BrowserWindow };
}

function withElectronMock(mockElectron, callback) {
    const originalLoad = Module._load;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'electron') {
            return mockElectron;
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        return callback();
    } finally {
        Module._load = originalLoad;
    }
}

function initializeRuntime() {
    if (runtimeState) {
        return runtimeState;
    }

    const handlerMap = new Map();
    const mockElectron = buildMockElectron(handlerMap);
    const preloadChannels = extractInvokeChannels();
    const localElectronOnlyChannels = extractLocalElectronOnlyChannels();

    withElectronMock(mockElectron, () => {
        const dbModulePath = path.join(BACKEND_COMPAT_DIR, 'db.js');
        const ipcModulePath = path.join(BACKEND_COMPAT_DIR, 'ipcHandlers.js');

        delete require.cache[require.resolve(dbModulePath)];
        delete require.cache[require.resolve(ipcModulePath)];

        const { initDB } = require(dbModulePath);
        const { setupIPC } = require(ipcModulePath);

        initDB();
        setupIPC();
    });

    runtimeState = {
        handlerMap,
        preloadChannels,
        localElectronOnlyChannels
    };

    return runtimeState;
}

function listPublicChannels() {
    return initializeRuntime().preloadChannels;
}

function listLocalElectronOnlyChannels() {
    return initializeRuntime().localElectronOnlyChannels;
}

function listRegisteredChannels() {
    return [...initializeRuntime().handlerMap.keys()].sort();
}

async function invokeChannel(channel, args = []) {
    const { handlerMap, preloadChannels } = initializeRuntime();

    if (!preloadChannels.includes(channel)) {
        throw new Error(`Channel is not public: ${channel}`);
    }

    const handler = handlerMap.get(channel);
    if (!handler) {
        throw new Error(`No handler registered for channel: ${channel}`);
    }

    const fakeEvent = { sender: null };
    const result = handler(fakeEvent, ...args);
    return Promise.resolve(result);
}

function getCompatibilityReport() {
    const preloadChannels = listPublicChannels();
    const localElectronOnlyChannels = listLocalElectronOnlyChannels();
    const registeredChannels = listRegisteredChannels();
    const registeredSet = new Set(registeredChannels);
    const localElectronOnlySet = new Set(localElectronOnlyChannels);

    const missingChannels = preloadChannels.filter((channel) => !registeredSet.has(channel));
    const extraChannels = registeredChannels.filter((channel) => !preloadChannels.includes(channel));
    const publicVsLocalOverlap = preloadChannels.filter((channel) => localElectronOnlySet.has(channel));

    return {
        preloadCount: preloadChannels.length,
        localElectronOnlyCount: localElectronOnlyChannels.length,
        registeredCount: registeredChannels.length,
        missingChannels,
        extraChannels,
        publicVsLocalOverlap,
        isFullyCompatible: missingChannels.length === 0 && extraChannels.length === 0 && publicVsLocalOverlap.length === 0
    };
}

module.exports = {
    listPublicChannels,
    listLocalElectronOnlyChannels,
    listRegisteredChannels,
    invokeChannel,
    getCompatibilityReport
};
