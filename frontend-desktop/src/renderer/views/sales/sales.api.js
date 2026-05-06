(function () {
    async function getNextInvoiceNumber() {
        return window.electronAPI.getNextInvoiceNumber('sales');
    }

    async function getInvoiceWithDetails(id) {
        return window.electronAPI.getInvoiceWithDetails(id, 'sales');
    }

    async function getCustomers() {
        const customers = await window.electronAPI.getCustomers();
        return customers.filter((c) => c.type === 'customer' || c.type === 'both');
    }

    async function getSalesInvoices() {
        return window.electronAPI.getSalesInvoices();
    }

    async function getItems() {
        return window.electronAPI.getItems();
    }

    async function saveInvoice(invoiceData) {
        return window.electronAPI.saveSalesInvoice(invoiceData);
    }

    async function updateInvoice(invoiceData) {
        return window.electronAPI.updateSalesInvoice(invoiceData);
    }

    async function getShiftClosePreview() {
        return window.electronAPI.getSalesShiftClosePreview();
    }

    async function createShiftClosing(data) {
        return window.electronAPI.createSalesShiftClosing(data);
    }

    async function getShiftClosings(params = {}) {
        return window.electronAPI.getSalesShiftClosings(params);
    }

    async function updateShiftClosing(data) {
        return window.electronAPI.updateSalesShiftClosing(data);
    }

    async function deleteShiftClosing(id) {
        return window.electronAPI.deleteSalesShiftClosing(id);
    }

    window.salesPageApi = {
        getNextInvoiceNumber,
        getInvoiceWithDetails,
        getCustomers,
        getSalesInvoices,
        getItems,
        saveInvoice,
        updateInvoice,
        getShiftClosePreview,
        createShiftClosing,
        getShiftClosings,
        updateShiftClosing,
        deleteShiftClosing
    };
})();

