(function () {
    async function getNextInvoiceNumber() {
        return window.electronAPI.getNextInvoiceNumber('purchase');
    }

    async function getInvoiceWithDetails(id) {
        return window.electronAPI.getInvoiceWithDetails(id, 'purchase');
    }

    async function getSuppliers() {
        const customers = await window.electronAPI.getCustomers();
        return customers.filter((c) => c.type === 'supplier' || c.type === 'both');
    }

    async function getPurchaseInvoices() {
        return window.electronAPI.getPurchaseInvoices();
    }

    async function getItems() {
        return window.electronAPI.getItems();
    }

    async function savePurchaseInvoice(invoiceData) {
        return window.electronAPI.savePurchaseInvoice(invoiceData);
    }

    async function updatePurchaseInvoice(invoiceData) {
        return window.electronAPI.updatePurchaseInvoice(invoiceData);
    }

    window.purchasesPageApi = {
        getNextInvoiceNumber,
        getInvoiceWithDetails,
        getSuppliers,
        getPurchaseInvoices,
        getItems,
        savePurchaseInvoice,
        updatePurchaseInvoice
    };
})();
