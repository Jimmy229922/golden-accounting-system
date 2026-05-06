const purchasesState = window.purchasesPageState.createInitialState();
const purchasesApi = window.purchasesPageApi;
const purchasesRender = window.purchasesPageRender;
const purchasesEvents = window.purchasesPageEvents;
const { t, fmt } = window.i18n?.createPageHelpers?.(() => purchasesState.ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

document.addEventListener('DOMContentLoaded', async () => {    // Reset submitting state just in case
    purchasesState.isSubmitting = false;
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        purchasesState.ar = await window.i18n.loadArabicDictionary();
    }

    purchasesRender.renderPage({ t, getNavHTML: buildTopNavHTML });

    if (window.FieldSystem && typeof window.FieldSystem.enable === 'function') {
        window.FieldSystem.enable(document, { watch: true });
    }

    initializeElements();

    if (purchasesState.dom.invoiceDateInput) {
        purchasesState.dom.invoiceDateInput.valueAsDate = new Date();
    }

    Promise.all([
        loadSuppliers(),
        loadItems(),
        loadInvoiceNumberSuggestions()
    ]).then(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('editId');
        if (editId) {
            loadInvoiceForEdit(editId);
        } else {
            initializeNewInvoice();
        }
    });
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function initializeElements() {
    window.purchasesPageState.initializeDomRefs(purchasesState);

    purchasesEvents.bindStaticEvents({
        root: purchasesState.dom.app,
        dom: purchasesState.dom,
        handlers: {
            onSupplierChange: handleSupplierChange,
            onAddRow: () => addInvoiceRow(),
            onSubmitInvoice: submitInvoice,
            onLoadPrevInvoice: () => navigateInvoice(-1),
            onLoadNextInvoice: () => navigateInvoice(1),
            onRemoveRow: removeRow
        }
    });

    purchasesEvents.bindRowsEvents({
        dom: purchasesState.dom,
        handlers: {
            onItemSelect,
            onRowInput,
            onRowArrowNavigate: handleRowArrowNavigation
        }
    });

    if (purchasesState.dom.discountTypeSelect) {
        purchasesState.dom.discountTypeSelect.addEventListener('change', () => calculateInvoiceTotal());
    }

    if (purchasesState.dom.discountValueInput) {
        purchasesState.dom.discountValueInput.addEventListener('input', () => calculateInvoiceTotal());
    }

    if (purchasesState.dom.paidAmountInput) {
        purchasesState.dom.paidAmountInput.addEventListener('input', () => calculateInvoiceTotal());
    }

    const invoiceNumberInput = document.getElementById('invoiceNumber');
    if (invoiceNumberInput) {
        invoiceNumberInput.addEventListener('input', updateInvoiceNavigationButtons);
        invoiceNumberInput.addEventListener('change', updateInvoiceNavigationButtons);
    }
}

function isEditLocked() {
    return Boolean(purchasesState.editingInvoiceId && purchasesState.isEditLocked);
}

function setEditLocked(locked) {
    const form = purchasesState.dom.invoiceForm;
    if (!form) return;

    purchasesState.isEditLocked = Boolean(locked);
    const lockActive = Boolean(purchasesState.editingInvoiceId && purchasesState.isEditLocked);
    const submitBtn = form.querySelector('[data-action="submit-invoice"]');
    const shell = form.querySelector('.invoice-shell');
    const statusChip = form.querySelector('.form-status-chip');
    const titleRow = form.querySelector('.form-title-row');
    let lockHint = form.querySelector('[data-edit-lock-hint="true"]');

    if (lockActive && !lockHint) {
        lockHint = document.createElement('div');
        lockHint.dataset.editLockHint = 'true';
        lockHint.textContent = 'الوضع الحالي: عرض فقط. اضغط "تعديل الفاتورة" لفتح الحقول.';
        lockHint.style.margin = '10px 0 0 0';
        lockHint.style.padding = '10px 12px';
        lockHint.style.borderRadius = '10px';
        lockHint.style.background = 'rgba(245, 158, 11, 0.18)';
        lockHint.style.border = '1px solid rgba(245, 158, 11, 0.6)';
        lockHint.style.color = 'var(--text-color)';
        lockHint.style.fontWeight = '700';
        if (titleRow && titleRow.parentNode) {
            titleRow.parentNode.insertBefore(lockHint, titleRow.nextSibling);
        }
    }

    if (!lockActive && lockHint) {
        lockHint.remove();
    }

    const controls = form.querySelectorAll('input, select, textarea, button');
    controls.forEach((control) => {
        if (
            control.dataset.action === 'submit-invoice' ||
            control.dataset.action === 'load-prev-invoice' ||
            control.dataset.action === 'load-next-invoice'
        ) return;
        control.disabled = lockActive;

        if (lockActive) {
            control.style.cursor = 'not-allowed';
            control.style.backgroundColor = 'rgba(148, 163, 184, 0.2)';
            control.style.borderStyle = 'dashed';
            control.style.opacity = '0.72';
            control.title = 'اضغط "تعديل الفاتورة" أولاً';
        } else {
            control.style.cursor = '';
            control.style.backgroundColor = '';
            control.style.borderStyle = '';
            control.style.opacity = '';
            control.title = '';
        }
    });

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';

        if (lockActive) {
            submitBtn.textContent = 'تعديل الفاتورة';
        } else if (purchasesState.editingInvoiceId) {
            submitBtn.textContent = t('purchases.updateAndSave', 'تحديث وحفظ الفاتورة');
        } else {
            submitBtn.textContent = t('purchases.saveAndPost', 'حفظ وترحيل الفاتورة');
        }
    }

    if (statusChip) {
        if (lockActive) {
            statusChip.textContent = 'وضع عرض فقط';
        } else if (purchasesState.editingInvoiceId) {
            statusChip.textContent = 'وضع التعديل مفعل';
        } else {
            statusChip.textContent = t('purchases.formStatusChip', 'فاتورة مشتريات');
        }
    }

    if (shell) {
        if (lockActive) {
            shell.style.outline = '2px dashed #f59e0b';
            shell.style.outlineOffset = '4px';
            shell.style.opacity = '0.94';
            shell.style.filter = 'grayscale(0.2)';
        } else if (purchasesState.editingInvoiceId) {
            shell.style.outline = '2px solid #10b981';
            shell.style.outlineOffset = '4px';
            shell.style.opacity = '1';
            shell.style.filter = '';
        } else {
            shell.style.outline = '';
            shell.style.outlineOffset = '';
            shell.style.opacity = '';
            shell.style.filter = '';
        }
    }

    if (purchasesState.dom.invoiceItemsBody) {
        purchasesState.dom.invoiceItemsBody.querySelectorAll('.remove-row').forEach((removeEl) => {
            removeEl.style.pointerEvents = lockActive ? 'none' : '';
            removeEl.style.opacity = lockActive ? '0.45' : '';
        });
    }
}

