const salesReturnsState = window.salesReturnsPageState.createInitialState();
const salesReturnsApi = window.salesReturnsPageApi;
const salesReturnsRender = window.salesReturnsPageRender;
const salesReturnsEvents = window.salesReturnsPageEvents;
const { t, fmt } = window.i18n?.createPageHelpers?.(() => salesReturnsState.ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

document.addEventListener('DOMContentLoaded', async () => {    // Reset submitting state just in case
    salesReturnsState.isSubmitting = false;
    salesReturnsState.isEditLocked = false;
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        salesReturnsState.ar = await window.i18n.loadArabicDictionary();
    }

    salesReturnsRender.renderPage({ t, getNavHTML: buildTopNavHTML });

    if (window.FieldSystem && typeof window.FieldSystem.enable === 'function') {
        window.FieldSystem.enable(document, { watch: true });
    }

    initializeElements();

    await Promise.all([loadCustomers(), loadReturnsHistory()]);

    const editId = getEditIdFromUrl();
    if (editId) {
        await loadReturnForEdit(editId);
    }
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function getEditIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('editId');
}

function clearEditQueryFromUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
}

function isEditLocked() {
    return Boolean(salesReturnsState.editingReturnId && salesReturnsState.isEditLocked);
}

function setEditLocked(locked) {
    const form = document.getElementById('invoiceForm');
    if (!form) return;

    salesReturnsState.isEditLocked = Boolean(locked);
    const lockActive = Boolean(salesReturnsState.editingReturnId && salesReturnsState.isEditLocked);
    const saveBtn = form.querySelector('[data-action="save-return"]');
    let lockHint = form.querySelector('[data-edit-lock-hint="true"]');

    if (lockActive && !lockHint) {
        lockHint = document.createElement('div');
        lockHint.dataset.editLockHint = 'true';
        lockHint.textContent = 'الوضع الحالي: عرض فقط. اضغط "تعديل المرتجع" لفتح الحقول.';
        lockHint.style.margin = '10px 0 14px 0';
        lockHint.style.padding = '10px 12px';
        lockHint.style.borderRadius = '10px';
        lockHint.style.background = 'rgba(245, 158, 11, 0.18)';
        lockHint.style.border = '1px solid rgba(245, 158, 11, 0.6)';
        lockHint.style.color = 'var(--text-color)';
        lockHint.style.fontWeight = '700';
        const shell = form.querySelector('.invoice-shell');
        if (shell) {
            shell.insertBefore(lockHint, shell.firstChild);
        }
    }

    if (!lockActive && lockHint) {
        lockHint.remove();
    }

    const controls = form.querySelectorAll('input, select, textarea, button');
    controls.forEach((control) => {
        if (
            control.dataset.action === 'save-return' ||
            control.dataset.action === 'load-prev-return' ||
            control.dataset.action === 'load-next-return'
        ) return;
        control.disabled = lockActive;

        if (lockActive) {
            control.style.cursor = 'not-allowed';
            control.style.backgroundColor = 'rgba(148, 163, 184, 0.2)';
            control.style.borderStyle = 'dashed';
            control.style.opacity = '0.72';
            control.title = 'اضغط "تعديل المرتجع" أولاً';
        } else {
            control.style.cursor = '';
            control.style.backgroundColor = '';
            control.style.borderStyle = '';
            control.style.opacity = '';
            control.title = '';
        }
    });

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        saveBtn.style.cursor = 'pointer';
        saveBtn.removeAttribute('data-invalid');

        if (lockActive) {
            saveBtn.innerHTML = `<i class="fas fa-pen"></i> تعديل المرتجع`;
        } else if (salesReturnsState.editingReturnId) {
            saveBtn.innerHTML = `<i class="fas fa-save"></i> ${t('salesReturns.updateReturn', 'تحديث المرتجع')}`;
        } else {
            saveBtn.innerHTML = `<i class="fas fa-save"></i> ${t('salesReturns.saveReturn', 'حفظ المرتجع')}`;
        }
    }
}

