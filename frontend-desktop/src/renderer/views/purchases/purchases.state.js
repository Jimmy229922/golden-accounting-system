(function () {
    function createInitialState() {
        return {
            allItems: [],
            editingInvoiceId: null,
            isEditLocked: false,
            originalInvoiceItemTotalsByItemId: {},
            supplierAutocomplete: null,
            isSubmitting: false,
            activeWeightsRow: null,
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
                invoiceForm: null,
                baskeelModal: null,
                baskeelWeightsList: null,
                baskeelRawTotal: null,
                baskeelDiscountTotal: null,
                baskeelNetTotal: null,
                quickRawModal: null,
                quickRawInput: null,
                deleteConfirmModal: null
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
        state.dom.baskeelModal = document.getElementById('baskeelModal');
        state.dom.baskeelWeightsList = document.getElementById('baskeelWeightsList');
        state.dom.baskeelRawTotal = document.getElementById('baskeelRawTotal');
        state.dom.baskeelDiscountTotal = document.getElementById('baskeelDiscountTotal');
        state.dom.baskeelNetTotal = document.getElementById('baskeelNetTotal');
        state.dom.quickRawModal = document.getElementById('quickRawModal');
        state.dom.quickRawInput = document.getElementById('quickRawInput');
        state.dom.deleteConfirmModal = document.getElementById('deleteConfirmModal');
        return state.dom;
    }

    window.purchasesPageState = {
        createInitialState,
        initializeDomRefs
    };
})();