async function handleSupplierChange() {
    if (isEditLocked()) return;

    if (!purchasesState.dom.supplierSelect || !purchasesState.dom.invoiceItemsBody) return;

    if (purchasesState.dom.supplierSelect.value) {
        await displaySupplierBalance();
        if (purchasesState.dom.invoiceItemsBody.children.length === 0) {
            addInvoiceRow();
        }
    } else {
        const balanceDiv = document.getElementById('supplierBalance');
        if (balanceDiv) balanceDiv.style.display = 'none';
        clearSelectedItemAvailability();
    }
}

async function initializeNewInvoice() {
    purchasesState.isEditLocked = false;
    setEditLocked(false);
    purchasesState.originalInvoiceItemTotalsByItemId = {};
    const nextId = await purchasesApi.getNextInvoiceNumber();
    const invoiceNumberInput = document.getElementById('invoiceNumber');
    if (invoiceNumberInput) {
        invoiceNumberInput.value = nextId;
    }
    calculateInvoiceTotal();
    updateInvoiceNavigationButtons();
}

async function loadInvoiceForEdit(id) {
    try {
        const invoice = await purchasesApi.getInvoiceWithDetails(id);
        if (!invoice) {
            if (window.showToast) window.showToast(t('purchases.invoiceNotFound', 'الفاتورة غير موجودة'), 'error');
            updateInvoiceNavigationButtons();
            return;
        }

        purchasesState.editingInvoiceId = id;
        purchasesState.originalInvoiceItemTotalsByItemId = {};
        (invoice.items || []).forEach((item) => {
            const itemId = parseInt(item.item_id, 10);
            const qty = Number(item.quantity) || 0;
            if (!Number.isFinite(itemId) || qty <= 0) return;
            purchasesState.originalInvoiceItemTotalsByItemId[itemId] = (purchasesState.originalInvoiceItemTotalsByItemId[itemId] || 0) + qty;
        });

        purchasesState.dom.supplierSelect.value = invoice.supplier_id;
        if (purchasesState.supplierAutocomplete) purchasesState.supplierAutocomplete.refresh();

        const invoiceNumberInput = document.getElementById('invoiceNumber');
        if (invoiceNumberInput) {
            invoiceNumberInput.value = invoice.invoice_number;
        }

        if (invoice.invoice_date && purchasesState.dom.invoiceDateInput) {
            purchasesState.dom.invoiceDateInput.value = invoice.invoice_date.split('T')[0];
        }

        const notesInput = document.getElementById('invoiceNotes');
        if (notesInput) notesInput.value = invoice.notes || '';

        const paymentTypeInput = document.getElementById('paymentType');
        if (paymentTypeInput) paymentTypeInput.value = invoice.payment_type || 'cash';

        const subtotalFromDetails = (invoice.items || []).reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
        const storedTotal = Number(invoice.total_amount) || 0;
        const fallbackDiscountAmount = Math.max(subtotalFromDetails - storedTotal, 0);
        const discountTypeInput = purchasesState.dom.discountTypeSelect;
        const discountValueInput = purchasesState.dom.discountValueInput;
        const paidAmountInput = purchasesState.dom.paidAmountInput;

        if (discountTypeInput) {
            discountTypeInput.value = invoice.discount_type === 'percent' ? 'percent' : 'amount';
        }

        if (discountValueInput) {
            const sourceDiscountValue = Number(invoice.discount_value);
            const valueToUse = Number.isFinite(sourceDiscountValue) ? sourceDiscountValue : fallbackDiscountAmount;
            discountValueInput.value = valueToUse.toFixed(2);
        }

        if (paidAmountInput) {
            const paid = Number(invoice.paid_amount) || 0;
            paidAmountInput.value = paid.toFixed(2);
        }

        purchasesState.dom.invoiceItemsBody.innerHTML = '';
        invoice.items.forEach((item) => addInvoiceRow(item));
        calculateInvoiceTotal();
        updateSelectedItemAvailability(purchasesState.dom.invoiceItemsBody.querySelector('tr'));

        purchasesRender.setEditModeUI(t);
        setEditLocked(true);
        updateInvoiceNavigationButtons();
    } catch (error) {
        if (window.showToast) window.showToast(t('purchases.toast.loadError', 'حدث خطأ أثناء تحميل الفاتورة: ') + error.message, 'error');
        updateInvoiceNavigationButtons();
    }
}

