(function () {
    async function getNextReturnNumber() {
        return window.electronAPI.getNextInvoiceNumber('purchase_return');
    }

    async function getSuppliers() {
        const customers = await window.electronAPI.getCustomers();
        return customers.filter((c) => c.type === 'supplier' || c.type === 'both');
    }

    async function getSupplierInvoices(supplierId) {
        return window.electronAPI.getSupplierPurchaseInvoices(supplierId);
    }

    async function getInvoiceItems(invoiceId) {
        return window.electronAPI.getInvoiceItemsForReturn(invoiceId, 'purchase');
    }

    async function saveReturn(payload) {
        return window.electronAPI.savePurchaseReturn(payload);
    }

    async function updateReturn(payload) {
        return window.electronAPI.updatePurchaseReturn(payload);
    }

    async function getReturns() {
        return window.electronAPI.getPurchaseReturns();
    }

    async function getReturnDetails(returnId) {
        return window.electronAPI.getPurchaseReturnDetails(returnId);
    }

    async function deleteReturn(returnId) {
        return window.electronAPI.deletePurchaseReturn(returnId);
    }

    window.purchaseReturnsPageApi = {
        getNextReturnNumber,
        getSuppliers,
        getSupplierInvoices,
        getInvoiceItems,
        saveReturn,
        updateReturn,
        getReturns,
        getReturnDetails,
        deleteReturn
    };
})();
