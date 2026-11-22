let typeFilter;
let customerFilter;
let startDateInput;
let endDateInput;
let searchBtn;
let resetBtn;
let reportsTableBody;
let reportsStatusEl;
let heroResultCountEl;
let lastUpdatedLabelEl;
let voucherModalEl;
let voucherModalBodyEl;
let voucherModalTitleEl;
let voucherModalSubtitleEl;
let paginationBtnsEl;
let customerAutocomplete = null;
let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
const reportsRender = window.reportsPageRender;
let currentReports = [];
let allCustomers = [];
let currentPage = 1;
const PAGE_SIZE = 20;
const CUR = 'ج.م';
const PURCHASE_OPENING_BALANCE_KEY = 'reports_purchase_opening_balance';
const PURCHASE_OPENING_BALANCE_ITEMS_KEY = 'reports_purchase_opening_balance_items';
let purchaseOpeningBalanceValue = 0;
let purchaseOpeningBalanceItems = [];
let modalDraftItems = [];
let purchaseOpeningDisplayValue;
let purchaseOpeningDisplayCount;
let openPurchaseOpeningModalBtn;
let purchaseOpeningModalEl;
let purchaseOpeningModalCloseBtn;
let cancelOpeningBalanceModalBtn;
let saveOpeningBalanceModalBtn;
let purchaseOpeningItemForm;
let newOpeningItemAmount;
let newOpeningItemNote;
let purchaseOpeningTableBody;
let purchaseOpeningEmptyState;
let modalPurchaseOpeningTotal;
let modalPurchaseOpeningCount;
function formatCurrency(v) {
    const n = Number(v) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + CUR;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDateForUi(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleDateString('ar-EG');
}

function formatTimeForUi(value) {
    if (!value) return '';
    const dateStr = String(value).replace(' ', 'T') + 'Z';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDateTimeForUi(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleString('ar-EG');
}

function setStatus(message, type = 'info') {
    if (!reportsStatusEl) return;
    reportsStatusEl.textContent = message || '';
    reportsStatusEl.classList.remove('status-info', 'status-success', 'status-warning', 'status-error');

    if (!message) {
        reportsStatusEl.classList.add('status-hidden');
        return;
    }

    reportsStatusEl.classList.remove('status-hidden');
    reportsStatusEl.classList.add(`status-${type}`);
}

function setDefaultDateRange() {
    if (!startDateInput || !endDateInput) return;

    const now = new Date();
    const firstDayOfYear = `${now.getFullYear()}-01-01`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    startDateInput.value = firstDayOfYear;
    endDateInput.value = tomorrow.toISOString().split('T')[0];
}

function updateLastUpdatedLabel() {
    if (!lastUpdatedLabelEl) return;

    const now = new Date();
    lastUpdatedLabelEl.textContent = now.toLocaleString('ar-EG', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function parsePurchaseOpeningBalanceValue(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return 0;
    }

    return Number(numericValue.toFixed(2));
}

function updatePurchaseOpeningBalanceUI() {
    if (purchaseOpeningDisplayValue) {
        purchaseOpeningDisplayValue.textContent = formatCurrency(purchaseOpeningBalanceValue);
    }
    if (purchaseOpeningDisplayCount) {
        const count = Array.isArray(purchaseOpeningBalanceItems) ? purchaseOpeningBalanceItems.length : 0;
        purchaseOpeningDisplayCount.textContent = `(${count} بنود)`;
    }
}

async function loadPurchaseOpeningBalance() {
    if (!window.electronAPI || typeof window.electronAPI.getSettings !== 'function') {
        return;
    }

    try {
        const settings = await window.electronAPI.getSettings();
        const rawItems = settings?.[PURCHASE_OPENING_BALANCE_ITEMS_KEY];
        let loadedItems = [];
        if (rawItems) {
            try {
                const parsed = JSON.parse(rawItems);
                if (Array.isArray(parsed)) {
                    loadedItems = parsed;
                }
            } catch (_) {}
        }

        const legacyValue = parsePurchaseOpeningBalanceValue(settings?.[PURCHASE_OPENING_BALANCE_KEY]);

        if (loadedItems.length > 0) {
            purchaseOpeningBalanceItems = loadedItems;
            purchaseOpeningBalanceValue = purchaseOpeningBalanceItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
        } else if (legacyValue > 0) {
            purchaseOpeningBalanceValue = legacyValue;
            purchaseOpeningBalanceItems = [{
                id: 'item_' + Date.now(),
                amount: legacyValue,
                note: 'بداية المدة السابقة',
                date: new Date().toISOString().split('T')[0]
            }];
        } else {
            purchaseOpeningBalanceItems = [];
            purchaseOpeningBalanceValue = 0;
        }

        purchaseOpeningBalanceValue = Number(purchaseOpeningBalanceValue.toFixed(2));
    } catch (_) {
        purchaseOpeningBalanceItems = [];
        purchaseOpeningBalanceValue = 0;
    }

    updatePurchaseOpeningBalanceUI();
}

function renderModalDraftItems() {
    if (!purchaseOpeningTableBody) return;

    if (!modalDraftItems || !modalDraftItems.length) {
        purchaseOpeningTableBody.innerHTML = '';
        if (purchaseOpeningEmptyState) purchaseOpeningEmptyState.style.display = 'flex';
        if (modalPurchaseOpeningTotal) modalPurchaseOpeningTotal.textContent = formatCurrency(0);
        if (modalPurchaseOpeningCount) modalPurchaseOpeningCount.textContent = '0 بنود';
        return;
    }

    if (purchaseOpeningEmptyState) purchaseOpeningEmptyState.style.display = 'none';

    let total = 0;
    purchaseOpeningTableBody.innerHTML = modalDraftItems.map((item, idx) => {
        const amt = Number(item.amount) || 0;
        total += amt;
        return `
            <tr>
                <td style="color: var(--text-muted); font-weight: 700;">${idx + 1}</td>
                <td class="amount-cell">${formatCurrency(amt)}</td>
                <td>${escapeHtml(item.note || '-')}</td>
                <td style="text-align: center;">
                    <button type="button" class="btn-del-opening-item" data-index="${idx}" title="حذف هذا البند">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (modalPurchaseOpeningTotal) {
        modalPurchaseOpeningTotal.textContent = formatCurrency(total);
    }
    if (modalPurchaseOpeningCount) {
        modalPurchaseOpeningCount.textContent = `${modalDraftItems.length} بنود`;
    }
}

function openPurchaseOpeningModal() {
    modalDraftItems = JSON.parse(JSON.stringify(purchaseOpeningBalanceItems || []));
    renderModalDraftItems();
    if (newOpeningItemAmount) newOpeningItemAmount.value = '';
    if (newOpeningItemNote) newOpeningItemNote.value = '';
    if (purchaseOpeningModalEl) {
        purchaseOpeningModalEl.classList.add('is-open');
        purchaseOpeningModalEl.setAttribute('aria-hidden', 'false');
    }
    if (newOpeningItemAmount) {
        setTimeout(() => newOpeningItemAmount.focus(), 80);
    }
}

function closePurchaseOpeningModal() {
    if (purchaseOpeningModalEl) {
        purchaseOpeningModalEl.classList.remove('is-open');
        purchaseOpeningModalEl.setAttribute('aria-hidden', 'true');
    }
}

function formatMoneyInputValue(value) {
    const s = String(value || '').replace(/[٬،]/g, '.').replace(/,/g, '').replace(/[^0-9.]/g, '');
    if (!s) return '';
    const parts = s.split('.');
    const integerPart = (parts.shift() || '').replace(/[^0-9]/g, '');
    const decimalPart = parts.join('').replace(/[^0-9]/g, '');
    const formattedInteger = (integerPart ? Number(integerPart) : 0).toLocaleString('en-US');
    if (s.includes('.')) {
        return `${formattedInteger}.${decimalPart}`;
    }
    return formattedInteger;
}

function formatInputWithCursor(input) {
    if (!input) return;
    const val = input.value || '';
    const oldCursor = input.selectionStart ?? val.length;

    let digitCount = 0;
    for (let i = 0; i < oldCursor && i < val.length; i++) {
        if (/[0-9.]/.test(val[i])) digitCount++;
    }

    const formatted = formatMoneyInputValue(val);
    input.value = formatted;

    let newCursor = formatted.length;
    let currentDigits = 0;
    for (let i = 0; i < formatted.length; i++) {
        if (/[0-9.]/.test(formatted[i])) {
            currentDigits++;
        }
        if (currentDigits === digitCount) {
            newCursor = i + 1;
            break;
        }
    }

    try {
        input.setSelectionRange(newCursor, newCursor);
    } catch (_) {}
}

function handleAddOpeningItem(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!newOpeningItemAmount || !newOpeningItemNote) return;

    const amount = Number(String(newOpeningItemAmount.value).replace(/,/g, ''));
    const note = String(newOpeningItemNote.value || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
        if (window.showToast) window.showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر.', 'warning');
        newOpeningItemAmount.focus();
        return;
    }

    if (!note) {
        if (window.showToast) window.showToast('يرجى إدخال ملاحظة أو بيان لهذا المبلغ.', 'warning');
        newOpeningItemNote.focus();
        return;
    }

    modalDraftItems.push({
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        amount: Number(amount.toFixed(2)),
        note: note,
        date: new Date().toISOString().split('T')[0]
    });

    renderModalDraftItems();
    newOpeningItemAmount.value = '';
    newOpeningItemNote.value = '';
    newOpeningItemAmount.focus();
}

function handleDeleteOpeningItem(index) {
    const idx = Number(index);
    if (!Number.isFinite(idx) || idx < 0 || idx >= modalDraftItems.length) return;
    modalDraftItems.splice(idx, 1);
    renderModalDraftItems();
}

async function savePurchaseOpeningBalanceFromModal() {
    if (!window.electronAPI || typeof window.electronAPI.saveSettings !== 'function') {
        return;
    }

    const calculatedTotal = modalDraftItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
    const totalToSave = Number(calculatedTotal.toFixed(2));

    if (saveOpeningBalanceModalBtn) {
        saveOpeningBalanceModalBtn.disabled = true;
    }

    try {
        const result = await window.electronAPI.saveSettings({
            [PURCHASE_OPENING_BALANCE_KEY]: String(totalToSave),
            [PURCHASE_OPENING_BALANCE_ITEMS_KEY]: JSON.stringify(modalDraftItems)
        });

        if (!result || !result.success) {
            const errorMessage = (result && result.error) || 'تعذر حفظ بنود بداية مدة المشتريات.';
            setStatus(errorMessage, 'error');
            if (window.showToast) window.showToast(errorMessage, 'error');
            return;
        }

        purchaseOpeningBalanceItems = JSON.parse(JSON.stringify(modalDraftItems));
        purchaseOpeningBalanceValue = totalToSave;

        updatePurchaseOpeningBalanceUI();
        updateSummary(currentReports);
        closePurchaseOpeningModal();

        setStatus('تم حفظ بنود بداية مدة المشتريات بنجاح.', 'success');
        if (window.showToast) window.showToast('تم حفظ بنود بداية مدة المشتريات بنجاح.', 'success');
    } catch (error) {
        const errorMessage = error.message || 'تعذر حفظ بنود بداية مدة المشتريات.';
        setStatus(errorMessage, 'error');
        if (window.showToast) window.showToast(errorMessage, 'error');
    } finally {
        if (saveOpeningBalanceModalBtn) {
            saveOpeningBalanceModalBtn.disabled = false;
        }
    }
}

function shouldApplyPurchaseOpeningBalance() {
    const selectedType = String(typeFilter?.value || 'all');
    const selectedCustomer = String(customerFilter?.value || '').trim();
    const startDate = String(startDateInput?.value || '').trim();

    if (selectedCustomer) {
        return false;
    }

    if (selectedType !== 'all' && selectedType !== 'purchase') {
        return false;
    }

    return /^\d{4}-01-01$/.test(startDate);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    reportsRender.renderPage({ t, CUR });
    initializeElements();
    setDefaultDateRange();
    await loadPurchaseOpeningBalance();
    await loadCustomers();
    await loadReports();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function initializeElements() {
    typeFilter = document.getElementById('typeFilter');
    customerFilter = document.getElementById('customerFilter');
    startDateInput = document.getElementById('startDate');
    endDateInput = document.getElementById('endDate');
    searchBtn = document.getElementById('searchBtn');
    resetBtn = document.getElementById('resetBtn');
    reportsTableBody = document.getElementById('reportsTableBody');
    reportsStatusEl = document.getElementById('reportsStatus');
    heroResultCountEl = document.getElementById('heroResultCount');
    lastUpdatedLabelEl = document.getElementById('lastUpdatedLabel');
    purchaseOpeningDisplayValue = document.getElementById('purchaseOpeningDisplayValue');
    purchaseOpeningDisplayCount = document.getElementById('purchaseOpeningDisplayCount');
    openPurchaseOpeningModalBtn = document.getElementById('openPurchaseOpeningModalBtn');
    purchaseOpeningModalEl = document.getElementById('purchaseOpeningModal');
    purchaseOpeningModalCloseBtn = document.getElementById('purchaseOpeningModalCloseBtn');
    cancelOpeningBalanceModalBtn = document.getElementById('cancelOpeningBalanceModalBtn');
    saveOpeningBalanceModalBtn = document.getElementById('saveOpeningBalanceModalBtn');
    purchaseOpeningItemForm = document.getElementById('purchaseOpeningItemForm');
    newOpeningItemAmount = document.getElementById('newOpeningItemAmount');
    newOpeningItemNote = document.getElementById('newOpeningItemNote');
    purchaseOpeningTableBody = document.getElementById('purchaseOpeningTableBody');
    purchaseOpeningEmptyState = document.getElementById('purchaseOpeningEmptyState');
    modalPurchaseOpeningTotal = document.getElementById('modalPurchaseOpeningTotal');
    modalPurchaseOpeningCount = document.getElementById('modalPurchaseOpeningCount');

    if (newOpeningItemAmount) {
        newOpeningItemAmount.addEventListener('input', (e) => formatInputWithCursor(e.target));
        newOpeningItemAmount.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                const input = e.target;
                const start = input.selectionStart;
                const end = input.selectionEnd;
                if (start === end && start > 0 && input.value[start - 1] === ',') {
                    e.preventDefault();
                    const val = input.value;
                    input.value = val.slice(0, start - 2) + val.slice(start);
                    input.setSelectionRange(start - 2, start - 2);
                    input.dispatchEvent(new Event('input'));
                }
            }
        });
    }

    voucherModalEl = document.getElementById('voucherModal');
    voucherModalBodyEl = document.getElementById('voucherModalBody');
    voucherModalTitleEl = document.getElementById('voucherModalTitle');
    voucherModalSubtitleEl = document.getElementById('voucherModalSubtitle');
    paginationBtnsEl = document.getElementById('paginationBtns');

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentPage = 1;
            loadReports();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (typeFilter) typeFilter.value = 'all';
            if (customerFilter) customerFilter.value = '';
            setDefaultDateRange();
            currentPage = 1;
            loadReports();
        });
    }

    if (openPurchaseOpeningModalBtn) {
        openPurchaseOpeningModalBtn.addEventListener('click', openPurchaseOpeningModal);
    }
    if (purchaseOpeningModalCloseBtn) {
        purchaseOpeningModalCloseBtn.addEventListener('click', closePurchaseOpeningModal);
    }
    if (cancelOpeningBalanceModalBtn) {
        cancelOpeningBalanceModalBtn.addEventListener('click', closePurchaseOpeningModal);
    }
    if (purchaseOpeningItemForm) {
        purchaseOpeningItemForm.addEventListener('submit', handleAddOpeningItem);
    }
    if (purchaseOpeningTableBody) {
        purchaseOpeningTableBody.addEventListener('click', (e) => {
            const delBtn = e.target.closest('.btn-del-opening-item');
            if (delBtn && delBtn.dataset.index !== undefined) {
                handleDeleteOpeningItem(delBtn.dataset.index);
            }
        });
    }
    if (saveOpeningBalanceModalBtn) {
        saveOpeningBalanceModalBtn.addEventListener('click', savePurchaseOpeningBalanceFromModal);
    }
    if (purchaseOpeningModalEl) {
        purchaseOpeningModalEl.addEventListener('click', (e) => {
            if (e.target === purchaseOpeningModalEl) {
                closePurchaseOpeningModal();
            }
        });
    }

    if (reportsTableBody) {
        reportsTableBody.addEventListener('click', handleTableAction);
    }

    if (paginationBtnsEl) {
        paginationBtnsEl.addEventListener('click', (event) => {
            const btn = event.target.closest('button[data-page]');
            if (!btn || btn.disabled) return;

            const page = Number.parseInt(btn.dataset.page, 10);
            if (!Number.isFinite(page) || page < 1) return;

            currentPage = page;
            renderReports(currentReports);
        });
    }

    const closeBtn = document.getElementById('voucherModalCloseBtn');
    const closeBtnFooter = document.getElementById('voucherModalCloseBtnFooter');
    const printBtn = document.getElementById('voucherModalPrintBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeVoucherModal);
    if (closeBtnFooter) closeBtnFooter.addEventListener('click', closeVoucherModal);
    if (printBtn) printBtn.addEventListener('click', printVoucherFromModal);

    if (voucherModalEl) {
        voucherModalEl.addEventListener('click', (event) => {
            if (event.target === voucherModalEl) {
                closeVoucherModal();
            }
        });
    }

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && voucherModalEl?.classList.contains('is-open')) {
            closeVoucherModal();
        }
    });
}

async function loadCustomers() {
    try {
        const customers = await window.electronAPI.getCustomers();
        allCustomers = Array.isArray(customers) ? customers : [];
        customerFilter.innerHTML = `<option value="">${t('reports.allCustomers', 'الكل')}</option>`;

        allCustomers.forEach((customer) => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            customerFilter.appendChild(option);
        });

        if (customerAutocomplete) {
            customerAutocomplete.refresh();
        } else if (typeof Autocomplete !== 'undefined') {
            customerAutocomplete = new Autocomplete(customerFilter);
        }
    } catch (error) {
        console.error(error);
        setStatus(t('reports.customerLoadError', 'تعذر تحميل قائمة العملاء والموردين.'), 'warning');
    }
}

function updateSummary(reports) {
    const safeReports = Array.isArray(reports) ? reports : [];
    const salesCount = safeReports.filter((r) => r.type === 'sales').length;
    const purchaseCount = safeReports.filter((r) => r.type === 'purchase').length;
    const receiptCount = safeReports.filter((r) => r.type === 'receipt').length;
    const paymentCount = safeReports.filter((r) => r.type === 'payment').length;
    const totalAmount = safeReports.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    const purchaseInvoicesAmount = safeReports
        .filter((r) => r.type === 'purchase')
        .reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    const effectivePurchaseOpeningBalance = shouldApplyPurchaseOpeningBalance() ? purchaseOpeningBalanceValue : 0;
    const purchaseTotalAmount = purchaseInvoicesAmount + effectivePurchaseOpeningBalance;

    document.getElementById('totalInvoices').textContent = safeReports.length;
    document.getElementById('salesCount').textContent = salesCount;
    document.getElementById('purchaseCount').textContent = purchaseCount;
    document.getElementById('purchaseOpeningBalanceAmount').textContent = formatCurrency(purchaseOpeningBalanceValue);
    document.getElementById('purchaseTotalAmount').textContent = formatCurrency(purchaseTotalAmount);
    document.getElementById('receiptCount').textContent = receiptCount;
    document.getElementById('paymentCount').textContent = paymentCount;
    document.getElementById('totalAmount').textContent = formatCurrency(totalAmount);

    if (heroResultCountEl) {
        heroResultCountEl.textContent = String(safeReports.length);
    }
}

function getTypeMeta(type) {
    if (type === 'sales') {
        return {
            badge: `<span class="badge badge-sales"><i class="fas fa-arrow-up"></i> ${t('reports.salesType', 'مبيعات')}</span>`,
            amountClass: 'amount-sales',
            rowClass: 'row-sales'
        };
    }

    if (type === 'purchase') {
        return {
            badge: `<span class="badge badge-purchase"><i class="fas fa-arrow-down"></i> ${t('reports.purchaseType', 'مشتريات')}</span>`,
            amountClass: 'amount-purchase',
            rowClass: 'row-purchase'
        };
    }

    if (type === 'receipt') {
        return {
            badge: `<span class="badge badge-receipt"><i class="fas fa-hand-holding-usd"></i> ${t('reports.receiptType', 'سندات تحصيل')}</span>`,
            amountClass: 'amount-receipt',
            rowClass: 'row-receipt'
        };
    }

    if (type === 'payment') {
        return {
            badge: `<span class="badge badge-payment"><i class="fas fa-money-bill-wave"></i> ${t('reports.paymentType', 'سندات سداد')}</span>`,
            amountClass: 'amount-payment',
            rowClass: 'row-payment'
        };
    }

    return {
        badge: `<span class="badge"><i class="fas fa-file"></i> ${escapeHtml(type || '-')}</span>`,
        amountClass: '',
        rowClass: ''
    };
}

async function loadReports() {
    const filters = {
        type: typeFilter.value,
        customerId: customerFilter.value,
        startDate: startDateInput.value,
        endDate: endDateInput.value
    };

    setStatus(t('reports.loading', 'جارٍ تحميل البيانات...'), 'info');
    if (searchBtn) searchBtn.disabled = true;

    try {
        const reports = await window.electronAPI.getAllReports(filters);

        if (reports && reports.error) {
            console.error('Backend SQL Error:', reports.error, '\nStack:', reports.stack);
            setStatus('خطأ في قاعدة البيانات: ' + reports.error, 'error');
            reportsTableBody.innerHTML = `<tr><td colspan="9" style="color:red; text-align:center;">${reports.error}</td></tr>`;
            return;
        }

        currentReports = Array.isArray(reports) ? reports : [];
        updateSummary(currentReports);
        renderReports(currentReports);

        if (currentReports.length === 0) {
            setStatus(t('reports.noDataHint', 'لا توجد فواتير مطابقة لمعايير البحث الحالية.'), 'warning');
        } else {
            setStatus(fmt(t('reports.resultCount', '{count} فاتورة'), { count: currentReports.length }), 'success');
        }

        updateLastUpdatedLabel();
    } catch (error) {
        console.error(error);
        setStatus(t('reports.loadError', 'حدث خطأ أثناء تحميل البيانات'), 'error');
        if (window.showToast) {
            window.showToast(t('reports.loadError', 'حدث خطأ أثناء تحميل البيانات'), 'error');
        }
    } finally {
        if (searchBtn) searchBtn.disabled = false;
    }
}

function renderReports(reports) {
    reportsTableBody.innerHTML = '';
    const resultCountEl = document.getElementById('resultCount');

    if (!Array.isArray(reports) || reports.length === 0) {
        reportsTableBody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>${t('reports.noDataTitle', 'لا توجد فواتير')}</h3>
                        <p>${t('reports.noDataDesc', 'لم يتم العثور على فواتير مطابقة لمعايير البحث')}</p>
                    </div>
                </td>
            </tr>`;

        resultCountEl.textContent = '';
        document.getElementById('paginationBar').style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(reports.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = reports.slice(start, end);

    resultCountEl.textContent = fmt(t('reports.resultCount', '{count} فاتورة'), { count: reports.length });

    pageData.forEach((report, idx) => {
        const row = document.createElement('tr');
        const typeMeta = getTypeMeta(report.type);
        const safeDate = formatDateForUi(report.invoice_date);
        const safeTime = report.created_at ? formatTimeForUi(report.created_at) : '';
        const dateHtml = safeTime
            ? `<div>${safeDate}</div><div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;"><i class="fas fa-clock"></i> ${safeTime}</div>`
            : `<div>${safeDate}</div>`;
        const invoiceNumberValue = (report.type === 'receipt' || report.type === 'payment')
            ? (report.invoice_number || '-')
            : (report.invoice_number || report.id || '-');
        const invoiceCellHtml = window.renderDocNumberCell
            ? window.renderDocNumberCell(invoiceNumberValue, { numberTag: 'strong' })
            : `<strong>${escapeHtml(invoiceNumberValue || '-')}</strong>`;
        const safeCustomer = escapeHtml(report.customer_name || '-');

        const paidAmountVal = (report.type === 'receipt' || report.type === 'payment')
            ? formatCurrency(report.paid_amount)
            : formatCurrency(report.paid_amount || 0);
        const remainingAmountVal = (report.type === 'receipt' || report.type === 'payment')
            ? '—'
            : formatCurrency(report.remaining_amount || 0);

        row.className = typeMeta.rowClass;
        row.innerHTML = `
            <td class="index-col">${start + idx + 1}</td>
            <td class="date-col">${dateHtml}</td>
            <td>${invoiceCellHtml}</td>
            <td>${typeMeta.badge}</td>
            <td class="name-col">${safeCustomer}</td>
            <td class="amount ${typeMeta.amountClass}">${formatCurrency(report.total_amount)}</td>
            <td class="amount">${paidAmountVal}</td>
            <td class="amount">${remainingAmountVal}</td>
            <td>
                <div class="row-actions">
                    ${report.type === 'receipt' || report.type === 'payment' ? `
                    <button type="button" class="btn-sm btn-edit" data-action="view" data-id="${report.id}" data-type="${report.type}">
                        <i class="fas fa-eye"></i> ${t('reports.viewBtn', 'عرض')}
                    </button>
                    ` : ''}
                    <button type="button" class="btn-sm btn-edit" data-action="edit" data-id="${report.id}" data-type="${report.type}">
                        <i class="fas fa-edit"></i> ${t('reports.editBtn', 'تعديل')}
                    </button>
                    <button type="button" class="btn-sm btn-delete" data-action="delete" data-id="${report.id}" data-type="${report.type}">
                        <i class="fas fa-trash"></i> ${t('reports.deleteBtn', 'حذف')}
                    </button>
                </div>
            </td>
        `;

        reportsTableBody.appendChild(row);
    });

    renderPagination(reports.length, totalPages);
}

function renderPagination(total, totalPages) {
    const paginationBar = document.getElementById('paginationBar');
    const paginationInfo = document.getElementById('paginationInfo');

    if (totalPages <= 1) {
        paginationBar.style.display = 'none';
        return;
    }

    paginationBar.style.display = 'flex';
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);
    paginationInfo.textContent = fmt(t('reports.paginationInfo', 'عرض {start} - {end} من {total}'), {
        start,
        end,
        total
    });

    let btnsHTML = `<button type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i += 1) {
        btnsHTML += `<button type="button" class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    btnsHTML += `<button type="button" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    paginationBtnsEl.innerHTML = btnsHTML;
}

function handleTableAction(event) {
    const actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;

    const id = actionBtn.getAttribute('data-id');
    const type = actionBtn.getAttribute('data-type');
    const action = actionBtn.getAttribute('data-action');

    if (action === 'view') {
        openVoucherModal(id, type);
        return;
    }

    if (action === 'edit') {
        let page;
        if (type === 'sales') page = '../sales/index.html';
        else if (type === 'purchase') page = '../purchases/index.html';
        else if (type === 'receipt') page = '../payments/receipt.html';
        else if (type === 'payment') page = '../payments/payment.html';

        if (page) {
            const target = `${page}?editId=${id}`;
            if (!window.__navigateWithinShell || !window.__navigateWithinShell(target)) {
                window.location.href = target;
            }
        }
        return;
    }

    if (action === 'delete') {
        deleteInvoice(id, type);
    }
}

async function deleteInvoice(id, type) {
    const isTreasury = type === 'receipt' || type === 'payment';
    const msg = isTreasury 
        ? t('reports.deleteTreasuryConfirm', 'هل أنت متأكد من حذف هذا السند؟ سيتم عكس جميع التأثيرات المالية.')
        : t('reports.deleteConfirm', 'هل أنت متأكد من حذف هذه الفاتورة؟ سيتم عكس جميع التأثيرات المالية والمخزنية.');
    
    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(msg)
        : false;
    if (!confirmed) return;

    let result;
    if (isTreasury) {
        result = await window.electronAPI.deleteTreasuryTransaction(Number(id));
    } else {
        result = await window.electronAPI.deleteInvoice(Number(id), type);
    }
    
    if (result && result.success) {
        if (window.showToast) {
            window.showToast(isTreasury ? t('reports.deleteTreasurySuccess', 'تم حذف السند بنجاح') : t('reports.deleteSuccess', 'تم حذف الفاتورة بنجاح'), 'success');
        }
        currentPage = 1;
        loadReports();
    } else {
        const errorMessage = fmt(t('reports.deleteError', 'حدث خطأ أثناء الحذف: {error}'), { error: (result && result.error) || 'Unknown error' });
        if (window.showToast) {
            window.showToast(errorMessage, 'error');
        }
        setStatus(errorMessage, 'error');
    }
}