async function submitInvoice() {
    if (isEditLocked()) {
        setEditLocked(false);
        if (window.showToast) window.showToast('تم تفعيل وضع التعديل. راجع البيانات ثم اضغط تحديث وحفظ الفاتورة.', 'success');
        return;
    }

    if (purchasesState.isSubmitting) return;
    purchasesState.isSubmitting = true;

    const saveBtn = document.querySelector('#invoiceForm .btn-success');
    if (saveBtn) {
        saveBtn.style.opacity = '0.6';
        saveBtn.style.cursor = 'not-allowed';
    }

    try {
        if (purchasesState.editingInvoiceId) {
            await updateInvoice();
        } else {
            await saveInvoice();
        }
    } finally {
        purchasesState.isSubmitting = false;
        if (saveBtn) {
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
        }
    }
}

async function loadSuppliers() {
    const suppliers = await purchasesApi.getSuppliers();
    if (!purchasesState.dom.supplierSelect) return;

    purchasesState.dom.supplierSelect.innerHTML = `<option value="">${t('purchases.selectSupplier', 'اختر المورد')}</option>`;

    suppliers.forEach((supplier) => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = supplier.name;
        option.dataset.balance = supplier.balance || 0;
        purchasesState.dom.supplierSelect.appendChild(option);
    });

    if (purchasesState.supplierAutocomplete) {
        purchasesState.supplierAutocomplete.refresh();
    } else {
        purchasesState.supplierAutocomplete = new Autocomplete(purchasesState.dom.supplierSelect);
    }

    bindSupplierAutocompleteClearHandler();
}

function bindSupplierAutocompleteClearHandler() {
    const supplierInput = purchasesState.supplierAutocomplete?.input;
    if (!supplierInput || !purchasesState.dom.supplierSelect) return;
    if (supplierInput.dataset.clearSelectionBound === '1') return;

    supplierInput.dataset.clearSelectionBound = '1';
    supplierInput.addEventListener('input', () => {
        if (supplierInput.value.trim() !== '') return;
        if (!purchasesState.dom.supplierSelect.value) return;

        purchasesState.dom.supplierSelect.value = '';
        purchasesState.dom.supplierSelect.dispatchEvent(new Event('change'));
    });

    const reopenSupplierList = () => {
        if (!purchasesState.supplierAutocomplete || supplierInput.disabled) return;
        if (!purchasesState.dom.supplierSelect.value) return;

        setTimeout(() => {
            if (!purchasesState.supplierAutocomplete || supplierInput.disabled) return;
            if (!purchasesState.dom.supplierSelect.value) return;
            purchasesState.supplierAutocomplete.renderList('');
        }, 70);
    };

    supplierInput.addEventListener('focus', reopenSupplierList);
    supplierInput.addEventListener('click', reopenSupplierList);
}

function getOrderedInvoicesForNavigation() {
    const invoices = Array.isArray(purchasesState.invoiceNavigationList) ? purchasesState.invoiceNavigationList : [];
    return invoices
        .slice()
        .sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
}

function findCurrentInvoiceIndexForNavigation(orderedInvoices) {
    if (!orderedInvoices.length) return -1;

    if (Number.isFinite(Number(purchasesState.editingInvoiceId))) {
        const activeId = Number(purchasesState.editingInvoiceId);
        const editIdx = orderedInvoices.findIndex((inv) => Number(inv?.id) === activeId);
        if (editIdx >= 0) return editIdx;
    }

    const invoiceNumberInput = document.getElementById('invoiceNumber');
    const invoiceNumber = (invoiceNumberInput?.value || '').trim();
    if (!invoiceNumber) return -1;

    return orderedInvoices.findIndex((inv) => String(inv?.invoice_number || '').trim() === invoiceNumber);
}

function applyInvoiceNavButtonState(button, disabled, disabledTitle) {
    if (!button) return;

    button.disabled = Boolean(disabled);
    button.style.opacity = disabled ? '0.55' : '1';
    button.style.cursor = disabled ? 'not-allowed' : 'pointer';
    button.title = disabled ? disabledTitle : '';
}

function updateInvoiceNavigationButtons() {
    const prevBtn = document.querySelector('[data-action="load-prev-invoice"]');
    const nextBtn = document.querySelector('[data-action="load-next-invoice"]');
    if (!prevBtn || !nextBtn) return;

    const orderedInvoices = getOrderedInvoicesForNavigation();
    if (!orderedInvoices.length) {
        applyInvoiceNavButtonState(prevBtn, true, 'لا توجد فواتير سابقة');
        applyInvoiceNavButtonState(nextBtn, true, 'لا توجد فواتير تالية');
        return;
    }

    const currentIndex = findCurrentInvoiceIndexForNavigation(orderedInvoices);
    if (currentIndex < 0) {
        applyInvoiceNavButtonState(prevBtn, false, '');
        applyInvoiceNavButtonState(nextBtn, true, 'لا توجد فواتير تالية');
        return;
    }

    const isPrevDisabled = currentIndex <= 0;
    // Keep "next" enabled on the latest saved invoice to allow returning to a fresh empty form.
    const isNextDisabled = false;

    applyInvoiceNavButtonState(prevBtn, isPrevDisabled, 'لا توجد فواتير سابقة');
    applyInvoiceNavButtonState(nextBtn, isNextDisabled, '');
}

