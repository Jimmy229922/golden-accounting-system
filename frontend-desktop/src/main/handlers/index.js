const { ipcMain } = require('electron');
const { checkBackendHealth } = require('../backendClient');
const auth = require('./auth');

let isAuthIpcRegistered = false;
let isFullIpcRegistered = false;

function setupAuthIPC() {
    if (isAuthIpcRegistered) {
        return;
    }
    isAuthIpcRegistered = true;

    ipcMain.handle('backend-health-check', async () => {
        return checkBackendHealth();
    });

    auth.register();
}

function setupFullIPC() {
    setupAuthIPC();

    if (isFullIpcRegistered) {
        return;
    }
    isFullIpcRegistered = true;

    const { repairWarehouseNamesEncoding } = require('./utils');
    repairWarehouseNamesEncoding();

    const units = require('./units');
    const warehouses = require('./warehouses');
    const openingBalances = require('./openingBalances');
    const items = require('./items');
    const customers = require('./customers');
    const purchases = require('./purchases');
    const sales = require('./sales');
    const treasury = require('./treasury');
    const settings = require('./settings');
    const invoices = require('./invoices');
    const reports = require('./reports');
    const backup = require('./backup');
    const pettyExpenses = require('./pettyExpenses');
    const factoryPettyExpenses = require('./factoryPettyExpenses');
    const underCollection = require('./underCollection');
    const remainingUnderCollection = require('./remainingUnderCollection');
    const exportRevenues = require('./exportRevenues');
    const localSales = require('./localSales');
    const workersManagement = require('./workersManagement');

    units.register();
    warehouses.register();
    openingBalances.register();
    items.register();
    customers.register();
    purchases.register();
    sales.register();
    treasury.register();
    settings.register();
    invoices.register();
    reports.register();
    backup.register();
    pettyExpenses.register();
    factoryPettyExpenses.register();
    underCollection.register();
    remainingUnderCollection.register();
    exportRevenues.register();
    localSales.register();
    workersManagement.register();
}

function setupIPC() {
    setupFullIPC();
}

module.exports = { setupIPC, setupAuthIPC, setupFullIPC };