function initializeElements() {
    window.salesReturnsPageState.initializeDomRefs(salesReturnsState);

    if (salesReturnsState.dom.returnDateInput) {
        salesReturnsState.dom.returnDateInput.valueAsDate = new Date();
    }
    loadNextReturnNumber();

    salesReturnsEvents.bindEvents({
        root: salesReturnsState.dom.app,
        dom: salesReturnsState.dom,
        handlers: {
            onCustomerChange: handleCustomerChange,
            onInvoiceChange: handleInvoiceChange,
            onCheckboxChange,
            onQtyInput,
            onPriceInput: calculateTotal,
            onItemsArrowNavigate: handleItemsArrowNavigation,
            onResetForm: resetForm,
            onSaveReturn: saveReturn,
            onLoadPrevReturn: () => navigateReturn(-1),
            onLoadNextReturn: () => navigateReturn(1),
            onHistoryPrev: () => changeSalesReturnsPage(salesReturnsState.salesReturnsPage - 1),
            onHistoryNext: () => changeSalesReturnsPage(salesReturnsState.salesReturnsPage + 1),
            onDeleteReturn: deleteReturn
        }
    });

    updateReturnNavigationButtons();
}

async function loadNextReturnNumber() {
    const next = await salesReturnsApi.getNextReturnNumber();
    if (salesReturnsState.dom.returnNumberInput) {
        salesReturnsState.dom.returnNumberInput.value = `MR-${String(next).padStart(4, '0')}`;
    }
}

async function loadCustomers() {
    const customers = toArray(await salesReturnsApi.getCustomers());

    if (salesReturnsState.dom.customerSelect) {
        salesReturnsState.dom.customerSelect.classList.add('autocomplete-force-down');
        salesReturnsState.dom.customerSelect.classList.add('item-select');
    }

    salesReturnsState.dom.customerSelect.innerHTML = `<option value="">${t('common.actions.selectCustomer', 'Select Customer')}</option>`;
    customers.forEach((customer) => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        salesReturnsState.dom.customerSelect.appendChild(option);
    });

    if (salesReturnsState.customerAutocomplete) {
        salesReturnsState.customerAutocomplete.refresh();
    } else {
        salesReturnsState.customerAutocomplete = new Autocomplete(salesReturnsState.dom.customerSelect);
    }

    applyCustomerAutocompleteDropdownStyle();

    bindCustomerAutocompleteClearHandler();
}

function applyCustomerAutocompleteDropdownStyle() {
    const customerAutocomplete = salesReturnsState.customerAutocomplete;
    if (!customerAutocomplete) return;

    customerAutocomplete.forceOpenDown = true;

    const customerList = customerAutocomplete.list;
    if (!customerList) return;
    customerList.classList.add('sales-returns-customer-list');
    customerList.style.maxHeight = '350px';
    customerList.style.overflowY = 'auto';
}

function bindCustomerAutocompleteClearHandler() {
    const customerInput = salesReturnsState.customerAutocomplete?.input;
    if (!customerInput || !salesReturnsState.dom.customerSelect) return;
    if (customerInput.dataset.clearSelectionBound === '1') return;

    customerInput.dataset.clearSelectionBound = '1';
    customerInput.addEventListener('input', () => {
        if (customerInput.value.trim() !== '') return;
        if (!salesReturnsState.dom.customerSelect.value) return;

        salesReturnsState.dom.customerSelect.value = '';
        salesReturnsState.dom.customerSelect.dispatchEvent(new Event('change'));
    });

    const reopenCustomerList = () => {
        if (!salesReturnsState.customerAutocomplete || customerInput.disabled) return;
        if (!salesReturnsState.dom.customerSelect.value) return;

        // Autocomplete has its own focus/click handlers; defer so full list wins.
        setTimeout(() => {
            if (!salesReturnsState.customerAutocomplete || customerInput.disabled) return;
            if (!salesReturnsState.dom.customerSelect.value) return;
            salesReturnsState.customerAutocomplete.renderList('');
        }, 70);
    };

    customerInput.addEventListener('focus', reopenCustomerList);
    customerInput.addEventListener('click', reopenCustomerList);
}