async function navigateInvoice(direction) {
    const orderedInvoices = getOrderedInvoicesForNavigation();
    if (!orderedInvoices.length) {
        if (window.showToast) window.showToast('لا توجد فواتير محفوظة للتنقل بينها', 'warning');
        updateInvoiceNavigationButtons();
        return;
    }

    const currentIndex = findCurrentInvoiceIndexForNavigation(orderedInvoices);
    const targetIndex = currentIndex < 0
        ? (direction < 0 ? orderedInvoices.length - 1 : 0)
        : currentIndex + direction;

    if (targetIndex < 0) {
        if (window.showToast) window.showToast('لا توجد فاتورة سابقة', 'warning');
        updateInvoiceNavigationButtons();
        return;
    }

    if (targetIndex >= orderedInvoices.length) {
        if (direction > 0 && currentIndex === orderedInvoices.length - 1) {
            await resetForm();
            updateInvoiceNavigationButtons();
            return;
        }

        if (window.showToast) window.showToast('لا توجد فاتورة تالية', 'warning');
        updateInvoiceNavigationButtons();
        return;
    }

    const targetInvoice = orderedInvoices[targetIndex];
    if (!targetInvoice?.id) {
        if (window.showToast) window.showToast('تعذر فتح الفاتورة المطلوبة', 'error');
        return;
    }

    await loadInvoiceForEdit(targetInvoice.id);
}

async function loadInvoiceNumberSuggestions() {
    try {
        const invoices = await purchasesApi.getPurchaseInvoices();
        purchasesState.invoiceNavigationList = Array.isArray(invoices) ? invoices : [];
        const datalist = document.getElementById('invoiceSuggestions');
        if (!datalist) {
            updateInvoiceNavigationButtons();
            return;
        }

        datalist.innerHTML = '';
        purchasesState.invoiceNavigationList.slice(0, 30).forEach((inv) => {
            if (!inv.invoice_number) return;
            const option = document.createElement('option');
            option.value = inv.invoice_number;
            datalist.appendChild(option);
        });
        updateInvoiceNavigationButtons();
    } catch (_) {
        purchasesState.invoiceNavigationList = [];
        updateInvoiceNavigationButtons();
    }
}

async function loadItems() {
    purchasesState.allItems = await purchasesApi.getItems();
}

function normalizeBarcodeInput(value) {
    if (value === null || value === undefined) return '';

    const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
    const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';

    return String(value)
        .trim()
        .replace(/[٠-٩]/g, (digit) => String(arabicIndic.indexOf(digit)))
        .replace(/[۰-۹]/g, (digit) => String(easternArabicIndic.indexOf(digit)));
}

function bindItemBarcodeQuickSelect(autocompleteInstance, selectElement) {
    const inputElement = autocompleteInstance?.input;
    if (!inputElement || !selectElement) return;
    if (inputElement.dataset.barcodeQuickSelectBound === '1') return;

    inputElement.dataset.barcodeQuickSelectBound = '1';
    inputElement.addEventListener('input', () => {
        const typedBarcode = normalizeBarcodeInput(inputElement.value);
        if (!typedBarcode) return;

        const matchedOption = Array.from(selectElement.options).find((option) => {
            const optionBarcode = normalizeBarcodeInput(option.dataset?.barcode || '');
            return optionBarcode !== '' && optionBarcode === typedBarcode;
        });

        if (!matchedOption || !matchedOption.value) return;

        if (selectElement.value !== matchedOption.value) {
            selectElement.value = matchedOption.value;
            selectElement.dispatchEvent(new Event('change'));
        }

        inputElement.value = matchedOption.text;
        autocompleteInstance.closeList();
    });
}

function findItemByBarcode(barcodeValue) {
    const normalizedTarget = normalizeBarcodeInput(barcodeValue);
    if (!normalizedTarget) return null;

    return purchasesState.allItems.find((item) => {
        const itemBarcode = normalizeBarcodeInput(item?.barcode || '');
        return itemBarcode !== '' && itemBarcode === normalizedTarget;
    }) || null;
}

function onBarcodeInput(inputElement) {
    if (isEditLocked()) return;

    const row = inputElement.closest('tr');
    if (!row) return;

    const matchedItem = findItemByBarcode(inputElement.value);
    if (!matchedItem) return;

    const selectElement = row.querySelector('.item-select');
    if (!selectElement) return;

    const matchedItemId = String(matchedItem.id);
    if (selectElement.value !== matchedItemId) {
        selectElement.value = matchedItemId;
        selectElement.dispatchEvent(new Event('change'));
    } else {
        onItemSelect(selectElement);
    }

    const selectedOption = Array.from(selectElement.options).find((opt) => opt.value === matchedItemId);
    if (row.__itemAutocomplete?.input && selectedOption) {
        row.__itemAutocomplete.input.value = selectedOption.text;
    }

    inputElement.value = matchedItem.barcode || inputElement.value;
}

