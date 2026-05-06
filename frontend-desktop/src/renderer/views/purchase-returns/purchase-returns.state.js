(function () {
    const PURCHASE_RETURNS_PER_PAGE = 50;

    function createInitialState() {
        return {
            supplierAutocomplete: null,
            invoiceAutocomplete: null,
            currentInvoiceItems: [],
            isSubmitting: false,
            editingReturnId: null,
            editingOriginalInvoiceId: null,
            editingReturnItemsMap: new Map(),
            allPurchaseReturns: [],
            purchaseReturnsPage: 1,
            purchaseReturnsPerPage: PURCHASE_RETURNS_PER_PAGE,
            ar: {},
            dom: {
                app: null,
                supplierSelect: null,
                invoiceSelect: null,
                returnDateInput: null,
                returnNumberInput: null,
                originalInvoicePreview: null,
                originalInvoicePreviewText: null,
                itemsSection: null,
                itemsBody: null,
                returnTotal: null,
                saveBtn: null,
                historyContent: null
            }
        };
    }

    function initializeDomRefs(state) {
        state.dom.app = document.getElementById('app');
        state.dom.supplierSelect = document.getElementById('supplierSelect');
        state.dom.invoiceSelect = document.getElementById('invoiceSelect');
        state.dom.returnDateInput = document.getElementById('returnDate');
        state.dom.returnNumberInput = document.getElementById('returnNumber');
        state.dom.originalInvoicePreview = document.getElementById('originalInvoicePreview');
        state.dom.originalInvoicePreviewText = document.getElementById('originalInvoicePreviewText');
        state.dom.itemsSection = document.getElementById('itemsSection');
        state.dom.itemsBody = document.getElementById('itemsBody');
        state.dom.returnTotal = document.getElementById('returnTotal');
        state.dom.saveBtn = document.getElementById('saveBtn');
        state.dom.historyContent = document.getElementById('historyContent');
        return state.dom;
    }

    window.purchaseReturnsPageState = {
        createInitialState,
        initializeDomRefs
    };
})();