async function handleCustomerChange() {
    if (isEditLocked()) return;

    const customerId = salesReturnsState.dom.customerSelect.value;
    if (customerId) {
        if (salesReturnsState.editingReturnId) {
            salesReturnsState.editingOriginalInvoiceId = null;
            salesReturnsState.editingReturnItemsMap = new Map();
        }

        salesReturnsState.dom.invoiceSelect.disabled = false;
        await loadCustomerInvoices(customerId);
        return;
    }

    salesReturnsState.dom.invoiceSelect.disabled = true;
    salesReturnsState.dom.invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>`;
    if (salesReturnsState.invoiceAutocomplete) salesReturnsState.invoiceAutocomplete.refresh();
    hideItemsSection();
}

async function loadCustomerInvoices(customerId) {
    const invoices = toArray(await salesReturnsApi.getCustomerInvoices(customerId));

    salesReturnsState.dom.invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>`;
    invoices.forEach((invoice) => {
        const option = document.createElement('option');
        option.value = invoice.id;
        option.textContent = fmt(t('salesReturns.invoiceOption', 'Invoice #{number} - {date} - {total}'), {
            number: invoice.invoice_number ?? '-',
            date: invoice.invoice_date ?? '-',
            total: `${(Number(invoice.total_amount) || 0).toFixed(2)} ${t('common.currency.egp', 'EGP')}`
        });
        salesReturnsState.dom.invoiceSelect.appendChild(option);
    });

    if (salesReturnsState.invoiceAutocomplete) {
        salesReturnsState.invoiceAutocomplete.refresh();
    } else {
        salesReturnsState.invoiceAutocomplete = new Autocomplete(salesReturnsState.dom.invoiceSelect);
    }
}

async function handleInvoiceChange() {
    if (isEditLocked()) return;

    const invoiceId = salesReturnsState.dom.invoiceSelect.value;
    if (invoiceId) {
        if (salesReturnsState.editingReturnId && Number(invoiceId) !== Number(salesReturnsState.editingOriginalInvoiceId)) {
            salesReturnsState.editingReturnItemsMap = new Map();
        }
        await loadInvoiceItems(invoiceId);
    } else {
        hideItemsSection();
    }
}

async function loadInvoiceItems(invoiceId) {
    const result = await salesReturnsApi.getInvoiceItems(invoiceId);
    if (!result || !result.success) {
        Toast.show((result && result.error) || t('salesReturns.toast.loadItemsError', 'Failed to load invoice items'), 'error');
        return;
    }

    salesReturnsState.currentInvoiceItems = toArray(result.items);
    normalizeInvoiceItemsForEdit(invoiceId);
    renderInvoiceItems();
    applyEditSelections(invoiceId);
}

function toSafeNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getAvailableToReturn(item) {
    return Math.max(0, toSafeNumber(item.quantity) - toSafeNumber(item.returned_quantity));
}

function normalizeInvoiceItemsForEdit(invoiceId) {
    if (!salesReturnsState.editingReturnId || Number(invoiceId) !== Number(salesReturnsState.editingOriginalInvoiceId) || salesReturnsState.editingReturnItemsMap.size === 0) {
        return;
    }

    salesReturnsState.currentInvoiceItems = salesReturnsState.currentInvoiceItems.map((item) => {
        const editItem = salesReturnsState.editingReturnItemsMap.get(Number(item.item_id));
        if (!editItem) return item;

        return {
            ...item,
            returned_quantity: Math.max(0, toSafeNumber(item.returned_quantity) - toSafeNumber(editItem.quantity))
        };
    });
}

function renderInvoiceItems() {
    salesReturnsState.dom.itemsBody.innerHTML = '';

    if (salesReturnsState.currentInvoiceItems.length === 0) {
        hideItemsSection();
        return;
    }

    salesReturnsState.dom.itemsSection.style.display = 'block';

    salesReturnsState.currentInvoiceItems.forEach((item, index) => {
        const row = salesReturnsRender.createInvoiceItemRow({
            item,
            index,
            t,
            toSafeNumber,
            getAvailableToReturn
        });
        salesReturnsState.dom.itemsBody.appendChild(row);
    });

    calculateTotal();
}

function applyEditSelections(invoiceId) {
    if (!salesReturnsState.editingReturnId || Number(invoiceId) !== Number(salesReturnsState.editingOriginalInvoiceId) || salesReturnsState.editingReturnItemsMap.size === 0) {
        return;
    }

    salesReturnsState.currentInvoiceItems.forEach((item, index) => {
        const editItem = salesReturnsState.editingReturnItemsMap.get(Number(item.item_id));
        if (!editItem) return;

        const checkbox = salesReturnsState.dom.itemsBody.querySelector(`.return-checkbox[data-index="${index}"]`);
        const qtyInput = salesReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`);
        const priceInput = salesReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`);
        if (!checkbox || !qtyInput || !priceInput || checkbox.disabled) return;

        checkbox.checked = true;
        qtyInput.disabled = false;
        priceInput.disabled = false;

        const maxQty = getAvailableToReturn(item);
        const qty = Math.min(maxQty, Math.max(0, toSafeNumber(editItem.quantity)));
        qtyInput.value = String(qty);
        priceInput.value = String(toSafeNumber(editItem.price));
    });

    calculateTotal();
}

