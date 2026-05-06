const { app, shell } = require('electron');
const path = require('path');

app.whenReady().then(() => {
    const folderPath = path.join(app.getPath('desktop'), 'برنامج الحسابات');
    const fs = require('fs');
    if(!fs.existsSync(folderPath)){
        fs.mkdirSync(folderPath);
    }
    const target = process.execPath;
    const shortcutPath = path.join(folderPath, 'تشغيل النظام.lnk');
    const success = shell.writeShortcutLink(shortcutPath, 'create', { target, description: 'Accounting System' });
    console.log('Shortcut created:', success);
    app.quit();
});