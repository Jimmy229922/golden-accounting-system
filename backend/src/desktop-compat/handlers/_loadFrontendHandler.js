const path = require('path');
const Module = require('module');

const GENERATED_COMPAT_MAIN_DIR = path.resolve(__dirname, '../generated');
const GENERATED_HANDLERS_DIR = path.join(GENERATED_COMPAT_MAIN_DIR, 'handlers');

function isGeneratedCompatModule(parent) {
    return Boolean(
        parent &&
        typeof parent.filename === 'string' &&
        parent.filename.startsWith(GENERATED_COMPAT_MAIN_DIR)
    );
}

const backendWindowManagerModule = {
    openAppFlow: () => Promise.resolve(),
    getMainWindow: () => null,
    markMainWindowClosingForUpdate: () => {}
};

function loadFrontendHandler(handlerName) {
    const backendDbModule = require('../db');
    const backendInviteConfigModule = require('../inviteConfig');
    const handlerPath = path.join(GENERATED_HANDLERS_DIR, `${handlerName}.js`);

    if (!require('fs').existsSync(handlerPath)) {
        throw new Error(
            `Generated handler not found for "${handlerName}". Run "npm run sync:contract" from repository root.`
        );
    }

    const originalLoad = Module._load;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === '../db' && isGeneratedCompatModule(parent)) {
            return backendDbModule;
        }

        if (request === '../inviteConfig' && isGeneratedCompatModule(parent)) {
            return backendInviteConfigModule;
        }

        if ((request === '../windowManager' || request === '../windowManager.js') && isGeneratedCompatModule(parent)) {
            return backendWindowManagerModule;
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        return require(handlerPath);
    } finally {
        Module._load = originalLoad;
    }
}

module.exports = { loadFrontendHandler };
