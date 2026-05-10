const { ipcMain } = require('electron');
// Handlers are loaded from frontend-desktop/src/main/handlers via local wrappers.
// We keep this index local only to customize backend-health-check for backend RPC mode.
const { repairWarehouseNamesEncoding } = require('./utils');
const auth = require('./auth');
const units = require('./units');
const warehouses = require('./warehouses');
const openingBalances = require('./openingBalances');
const items = require('./items');
const customers = require('./customers');
const suppliers = require('./suppliers');
const purchases = require('./purchases');
const sales = require('./sales');
const treasury = require('./treasury');
const settings = require('./settings');
const invoices = require('./invoices');
const reports = require('./reports');
const backup = require('./backup');
const salesReturns = require('./salesReturns');
const purchaseReturns = require('./purchaseReturns');
const pettyExpenses = require('./pettyExpenses');
const pettyBags = require('./pettyBags');
const pettyInspection = require('./pettyInspection');
const pettyShippingClearance = require('./pettyShippingClearance');
const pettyOperation = require('./pettyOperation');
const underCollection = require('./underCollection');
const remainingUnderCollection = require('./remainingUnderCollection');
const exportRevenues = require('./exportRevenues');
const localSales = require('./localSales');

function setupIPC() {
    repairWarehouseNamesEncoding();

    ipcMain.handle('backend-health-check', async () => {
        return {
            connected: true,
            baseUrl: null,
            payload: {
                status: 'ok',
                service: 'accounting-system-backend',
                mode: 'backend-rpc'
            }
        };
    });

    auth.register();
    units.register();
    warehouses.register();
    openingBalances.register();
    items.register();
    customers.register();
    suppliers.register();
    purchases.register();
    sales.register();
    treasury.register();
    settings.register();
    invoices.register();
    reports.register();
    backup.register();
    salesReturns.register();
    purchaseReturns.register();
    pettyExpenses.register();
    pettyBags.register();
    pettyInspection.register();
    pettyShippingClearance.register();
    pettyOperation.register();
    underCollection.register();
    remainingUnderCollection.register();
    exportRevenues.register();
    localSales.register();
}

module.exports = { setupIPC };
