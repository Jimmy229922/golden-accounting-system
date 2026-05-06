(function () {
    function createInitialState() {
        return {
            allItems: [],
            editingInvoiceId: null,
            isEditLocked: false,
            originalInvoiceItemTotalsByItemId: {},
            supplierAutocomplete: null,
            isSubmitting: false,
            ar: {},
            dom: {
                app: null,
                supplierSelect: null,
                invoiceDateInput: null,
                invoiceItemsBody: null,
                selectedItemAvailability: null,
                discountTypeSelect: null,
                discountValueInput: null,
                paidAmountInput: null,
                invoiceSubtotalSpan: null,
                invoiceDiscountAmountSpan: null,
                invoiceTotalSpan: null,
                invoicePaidDisplaySpan: null,
                invoiceRemainingSpan: null,
                invoiceForm: null
            }
        };
    }

    function initializeDomRefs(state) {
        state.dom.app = document.getElementById('app');
        state.dom.supplierSelect = document.getElementById('supplierSelect');
        state.dom.invoiceDateInput = document.getElementById('invoiceDate');
        state.dom.invoiceItemsBody = document.getElementById('invoiceItemsBody');
        state.dom.selectedItemAvailability = document.getElementById('selectedItemAvailability');
        state.dom.discountTypeSelect = document.getElementById('discountType');
        state.dom.discountValueInput = document.getElementById('discountValue');
        state.dom.paidAmountInput = document.getElementById('paidAmount');
        state.dom.invoiceSubtotalSpan = document.getElementById('invoiceSubtotal');
        state.dom.invoiceDiscountAmountSpan = document.getElementById('invoiceDiscountAmount');
        state.dom.invoiceTotalSpan = document.getElementById('invoiceTotal');
        state.dom.invoicePaidDisplaySpan = document.getElementById('invoicePaidDisplay');
        state.dom.invoiceRemainingSpan = document.getElementById('invoiceRemaining');
        state.dom.invoiceForm = document.getElementById('invoiceForm');
        return state.dom;
    }

    window.purchasesPageState = {
        createInitialState,
        initializeDomRefs
    };
})();