async function displaySupplierBalance() {
    const supplierId = purchasesState.dom.supplierSelect?.value;
    if (!supplierId) return;

    const selectedOption = purchasesState.dom.supplierSelect.options[purchasesState.dom.supplierSelect.selectedIndex];
    const balance = parseFloat(selectedOption?.dataset?.balance || 0);

    const balanceDiv = document.getElementById('supplierBalance');
    if (!balanceDiv) return;

    balanceDiv.className = 'customer-balance';
    if (balance > 0) {
        balanceDiv.classList.add('balance-positive');
        balanceDiv.textContent = fmt(t('purchases.balanceCurrentDueFromSupplier', 'الرصيد الحالي: لينا (مدين) {amount} جنيه'), { amount: balance.toLocaleString() });
    } else if (balance < 0) {
        balanceDiv.classList.add('balance-negative');
        balanceDiv.textContent = fmt(t('purchases.balanceCurrentOwedToSupplier', 'الرصيد الحالي: علينا (دائن) {amount} جنيه'), { amount: Math.abs(balance).toLocaleString() });
    } else {
        balanceDiv.classList.add('balance-zero');
        balanceDiv.textContent = t('purchases.balanceCurrentSettled', 'الرصيد الحالي: متزن');
    }

    balanceDiv.style.display = 'inline-flex';
}

function clearSelectedItemAvailability() {
    if (!purchasesState.dom.selectedItemAvailability) return;
    purchasesState.dom.selectedItemAvailability.classList.remove('has-overage');
    purchasesState.dom.selectedItemAvailability.textContent = '';
}

function formatQty(value) {
    const qty = Number(value);
    if (!Number.isFinite(qty)) return '0';
    if (Number.isInteger(qty)) return String(qty);
    return qty.toFixed(3).replace(/\.?0+$/, '');
}

function getAddedQuantityInDraft(itemId, excludedRow = null) {
    if (!Number.isFinite(itemId) || !purchasesState.dom.invoiceItemsBody) return 0;

    let added = 0;
    purchasesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((candidateRow) => {
        if (excludedRow && candidateRow === excludedRow) return;

        const itemSelect = candidateRow.querySelector('.item-select');
        const candidateItemId = parseInt(itemSelect?.value, 10);
        if (!Number.isFinite(candidateItemId) || candidateItemId !== itemId) return;

        const quantityInput = candidateRow.querySelector('.quantity-input');
        const qty = parseLocaleFloat(quantityInput?.value);
        if (Number.isFinite(qty) && qty > 0) {
            added += qty;
        }
    });

    return added;
}

function getEffectiveBaseAvailable(itemId) {
    const match = Number.isFinite(itemId) ? purchasesState.allItems.find((i) => i.id === itemId) : null;
    const currentStock = Number(match?.stock_quantity) || 0;
    const originalInEditedInvoice = Number(purchasesState.originalInvoiceItemTotalsByItemId?.[itemId]) || 0;
    return Math.max(currentStock - originalInEditedInvoice, 0);
}

function updateSelectedItemAvailability(row) {
    if (!purchasesState.dom.selectedItemAvailability) return;
    if (!row) {
        clearSelectedItemAvailability();
        return;
    }

    const itemSelect = row.querySelector('.item-select');
    if (!itemSelect || !itemSelect.value) {
        clearSelectedItemAvailability();
        return;
    }

    const itemId = parseInt(itemSelect.value, 10);
    const match = Number.isFinite(itemId) ? purchasesState.allItems.find((i) => i.id === itemId) : null;
    if (!match) {
        clearSelectedItemAvailability();
        return;
    }

    const baseAvailableQty = getEffectiveBaseAvailable(itemId);
    const addedByOtherRows = getAddedQuantityInDraft(itemId, row);
    const availableQty = Math.max(baseAvailableQty + addedByOtherRows, 0);

    const qtyInput = row.querySelector('.quantity-input');
    const enteredQtyRaw = qtyInput ? parseLocaleFloat(qtyInput.value) : 0;
    const enteredQty = Number.isFinite(enteredQtyRaw) && enteredQtyRaw > 0 ? enteredQtyRaw : 0;

    if (enteredQty > 0) {
        const expectedQty = availableQty + enteredQty;
        purchasesState.dom.selectedItemAvailability.textContent = `المتاح الحالي: ${formatQty(availableQty)} | المتوقع بعد الإدخال: ${formatQty(expectedQty)}`;
        return;
    }

    purchasesState.dom.selectedItemAvailability.textContent = `المتاح الحالي: ${formatQty(availableQty)}`;
}

function addInvoiceRow(existingItem = null) {
    if (!existingItem && isEditLocked()) {
        if (window.showToast) window.showToast('اضغط على زر "تعديل الفاتورة" أولاً', 'warning');
        return;
    }

    if (!existingItem && !purchasesState.dom.supplierSelect?.value) {
        if (window.showToast) window.showToast(t('purchases.selectSupplierFirst', 'الرجاء اختيار المورد أولاً'), 'warning');
        return;
    }

    const row = purchasesRender.createInvoiceRow({
        allItems: purchasesState.allItems,
        existingItem,
        t,
        fmt
    });

    purchasesState.dom.invoiceItemsBody.appendChild(row);

    const selectElement = row.querySelector('.item-select');
    const itemAutocomplete = new Autocomplete(selectElement);
    row.__itemAutocomplete = itemAutocomplete;
    bindItemBarcodeQuickSelect(itemAutocomplete, selectElement);
    const barcodeInput = row.querySelector('.barcode-input');
    if (barcodeInput) {
        barcodeInput.addEventListener('input', () => onBarcodeInput(barcodeInput));
    }
    if (selectElement) {
        selectElement.addEventListener('change', () => onItemSelect(selectElement));
    }
}

