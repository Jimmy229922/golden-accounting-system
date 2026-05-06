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
function formatCurrency(v) {
    return parseFloat(v || 0).toFixed(2) + ' ' + CUR;
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

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    reportsRender.renderPage({ t, CUR });
    initializeElements();
    setDefaultDateRange();
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
    const salesReturnCount = safeReports.filter((r) => r.type === 'sales_return').length;
    const purchaseReturnCount = safeReports.filter((r) => r.type === 'purchase_return').length;
    const receiptCount = safeReports.filter((r) => r.type === 'receipt').length;
    const paymentCount = safeReports.filter((r) => r.type === 'payment').length;
    const totalAmount = safeReports.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

    document.getElementById('totalInvoices').textContent = safeReports.length;
    document.getElementById('salesCount').textContent = salesCount;
    document.getElementById('purchaseCount').textContent = purchaseCount;
    document.getElementById('salesReturnCount').textContent = salesReturnCount;
    document.getElementById('purchaseReturnCount').textContent = purchaseReturnCount;
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

    if (type === 'sales_return') {
        return {
            badge: `<span class="badge badge-sales-return"><i class="fas fa-undo"></i> ${t('reports.salesReturnType', 'مردودات مبيعات')}</span>`,
            amountClass: 'amount-sales-return',
            rowClass: 'row-sales-return'
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
        badge: `<span class="badge badge-purchase-return"><i class="fas fa-undo"></i> ${t('reports.purchaseReturnType', 'مردودات مشتريات')}</span>`,
        amountClass: 'amount-purchase-return',
        rowClass: 'row-purchase-return'
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
                <td colspan="7">
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
        const invoiceNumberValue = (report.type === 'receipt' || report.type === 'payment')
            ? (report.invoice_number || '-')
            : (report.invoice_number || report.id || '-');
        const invoiceCellHtml = window.renderDocNumberCell
            ? window.renderDocNumberCell(invoiceNumberValue, { numberTag: 'strong' })
            : `<strong>${escapeHtml(invoiceNumberValue || '-')}</strong>`;
        const safeCustomer = escapeHtml(report.customer_name || '-');

        row.className = typeMeta.rowClass;
        row.innerHTML = `
            <td class="index-col">${start + idx + 1}</td>
            <td class="date-col">${safeDate}</td>
            <td>${invoiceCellHtml}</td>
            <td>${typeMeta.badge}</td>
            <td class="name-col">${safeCustomer}</td>
            <td class="amount ${typeMeta.amountClass}">${formatCurrency(report.total_amount)}</td>
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
        else if (type === 'sales_return') page = '../sales-returns/index.html';
        else if (type === 'purchase_return') page = '../purchase-returns/index.html';
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
    } else if (type === 'sales_return') {
        result = await window.electronAPI.deleteSalesReturn(Number(id));
    } else if (type === 'purchase_return') {
        result = await window.electronAPI.deletePurchaseReturn(Number(id));
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
