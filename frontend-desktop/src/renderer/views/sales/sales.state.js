(function () {
    function createInitialState() {
        return {
            allItems: [],
            editingInvoiceId: null,
            isEditLocked: false,
            originalInvoiceItemTotalsByItemId: {},
            customerAutocomplete: null,
            isSubmitting: false,
            shiftClosings: [],
            editingShiftClosingId: null,
            shiftClosePreview: null,
            ar: {},
            dom: {
                app: null,
                customerSelect: null,
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
                printPreviewModal: null,
                shiftCloseModal: null,
                shiftClosePeriodStartSpan: null,
                shiftClosePeriodEndSpan: null,
                shiftCloseTotalInput: null,
                shiftCloseCollectionsInput: null,
                shiftCloseDrawerInput: null,
                shiftCloseDifferenceSpan: null,
                shiftCloseNotesInput: null,
                shiftCloseCreatedByInput: null,
                shiftCloseSearchInput: null,
                shiftCloseTableBody: null,
                shiftCloseSubmitBtn: null,
                shiftCloseSubmitLabel: null
            }
        };
    }

    function initializeDomRefs(state) {
        state.dom.app = document.getElementById('app');
        state.dom.customerSelect = document.getElementById('customerSelect');
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
        state.dom.printPreviewModal = document.getElementById('salesPrintPreviewModal');
        state.dom.shiftCloseModal = document.getElementById('salesShiftCloseModal');
        state.dom.shiftClosePeriodStartSpan = document.getElementById('shiftClosePeriodStart');
        state.dom.shiftClosePeriodEndSpan = document.getElementById('shiftClosePeriodEnd');
        state.dom.shiftCloseTotalInput = document.getElementById('shiftCloseTotal');
        state.dom.shiftCloseCollectionsInput = document.getElementById('shiftCloseCollections');
        state.dom.shiftCloseDrawerInput = document.getElementById('shiftCloseDrawer');
        state.dom.shiftCloseDifferenceSpan = document.getElementById('shiftCloseDifference');
        state.dom.shiftCloseNotesInput = document.getElementById('shiftCloseNotes');
        state.dom.shiftCloseCreatedByInput = document.getElementById('shiftCloseCreatedBy');
        state.dom.shiftCloseSearchInput = document.getElementById('shiftCloseSearch');
        state.dom.shiftCloseTableBody = document.getElementById('shiftCloseTableBody');
        state.dom.shiftCloseSubmitBtn = document.getElementById('shiftCloseSubmitBtn');
        state.dom.shiftCloseSubmitLabel = document.getElementById('shiftCloseSubmitLabel');
        return state.dom;
    }

    window.salesPageState = {
        createInitialState,
        initializeDomRefs
    };
})();