function removeRow(removeBtnEl) {
    if (isEditLocked()) {
        if (window.showToast) window.showToast('اضغط على زر "تعديل الفاتورة" أولاً', 'warning');
        return;
    }

    const row = removeBtnEl.closest('tr');
    if (!row) return;
    row.remove();
    calculateInvoiceTotal();

    const fallbackRow = purchasesState.dom.invoiceItemsBody.querySelector('tr:last-child');
    if (fallbackRow) {
        updateSelectedItemAvailability(fallbackRow);
    } else {
        clearSelectedItemAvailability();
    }
}

function maybeAutoAddRow(row) {
    if (!row || !purchasesState.dom.invoiceItemsBody) return;
    if (row === purchasesState.dom.invoiceItemsBody.lastElementChild) {
        addInvoiceRow();
    }
}

function onItemSelect(select) {
    if (isEditLocked()) return;

    const row = select.closest('tr');
    const itemId = parseInt(select.value, 10);
    const match = Number.isFinite(itemId) ? purchasesState.allItems.find((i) => i.id === itemId) : null;
    const unitName = match && match.unit_name ? match.unit_name : '';
    const costPrice = match ? Number(match.cost_price || 0) : 0;

    const unitEl = row.querySelector('.unit-label');
    if (unitEl) unitEl.textContent = unitName;

    const barcodeInput = row.querySelector('.barcode-input');
    if (barcodeInput) {
        barcodeInput.value = match && match.barcode ? match.barcode : '';
    }

    const priceInput = row.querySelector('.price-input');
    if (priceInput) {
        priceInput.value = Number.isFinite(costPrice) ? costPrice : 0;
    }

    updateSelectedItemAvailability(row);
    calculateRowTotal(select);
    maybeAutoAddRow(row);

    // const qtyInput = row.querySelector('.quantity-input');
    // if (qtyInput) qtyInput.focus();
}

function onRowInput(input) {
    if (isEditLocked()) return;

    calculateRowTotal(input);
    if (input.classList.contains('quantity-input')) {
        const row = input.closest('tr');
        maybeAutoAddRow(row);
        updateSelectedItemAvailability(row);
    }
}

const NAVIGABLE_ROW_FIELDS = ['barcode', 'item', 'quantity', 'price'];

function getRowFieldKey(target, row) {
    if (!target || !row) return '';
    if (target.classList.contains('barcode-input')) return 'barcode';
    if (target.classList.contains('quantity-input')) return 'quantity';
    if (target.classList.contains('price-input')) return 'price';

    if (target.classList.contains('autocomplete-input')) {
        const wrapper = target.closest('.autocomplete-wrapper');
        if (wrapper && row.contains(wrapper) && wrapper.querySelector('.item-select')) {
            return 'item';
        }
    }

    return '';
}

function getRowFieldElement(row, fieldKey) {
    if (!row) return null;

    if (fieldKey === 'barcode') return row.querySelector('.barcode-input');
    if (fieldKey === 'item') {
        if (row.__itemAutocomplete?.input) return row.__itemAutocomplete.input;
        return row.querySelector('.autocomplete-wrapper .autocomplete-input');
    }
    if (fieldKey === 'quantity') return row.querySelector('.quantity-input');
    if (fieldKey === 'price') return row.querySelector('.price-input');

    return null;
}

function closeVisibleAutocompleteLists() {
    if (typeof Autocomplete !== 'undefined' && typeof Autocomplete.closeAllVisible === 'function') {
        Autocomplete.closeAllVisible();
        return;
    }

    document.querySelectorAll('.autocomplete-list.visible').forEach((listEl) => {
        listEl.classList.remove('visible');
    });
}

function focusRowField(row, fieldKey) {
    const field = getRowFieldElement(row, fieldKey);
    if (!field) return;

    closeVisibleAutocompleteLists();
    field.focus();

    if (typeof field.select === 'function') {
        field.select();
    }
}

function handleRowArrowNavigation(event) {
    if (isEditLocked()) return;
    if (!purchasesState.dom.invoiceItemsBody) return;
    if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowLeft'
    ) return;

    const target = event.target;
    const row = target?.closest?.('tr');
    if (!row) return;

    const fieldKey = getRowFieldKey(target, row);
    if (!fieldKey) return;

    if (fieldKey === 'item') {
        const itemAutocomplete = row.__itemAutocomplete;
        if (itemAutocomplete?.input === target && itemAutocomplete?.list?.classList.contains('visible')) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                return;
            }
        }
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const currentFieldIndex = NAVIGABLE_ROW_FIELDS.indexOf(fieldKey);
        if (currentFieldIndex < 0) return;

        const horizontalStep = event.key === 'ArrowRight' ? -1 : 1;
        const nextField = NAVIGABLE_ROW_FIELDS[currentFieldIndex + horizontalStep];
        if (!nextField) return;

        event.preventDefault();
        focusRowField(row, nextField);
        return;
    }

    event.preventDefault();

    const rows = Array.from(purchasesState.dom.invoiceItemsBody.querySelectorAll('tr'));
    const currentIndex = rows.indexOf(row);
    if (currentIndex < 0) return;

    const direction = event.key === 'ArrowDown' ? 1 : -1;
    let nextIndex = currentIndex + direction;

    if (nextIndex < 0) return;

    if (nextIndex >= rows.length) {
        if (direction > 0 && row === purchasesState.dom.invoiceItemsBody.lastElementChild) {
            addInvoiceRow();
            const updatedRows = Array.from(purchasesState.dom.invoiceItemsBody.querySelectorAll('tr'));
            nextIndex = updatedRows.indexOf(row) + 1;
            if (nextIndex < updatedRows.length) {
                focusRowField(updatedRows[nextIndex], fieldKey);
            }
        }
        return;
    }

    focusRowField(rows[nextIndex], fieldKey);
}

