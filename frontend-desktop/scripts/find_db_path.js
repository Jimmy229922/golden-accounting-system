const { app } = require('electron');
const path = require('path');

app.whenReady().then(() => {
    console.log("DB_PATH_START");
    console.log(path.join(app.getPath('userData'), 'accounting.db'));
    console.log("DB_PATH_END");
    app.quit();
});