function onCheckboxChange(checkbox) {
    if (isEditLocked()) return;

    const index = checkbox.dataset.index;
    const qtyInput = salesReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`);
    const priceInput = salesReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`);

    if (!qtyInput || !priceInput) return;

    if (checkbox.checked) {
        qtyInput.disabled = false;
        priceInput.disabled = false;

        const item = salesReturnsState.currentInvoiceItems[index];
        const available = getAvailableToReturn(item);
        qtyInput.value = String(available);
        // qtyInput.focus();
    } else {
        qtyInput.disabled = true;
        priceInput.disabled = true;
        qtyInput.value = '0';
    }

    calculateTotal();
}

function onQtyInput(input) {
    if (isEditLocked()) return;

    const index = input.dataset.index;
    const item = salesReturnsState.currentInvoiceItems[index];
    const maxQty = getAvailableToReturn(item);

    let val = Number.parseFloat(input.value);
    if (Number.isNaN(val)) {
        calculateTotal();
        return;
    }

    let shouldUpdate = false;
    if (val > maxQty) {
        val = maxQty;
        shouldUpdate = true;
    }
    if (val < 0) {
        val = 0;
        shouldUpdate = true;
    }

    if (shouldUpdate) {
        input.value = String(val);
    }
    
    calculateTotal();
}

const NAVIGABLE_RETURN_FIELDS = ['toggle', 'quantity', 'price'];

function getItemsRowFieldKey(target) {
    if (!target) return '';
    if (target.classList.contains('return-checkbox')) return 'toggle';
    if (target.classList.contains('return-qty-input')) return 'quantity';
    if (target.classList.contains('return-price-input')) return 'price';
    return '';
}

function getItemsRowFieldElement(row, fieldKey) {
    if (!row) return null;
    if (fieldKey === 'toggle') return row.querySelector('.return-checkbox');
    if (fieldKey === 'quantity') return row.querySelector('.return-qty-input');
    if (fieldKey === 'price') return row.querySelector('.return-price-input');
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

function isEnabledElement(field) {
    return Boolean(field && !field.disabled && !field.hasAttribute('disabled'));
}

function focusItemsRowField(row, fieldKey) {
    const field = getItemsRowFieldElement(row, fieldKey);
    if (!isEnabledElement(field)) return;

    closeVisibleAutocompleteLists();
    field.focus();
    if (field.type !== 'checkbox' && typeof field.select === 'function') {
        field.select();
    }
}

function getNextFieldKeyInSameRow(row, currentFieldIndex, step) {
    for (
        let idx = currentFieldIndex + step;
        idx >= 0 && idx < NAVIGABLE_RETURN_FIELDS.length;
        idx += step
    ) {
        const fieldKey = NAVIGABLE_RETURN_FIELDS[idx];
        const field = getItemsRowFieldElement(row, fieldKey);
        if (isEnabledElement(field)) return fieldKey;
    }

    return '';
}

function handleItemsArrowNavigation(event) {
    if (isEditLocked()) return;
    if (!salesReturnsState.dom.itemsBody) return;
    if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowLeft'
    ) return;

    const target = event.target;
    const row = target?.closest?.('tr');
    if (!row) return;

    const fieldKey = getItemsRowFieldKey(target);
    if (!fieldKey) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const currentFieldIndex = NAVIGABLE_RETURN_FIELDS.indexOf(fieldKey);
        if (currentFieldIndex < 0) return;

        const horizontalStep = event.key === 'ArrowRight' ? -1 : 1;
        const nextFieldKey = getNextFieldKeyInSameRow(row, currentFieldIndex, horizontalStep);
        if (!nextFieldKey) return;

        event.preventDefault();
        focusItemsRowField(row, nextFieldKey);
        return;
    }

    event.preventDefault();

    const rows = Array.from(salesReturnsState.dom.itemsBody.querySelectorAll('tr'));
    const currentIndex = rows.indexOf(row);
    if (currentIndex < 0) return;

    const direction = event.key === 'ArrowDown' ? 1 : -1;
    for (let idx = currentIndex + direction; idx >= 0 && idx < rows.length; idx += direction) {
        const field = getItemsRowFieldElement(rows[idx], fieldKey);
        if (!isEnabledElement(field)) continue;
        focusItemsRowField(rows[idx], fieldKey);
        return;
    }
}

