const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');
const { INVITE_CODE, getMachineId, generateActivationCode } = require('./inviteConfig');
const customIconPath = path.join(__dirname, 'assets/icon.ico');
const appIconPath = (!app.isPackaged && fs.existsSync(customIconPath)) ? customIconPath : process.execPath;

let mainWindow = null;
let inviteWindow = null;
let authWindow = null;
let inviteUnlocked = false;
let authUnlocked = false;
let isMainWindowClosingConfirmed = false;

function isInviteValid() {
    try {
        const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('invite_code', 'invite_expiry', 'renew_count')").all();
        const map = {};
        rows.forEach(r => { map[r.key] = r.value; });
        
        const machineId = getMachineId();
        const renewCount = parseInt(map.renew_count || '0', 10);
        
        let codeMatches = false;
        if (map.invite_code === INVITE_CODE) {
            codeMatches = true;
        } else {
            const expectedDynamicCode = generateActivationCode(`${machineId}-${renewCount}`);
            codeMatches = (map.invite_code === expectedDynamicCode);
        }

        const expiry = map.invite_expiry ? new Date(map.invite_expiry) : null;
        const withinRange = expiry ? expiry > new Date() : false;
        return codeMatches && withinRange;
    } catch (err) {
        console.error('[invite] validation error:', err);
        return false;
    }
}

/**
 * Calculate responsive window size based on the primary display.
 * Scales proportionally from a 1080p reference, clamped between 0.85x and 1.35x.
 */
function getDialogSize(baseWidth, baseHeight) {
    try {
        const display = screen.getPrimaryDisplay();
        const { height: sh, width: sw } = display.workAreaSize;
        const scale = Math.min(Math.max(sh / 1080, 0.85), 1.35);
        let w = Math.round(baseWidth * scale);
        let h = Math.round(baseHeight * scale);
        w = Math.min(w, Math.round(sw * 0.85));
        h = Math.min(h, Math.round(sh * 0.85));
        return { width: Math.max(w, 340), height: Math.max(h, 300) };
    } catch (err) {
        return { width: baseWidth, height: baseHeight };
    }
}

function showInviteWindow() {
    return new Promise((resolve) => {
        if (inviteWindow) {
            // inviteWindow.focus() removed to prevent aggressive focus stealing Native Windows issues
            return;
        }

        const { width, height } = getDialogSize(460, 420);
        inviteWindow = new BrowserWindow({
            width,
            height,
            resizable: false,
            autoHideMenuBar: true,
            icon: appIconPath,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        const invitePath = path.join(__dirname, '../renderer/views/invite/index.html');
        inviteWindow.loadFile(invitePath).catch(e => {
            console.error('Failed to load invite view:', e);
            dialog.showErrorBox('Load Error', `Failed to load invite view:\n${invitePath}\n${e.message}`);
        });

        const onUnlocked = () => {
            inviteUnlocked = true;
            ipcMain.removeListener('invite-unlocked', onUnlocked);
            if (inviteWindow) {
                inviteWindow.close();
            }
        };

        ipcMain.once('invite-unlocked', onUnlocked);

        inviteWindow.on('closed', () => {
            inviteWindow = null;
            if (inviteUnlocked) {
                // Resolve only after the window is fully destroyed
                resolve();
            } else if (!mainWindow) {
                // User closed without unlocking — exit to prevent bypassing
                app.quit();
            }
        });
    });
}

function showAuthWindow() {
    return new Promise((resolve) => {
        if (authWindow) {
            // authWindow.focus() removed to prevent focus stealing regression
            return;
        }

        const { width, height } = getDialogSize(460, 440);
        authWindow = new BrowserWindow({
            width,
            height,
            resizable: false,
            autoHideMenuBar: true,
            icon: appIconPath,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        const authPath = path.join(__dirname, '../renderer/views/auth/index.html');
        authWindow.loadFile(authPath).catch((error) => {
            console.error('Failed to load auth view:', error);
            dialog.showErrorBox('Load Error', `Failed to load auth view:\n${authPath}\n${error.message}`);
        });

        const onUnlocked = () => {
            authUnlocked = true;
            ipcMain.removeListener('auth-unlocked', onUnlocked);
            if (authWindow) {
                authWindow.close();
            }
        };

        ipcMain.once('auth-unlocked', onUnlocked);

        authWindow.on('closed', () => {
            authWindow = null;
            if (authUnlocked) {
                // Resolve only after the window is fully destroyed
                resolve();
            } else if (!mainWindow) {
                // User closed without login — exit to prevent bypassing
                app.quit();
            }
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        backgroundColor: '#0b1220', // Dark theme background to prevent white flash
        autoHideMenuBar: true, // Hide the default menu bar
        icon: appIconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Remove the application menu completely
    mainWindow.setMenuBarVisibility(false);

    // Load the shell as the starting page
    const viewPath = path.join(__dirname, '../renderer/views/shell/index.html');
    mainWindow.loadFile(viewPath).catch(e => {
        console.error('Failed to load view:', e);
        dialog.showErrorBox('Load Error', `Failed to load view:\n${viewPath}\n${e.message}`);
    });

    mainWindow.once('ready-to-show', () => {
        if (!mainWindow) return;
        mainWindow.maximize();
        mainWindow.show();
        // Removed mainWindow.focus() to prevent focus stealing on initial load if the user is typing somewhere else
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        const isOpenDevToolsShortcut = input.type === 'keyDown'
            && input.control
            && input.shift
            && String(input.key || '').toLowerCase() === 'i';

        if (!isOpenDevToolsShortcut) {
            return;
        }

        event.preventDefault();
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    });

    // Open the DevTools (optional, helpful for development)
    // mainWindow.webContents.openDevTools();

    mainWindow.on('close', async (event) => {
        if (isMainWindowClosingConfirmed) {
            return;
        }

        event.preventDefault();

        const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['تسجيل الخروج', 'إلغاء'],
            noLink: true,
            defaultId: 0,
            cancelId: 1,
            title: 'تأكيد تسجيل الخروج',
            message: 'هل أنت متأكد أنك تريد تسجيل الخروج؟'
        });

        if (result.response !== 0) {
            return;
        }

        try {
            await mainWindow.webContents.executeJavaScript(`
                try {
                    localStorage.removeItem('auth_session_token');
                    sessionStorage.removeItem('user_permissions_cache');
                } catch (e) {}
            `);
        } catch (error) {
            console.error('[auth] logout cleanup failed:', error);
        }

        isMainWindowClosingConfirmed = true;
        app.quit();
    });

    mainWindow.on('closed', () => {
        isMainWindowClosingConfirmed = false;
        mainWindow = null;
    });
}

/**
 * Full app opening flow: invite gate → auth gate → main window.
 * NOTE: Invite screen is disabled for distributed versions.
 */
async function openAppFlow() {
    inviteUnlocked = false;
    authUnlocked = false;
    // Invite screen is completely disabled - skip validation
    // const valid = isInviteValid();
    // if (!valid) {
    //     await showInviteWindow();
    // }
    await showAuthWindow();
    if (!mainWindow) {
        createWindow();
    }
}

/**
 * Returns the current main window reference (may be null).
 */
function getMainWindow() {
    return mainWindow;
}

module.exports = {
    openAppFlow,
    getMainWindow
};