function calculateRowTotal(input) {
    if (!input) return;

    const row = input.closest('tr');
    const quantity = parseLocaleFloat(row.querySelector('.quantity-input').value);
    const price = parseLocaleFloat(row.querySelector('.price-input').value);
    const total = (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(price) ? price : 0);

    row.querySelector('.row-total').textContent = total.toFixed(2);
    calculateInvoiceTotal();
}

function normalizeNumberString(value) {
    if (value === null || value === undefined) return '';
    let s = String(value).trim();
    if (s === '') return '';

    const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
    const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';

    s = s.replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)));
    s = s.replace(/[۰-۹]/g, (d) => String(easternArabicIndic.indexOf(d)));
    s = s.replace(/[٬،]/g, '.');
    s = s.replace(/\s+/g, '');
    return s;
}

function parseLocaleFloat(value) {
    const normalized = normalizeNumberString(value);
    const num = parseFloat(normalized);
    return Number.isFinite(num) ? num : NaN;
}

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getInvoiceFinancials(subtotal) {
    const safeSubtotal = Number.isFinite(subtotal) ? Math.max(subtotal, 0) : 0;
    const discountType = purchasesState.dom.discountTypeSelect?.value === 'percent' ? 'percent' : 'amount';

    const discountValueRaw = parseLocaleFloat(purchasesState.dom.discountValueInput?.value || '0');
    const discountValue = Number.isFinite(discountValueRaw) && discountValueRaw > 0 ? discountValueRaw : 0;

    let discountAmount = discountType === 'percent'
        ? safeSubtotal * (discountValue / 100)
        : discountValue;

    if (!Number.isFinite(discountAmount) || discountAmount < 0) discountAmount = 0;
    discountAmount = Math.min(discountAmount, safeSubtotal);

    const netTotal = Math.max(safeSubtotal - discountAmount, 0);

    const paidAmountRaw = parseLocaleFloat(purchasesState.dom.paidAmountInput?.value || '0');
    const paidAmount = Number.isFinite(paidAmountRaw) && paidAmountRaw > 0 ? paidAmountRaw : 0;
    const supplierRemaining = netTotal - paidAmount;

    return {
        discountType,
        discountValue: roundMoney(discountValue),
        discountAmount: roundMoney(discountAmount),
        netTotal: roundMoney(netTotal),
        paidAmount: roundMoney(paidAmount),
        supplierRemaining: roundMoney(supplierRemaining)
    };
}

function calculateInvoiceTotal() {
    let subtotal = 0;
    purchasesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((row) => {
        const rowTotal = parseFloat(row.querySelector('.row-total').textContent) || 0;
        subtotal += rowTotal;
    });

    const financials = getInvoiceFinancials(subtotal);

    if (purchasesState.dom.invoiceSubtotalSpan) {
        purchasesState.dom.invoiceSubtotalSpan.textContent = subtotal.toFixed(2);
    }

    if (purchasesState.dom.invoiceDiscountAmountSpan) {
        purchasesState.dom.invoiceDiscountAmountSpan.textContent = financials.discountAmount.toFixed(2);
    }

    purchasesState.dom.invoiceTotalSpan.textContent = financials.netTotal.toFixed(2);

    if (purchasesState.dom.invoicePaidDisplaySpan) {
        purchasesState.dom.invoicePaidDisplaySpan.textContent = financials.paidAmount.toFixed(2);
    }

    if (purchasesState.dom.invoiceRemainingSpan) {
        if (financials.supplierRemaining > 0) {
            purchasesState.dom.invoiceRemainingSpan.textContent = fmt(t('purchases.supplierDuePositive', 'علينا (دائن) {amount}'), { amount: financials.supplierRemaining.toFixed(2) });
            purchasesState.dom.invoiceRemainingSpan.className = 'customer-due-value due-positive';
        } else if (financials.supplierRemaining < 0) {
            purchasesState.dom.invoiceRemainingSpan.textContent = fmt(t('purchases.supplierDueNegative', 'لينا (مدين) {amount}'), { amount: Math.abs(financials.supplierRemaining).toFixed(2) });
            purchasesState.dom.invoiceRemainingSpan.className = 'customer-due-value due-negative';
        } else {
            purchasesState.dom.invoiceRemainingSpan.textContent = '0.00';
            purchasesState.dom.invoiceRemainingSpan.className = 'customer-due-value';
        }
    }
}

function collectInvoiceItemsFromForm() {
    const items = [];
    let isValid = true;

    purchasesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((row) => {
        const item_id = parseInt(row.querySelector('.item-select').value, 10);
        const quantity = parseLocaleFloat(row.querySelector('.quantity-input').value);
        const cost_price = parseLocaleFloat(row.querySelector('.price-input').value);

        const quantityOk = Number.isFinite(quantity) && quantity > 0;
        const priceOk = Number.isFinite(cost_price) && cost_price >= 0;
        const itemOk = Number.isFinite(item_id) && item_id > 0;

        if (!itemOk && !quantityOk && (!priceOk || cost_price === 0)) {
            return;
        }

        if (!itemOk || !quantityOk || !priceOk) {
            isValid = false;
            return;
        }

        items.push({
            item_id,
            quantity,
            cost_price,
            total_price: quantity * cost_price
        });
    });

    return { items, isValid: isValid && items.length > 0 };
}