function calculateTotal() {
    let total = 0;
    let hasItems = false;

    salesReturnsState.dom.itemsBody.querySelectorAll('.return-checkbox').forEach((checkbox) => {
        const index = checkbox.dataset.index;
        const rowTotalEl = salesReturnsState.dom.itemsBody.querySelector(`.row-total[data-index="${index}"]`);

        if (!rowTotalEl) return;

        if (!checkbox.checked) {
            rowTotalEl.textContent = '0.00';
            return;
        }

        const qty = Number.parseFloat(salesReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`)?.value || '0') || 0;
        const price = Number.parseFloat(salesReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`)?.value || '0') || 0;
        const rowTotal = qty * price;

        rowTotalEl.textContent = rowTotal.toFixed(2);
        total += rowTotal;
        if (qty > 0) hasItems = true;
    });

    salesReturnsState.dom.returnTotal.textContent = total.toFixed(2);
    
    if (salesReturnsState.dom.saveBtn) {
        if (!hasItems) {
            salesReturnsState.dom.saveBtn.style.opacity = '0.6';
            salesReturnsState.dom.saveBtn.style.cursor = 'not-allowed';
            salesReturnsState.dom.saveBtn.dataset.invalid = 'true';
            salesReturnsState.dom.saveBtn.disabled = true;
        } else {
            salesReturnsState.dom.saveBtn.style.opacity = '1';
            salesReturnsState.dom.saveBtn.style.cursor = 'pointer';
            salesReturnsState.dom.saveBtn.removeAttribute('data-invalid');
            salesReturnsState.dom.saveBtn.disabled = false;
        }
    }
}

function hideItemsSection() {
    salesReturnsState.dom.itemsSection.style.display = 'none';
    salesReturnsState.dom.itemsBody.innerHTML = '';
    salesReturnsState.dom.returnTotal.textContent = '0.00';
    
    if (salesReturnsState.dom.saveBtn) {
        salesReturnsState.dom.saveBtn.style.opacity = '0.6';
        salesReturnsState.dom.saveBtn.style.cursor = 'not-allowed';
        salesReturnsState.dom.saveBtn.dataset.invalid = 'true';
        salesReturnsState.dom.saveBtn.disabled = true;
    }
    salesReturnsState.currentInvoiceItems = [];
}

function collectSelectedItems() {
    const items = [];

    salesReturnsState.dom.itemsBody.querySelectorAll('.return-checkbox').forEach((checkbox) => {
        if (!checkbox.checked) return;

        const index = checkbox.dataset.index;
        const qty = Number.parseFloat(salesReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`)?.value || '0') || 0;
        const price = Number.parseFloat(salesReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`)?.value || '0') || 0;

        if (qty <= 0) return;

        items.push({
            item_id: salesReturnsState.currentInvoiceItems[index].item_id,
            quantity: qty,
            price,
            total_price: qty * price
        });
    });

    return items;
}

