const { contextBridge, ipcRenderer } = require('electron');

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '');
const USE_REMOTE_BACKEND = String(process.env.USE_REMOTE_BACKEND || 'false').toLowerCase() === 'true';
const BACKEND_RPC_TOKEN = process.env.BACKEND_RPC_TOKEN || '';
const ipcRendererInvoke = ipcRenderer.invoke.bind(ipcRenderer);

async function invokeRemoteChannel(channel, args) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (BACKEND_RPC_TOKEN) {
            headers['x-api-token'] = BACKEND_RPC_TOKEN;
        }

        const response = await fetch(`${BACKEND_URL}/api/rpc/${encodeURIComponent(channel)}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ args })
        });

        const payload = await response.json().catch(() => ({
            ok: false,
            error: 'Invalid backend response'
        }));

        if (!response.ok || !payload.ok) {
            return {
                success: false,
                error: payload.error || `Backend request failed (${response.status})`
            };
        }

        return payload.result;
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Backend request failed'
        };
    }
}

function invokeChannel(channel, ...args) {
    if (!USE_REMOTE_BACKEND) {
        return ipcRendererInvoke(channel, ...args);
    }

    return invokeRemoteChannel(channel, args);
}

contextBridge.exposeInMainWorld('electronAPI', {
    // Backend integration
    checkBackendHealth: () => invokeChannel('backend-health-check'),

    // Units API
    getUnits: () => invokeChannel('get-units'),
    addUnit: (name) => invokeChannel('add-unit', name),
    updateUnit: (unit) => invokeChannel('update-unit', unit),
    deleteUnit: (id) => invokeChannel('delete-unit', id),

    // Items API
    getItems: () => invokeChannel('get-items'),
    getItemStockDetails: (id) => invokeChannel('get-item-stock-details', id),
    getItemMovements: (id) => invokeChannel('get-item-movements', id),
    addItem: (item) => invokeChannel('add-item', item),
    updateItem: (item) => invokeChannel('update-item', item),
    deleteItem: (id) => invokeChannel('delete-item', id),

    // Warehouses & Opening Balance
    getWarehouses: () => invokeChannel('get-warehouses'),
    addWarehouse: (name) => invokeChannel('add-warehouse', name),
    updateWarehouse: (data) => invokeChannel('update-warehouse', data),
    deleteWarehouse: (id) => invokeChannel('delete-warehouse', id),
    getOpeningBalances: () => invokeChannel('get-opening-balances'),
    saveOpeningBalances: (entries) => invokeChannel('save-opening-balances', { entries }),
    addOpeningBalance: (entry) => invokeChannel('add-opening-balance', entry),
    updateOpeningBalance: (entry) => invokeChannel('update-opening-balance', entry),
    deleteOpeningBalance: (id) => invokeChannel('delete-opening-balance', id),
    addOpeningBalanceGroup: (data) => invokeChannel('add-opening-balance-group', data),
    getOpeningBalanceGroups: () => invokeChannel('get-opening-balance-groups'),
    getOpeningBalanceGroup: (id) => invokeChannel('get-opening-balance-group', id),
    getGroupDetails: (groupId) => invokeChannel('get-group-details', groupId),
    updateOpeningBalanceGroup: (data) => invokeChannel('update-opening-balance-group', data),
    deleteOpeningBalanceGroup: (groupId) => invokeChannel('delete-opening-balance-group', groupId),

    // Customers API
    getCustomers: () => invokeChannel('get-customers'),
    getDebtorCreditorReport: (filters) => invokeChannel('get-debtor-creditor-report', filters),
    addCustomer: (customer) => invokeChannel('add-customer', customer),
    updateCustomer: (customer) => invokeChannel('update-customer', customer),
    deleteCustomer: (id) => invokeChannel('delete-customer', id),

    // Suppliers API
    getSuppliers: () => invokeChannel('get-suppliers'),
    addSupplier: (supplier) => invokeChannel('add-supplier', supplier),
    deleteSupplier: (id) => invokeChannel('delete-supplier', id),

    // Purchase Invoices API
    getPurchaseInvoices: () => invokeChannel('get-purchase-invoices'),
    savePurchaseInvoice: (data) => invokeChannel('save-purchase-invoice', data),

    // Sales Invoices API
    getSalesInvoices: () => invokeChannel('get-sales-invoices'),
    saveSalesInvoice: (data) => invokeChannel('save-sales-invoice', data),
    getSalesShiftClosePreview: () => invokeChannel('get-sales-shift-close-preview'),
    createSalesShiftClosing: (data) => invokeChannel('create-sales-shift-closing', data),
    getSalesShiftClosings: (params = {}) => invokeChannel('get-sales-shift-closings', params),
    updateSalesShiftClosing: (data) => invokeChannel('update-sales-shift-closing', data),
    deleteSalesShiftClosing: (id) => invokeChannel('delete-sales-shift-closing', id),

    // Treasury API
    getTreasuryBalance: () => invokeChannel('get-treasury-balance'),
    getTreasuryTransactions: () => invokeChannel('get-treasury-transactions'),
    getNextTreasuryVoucherNumber: (type) => invokeChannel('get-next-treasury-voucher-number', type),
    addTreasuryTransaction: (data) => invokeChannel('add-treasury-transaction', data),
    updateTreasuryTransaction: (data) => invokeChannel('update-treasury-transaction', data),
    deleteTreasuryTransaction: (id) => invokeChannel('delete-treasury-transaction', id),
    searchTreasuryByVoucher: (voucherNumber) => invokeChannel('search-treasury-by-voucher', voucherNumber),

    // Inventory API
    getItemTransactions: (itemId, startDate = null, endDate = null) => invokeChannel('get-item-transactions', { itemId, startDate, endDate }),
    getDamagedStockEntries: (filters = {}) => invokeChannel('get-damaged-stock-entries', filters),
    addDamagedStockEntry: (data) => invokeChannel('add-damaged-stock-entry', data),
    updateDamagedStockEntry: (data) => invokeChannel('update-damaged-stock-entry', data),
    deleteDamagedStockEntry: (id) => invokeChannel('delete-damaged-stock-entry', id),

    // Dashboard API
    getDashboardStats: (filters = {}) => invokeChannel('get-dashboard-stats', filters),

    // Helper API
    getNextInvoiceNumber: (type) => invokeChannel('get-next-invoice-number', type),

    // Reports API
    getAllReports: (filters) => invokeChannel('get-all-reports', filters),
    getCustomerFullReport: (customerId) => invokeChannel('get-customer-full-report', customerId),
    getCustomerDetailedStatement: (params) => invokeChannel('get-customer-detailed-statement', params),
    getStatementItemDetails: (params) => invokeChannel('get-statement-item-details', params),
    deleteInvoice: (id, type) => invokeChannel('delete-invoice', { id, type }),
    getInvoiceWithDetails: (id, type) => invokeChannel('get-invoice-with-details', { id, type }),
    updateSalesInvoice: (data) => invokeChannel('update-sales-invoice', data),
    updatePurchaseInvoice: (data) => invokeChannel('update-purchase-invoice', data),

    // Settings API
    getSettings: () => invokeChannel('get-settings'),
    saveSettings: (settings) => invokeChannel('save-settings', settings),

    // Invite Code API
    getMachineId: () => invokeChannel('get-machine-id'),
    checkInviteStatus: () => invokeChannel('get-invite-status'),
    submitInviteCode: (code) => invokeChannel('submit-invite-code', code),
    notifyInviteUnlocked: () => ipcRenderer.send('invite-unlocked'),

    // Auth API
    getAuthStatus: () => invokeChannel('get-auth-status'),
    setupAuthAccount: (payload) => invokeChannel('setup-auth-account', payload),
    loginAuthAccount: (payload) => invokeChannel('login-auth-account', payload),
    getActiveAuthUser: (payload = {}) => invokeChannel('get-active-auth-user', payload),
    getAuthUsers: (payload = {}) => invokeChannel('get-auth-users', payload),
    createAuthUser: (payload) => invokeChannel('create-auth-user', payload),
    setAuthUserActive: (payload) => invokeChannel('set-auth-user-active', payload),
    resetAuthUserPassword: (payload) => invokeChannel('reset-auth-user-password', payload),
    getUserPermissions: (payload) => invokeChannel('get-user-permissions', payload),
    updateUserPermissions: (payload) => invokeChannel('update-user-permissions', payload),
    getMyPermissions: (payload) => invokeChannel('get-my-permissions', payload),
    setAuthSessionToken: (token) => ipcRenderer.send('auth-session-token', token),
    getAuthSessionToken: () => ipcRenderer.invoke('get-auth-session-token'),
    notifyAuthUnlocked: () => ipcRenderer.send('auth-unlocked'),

    // Backup & Restore API
    backupDatabase: (payload = {}) => invokeChannel('backup-database', payload),
    backupDatabaseToCloud: (payload = {}) => invokeChannel('backup-database-to-cloud', payload),
    listCloudBackups: (payload = {}) => invokeChannel('list-cloud-backups', payload),
    restoreDatabaseFromCloud: (payload) => invokeChannel('restore-database-from-cloud', payload),
    restoreDatabase: () => invokeChannel('restore-database'),
    restartApp: () => invokeChannel('restart-app'),
    
    // PDF Export
    saveDebtorCreditorPdf: (options) => invokeChannel('save-debtor-creditor-pdf', options),
    saveCustomerReportPdf: (options) => invokeChannel('save-customer-report-pdf', options),
    saveCustomerSummaryPdf: (options) => invokeChannel('save-customer-summary-pdf', options),
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    printCurrentWindow: (options) => ipcRenderer.invoke('print-current-window', options),

    // Summary Statement
    getCustomerSummaryStatement: (params) => invokeChannel('get-customer-summary-statement', params),

    // Sales Returns API
    getSalesReturns: () => invokeChannel('get-sales-returns'),
    getCustomerSalesInvoices: (customerId) => invokeChannel('get-customer-sales-invoices', customerId),
    getInvoiceItemsForReturn: (invoiceId, type) => invokeChannel('get-invoice-items-for-return', { invoiceId, type }),
    saveSalesReturn: (data) => invokeChannel('save-sales-return', data),
    updateSalesReturn: (data) => invokeChannel('update-sales-return', data),
    deleteSalesReturn: (id) => invokeChannel('delete-sales-return', id),

    // Purchase Returns API
    getPurchaseReturns: () => invokeChannel('get-purchase-returns'),
    getSupplierPurchaseInvoices: (supplierId) => invokeChannel('get-supplier-purchase-invoices', supplierId),
    savePurchaseReturn: (data) => invokeChannel('save-purchase-return', data),
    updatePurchaseReturn: (data) => invokeChannel('update-purchase-return', data),
    deletePurchaseReturn: (id) => invokeChannel('delete-purchase-return', id),

    // Invoice & Return Details API (for Global Search)
    getSalesInvoiceDetails: (invoiceId) => invokeChannel('get-sales-invoice-details', invoiceId),
    getPurchaseInvoiceDetails: (invoiceId) => invokeChannel('get-purchase-invoice-details', invoiceId),
    getSalesReturnDetails: (returnId) => invokeChannel('get-sales-return-details', returnId),
    getPurchaseReturnDetails: (returnId) => invokeChannel('get-purchase-return-details', returnId)
});
