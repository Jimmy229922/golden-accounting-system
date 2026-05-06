(function () {
    const SALES_RETURNS_PER_PAGE = 50;

    function createInitialState() {
        return {
            customerAutocomplete: null,
            invoiceAutocomplete: null,
            currentInvoiceItems: [],
            isSubmitting: false,
            editingReturnId: null,
            editingOriginalInvoiceId: null,
            editingReturnItemsMap: new Map(),
            allSalesReturns: [],
            salesReturnsPage: 1,
            salesReturnsPerPage: SALES_RETURNS_PER_PAGE,
            ar: {},
            dom: {
                app: null,
                customerSelect: null,
                invoiceSelect: null,
                returnDateInput: null,
                returnNumberInput: null,
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
        state.dom.customerSelect = document.getElementById('customerSelect');
        state.dom.invoiceSelect = document.getElementById('invoiceSelect');
        state.dom.returnDateInput = document.getElementById('returnDate');
        state.dom.returnNumberInput = document.getElementById('returnNumber');
        state.dom.itemsSection = document.getElementById('itemsSection');
        state.dom.itemsBody = document.getElementById('itemsBody');
        state.dom.returnTotal = document.getElementById('returnTotal');
        state.dom.saveBtn = document.getElementById('saveBtn');
        state.dom.historyContent = document.getElementById('historyContent');
        return state.dom;
    }

    window.salesReturnsPageState = {
        createInitialState,
        initializeDomRefs
    };
})();