async function saveReturn() {
    if (isEditLocked()) {
        setEditLocked(false);
        Toast.show('تم تفعيل وضع التعديل. راجع البيانات ثم اضغط تحديث المرتجع.', 'success');
        return;
    }

    if (salesReturnsState.isSubmitting || salesReturnsState.dom.saveBtn?.dataset.invalid === 'true') return;

    salesReturnsState.isSubmitting = true;
    if (salesReturnsState.dom.saveBtn) {
        salesReturnsState.dom.saveBtn.style.opacity = '0.6';
        salesReturnsState.dom.saveBtn.style.cursor = 'not-allowed';
        salesReturnsState.dom.saveBtn.disabled = true;
    }

    try {
        const customerId = salesReturnsState.dom.customerSelect.value;
        const invoiceId = salesReturnsState.dom.invoiceSelect.value;
        const returnNumber = salesReturnsState.dom.returnNumberInput.value;
        const returnDate = salesReturnsState.dom.returnDateInput.value;
        const notes = document.getElementById('returnNotes').value;

        if (!customerId || !invoiceId) {
            Toast.show(t('salesReturns.toast.selectCustomerInvoice', 'Please select customer and invoice'), 'warning');
            return;
        }

        const items = collectSelectedItems();
        if (items.length === 0) {
            Toast.show(t('salesReturns.toast.selectAtLeastOneItem', 'Select at least one item for return'), 'warning');
            return;
        }

        const payload = {
            original_invoice_id: Number.parseInt(invoiceId, 10),
            customer_id: Number.parseInt(customerId, 10),
            return_number: returnNumber,
            return_date: returnDate,
            notes,
            items
        };

        let result;
        if (salesReturnsState.editingReturnId) {
            result = await salesReturnsApi.updateReturn({
                id: salesReturnsState.editingReturnId,
                ...payload
            });
        } else {
            result = await salesReturnsApi.saveReturn(payload);
        }

        if (result && result.success) {
            Toast.show(
                salesReturnsState.editingReturnId
                    ? t('salesReturns.toast.updateSuccess', 'تم تحديث بيانات المرتجع بنجاح')
                    : t('salesReturns.toast.saveSuccess', 'تم حفظ بيانات المرتجع بنجاح'),
                'success'
            );
            await resetForm();
            await loadReturnsHistory();
        } else {
            const errorText = salesReturnsState.editingReturnId
                ? t('salesReturns.toast.updateError', 'فشل في عملية تحديث المرتجع')
                : t('salesReturns.toast.saveError', 'فشل في عملية حفظ المرتجع');
            Toast.show((result && result.error) || errorText, 'error');
        }
    } catch (error) {
        if (salesReturnsState.editingReturnId && String(error?.message || '').includes("No handler registered for 'update-sales-return'")) {
            Toast.show(
                t(
                    'salesReturns.toast.restartRequired',
                    'تم تحديث جزء من التطبيق أثناء التشغيل. أغلق البرنامج وافتحه مرة أخرى ثم أعد المحاولة.'
                ),
                'warning'
            );
            return;
        }
        Toast.show(t('salesReturns.toast.unexpectedError', 'Unexpected error'), 'error');
    } finally {
        salesReturnsState.isSubmitting = false;
        if (salesReturnsState.dom.saveBtn) {
            salesReturnsState.dom.saveBtn.style.opacity = '1';
            salesReturnsState.dom.saveBtn.style.cursor = 'pointer';            salesReturnsState.dom.saveBtn.disabled = false;        }
        calculateTotal();
    }
}