function buildInvoicePayload(financials) {
    return {
        supplier_id: purchasesState.dom.supplierSelect.value,
        invoice_number: document.getElementById('invoiceNumber').value,
        invoice_date: purchasesState.dom.invoiceDateInput.value || new Date().toISOString().slice(0, 10),
        payment_type: document.getElementById('paymentType').value,
        notes: document.getElementById('invoiceNotes').value,
        discount_type: financials.discountType,
        discount_value: financials.discountValue,
        paid_amount: financials.paidAmount,
        total_amount: financials.netTotal
    };
}

async function saveInvoice() {
    if (!purchasesState.dom.supplierSelect.value) {
        if (window.showToast) window.showToast(t('purchases.toast.selectSupplier', 'الرجاء اختيار المورد'), 'error');
        return;
    }

    const { items, isValid } = collectInvoiceItemsFromForm();
    if (!isValid) {
        if (window.showToast) window.showToast(t('purchases.noItemsData', 'الرجاء إدخال جميع بيانات الأصناف بشكل صحيح (يجب إضافة صنف واحد على الأقل)'), 'error');
        return;
    }

    const financials = getInvoiceFinancials(parseFloat(purchasesState.dom.invoiceSubtotalSpan?.textContent || '0') || 0);

    const invoiceData = {
        ...buildInvoicePayload(financials),
        items
    };

    try {
        const result = await purchasesApi.savePurchaseInvoice(invoiceData);
        if (result.success) {
            if (window.showToast) window.showToast(t('purchases.toast.saveSuccess', 'تم حفظ الفاتورة بنجاح'), 'success');
            await resetForm();
        } else {
            if (window.showToast) window.showToast(t('purchases.toast.saveError', 'حدث خطأ أثناء الحفظ: ') + result.error, 'error');
        }
    } catch (error) {
        if (window.showToast) window.showToast(t('purchases.toast.unexpectedError', 'حدث خطأ غير متوقع: ') + error.message, 'error');
    }
}

async function updateInvoice() {
    if (!purchasesState.dom.supplierSelect.value) {
        if (window.showToast) window.showToast(t('purchases.toast.selectSupplier', 'الرجاء اختيار المورد'), 'error');
        return;
    }

    const { items, isValid } = collectInvoiceItemsFromForm();
    if (!isValid) {
        if (window.showToast) window.showToast(t('purchases.noItemsData', 'الرجاء إدخال جميع بيانات الأصناف بشكل صحيح (يجب إضافة صنف واحد على الأقل)'), 'error');
        return;
    }

    const financials = getInvoiceFinancials(parseFloat(purchasesState.dom.invoiceSubtotalSpan?.textContent || '0') || 0);

    const invoiceData = {
        ...buildInvoicePayload(financials),
        id: purchasesState.editingInvoiceId,
        items
    };

    try {
        const result = await purchasesApi.updatePurchaseInvoice(invoiceData);
        if (result.success) {
            if (window.showToast) window.showToast(t('purchases.toast.updateSuccess', 'تم تحديث الفاتورة بنجاح'), 'success');
            await resetForm();
        } else {
            if (window.showToast) window.showToast(t('purchases.toast.updateError', 'حدث خطأ أثناء التحديث: ') + result.error, 'error');
        }
    } catch (error) {
        if (window.showToast) window.showToast(t('purchases.toast.unexpectedError', 'حدث خطأ غير متوقع: ') + error.message, 'error');
    }
}

async function resetForm() {
    purchasesState.dom.supplierSelect.value = '';
    if (purchasesState.supplierAutocomplete) purchasesState.supplierAutocomplete.refresh();

    const balanceDiv = document.getElementById('supplierBalance');
    if (balanceDiv) balanceDiv.style.display = 'none';

    const invoiceNumberInput = document.getElementById('invoiceNumber');
    const notesInput = document.getElementById('invoiceNotes');
    const paymentTypeInput = document.getElementById('paymentType');

    if (invoiceNumberInput) invoiceNumberInput.value = '';
    if (notesInput) notesInput.value = '';
    if (paymentTypeInput) paymentTypeInput.value = 'credit';
    if (purchasesState.dom.discountTypeSelect) purchasesState.dom.discountTypeSelect.value = 'amount';
    if (purchasesState.dom.discountValueInput) purchasesState.dom.discountValueInput.value = '0';
    if (purchasesState.dom.paidAmountInput) purchasesState.dom.paidAmountInput.value = '0';

    purchasesState.dom.invoiceItemsBody.innerHTML = '';
    if (purchasesState.dom.invoiceSubtotalSpan) purchasesState.dom.invoiceSubtotalSpan.textContent = '0.00';
    if (purchasesState.dom.invoiceDiscountAmountSpan) purchasesState.dom.invoiceDiscountAmountSpan.textContent = '0.00';
    purchasesState.dom.invoiceTotalSpan.textContent = '0.00';
    if (purchasesState.dom.invoicePaidDisplaySpan) purchasesState.dom.invoicePaidDisplaySpan.textContent = '0.00';
    if (purchasesState.dom.invoiceRemainingSpan) {
        purchasesState.dom.invoiceRemainingSpan.textContent = '0.00';
        purchasesState.dom.invoiceRemainingSpan.className = 'customer-due-value';
    }
    clearSelectedItemAvailability();

    purchasesState.editingInvoiceId = null;
    purchasesState.isEditLocked = false;
    purchasesState.originalInvoiceItemTotalsByItemId = {};
    purchasesRender.setCreateModeUI(t);
    setEditLocked(false);

    window.history.replaceState({}, document.title, window.location.pathname);
    await loadItems();
    await initializeNewInvoice();
}
