(function () {
    async function getNextReturnNumber() {
        return window.electronAPI.getNextInvoiceNumber('sales_return');
    }

    async function getCustomers() {
        const customers = await window.electronAPI.getCustomers();
        return customers.filter((c) => c.type === 'customer' || c.type === 'both');
    }

    async function getCustomerInvoices(customerId) {
        return window.electronAPI.getCustomerSalesInvoices(customerId);
    }

    async function getInvoiceItems(invoiceId) {
        return window.electronAPI.getInvoiceItemsForReturn(invoiceId, 'sales');
    }

    async function saveReturn(payload) {
        return window.electronAPI.saveSalesReturn(payload);
    }

    async function updateReturn(payload) {
        return window.electronAPI.updateSalesReturn(payload);
    }

    async function getReturns() {
        return window.electronAPI.getSalesReturns();
    }

    async function getReturnDetails(returnId) {
        return window.electronAPI.getSalesReturnDetails(returnId);
    }

    async function deleteReturn(returnId) {
        return window.electronAPI.deleteSalesReturn(returnId);
    }

    window.salesReturnsPageApi = {
        getNextReturnNumber,
        getCustomers,
        getCustomerInvoices,
        getInvoiceItems,
        saveReturn,
        updateReturn,
        getReturns,
        getReturnDetails,
        deleteReturn
    };
})();