async function resetForm() {
    salesReturnsState.editingReturnId = null;
    salesReturnsState.isEditLocked = false;
    salesReturnsState.editingOriginalInvoiceId = null;
    salesReturnsState.editingReturnItemsMap = new Map();
    clearEditQueryFromUrl();
    salesReturnsRender.setFormMode(false, t);
    setEditLocked(false);

    salesReturnsState.dom.customerSelect.value = '';
    if (salesReturnsState.customerAutocomplete) salesReturnsState.customerAutocomplete.refresh();

    salesReturnsState.dom.invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>`;
    salesReturnsState.dom.invoiceSelect.disabled = true;
    if (salesReturnsState.invoiceAutocomplete) salesReturnsState.invoiceAutocomplete.refresh();

    document.getElementById('returnNotes').value = '';
    hideItemsSection();
    await loadNextReturnNumber();
    salesReturnsState.dom.returnDateInput.valueAsDate = new Date();
    updateReturnNavigationButtons();
}

async function loadReturnForEdit(id) {
    const returnId = Number.parseInt(id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
        Toast.show(t('salesReturns.toast.invalidReturnId', 'Invalid return ID'), 'warning');
        clearEditQueryFromUrl();
        updateReturnNavigationButtons();
        return;
    }

    try {
        const returns = toArray(await salesReturnsApi.getReturns());
        const selectedReturn = returns.find((row) => Number(row.id) === returnId);
        if (!selectedReturn) {
            Toast.show(t('salesReturns.toast.returnNotFound', 'Return not found'), 'warning');
            clearEditQueryFromUrl();
            updateReturnNavigationButtons();
            return;
        }

        const details = toArray(await salesReturnsApi.getReturnDetails(returnId));
        salesReturnsState.editingReturnId = returnId;
        salesReturnsState.editingOriginalInvoiceId = Number(selectedReturn.original_invoice_id);
        salesReturnsState.editingReturnItemsMap = new Map();

        details.forEach((detail) => {
            const itemId = Number(detail.item_id);
            if (!Number.isFinite(itemId)) return;
            const prev = salesReturnsState.editingReturnItemsMap.get(itemId);
            salesReturnsState.editingReturnItemsMap.set(itemId, {
                quantity: (prev ? toSafeNumber(prev.quantity) : 0) + toSafeNumber(detail.quantity),
                price: toSafeNumber(detail.price)
            });
        });

        salesReturnsRender.setFormMode(true, t);

        salesReturnsState.dom.customerSelect.value = String(selectedReturn.customer_id ?? '');
        if (salesReturnsState.customerAutocomplete) salesReturnsState.customerAutocomplete.refresh();

        salesReturnsState.dom.invoiceSelect.disabled = false;
        await loadCustomerInvoices(selectedReturn.customer_id);

        const invoiceValue = String(selectedReturn.original_invoice_id ?? '');
        const hasInvoiceOption = Array.from(salesReturnsState.dom.invoiceSelect.options).some((option) => option.value === invoiceValue);
        if (!hasInvoiceOption && invoiceValue) {
            const fallbackOption = document.createElement('option');
            fallbackOption.value = invoiceValue;
            fallbackOption.textContent = fmt(
                t('salesReturns.invoiceOption', 'Invoice #{number} - {date} - {total}'),
                {
                    number: selectedReturn.original_invoice_number || invoiceValue,
                    date: '-',
                    total: `${(Number(selectedReturn.total_amount) || 0).toFixed(2)} ${t('common.currency.egp', 'EGP')}`
                }
            );
            salesReturnsState.dom.invoiceSelect.appendChild(fallbackOption);
        }

        salesReturnsState.dom.invoiceSelect.value = invoiceValue;
        if (salesReturnsState.invoiceAutocomplete) salesReturnsState.invoiceAutocomplete.refresh();

        salesReturnsState.dom.returnNumberInput.value = selectedReturn.return_number || '';
        salesReturnsState.dom.returnDateInput.value = selectedReturn.return_date
            ? String(selectedReturn.return_date).split('T')[0]
            : new Date().toISOString().slice(0, 10);

        document.getElementById('returnNotes').value = selectedReturn.notes || '';

        await loadInvoiceItems(selectedReturn.original_invoice_id);
        setEditLocked(true);
        updateReturnNavigationButtons();
    } catch (_) {
        Toast.show(t('salesReturns.toast.loadReturnError', 'Failed to load return data for editing'), 'error');
        updateReturnNavigationButtons();
    }
}

async function loadReturnsHistory() {
    salesReturnsState.allSalesReturns = toArray(await salesReturnsApi.getReturns());
    salesReturnsState.salesReturnsPage = 1;
    renderReturnsHistory();
    updateReturnNavigationButtons();
}

function getOrderedReturnsForNavigation() {
    return toArray(salesReturnsState.allSalesReturns)
        .slice()
        .sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
}

function findCurrentReturnIndexForNavigation(orderedReturns) {
    if (!orderedReturns.length) return -1;

    if (Number.isFinite(Number(salesReturnsState.editingReturnId))) {
        const activeId = Number(salesReturnsState.editingReturnId);
        const editIdx = orderedReturns.findIndex((entry) => Number(entry?.id) === activeId);
        if (editIdx >= 0) return editIdx;
    }

    const currentReturnNumber = (salesReturnsState.dom.returnNumberInput?.value || '').trim();
    if (!currentReturnNumber) return -1;

    return orderedReturns.findIndex((entry) => String(entry?.return_number || '').trim() === currentReturnNumber);
}

function applyReturnNavButtonState(button, disabled, disabledTitle) {
    if (!button) return;

    button.disabled = Boolean(disabled);
    button.style.opacity = disabled ? '0.55' : '1';
    button.style.cursor = disabled ? 'not-allowed' : 'pointer';
    button.title = disabled ? disabledTitle : '';
}

function updateReturnNavigationButtons() {
    const prevBtn = document.querySelector('[data-action="load-prev-return"]');
    const nextBtn = document.querySelector('[data-action="load-next-return"]');
    if (!prevBtn || !nextBtn) return;

    const orderedReturns = getOrderedReturnsForNavigation();
    if (!orderedReturns.length) {
        applyReturnNavButtonState(prevBtn, true, 'لا يوجد مرتجع سابق');
        applyReturnNavButtonState(nextBtn, true, 'لا يوجد مرتجع تالي');
        return;
    }

    const currentIndex = findCurrentReturnIndexForNavigation(orderedReturns);
    if (currentIndex < 0) {
        applyReturnNavButtonState(prevBtn, false, '');
        applyReturnNavButtonState(nextBtn, true, 'لا يوجد مرتجع تالي');
        return;
    }

    const isPrevDisabled = currentIndex <= 0;
    // Keep "next" enabled on the latest saved return to allow returning to a fresh empty form.
    const isNextDisabled = false;

    applyReturnNavButtonState(prevBtn, isPrevDisabled, 'لا يوجد مرتجع سابق');
    applyReturnNavButtonState(nextBtn, isNextDisabled, '');
}

async function navigateReturn(direction) {
    const orderedReturns = getOrderedReturnsForNavigation();
    if (!orderedReturns.length) {
        Toast.show('لا توجد مرتجعات محفوظة للتنقل بينها', 'warning');
        updateReturnNavigationButtons();
        return;
    }

    const currentIndex = findCurrentReturnIndexForNavigation(orderedReturns);
    const targetIndex = currentIndex < 0
        ? (direction < 0 ? orderedReturns.length - 1 : 0)
        : currentIndex + direction;

    if (targetIndex < 0) {
        Toast.show('لا يوجد مرتجع سابق', 'warning');
        updateReturnNavigationButtons();
        return;
    }

    if (targetIndex >= orderedReturns.length) {
        if (direction > 0 && currentIndex === orderedReturns.length - 1) {
            await resetForm();
            updateReturnNavigationButtons();
            return;
        }

        Toast.show('لا يوجد مرتجع تالي', 'warning');
        updateReturnNavigationButtons();
        return;
    }

    const targetReturn = orderedReturns[targetIndex];
    if (!targetReturn?.id) {
        Toast.show('تعذر فتح المرتجع المطلوب', 'error');
        return;
    }

    await loadReturnForEdit(targetReturn.id);
}

function renderReturnsHistory() {
    if (!salesReturnsState.allSalesReturns.length) {
        salesReturnsRender.renderEmptyHistory(salesReturnsState.dom.historyContent, t);
        return;
    }

    const totalPages = Math.ceil(salesReturnsState.allSalesReturns.length / salesReturnsState.salesReturnsPerPage);
    if (salesReturnsState.salesReturnsPage > totalPages) salesReturnsState.salesReturnsPage = totalPages;
    if (salesReturnsState.salesReturnsPage < 1) salesReturnsState.salesReturnsPage = 1;

    const startIdx = (salesReturnsState.salesReturnsPage - 1) * salesReturnsState.salesReturnsPerPage;
    const pageReturns = salesReturnsState.allSalesReturns.slice(startIdx, startIdx + salesReturnsState.salesReturnsPerPage);

    salesReturnsRender.renderHistoryTable({
        container: salesReturnsState.dom.historyContent,
        rows: pageReturns,
        page: salesReturnsState.salesReturnsPage,
        totalPages,
        t,
        fmt
    });
}

function changeSalesReturnsPage(newPage) {
    const totalPages = Math.ceil(salesReturnsState.allSalesReturns.length / salesReturnsState.salesReturnsPerPage);
    if (newPage < 1 || newPage > totalPages) return;

    salesReturnsState.salesReturnsPage = newPage;
    renderReturnsHistory();
}

async function deleteReturn(id) {
    if (!Number.isFinite(id)) return;

    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('salesReturns.confirmDelete', 'هل أنت متأكد من رغبتك في حذف هذا المرتجع؟'))
        : false;
    if (!confirmed) {
        return;
    }

    try {
        const result = await salesReturnsApi.deleteReturn(id);

        if (result && result.success) {
            Toast.show(t('salesReturns.toast.deleteSuccess', 'تم حذف المرتجع بنجاح'), 'success');
            await loadReturnsHistory();

            if (salesReturnsState.dom.invoiceSelect.value) {
                await loadInvoiceItems(salesReturnsState.dom.invoiceSelect.value);
            }
            return;
        }

        Toast.show((result && result.error) || t('salesReturns.toast.deleteError', 'فشل في حذف المرتجع'), 'error');
    } catch (_) {
        Toast.show(t('salesReturns.toast.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
    }
}
