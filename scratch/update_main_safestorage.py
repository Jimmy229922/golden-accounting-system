filePath = r'd:\JImmy Golden\frontend-desktop\src\main\main.js'

with open(filePath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update electron import
content = content.replace(
    "const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');",
    "const { app, BrowserWindow, dialog, ipcMain, Menu, shell, safeStorage } = require('electron');"
)

# 2. Update loadOrCreateDeviceIdentity calls
content = content.replace(
    "        const identity = loadOrCreateDeviceIdentity(storageDir);\n        const COMPANY_ID = getOrInitializeCompanyId(db);",
    "        const identity = loadOrCreateDeviceIdentity(storageDir, safeStorage);\n        const COMPANY_ID = getOrInitializeCompanyId(db);"
)
content = content.replace(
    "        const identity = loadOrCreateDeviceIdentity(storageDir);\r\n        const COMPANY_ID = getOrInitializeCompanyId(db);",
    "        const identity = loadOrCreateDeviceIdentity(storageDir, safeStorage);\r\n        const COMPANY_ID = getOrInitializeCompanyId(db);"
)

content = content.replace(
    "        const identity = loadOrCreateDeviceIdentity(storageDir);\n        if (!identity) {",
    "        const identity = loadOrCreateDeviceIdentity(storageDir, safeStorage);\n        if (!identity) {"
)
content = content.replace(
    "        const identity = loadOrCreateDeviceIdentity(storageDir);\r\n        if (!identity) {",
    "        const identity = loadOrCreateDeviceIdentity(storageDir, safeStorage);\r\n        if (!identity) {"
)

with open(filePath, 'w', encoding='utf-8') as f:
    f.write(content)

print("main.js updated with safeStorage!")
