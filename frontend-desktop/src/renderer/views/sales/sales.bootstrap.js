const salesState = window.salesPageState.createInitialState();
const salesApi = window.salesPageApi;
const salesRender = window.salesPageRender;
const salesEvents = window.salesPageEvents;
const { t, fmt } = window.i18n?.createPageHelpers?.(() => salesState.ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
const SALES_PRINT_PRINTER_STORAGE_KEY = 'sales.invoicePrinterName';

function getNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

document.addEventListener('DOMContentLoaded', async () => {
    // Reset submitting state just in case
    salesState.isSubmitting = false;

    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        salesState.ar = await window.i18n.loadArabicDictionary();
    }

    salesRender.renderPage({ t, getNavHTML });

    if (window.FieldSystem && typeof window.FieldSystem.enable === 'function') {
        window.FieldSystem.enable(document, { watch: true });
    }

    initializeElements();

    if (salesState.dom.invoiceDateInput) {
        salesState.dom.invoiceDateInput.valueAsDate = new Date();
    }

    Promise.all([loadCustomers(), loadItems(), loadInvoiceNumberSuggestions()]).then(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('editId');
        if (editId) {
            await loadInvoiceForEdit(editId);
        } else {
            await initializeNewInvoice();
        }

        if (urlParams.get('openShiftClose') === '1') {
            await openShiftCloseModal();
            clearShiftCloseAutoOpenQueryParam();
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
    window.salesPageState.initializeDomRefs(salesState);

    salesEvents.bindStaticEvents({
        root: salesState.dom.app,
        dom: salesState.dom,
        handlers: {
            onCustomerChange: handleCustomerChange,
            onAddRow: () => addInvoiceRow(),
            onSubmitInvoice: submitInvoice,
            onPrintInvoice: printInvoice,
            onConfirmPrintInvoice: confirmPrintInvoice,
            onClosePrintPreview: closePrintPreview,
            onChangePrintPrinter: changePrintPrinter,
            onLoadPrevInvoice: () => navigateInvoice(-1),
            onLoadNextInvoice: () => navigateInvoice(1),
            onRemoveRow: removeRow,
            onOpenShiftCloseModal: () => openShiftCloseModal(),
            onCloseShiftCloseModal: () => closeShiftCloseModal(),
            onRefreshShiftClosePreview: () => refreshShiftClosePreview({ keepCurrentAmounts: false }),
            onSubmitShiftClose: () => submitShiftClose(),
            onResetShiftCloseForm: () => resetShiftCloseForm({ keepSearch: true }),
            onEditShiftClose: editShiftCloseFromAction,
            onDeleteShiftClose: deleteShiftCloseFromAction,
            onShiftCloseSearchInput: () => queueShiftCloseHistoryRefresh(),
            onShiftCloseAmountsInput: () => updateShiftCloseDifferenceDisplay()
        }
    });

    salesEvents.bindRowsEvents({
        dom: salesState.dom,
        handlers: {
            onItemSelect,
            onRowInput,
            onRowArrowNavigate: handleRowArrowNavigation
        }
    });

    if (salesState.dom.discountTypeSelect) {
        salesState.dom.discountTypeSelect.addEventListener('change', () => calculateInvoiceTotal());
    }

    if (salesState.dom.discountValueInput) {
        salesState.dom.discountValueInput.addEventListener('input', () => calculateInvoiceTotal());
    }

    if (salesState.dom.paidAmountInput) {
        salesState.dom.paidAmountInput.addEventListener('input', () => calculateInvoiceTotal());
    }

    const invoiceNumberInput = document.getElementById('invoiceNumber');
    if (invoiceNumberInput) {
        invoiceNumberInput.addEventListener('input', updateInvoiceNavigationButtons);
        invoiceNumberInput.addEventListener('change', updateInvoiceNavigationButtons);
    }

    if (salesState.dom.shiftCloseModal) {
        salesState.dom.shiftCloseModal.addEventListener('click', (event) => {
            if (event.target === salesState.dom.shiftCloseModal) {
                closeShiftCloseModal();
            }
        });
    }

    if (salesState.dom.printPreviewModal) {
        salesState.dom.printPreviewModal.addEventListener('click', (event) => {
            if (event.target === salesState.dom.printPreviewModal) {
                closePrintPreview();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (salesState.dom.printPreviewModal?.classList.contains('is-open')) {
            closePrintPreview();
            return;
        }
        if (!salesState.dom.shiftCloseModal) return;
        if (!salesState.dom.shiftCloseModal.classList.contains('is-open')) return;
        closeShiftCloseModal();
    });
}

function clearShiftCloseAutoOpenQueryParam() {
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has('openShiftClose')) return;

    currentUrl.searchParams.delete('openShiftClose');
    const nextSearch = currentUrl.searchParams.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, nextUrl);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatMoneyForUi(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0.00';
    return roundMoney(num).toFixed(2);
}

function formatShiftCloseDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function parseShiftCloseMoney(value, { allowEmpty = false } = {}) {
    const normalized = String(value ?? '').trim();
    if (normalized === '') {
        return allowEmpty ? null : NaN;
    }

    const parsed = parseLocaleFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return NaN;
    }

    return roundMoney(parsed);
}

function setShiftCloseSubmitMode(isEditMode) {
    if (!salesState.dom.shiftCloseSubmitLabel || !salesState.dom.shiftCloseSubmitBtn) return;

    if (isEditMode) {
        salesState.dom.shiftCloseSubmitLabel.textContent = 'حفظ تعديل الإقفال';
        salesState.dom.shiftCloseSubmitBtn.title = 'تحديث سجل الإقفال مع تعديل رصيد المالية';
        if (salesState.dom.shiftCloseTotalInput) {
            salesState.dom.shiftCloseTotalInput.readOnly = false;
            salesState.dom.shiftCloseTotalInput.title = 'يمكنك تعديل إجمالي المرحل عند مراجعة السجل';
        }
    } else {
        salesState.dom.shiftCloseSubmitLabel.textContent = 'تأكيد الإقفال وترحيل المالية';
        salesState.dom.shiftCloseSubmitBtn.title = 'ترحيل إجمالي المقبوض إلى المالية كعملية واحدة';
        if (salesState.dom.shiftCloseTotalInput) {
            salesState.dom.shiftCloseTotalInput.readOnly = true;
            salesState.dom.shiftCloseTotalInput.title = 'يتم احتساب الإجمالي تلقائيًا من مدفوع فواتير البيع';
        }
    }
}

function updateShiftCloseDifferenceDisplay() {
    const diffEl = salesState.dom.shiftCloseDifferenceSpan;
    if (!diffEl) return;

    const salesOnlyValue = parseShiftCloseMoney(salesState.dom.shiftCloseTotalInput?.value, { allowEmpty: false });
    const collectionsValue = parseShiftCloseMoney(salesState.dom.shiftCloseCollectionsInput?.value, { allowEmpty: false });
    const drawerValue = parseShiftCloseMoney(salesState.dom.shiftCloseDrawerInput?.value, { allowEmpty: true });

    diffEl.classList.remove('diff-positive', 'diff-negative');

    if (!Number.isFinite(salesOnlyValue) || !Number.isFinite(collectionsValue)) {
        diffEl.textContent = '0.00';
        return;
    }

    if (Number.isNaN(drawerValue) || drawerValue === null) {
        diffEl.textContent = '0.00';
        return;
    }

    const totalTransferred = roundMoney(salesOnlyValue + collectionsValue);
    const difference = roundMoney(drawerValue - totalTransferred);
    diffEl.textContent = difference.toFixed(2);

    if (difference > 0) {
        diffEl.classList.add('diff-positive');
    } else if (difference < 0) {
        diffEl.classList.add('diff-negative');
    }
}

function applyShiftClosePreviewToUi(preview) {
    if (salesState.dom.shiftClosePeriodStartSpan) {
        salesState.dom.shiftClosePeriodStartSpan.textContent = formatShiftCloseDateTime(preview?.period_start_at);
    }

    if (salesState.dom.shiftClosePeriodEndSpan) {
        salesState.dom.shiftClosePeriodEndSpan.textContent = formatShiftCloseDateTime(preview?.period_end_at);
    }

    if (salesState.dom.shiftCloseCollectionsInput) {
        const collectionsTotal = Number(preview?.customer_collections_total);
        salesState.dom.shiftCloseCollectionsInput.value = Number.isFinite(collectionsTotal)
            ? formatMoneyForUi(collectionsTotal)
            : '0.00';
    }
}

function setShiftCloseSubmitLoading(loading) {
    const submitBtn = salesState.dom.shiftCloseSubmitBtn;
    if (!submitBtn) return;

    submitBtn.disabled = Boolean(loading);
    submitBtn.style.opacity = loading ? '0.65' : '1';
    submitBtn.style.cursor = loading ? 'not-allowed' : 'pointer';
}

async function resolveActiveAuthUsername() {
    try {
        if (!window.electronAPI || typeof window.electronAPI.getActiveAuthUser !== 'function') {
            return '';
        }

        let sessionToken = '';
        if (typeof window.electronAPI.getAuthSessionToken === 'function') {
            sessionToken = await window.electronAPI.getAuthSessionToken();
        }

        const activeUser = await window.electronAPI.getActiveAuthUser({ sessionToken });
        return String(activeUser?.username || '').trim();
    } catch (_error) {
        return '';
    }
}

async function hydrateShiftCloseUserField() {
    if (!salesState.dom.shiftCloseCreatedByInput) return;

    if (String(salesState.dom.shiftCloseCreatedByInput.value || '').trim() !== '') {
        return;
    }

    const username = await resolveActiveAuthUsername();
    if (username) {
        salesState.dom.shiftCloseCreatedByInput.value = username;
    }
}

function getShiftCloseHistoryRowStatus(row = {}) {
    const hasDrawer = row?.drawer_amount !== null && row?.drawer_amount !== undefined && String(row.drawer_amount).trim() !== '';
    if (!hasDrawer) return 'missing';

    const totalValue = Number(row?.sales_paid_total);
    const drawerValue = Number(row?.drawer_amount);
    if (!Number.isFinite(totalValue) || !Number.isFinite(drawerValue)) {
        return 'mismatch';
    }

    const difference = roundMoney(drawerValue - totalValue);
    return difference === 0 ? 'match' : 'mismatch';
}

function renderShiftCloseHistoryRows() {
    const body = salesState.dom.shiftCloseTableBody;
    if (!body) return;

    const rows = Array.isArray(salesState.shiftClosings) ? salesState.shiftClosings : [];
    if (!rows.length) {
        body.innerHTML = `
            <tr>
                <td colspan="10" class="sales-shift-empty">لا توجد إقفالات مسجلة حتى الآن.</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = rows.map((row) => {
        const rowId = Number(row?.id) || 0;
        const isEditing = Number(salesState.editingShiftClosingId) === rowId;
        const rowStatus = getShiftCloseHistoryRowStatus(row);
        const rowClass = rowStatus === 'match'
            ? 'sales-shift-status-match'
            : rowStatus === 'mismatch'
                ? 'sales-shift-status-mismatch'
                : 'sales-shift-status-missing';
        const periodStart = formatShiftCloseDateTime(row?.period_start_at);
        const periodEnd = formatShiftCloseDateTime(row?.period_end_at);
        const total = formatMoneyForUi(row?.sales_paid_total);

        const hasDrawer = row?.drawer_amount !== null && row?.drawer_amount !== undefined && String(row.drawer_amount) !== '';
        const drawer = hasDrawer ? formatMoneyForUi(row.drawer_amount) : '-';

        const hasDifference = row?.difference_amount !== null && row?.difference_amount !== undefined && String(row.difference_amount) !== '';
        const difference = hasDifference ? formatMoneyForUi(row.difference_amount) : '-';

        const createdBy = row?.created_by ? escapeHtml(row.created_by) : '-';
        const notes = row?.notes ? escapeHtml(row.notes) : '-';
        const updatedAt = row?.updated_at ? formatShiftCloseDateTime(row.updated_at) : '-';

        return `
            <tr class="${rowClass}">
                <td>${rowId}</td>
                <td>${escapeHtml(periodStart)}</td>
                <td>${escapeHtml(periodEnd)}</td>
                <td>${total}</td>
                <td>${drawer}</td>
                <td>${difference}</td>
                <td>${createdBy}</td>
                <td class="sales-shift-note-cell" title="${notes}">${notes}</td>
                <td>${escapeHtml(updatedAt)}</td>
                <td>
                    <div class="sales-shift-actions-cell">
                        <button class="btn ${isEditing ? 'btn-success' : 'btn-outline'}" type="button" data-action="edit-shift-close" data-id="${rowId}">تعديل</button>
                        <button class="btn btn-outline" type="button" data-action="delete-shift-close" data-id="${rowId}">حذف</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadShiftCloseHistory() {
    const search = String(salesState.dom.shiftCloseSearchInput?.value || '').trim();
    const result = await salesApi.getShiftClosings({ search });

    if (!result || !result.success) {
        if (window.showToast) window.showToast('تعذر تحميل سجل إقفالات الوردية', 'error');
        return;
    }

    salesState.shiftClosings = Array.isArray(result.closings) ? result.closings : [];
    renderShiftCloseHistoryRows();
}

function queueShiftCloseHistoryRefresh() {
    if (salesState.shiftCloseSearchTimer) {
        clearTimeout(salesState.shiftCloseSearchTimer);
    }

    salesState.shiftCloseSearchTimer = setTimeout(() => {
        loadShiftCloseHistory();
    }, 180);
}

function resetShiftCloseForm({ keepSearch = false } = {}) {
    salesState.editingShiftClosingId = null;
    setShiftCloseSubmitMode(false);

    if (!keepSearch && salesState.dom.shiftCloseSearchInput) {
        salesState.dom.shiftCloseSearchInput.value = '';
    }

    if (salesState.dom.shiftCloseNotesInput) {
        salesState.dom.shiftCloseNotesInput.value = '';
    }

    if (salesState.dom.shiftCloseDrawerInput) {
        salesState.dom.shiftCloseDrawerInput.value = '';
    }

    if (salesState.dom.shiftCloseTotalInput) {
        const previewTotal = salesState.shiftClosePreview?.sales_only_total;
        salesState.dom.shiftCloseTotalInput.value = Number.isFinite(Number(previewTotal))
            ? formatMoneyForUi(previewTotal)
            : '0.00';
    }

    if (salesState.dom.shiftCloseCollectionsInput) {
        const previewCollections = salesState.shiftClosePreview?.customer_collections_total;
        salesState.dom.shiftCloseCollectionsInput.value = Number.isFinite(Number(previewCollections))
            ? formatMoneyForUi(previewCollections)
            : '0.00';
    }

    applyShiftClosePreviewToUi(salesState.shiftClosePreview || null);
    updateShiftCloseDifferenceDisplay();
    hydrateShiftCloseUserField();
}

async function refreshShiftClosePreview({ keepCurrentAmounts = false } = {}) {
    const result = await salesApi.getShiftClosePreview();
    if (!result || !result.success) {
        if (window.showToast) window.showToast('تعذر تحميل إجمالي المقبوض للفترة الحالية', 'error');
        return;
    }

    salesState.shiftClosePreview = result;
    applyShiftClosePreviewToUi(result);

    if (!keepCurrentAmounts && !salesState.editingShiftClosingId && salesState.dom.shiftCloseTotalInput) {
        const salesOnlyTotal = Number(result.sales_only_total);
        salesState.dom.shiftCloseTotalInput.value = Number.isFinite(salesOnlyTotal)
            ? formatMoneyForUi(salesOnlyTotal)
            : formatMoneyForUi(result.sales_paid_total);
    }

    updateShiftCloseDifferenceDisplay();
}

async function openShiftCloseModal() {
    if (!salesState.dom.shiftCloseModal) return;

    salesState.dom.shiftCloseModal.style.display = 'flex';
    salesState.dom.shiftCloseModal.classList.add('is-open');
    salesState.dom.shiftCloseModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    await hydrateShiftCloseUserField();
    await refreshShiftClosePreview({ keepCurrentAmounts: false });
    resetShiftCloseForm({ keepSearch: true });
    await loadShiftCloseHistory();
}

function closeShiftCloseModal() {
    if (!salesState.dom.shiftCloseModal) return;

    salesState.dom.shiftCloseModal.classList.remove('is-open');
    salesState.dom.shiftCloseModal.setAttribute('aria-hidden', 'true');
    salesState.dom.shiftCloseModal.style.display = 'none';
    document.body.style.overflow = '';
}

function editShiftCloseFromAction(actionEl) {
    const id = Number(actionEl?.dataset?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    const row = (salesState.shiftClosings || []).find((entry) => Number(entry?.id) === id);
    if (!row) return;

    salesState.editingShiftClosingId = id;
    setShiftCloseSubmitMode(true);

    if (salesState.dom.shiftClosePeriodStartSpan) {
        salesState.dom.shiftClosePeriodStartSpan.textContent = formatShiftCloseDateTime(row.period_start_at);
    }

    if (salesState.dom.shiftClosePeriodEndSpan) {
        salesState.dom.shiftClosePeriodEndSpan.textContent = formatShiftCloseDateTime(row.period_end_at);
    }

    const collectionsTotal = Number(row.customer_collections_total);
    const normalizedCollectionsTotal = Number.isFinite(collectionsTotal) ? roundMoney(Math.max(collectionsTotal, 0)) : 0;
    const rowTransferredTotal = Number(row.sales_paid_total);
    const salesOnlyTotal = Number.isFinite(rowTransferredTotal)
        ? roundMoney(Math.max(rowTransferredTotal - normalizedCollectionsTotal, 0))
        : 0;

    if (salesState.dom.shiftCloseTotalInput) {
        salesState.dom.shiftCloseTotalInput.value = formatMoneyForUi(salesOnlyTotal);
    }

    if (salesState.dom.shiftCloseCollectionsInput) {
        salesState.dom.shiftCloseCollectionsInput.value = formatMoneyForUi(normalizedCollectionsTotal);
    }

    if (salesState.dom.shiftCloseDrawerInput) {
        const hasDrawer = row.drawer_amount !== null && row.drawer_amount !== undefined && String(row.drawer_amount) !== '';
        salesState.dom.shiftCloseDrawerInput.value = hasDrawer ? formatMoneyForUi(row.drawer_amount) : '';
    }

    if (salesState.dom.shiftCloseNotesInput) {
        salesState.dom.shiftCloseNotesInput.value = row.notes || '';
    }

    if (salesState.dom.shiftCloseCreatedByInput) {
        salesState.dom.shiftCloseCreatedByInput.value = row.created_by || salesState.dom.shiftCloseCreatedByInput.value || '';
    }

    updateShiftCloseDifferenceDisplay();
    renderShiftCloseHistoryRows();
}

async function deleteShiftCloseFromAction(actionEl) {
    const id = Number(actionEl?.dataset?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog('هل أنت متأكد من حذف سجل الإقفال؟ سيتم خصم قيمته من المالية.')
        : false;
    if (!confirmed) return;

    const result = await salesApi.deleteShiftClosing(id);
    if (!result || !result.success) {
        if (window.showToast) window.showToast((result && result.error) || 'تعذر حذف سجل الإقفال', 'error');
        return;
    }

    if (window.showToast) window.showToast('تم حذف سجل الإقفال وتحديث المالية', 'success');

    if (Number(salesState.editingShiftClosingId) === id) {
        resetShiftCloseForm({ keepSearch: true });
    }

    await refreshShiftClosePreview({ keepCurrentAmounts: false });
    await loadShiftCloseHistory();
}

async function submitShiftClose() {
    const salesOnlyValue = parseShiftCloseMoney(salesState.dom.shiftCloseTotalInput?.value, { allowEmpty: false });
    if (!Number.isFinite(salesOnlyValue) || salesOnlyValue < 0) {
        if (window.showToast) window.showToast('يرجى إدخال إجمالي صحيح (صفر أو أكثر)', 'error');
        return;
    }

    const collectionsValue = parseShiftCloseMoney(salesState.dom.shiftCloseCollectionsInput?.value, { allowEmpty: false });
    if (!Number.isFinite(collectionsValue) || collectionsValue < 0) {
        if (window.showToast) window.showToast('قيمة إجمالي تحصيل العملاء غير صحيحة', 'error');
        return;
    }

    const totalTransferred = roundMoney(salesOnlyValue + collectionsValue);
    const drawerValue = parseShiftCloseMoney(salesState.dom.shiftCloseDrawerInput?.value, { allowEmpty: true });
    if (Number.isNaN(drawerValue)) {
        if (window.showToast) window.showToast('قيمة الدرج الفعلية غير صحيحة', 'error');
        return;
    }

    const notes = String(salesState.dom.shiftCloseNotesInput?.value || '').trim();
    let createdBy = String(salesState.dom.shiftCloseCreatedByInput?.value || '').trim();
    if (!createdBy) {
        createdBy = await resolveActiveAuthUsername();
        if (createdBy && salesState.dom.shiftCloseCreatedByInput) {
            salesState.dom.shiftCloseCreatedByInput.value = createdBy;
        }
    }

    setShiftCloseSubmitLoading(true);
    try {
        const editingShiftId = Number(salesState.editingShiftClosingId);
        const isEditMode = Number.isFinite(editingShiftId) && editingShiftId > 0;
        let result;

        if (isEditMode) {
            result = await salesApi.updateShiftClosing({
                id: editingShiftId,
                sales_paid_total: totalTransferred,
                customer_collections_total: collectionsValue,
                drawer_amount: drawerValue,
                notes,
                created_by: createdBy,
                updated_by: createdBy
            });
        } else {
            result = await salesApi.createShiftClosing({
                drawer_amount: drawerValue,
                notes,
                created_by: createdBy,
                period_end_at: new Date().toISOString()
            });
        }

        if (!result || !result.success) {
            if (window.showToast) window.showToast((result && result.error) || 'تعذر حفظ إقفال الوردية', 'error');
            return;
        }

        if (window.showToast) {
            window.showToast(isEditMode ? 'تم تعديل الإقفال وتحديث المالية' : 'تم إقفال الوردية وترحيل القيمة إلى المالية', 'success');
        }

        await refreshShiftClosePreview({ keepCurrentAmounts: false });
        resetShiftCloseForm({ keepSearch: true });
        await loadShiftCloseHistory();
    } catch (error) {
        if (window.showToast) window.showToast(error.message || 'حدث خطأ أثناء حفظ الإقفال', 'error');
    } finally {
        setShiftCloseSubmitLoading(false);
    }
}

function isEditLocked() {
    return Boolean(salesState.editingInvoiceId && salesState.isEditLocked);
}

function setEditLocked(locked) {
    const form = salesState.dom.invoiceForm;
    if (!form) return;

    salesState.isEditLocked = Boolean(locked);
    const lockActive = Boolean(salesState.editingInvoiceId && salesState.isEditLocked);
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
            control.dataset.action === 'print-invoice' ||
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
        } else if (salesState.editingInvoiceId) {
            submitBtn.textContent = t('sales.updateAndSave', 'تحديث وحفظ الفاتورة');
        } else {
            submitBtn.textContent = t('sales.saveAndPost', 'حفظ الفاتورة');
        }
    }

    if (statusChip) {
        if (lockActive) {
            statusChip.textContent = 'وضع عرض فقط';
        } else if (salesState.editingInvoiceId) {
            statusChip.textContent = 'وضع التعديل مفعل';
        } else {
            statusChip.textContent = t('sales.formStatusChip', 'فاتورة مبيعات');
        }
    }

    if (shell) {
        if (lockActive) {
            shell.style.outline = '2px dashed #f59e0b';
            shell.style.outlineOffset = '4px';
            shell.style.opacity = '0.94';
            shell.style.filter = 'grayscale(0.2)';
        } else if (salesState.editingInvoiceId) {
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

    if (salesState.dom.invoiceItemsBody) {
        salesState.dom.invoiceItemsBody.querySelectorAll('.remove-row').forEach((removeEl) => {
            removeEl.style.pointerEvents = lockActive ? 'none' : '';
            removeEl.style.opacity = lockActive ? '0.45' : '';
        });
    }
}

async function handleCustomerChange() {
    if (isEditLocked()) return;

    if (!salesState.dom.customerSelect) return;

    if (salesState.dom.customerSelect.value) {
        await displayCustomerBalance();
        if (salesState.dom.invoiceItemsBody.children.length === 0) {
            addInvoiceRow();
        }
    } else {
        const balanceDiv = document.getElementById('customerBalance');
        if (balanceDiv) balanceDiv.style.display = 'none';
        clearSelectedItemAvailability();
    }
    
    updatePrintBtnState();
}

async function initializeNewInvoice() {
    salesState.isEditLocked = false;
    setEditLocked(false);
    salesState.originalInvoiceItemTotalsByItemId = {};
    const nextId = await salesApi.getNextInvoiceNumber();
    const invoiceNumberInput = document.getElementById('invoiceNumber');
    if (invoiceNumberInput) {
        invoiceNumberInput.value = nextId;
    }
    calculateInvoiceTotal();
    updateInvoiceNavigationButtons();
}

async function loadInvoiceForEdit(id) {
    try {
        const invoice = await salesApi.getInvoiceWithDetails(id);
        if (!invoice) {
            if (window.showToast) window.showToast(t('sales.invoiceNotFound', 'الفاتورة غير موجودة'), 'error');
            updateInvoiceNavigationButtons();
            return;
        }

        salesState.editingInvoiceId = id;
        salesState.originalInvoiceItemTotalsByItemId = {};
        (invoice.items || []).forEach((item) => {
            const itemId = parseInt(item.item_id, 10);
            const qty = Number(item.quantity) || 0;
            if (!Number.isFinite(itemId) || qty <= 0) return;
            salesState.originalInvoiceItemTotalsByItemId[itemId] = (salesState.originalInvoiceItemTotalsByItemId[itemId] || 0) + qty;
        });

        salesState.dom.customerSelect.value = invoice.customer_id;
        if (salesState.customerAutocomplete) salesState.customerAutocomplete.refresh();

        const invoiceNumberInput = document.getElementById('invoiceNumber');
        if (invoiceNumberInput) {
            invoiceNumberInput.value = invoice.invoice_number;
        }

        if (invoice.invoice_date) {
            salesState.dom.invoiceDateInput.value = invoice.invoice_date.split('T')[0];
        }

        const notesInput = document.getElementById('invoiceNotes');
        if (notesInput) notesInput.value = invoice.notes || '';

        const paymentTypeInput = document.getElementById('paymentType');
        if (paymentTypeInput) paymentTypeInput.value = invoice.payment_type || 'cash';

        const subtotalFromDetails = (invoice.items || []).reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
        const storedTotal = Number(invoice.total_amount) || 0;
        const fallbackDiscountAmount = Math.max(subtotalFromDetails - storedTotal, 0);
        const discountTypeInput = salesState.dom.discountTypeSelect;
        const discountValueInput = salesState.dom.discountValueInput;
        const paidAmountInput = salesState.dom.paidAmountInput;

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

        salesState.dom.invoiceItemsBody.innerHTML = '';
        invoice.items.forEach((item) => addInvoiceRow(item));
        calculateInvoiceTotal();
        updateSelectedItemAvailability(salesState.dom.invoiceItemsBody.querySelector('tr'));

        salesRender.setEditModeUI(t);
        setEditLocked(true);
        updateInvoiceNavigationButtons();
    } catch (error) {
        if (window.showToast) window.showToast(t('sales.toast.unexpectedError', 'حدث خطأ غير متوقع') + ': ' + error.message, 'error');
        updateInvoiceNavigationButtons();
    }
}

function getSavedPrintPrinterName() {
    try {
        return localStorage.getItem(SALES_PRINT_PRINTER_STORAGE_KEY) || '';
    } catch (_) {
        return '';
    }
}

function savePrintPrinterName(name) {
    try {
        if (name) {
            localStorage.setItem(SALES_PRINT_PRINTER_STORAGE_KEY, name);
        }
    } catch (_) {
    }
}

function clearSavedPrintPrinterName() {
    try {
        localStorage.removeItem(SALES_PRINT_PRINTER_STORAGE_KEY);
    } catch (_) {
    }
}

function syncPrintPreviewContent() {
    const printArea = document.getElementById('printArea');
    const previewPage = document.getElementById('salesPrintPreviewPage');
    if (!printArea || !previewPage) return;

    const clone = printArea.cloneNode(true);
    clone.style.display = 'block';
    clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    previewPage.innerHTML = clone.innerHTML;
}

function setPrintPreviewOpen(open) {
    if (!salesState.dom.printPreviewModal) return;
    salesState.dom.printPreviewModal.style.display = open ? 'flex' : 'none';
    salesState.dom.printPreviewModal.classList.toggle('is-open', open);
    salesState.dom.printPreviewModal.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
}

async function loadPrintPreviewPrinters({ forceChoose = false } = {}) {
    const picker = document.getElementById('salesPrintPrinterPicker');
    const select = document.getElementById('salesPrintPrinterSelect');
    const status = document.getElementById('salesPrintPrinterStatus');
    const changeBtn = document.getElementById('salesPrintChangePrinterBtn');
    if (!picker || !select || !status || !changeBtn) return;

    const savedPrinterName = getSavedPrintPrinterName();
    let printers = [];
    try {
        if (window.electronAPI && typeof window.electronAPI.getPrinters === 'function') {
            printers = await window.electronAPI.getPrinters();
        }
    } catch (_) {
        printers = [];
    }

    const normalizedPrinters = Array.isArray(printers) ? printers : [];
    select.innerHTML = '';
    normalizedPrinters.forEach((printer) => {
        const printerName = printer.name || printer.displayName || '';
        if (!printerName) return;
        const option = document.createElement('option');
        option.value = printerName;
        option.textContent = printer.displayName || printerName;
        if (printer.isDefault) option.dataset.defaultPrinter = '1';
        select.appendChild(option);
    });

    const hasSavedPrinter = savedPrinterName && normalizedPrinters.some((printer) => (printer.name || printer.displayName || '') === savedPrinterName);
    if (savedPrinterName && !hasSavedPrinter && normalizedPrinters.length > 0) {
        clearSavedPrintPrinterName();
    }

    if (hasSavedPrinter && !forceChoose) {
        picker.style.display = 'none';
        changeBtn.style.display = '';
        const selectedPrinter = normalizedPrinters.find((printer) => (printer.name || printer.displayName || '') === savedPrinterName);
        status.textContent = `الطابعة الحالية: ${selectedPrinter?.displayName || savedPrinterName}`;
        return;
    }

    picker.style.display = normalizedPrinters.length > 0 ? 'grid' : 'none';
    changeBtn.style.display = 'none';
    status.textContent = normalizedPrinters.length > 0
        ? 'اختر الطابعة أول مرة، وسيتم استخدامها تلقائياً بعد ذلك.'
        : 'لم يتم العثور على طابعات. سيتم استخدام نافذة الطباعة العادية.';

    const defaultOption = Array.from(select.options).find((option) => option.dataset.defaultPrinter === '1');
    if (defaultOption) {
        select.value = defaultOption.value;
    }
}

async function openPrintPreview() {
    syncPrintPreviewContent();
    setPrintPreviewOpen(true);
    await loadPrintPreviewPrinters({ forceChoose: !getSavedPrintPrinterName() });
}

function closePrintPreview() {
    setPrintPreviewOpen(false);
}

async function changePrintPrinter() {
    clearSavedPrintPrinterName();
    await loadPrintPreviewPrinters({ forceChoose: true });
}

async function confirmPrintInvoice() {
    const printBtn = document.getElementById('salesPrintConfirmBtn');
    const select = document.getElementById('salesPrintPrinterSelect');
    const savedPrinterName = getSavedPrintPrinterName();
    const selectedPrinterName = savedPrinterName || select?.value || '';

    if (printBtn) {
        printBtn.disabled = true;
        printBtn.textContent = 'جاري الطباعة...';
    }

    try {
        if (window.electronAPI && typeof window.electronAPI.printCurrentWindow === 'function' && selectedPrinterName) {
            const result = await window.electronAPI.printCurrentWindow({
                silent: true,
                deviceName: selectedPrinterName
            });
            if (result && result.success) {
                savePrintPrinterName(selectedPrinterName);
                closePrintPreview();
                if (window.showToast) window.showToast('تم إرسال الفاتورة للطابعة', 'success');
                return;
            }
            if (window.showToast) window.showToast((result && result.error) || 'تعذر طباعة الفاتورة', 'error');
            return;
        }

        window.print();
        closePrintPreview();
    } finally {
        if (printBtn) {
            printBtn.disabled = false;
            printBtn.textContent = 'طباعة';
        }
    }
}

async function printInvoice() {
    // 1. Gather all data for printing from the DOM
    const customerSelect = salesState.dom.customerSelect;
    const customerName = customerSelect.options[customerSelect.selectedIndex]?.text || '';
    const selectedCustomerOption = customerSelect.options[customerSelect.selectedIndex];
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const invoiceDate = salesState.dom.invoiceDateInput.value || new Date().toLocaleDateString('ar-EG');
    const customerBalance = parseFloat(selectedCustomerOption?.dataset.balance || '0') || 0;

    const { items, isValid } = collectInvoiceItemsFromForm();
    if (!isValid || items.length === 0) {
        if (window.showToast) window.showToast('الرجاء إدخال أصناف صحيحة قبل الطباعة', 'error');
        return;
    }

    const financials = getInvoiceFinancials(parseFloat(salesState.dom.invoiceSubtotalSpan?.textContent || '0') || 0);

    // 2. Submit the invoice if not locked
    const wasEditing = !!salesState.editingInvoiceId;
    const locked = isEditLocked();
    
    if (!locked) {
        await submitInvoice();
        
        // Check if submit was successful by seeing if form reset
        if (customerSelect.value !== '') {
            // Form didn't reset, meaning save failed or validation failed. Stop printing.
            return;
        }
    }

    // 4. Populate Print Area
    document.getElementById('printInvoiceNumber').textContent = invoiceNumber || (wasEditing ? 'معدلة' : 'جديدة');
    document.getElementById('printInvoiceDate').textContent = invoiceDate;
    document.getElementById('printCustomerName').textContent = customerName;

    const printItemsTbody = document.getElementById('printInvoiceItems');
    printItemsTbody.innerHTML = '';
    items.forEach((item, index) => {
        const itemObj = salesState.allItems.find(i => i.id === item.item_id);
        const itemName = itemObj ? (itemObj.item_name || itemObj.name || '') : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${itemName}</td>
            <td>${item.quantity}</td>
            <td>${parseFloat(item.sale_price).toFixed(2)}</td>
            <td>${parseFloat(item.total_price).toFixed(2)}</td>
        `;
        printItemsTbody.appendChild(tr);
    });

    const netTotal = financials.netTotal;
    const paid = financials.paidAmount;
    const remaining = netTotal - paid;
    const previousBalance = wasEditing && locked ? customerBalance - remaining : customerBalance;
    const currentBalance = wasEditing && locked ? customerBalance : previousBalance + remaining;

    document.getElementById('printInvoiceTotal').textContent = netTotal.toFixed(2);
    document.getElementById('printInvoicePaid').textContent = paid.toFixed(2);
    document.getElementById('printInvoiceRemaining').textContent = remaining.toFixed(2);
    document.getElementById('printCustomerPreviousBalance').textContent = previousBalance.toFixed(2);
    document.getElementById('printCustomerCurrentBalance').textContent = currentBalance.toFixed(2);

    // Get settings for company info
    try {
        const settings = await window.electronAPI.getSettings();
        if (settings) {
            const companyPhone = settings.companyPhone || settings.company_phone || '';
            document.getElementById('printCompanyName').textContent = settings.companyName || settings.company_name || 'اسم الشركة';
            document.getElementById('printCompanyInfo').textContent = companyPhone ? `هاتف: ${companyPhone}` : '';
            document.getElementById('printFooterText').textContent = settings.invoiceFooter || settings.invoice_notes || 'شكراً لتعاملكم معنا';
        }
    } catch(e) {
        console.error('Error fetching settings for print', e);
    }

    await openPrintPreview();
}

async function submitInvoice() {
    if (isEditLocked()) {
        setEditLocked(false);
        if (window.showToast) window.showToast('تم تفعيل وضع التعديل. راجع البيانات ثم اضغط تحديث وحفظ الفاتورة.', 'success');
        return;
    }

    if (salesState.isSubmitting) return;
    salesState.isSubmitting = true;

    const saveBtn = document.querySelector('#invoiceForm .btn-success');
    if (saveBtn) {
        saveBtn.style.opacity = '0.6';
        saveBtn.style.cursor = 'not-allowed';
    }

    try {
        if (salesState.editingInvoiceId) {
            await updateInvoice();
        } else {
            await saveInvoice();
        }
    } finally {
        salesState.isSubmitting = false;
        if (saveBtn) {
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
        }
    }
}

async function loadCustomers() {
    const customers = await salesApi.getCustomers();
    if (!salesState.dom.customerSelect) return;

    salesState.dom.customerSelect.innerHTML = `<option value="">${t('sales.selectCustomer', 'اختر العميل')}</option>`;

    customers.forEach((customer) => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        option.dataset.balance = customer.balance || 0;
        salesState.dom.customerSelect.appendChild(option);
    });

    if (salesState.customerAutocomplete) {
        salesState.customerAutocomplete.refresh();
    } else {
        salesState.customerAutocomplete = new Autocomplete(salesState.dom.customerSelect);
    }

    bindCustomerAutocompleteClearHandler();
}

function bindCustomerAutocompleteClearHandler() {
    const customerInput = salesState.customerAutocomplete?.input;
    if (!customerInput || !salesState.dom.customerSelect) return;
    if (customerInput.dataset.clearSelectionBound === '1') return;

    customerInput.dataset.clearSelectionBound = '1';
    customerInput.addEventListener('input', () => {
        if (customerInput.value.trim() !== '') return;
        if (!salesState.dom.customerSelect.value) return;

        salesState.dom.customerSelect.value = '';
        salesState.dom.customerSelect.dispatchEvent(new Event('change'));
    });

    const reopenCustomerList = () => {
        if (!salesState.customerAutocomplete || customerInput.disabled) return;
        if (!salesState.dom.customerSelect.value) return;

        // Autocomplete has its own focus/click handlers; defer so full list wins.
        setTimeout(() => {
            if (!salesState.customerAutocomplete || customerInput.disabled) return;
            if (!salesState.dom.customerSelect.value) return;
            salesState.customerAutocomplete.renderList('');
        }, 70);
    };

    customerInput.addEventListener('focus', reopenCustomerList);
    customerInput.addEventListener('click', reopenCustomerList);
}

function getOrderedInvoicesForNavigation() {
    const invoices = Array.isArray(salesState.invoiceNavigationList) ? salesState.invoiceNavigationList : [];
    return invoices
        .slice()
        .sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
}

function findCurrentInvoiceIndexForNavigation(orderedInvoices) {
    if (!orderedInvoices.length) return -1;

    if (Number.isFinite(Number(salesState.editingInvoiceId))) {
        const activeId = Number(salesState.editingInvoiceId);
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
        const invoices = await salesApi.getSalesInvoices();
        salesState.invoiceNavigationList = Array.isArray(invoices) ? invoices : [];
        const datalist = document.getElementById('invoiceSuggestions');
        if (!datalist) {
            updateInvoiceNavigationButtons();
            return;
        }

        datalist.innerHTML = '';
        salesState.invoiceNavigationList.slice(0, 30).forEach((inv) => {
            if (!inv.invoice_number) return;
            const option = document.createElement('option');
            option.value = inv.invoice_number;
            datalist.appendChild(option);
        });
        updateInvoiceNavigationButtons();
    } catch (_) {
        salesState.invoiceNavigationList = [];
        updateInvoiceNavigationButtons();
    }
}

async function displayCustomerBalance() {
    const customerId = salesState.dom.customerSelect?.value;
    if (!customerId) return;

    const selectedOption = salesState.dom.customerSelect.options[salesState.dom.customerSelect.selectedIndex];
    const balance = parseFloat(selectedOption.dataset.balance || 0);

    const balanceDiv = document.getElementById('customerBalance');
    if (!balanceDiv) return;

    balanceDiv.className = 'customer-balance';
    if (balance > 0) {
        balanceDiv.classList.add('balance-positive');
        balanceDiv.textContent = fmt(t('sales.balanceCurrentOwes', 'الرصيد الحالي: لينا (مدين) {amount} جنيه'), { amount: balance.toLocaleString() });
    } else if (balance < 0) {
        balanceDiv.classList.add('balance-negative');
        balanceDiv.textContent = fmt(t('sales.balanceCurrentOwed', 'الرصيد الحالي: علينا (دائن) {amount} جنيه'), { amount: Math.abs(balance).toLocaleString() });
    } else {
        balanceDiv.classList.add('balance-zero');
        balanceDiv.textContent = t('sales.balanceCurrentSettled', 'الرصيد الحالي: متزن');
    }
    balanceDiv.style.display = 'inline-flex';
}

async function loadItems() {
    salesState.allItems = await salesApi.getItems();
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

    return salesState.allItems.find((item) => {
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

function clearSelectedItemAvailability() {
    if (!salesState.dom.selectedItemAvailability) return;
    salesState.dom.selectedItemAvailability.classList.remove('has-overage');
    salesState.dom.selectedItemAvailability.textContent = '';
}

function formatQty(value) {
    const qty = Number(value);
    if (!Number.isFinite(qty)) return '0';
    if (Number.isInteger(qty)) return String(qty);
    return qty.toFixed(3).replace(/\.?0+$/, '');
}

function getEffectiveBaseAvailable(itemId) {
    const match = Number.isFinite(itemId) ? salesState.allItems.find((i) => i.id === itemId) : null;
    const currentStock = Number(match?.stock_quantity) || 0;
    const originalInEditedInvoice = Number(salesState.originalInvoiceItemTotalsByItemId?.[itemId]) || 0;
    return currentStock + originalInEditedInvoice;
}

function getReservedQuantityInDraft(itemId, excludedRow = null) {
    if (!Number.isFinite(itemId) || !salesState.dom.invoiceItemsBody) return 0;

    let reserved = 0;
    salesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((candidateRow) => {
        if (excludedRow && candidateRow === excludedRow) return;

        const itemSelect = candidateRow.querySelector('.item-select');
        const candidateItemId = parseInt(itemSelect?.value, 10);
        if (!Number.isFinite(candidateItemId) || candidateItemId !== itemId) return;

        const quantityInput = candidateRow.querySelector('.quantity-input');
        const qty = parseLocaleFloat(quantityInput?.value);
        if (Number.isFinite(qty) && qty > 0) {
            reserved += qty;
        }
    });

    return reserved;
}

function updateSelectedItemAvailability(row) {
    if (!salesState.dom.selectedItemAvailability) return;
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
    const match = Number.isFinite(itemId) ? salesState.allItems.find((i) => i.id === itemId) : null;
    if (!match) {
        clearSelectedItemAvailability();
        return;
    }

    const baseAvailableQty = getEffectiveBaseAvailable(itemId);
    const reservedByOtherRows = getReservedQuantityInDraft(itemId, row);
    const availableQty = Math.max(baseAvailableQty - reservedByOtherRows, 0);
    const qtyInput = row.querySelector('.quantity-input');
    const enteredQtyRaw = qtyInput ? parseLocaleFloat(qtyInput.value) : 0;
    const enteredQty = Number.isFinite(enteredQtyRaw) && enteredQtyRaw > 0 ? enteredQtyRaw : 0;

    const badge = row.querySelector('.item-stock-badge');

    if (enteredQty > 0) {
        const remainingQty = Math.max(availableQty - enteredQty, 0);
        const overQty = Math.max(enteredQty - availableQty, 0);
        
        if (badge) {
            badge.className = overQty > 0 ? 'item-stock-badge warning' : 'item-stock-badge';
            badge.textContent = overQty > 0 ? `متبقي: ${formatQty(remainingQty)} | زائد: ${formatQty(overQty)}` : `متبقي: ${formatQty(remainingQty)}`;
        }

        if (overQty > 0) {
            if (salesState.dom.selectedItemAvailability) {
                salesState.dom.selectedItemAvailability.classList.add('has-overage');
                salesState.dom.selectedItemAvailability.innerHTML = `المتاح: ${formatQty(availableQty)} | المتبقي بعد الإدخال: ${formatQty(remainingQty)} | <span class="selected-item-overage">يوجد ${formatQty(overQty)} زيادة</span>`;
            }
            return;
        }

        if (salesState.dom.selectedItemAvailability) {
            salesState.dom.selectedItemAvailability.classList.remove('has-overage');
            salesState.dom.selectedItemAvailability.textContent = `المتاح: ${formatQty(availableQty)} | المتبقي بعد الإدخال: ${formatQty(remainingQty)}`;
        }
        return;
    }

    if (badge) {
        badge.className = 'item-stock-badge';
        badge.textContent = `الحالي: ${formatQty(availableQty)}`;
    }

    if (salesState.dom.selectedItemAvailability) {
        salesState.dom.selectedItemAvailability.classList.remove('has-overage');
        salesState.dom.selectedItemAvailability.textContent = `المتاح: ${formatQty(availableQty)}`;
    }
}

function addInvoiceRow(existingItem = null) {
    if (!existingItem && isEditLocked()) {
        if (window.showToast) window.showToast('اضغط على زر "تعديل الفاتورة" أولاً', 'warning');
        return;
    }

    if (!existingItem && !salesState.dom.customerSelect?.value) {
        if (window.showToast) window.showToast(t('sales.selectCustomerFirst', 'الرجاء اختيار العميل أولا'), 'warning');
        return;
    }

    const row = salesRender.createInvoiceRow({
        allItems: salesState.allItems,
        existingItem,
        t,
        fmt
    });

    salesState.dom.invoiceItemsBody.appendChild(row);

    const selectElement = row.querySelector('.item-select');
    const itemAutocomplete = new Autocomplete(selectElement);
    row.__itemAutocomplete = itemAutocomplete;
    bindItemBarcodeQuickSelect(itemAutocomplete, selectElement);
    const barcodeInput = row.querySelector('.barcode-input');
    if (barcodeInput) {
        barcodeInput.addEventListener('input', () => onBarcodeInput(barcodeInput));
    }
    selectElement.addEventListener('change', () => onItemSelect(selectElement));

    if (existingItem) {
        updateProfitIndicator(row);
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

    const fallbackRow = salesState.dom.invoiceItemsBody.querySelector('tr:last-child');
    if (fallbackRow) {
        updateSelectedItemAvailability(fallbackRow);
    } else {
        clearSelectedItemAvailability();
    }
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
    if (!salesState.dom.invoiceItemsBody) return;
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

    const rows = Array.from(salesState.dom.invoiceItemsBody.querySelectorAll('tr'));
    const currentIndex = rows.indexOf(row);
    if (currentIndex < 0) return;

    const direction = event.key === 'ArrowDown' ? 1 : -1;
    let nextIndex = currentIndex + direction;

    if (nextIndex < 0) return;

    if (nextIndex >= rows.length) {
        if (direction > 0 && row === salesState.dom.invoiceItemsBody.lastElementChild) {
            addInvoiceRow();
            const updatedRows = Array.from(salesState.dom.invoiceItemsBody.querySelectorAll('tr'));
            nextIndex = updatedRows.indexOf(row) + 1;
            if (nextIndex < updatedRows.length) {
                focusRowField(updatedRows[nextIndex], fieldKey);
            }
            return;
        }
    }

    if (nextIndex >= rows.length) return;

    focusRowField(rows[nextIndex], fieldKey);
}

function maybeAutoAddRow(row) {
    if (!row || !salesState.dom.invoiceItemsBody) return;
    if (row === salesState.dom.invoiceItemsBody.lastElementChild) {
        addInvoiceRow();
    }
}

function updateProfitIndicator(row) {
    const indicator = row.querySelector('.profit-indicator');
    if (!indicator) return;

    const select = row.querySelector('.item-select');
    const selectedOption = select.options[select.selectedIndex];
    const unitCostPrice = parseFloat(selectedOption?.dataset?.cost) || 0;
    const unitSalePrice = parseLocaleFloat(row.querySelector('.price-input').value) || 0;
    
    let qtyRaw = parseLocaleFloat(row.querySelector('.quantity-input').value);
    const qty = (Number.isFinite(qtyRaw) && qtyRaw > 0) ? qtyRaw : 1;

    const costPrice = unitCostPrice * qty;
    const salePrice = unitSalePrice * qty;

    if (!unitCostPrice || !unitSalePrice) {
        indicator.innerHTML = '';
        indicator.className = 'profit-indicator';
        return;
    }

    const diff = salePrice - costPrice;
    const percent = ((diff / costPrice) * 100).toFixed(1);
    const costLabel = t('sales.costPriceLabel', 'سعر الشراء') + ': ' + costPrice.toFixed(2);

    if (diff > 0) {
        indicator.className = 'profit-indicator profit-positive';
        indicator.innerHTML = '<i class="fas fa-arrow-up"></i> ' + costLabel + ' · ' + t('sales.profitLabel', 'ربح') + ': ' + diff.toFixed(2) + ' (' + percent + '%)';
        indicator.title = '';
    } else if (diff < 0) {
        indicator.className = 'profit-indicator profit-negative';
        indicator.innerHTML = '<i class="fas fa-arrow-down"></i> ' + costLabel + ' · ' + t('sales.lossLabel', 'خسارة') + ': ' + Math.abs(diff).toFixed(2) + ' (' + Math.abs(percent) + '%)';
        indicator.title = '';
    } else {
        indicator.className = 'profit-indicator profit-neutral';
        indicator.innerHTML = costLabel + ' · ' + t('sales.profitLabel', 'ربح') + ': 0.00 (0.0%)';
        indicator.title = '';
    }
}

function onItemSelect(select) {
    if (isEditLocked()) return;

    const row = select.closest('tr');
    const itemId = parseInt(select.value, 10);
    const match = Number.isFinite(itemId) ? salesState.allItems.find((i) => i.id === itemId) : null;
    const unitName = match && match.unit_name ? match.unit_name : '';
    const salePrice = match ? Number(match.sale_price || 0) : 0;

    const unitEl = row.querySelector('.unit-label');
    if (unitEl) unitEl.textContent = unitName;

    const barcodeInput = row.querySelector('.barcode-input');
    if (barcodeInput) {
        barcodeInput.value = match && match.barcode ? match.barcode : '';
    }

    row.querySelector('.price-input').value = Number.isFinite(salePrice) ? salePrice : 0;
    updateSelectedItemAvailability(row);
    calculateRowTotal(select);
    updateProfitIndicator(row);
    maybeAutoAddRow(row);

    // const qtyInput = row.querySelector('.quantity-input');
    // if (qtyInput) qtyInput.focus();
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
    const discountType = salesState.dom.discountTypeSelect?.value === 'percent' ? 'percent' : 'amount';

    const discountValueRaw = parseLocaleFloat(salesState.dom.discountValueInput?.value || '0');
    const discountValue = Number.isFinite(discountValueRaw) && discountValueRaw > 0 ? discountValueRaw : 0;

    let discountAmount = discountType === 'percent'
        ? safeSubtotal * (discountValue / 100)
        : discountValue;

    if (!Number.isFinite(discountAmount) || discountAmount < 0) discountAmount = 0;
    discountAmount = Math.min(discountAmount, safeSubtotal);

    const netTotal = Math.max(safeSubtotal - discountAmount, 0);

    const paidAmountRaw = parseLocaleFloat(salesState.dom.paidAmountInput?.value || '0');
    const paidAmount = Number.isFinite(paidAmountRaw) && paidAmountRaw > 0 ? paidAmountRaw : 0;
    const customerRemaining = netTotal - paidAmount;

    return {
        discountType,
        discountValue: roundMoney(discountValue),
        discountAmount: roundMoney(discountAmount),
        netTotal: roundMoney(netTotal),
        paidAmount: roundMoney(paidAmount),
        customerRemaining: roundMoney(customerRemaining)
    };
}

function calculateRowTotal(element) {
    const row = element.closest('tr');
    const quantity = parseLocaleFloat(row.querySelector('.quantity-input').value);
    const price = parseLocaleFloat(row.querySelector('.price-input').value);
    const total = (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(price) ? price : 0);

    row.querySelector('.row-total').textContent = total.toFixed(2);
    calculateInvoiceTotal();
    updateProfitIndicator(row);
}

function calculateInvoiceTotal() {
    let subtotal = 0;
    salesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((row) => {
        const rowTotal = parseFloat(row.querySelector('.row-total').textContent) || 0;
        subtotal += rowTotal;
    });

    const financials = getInvoiceFinancials(subtotal);

    if (salesState.dom.invoiceSubtotalSpan) {
        salesState.dom.invoiceSubtotalSpan.textContent = subtotal.toFixed(2);
    }

    if (salesState.dom.invoiceDiscountAmountSpan) {
        salesState.dom.invoiceDiscountAmountSpan.textContent = financials.discountAmount.toFixed(2);
    }

    salesState.dom.invoiceTotalSpan.textContent = financials.netTotal.toFixed(2);

    if (salesState.dom.invoicePaidDisplaySpan) {
        salesState.dom.invoicePaidDisplaySpan.textContent = financials.paidAmount.toFixed(2);
    }

    if (salesState.dom.invoiceRemainingSpan) {
        if (financials.customerRemaining > 0) {
            salesState.dom.invoiceRemainingSpan.textContent = fmt(t('sales.customerDuePositive', 'لينا (مدين) {amount}'), { amount: financials.customerRemaining.toFixed(2) });
            salesState.dom.invoiceRemainingSpan.className = 'customer-due-value due-positive';
        } else if (financials.customerRemaining < 0) {
            salesState.dom.invoiceRemainingSpan.textContent = fmt(t('sales.customerDueNegative', 'علينا (دائن) {amount}'), { amount: Math.abs(financials.customerRemaining).toFixed(2) });
            salesState.dom.invoiceRemainingSpan.className = 'customer-due-value due-negative';
        } else {
            salesState.dom.invoiceRemainingSpan.textContent = '0.00';
            salesState.dom.invoiceRemainingSpan.className = 'customer-due-value';
        }
    }
    
    updatePrintBtnState();
}

function updatePrintBtnState() {
    const printBtn = document.getElementById('printInvoiceBtn');
    if (!printBtn) return;
    
    const customer_id = salesState.dom.customerSelect?.value;
    const hasItems = salesState.dom.invoiceItemsBody?.querySelectorAll('tr').length > 0;
    
    if (customer_id && hasItems) {
        printBtn.disabled = false;
        printBtn.style.opacity = '1';
        printBtn.style.cursor = 'pointer';
    } else {
        printBtn.disabled = true;
        printBtn.style.opacity = '0.5';
        printBtn.style.cursor = 'not-allowed';
    }
}

function collectInvoiceItemsFromForm() {
    const items = [];
    let isValid = true;

    salesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((row) => {
        const item_id = parseInt(row.querySelector('.item-select').value, 10);
        const quantity = parseLocaleFloat(row.querySelector('.quantity-input').value);
        const sale_price = parseLocaleFloat(row.querySelector('.price-input').value);

        const quantityOk = Number.isFinite(quantity) && quantity > 0;
        const priceOk = Number.isFinite(sale_price) && sale_price >= 0;
        const itemOk = Number.isFinite(item_id) && item_id > 0;

        if (!itemOk && !quantityOk && (!priceOk || sale_price === 0)) {
            return;
        }

        if (!itemOk || !quantityOk || !priceOk) {
            isValid = false;
            return;
        }

        items.push({
            item_id,
            quantity,
            sale_price,
            total_price: quantity * sale_price
        });
    });

    return { items, isValid: isValid && items.length > 0 };
}

function getDraftOverQuantityViolations() {
    const totalsByItem = new Map();

    salesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((row) => {
        const itemId = parseInt(row.querySelector('.item-select')?.value, 10);
        const qty = parseLocaleFloat(row.querySelector('.quantity-input')?.value);

        if (!Number.isFinite(itemId) || !Number.isFinite(qty) || qty <= 0) return;
        totalsByItem.set(itemId, (totalsByItem.get(itemId) || 0) + qty);
    });

    const violations = [];
    totalsByItem.forEach((enteredQty, itemId) => {
        const match = salesState.allItems.find((i) => i.id === itemId);
        if (!match) return;

        const availableQty = Math.max(getEffectiveBaseAvailable(itemId), 0);
        if (enteredQty > availableQty) {
            violations.push({
                itemName: match.name || `#${itemId}`,
                enteredQty,
                availableQty,
                overQty: enteredQty - availableQty
            });
        }
    });

    return violations;
}

async function updateInvoice() {
    if (!salesState.editingInvoiceId) {
        if (window.showToast) window.showToast(t('sales.updateNoId', 'لا يمكن تحديث الفاتورة: رقم تعريف الفاتورة غير موجود'), 'error');
        return;
    }

    const customer_id = salesState.dom.customerSelect.value;
    const invoice_date = salesState.dom.invoiceDateInput.value || new Date().toISOString().slice(0, 10);
    const invoice_number = document.getElementById('invoiceNumber').value;
    const notes = document.getElementById('invoiceNotes').value;
    const payment_type = document.getElementById('paymentType').value;

    if (!customer_id) {
        if (window.showToast) window.showToast(t('sales.toast.selectCustomer', 'الرجاء اختيار العميل'), 'error');
        return;
    }

    const { items, isValid } = collectInvoiceItemsFromForm();
    if (!isValid || items.length === 0) {
        if (window.showToast) window.showToast(t('sales.itemsDataInvalid', 'الرجاء إدخال جميع بيانات الأصناف بشكل صحيح'), 'error');
        return;
    }

    const overQtyViolations = getDraftOverQuantityViolations();
    if (overQtyViolations.length > 0) {
        const topViolation = overQtyViolations[0];
        if (window.showToast) window.showToast(`لا يمكن حفظ الفاتورة: الصنف "${topViolation.itemName}" يوجد به ${formatQty(topViolation.overQty)} زيادة عن المتاح (${formatQty(topViolation.availableQty)}).`, 'error');
        return;
    }

    const financials = getInvoiceFinancials(parseFloat(salesState.dom.invoiceSubtotalSpan?.textContent || '0') || 0);

    const invoiceData = {
        id: salesState.editingInvoiceId,
        customer_id,
        invoice_number,
        invoice_date,
        payment_type,
        notes,
        items,
        discount_type: financials.discountType,
        discount_value: financials.discountValue,
        paid_amount: financials.paidAmount,
        total_amount: financials.netTotal
    };

    try {
        const result = await salesApi.updateInvoice(invoiceData);
        if (result.success) {
            showToast(t('sales.toast.updateSuccess', 'تم تحديث الفاتورة بنجاح'), 'success');
            await resetForm();
        } else {
            if (window.showToast) window.showToast(t('sales.toast.updateError', 'حدث خطأ أثناء التحديث') + ': ' + result.error, 'error');
        }
    } catch (error) {
        if (window.showToast) window.showToast(t('sales.toast.unexpectedError', 'حدث خطأ غير متوقع') + ': ' + error.message, 'error');
    }
}

async function saveInvoice() {
    const customer_id = salesState.dom.customerSelect.value;
    const invoice_date = salesState.dom.invoiceDateInput.value || new Date().toISOString().slice(0, 10);
    const invoice_number = document.getElementById('invoiceNumber').value;
    const notes = document.getElementById('invoiceNotes').value;
    const payment_type = document.getElementById('paymentType').value;

    if (!customer_id) {
        if (window.showToast) window.showToast(t('sales.toast.selectCustomer', 'الرجاء اختيار العميل'), 'error');
        return;
    }

    const { items, isValid } = collectInvoiceItemsFromForm();
    if (!isValid) {
        if (window.showToast) window.showToast(t('sales.itemsInvalid', 'الرجاء التأكد من إدخال الأصناف والكميات بشكل صحيح'), 'error');
        return;
    }

    const overQtyViolations = getDraftOverQuantityViolations();
    if (overQtyViolations.length > 0) {
        const topViolation = overQtyViolations[0];
        if (window.showToast) window.showToast(`لا يمكن حفظ الفاتورة: الصنف "${topViolation.itemName}" يوجد به ${formatQty(topViolation.overQty)} زيادة عن المتاح (${formatQty(topViolation.availableQty)}).`, 'error');
        return;
    }

    const financials = getInvoiceFinancials(parseFloat(salesState.dom.invoiceSubtotalSpan?.textContent || '0') || 0);

    const invoiceData = {
        customer_id,
        invoice_number,
        invoice_date,
        notes,
        items,
        payment_type,
        discount_type: financials.discountType,
        discount_value: financials.discountValue,
        paid_amount: financials.paidAmount,
        total_amount: financials.netTotal
    };

    const result = await salesApi.saveInvoice(invoiceData);
    if (result.success) {
        showToast(t('sales.toast.saveSuccess', 'تم حفظ الفاتورة بنجاح'), 'success');
        await resetForm();
    } else {
        showToast(t('sales.toast.saveError', 'حدث خطأ') + ': ' + result.error, 'error');
    }
}

async function resetForm() {
    salesState.dom.customerSelect.value = '';
    if (salesState.customerAutocomplete) {
        salesState.customerAutocomplete.refresh();
        salesState.customerAutocomplete.closeList();
    }

    const balanceDiv = document.getElementById('customerBalance');
    if (balanceDiv) balanceDiv.style.display = 'none';

    const invoiceNumberInput = document.getElementById('invoiceNumber');
    const notesInput = document.getElementById('invoiceNotes');
    const paymentTypeInput = document.getElementById('paymentType');

    if (invoiceNumberInput) invoiceNumberInput.value = '';
    if (notesInput) notesInput.value = '';
    if (paymentTypeInput) paymentTypeInput.value = 'credit';
    if (salesState.dom.discountTypeSelect) salesState.dom.discountTypeSelect.value = 'amount';
    if (salesState.dom.discountValueInput) salesState.dom.discountValueInput.value = '0';
    if (salesState.dom.paidAmountInput) salesState.dom.paidAmountInput.value = '0';

    salesState.dom.invoiceItemsBody.innerHTML = '';
    if (salesState.dom.invoiceSubtotalSpan) salesState.dom.invoiceSubtotalSpan.textContent = '0.00';
    if (salesState.dom.invoiceDiscountAmountSpan) salesState.dom.invoiceDiscountAmountSpan.textContent = '0.00';
    salesState.dom.invoiceTotalSpan.textContent = '0.00';
    if (salesState.dom.invoicePaidDisplaySpan) salesState.dom.invoicePaidDisplaySpan.textContent = '0.00';
    if (salesState.dom.invoiceRemainingSpan) {
        salesState.dom.invoiceRemainingSpan.textContent = '0.00';
        salesState.dom.invoiceRemainingSpan.className = 'customer-due-value';
    }
    clearSelectedItemAvailability();

    salesState.editingInvoiceId = null;
    salesState.isEditLocked = false;
    salesState.originalInvoiceItemTotalsByItemId = {};
    
    // Safety check: force reset any pending boolean states
    salesState.isSubmitting = false;

    salesRender.setCreateModeUI(t);
    setEditLocked(false);

    window.history.replaceState({}, document.title, window.location.pathname);
    await loadItems();
    await initializeNewInvoice();
    updatePrintBtnState();
}
