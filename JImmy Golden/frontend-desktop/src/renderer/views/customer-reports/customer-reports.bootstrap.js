let customerSelect;
let reportContainer;
let totalSalesEl;
let totalPurchasesEl;
let totalReceiptsEl;
let totalPaymentsOutEl;
let totalSalesReturnsEl;
let totalPurchaseReturnsEl;
let customerReportTableBody;
let balanceFooterEl;
let totalClosingBalanceEl;
let closingBalanceBadgeEl;
let closingBalanceCardEl;
let customerReportPaginationEl;
let customerAutocomplete = null;
let ar = {};
const statementState = {
    page: 1,
    pageSize: 50,
    totalPages: 1,
    transactions: [],
    totals: {}
};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
const customerReportsRender = window.customerReportsPageRender;
const CUR = 'ج.م';

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

function getVisibleStatementEffect(item) {
    if (!item) return 0;
    if (item.type === 'sales') {
        return (Number(item.total_amount) - Number(item.paid_amount)) || 0;
    }
    if (item.type === 'local_sale') {
        return Number(item.total_amount) || 0;
    }
    if (item.type === 'purchase') {
        return -((Number(item.total_amount) - Number(item.paid_amount)) || 0);
    }
    if (item.type === 'payment_in') {
        return -(Number(item.paid_amount) || 0);
    }
    if (item.type === 'payment_out') {
        return Number(item.paid_amount) || 0;
    }
    return 0;
}

function buildVisibleStatementData(transactions, totals) {
    const safeTotals = totals || {};
    const visibleTransactions = (Array.isArray(transactions) ? transactions : [])
        .map((item) => ({ ...item }));

    // The backend now provides 100% accurate totals and running balances from the party_ledger.
    // There is no need to recalculate them on the frontend.
    return { transactions: visibleTransactions, totals: safeTotals };
}

function buildTopNavHTML() {
    return '';
}

function notifyCustomerReports(message, type = 'info') {
    if (!message) return;

    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }

    if (window.toast && typeof window.toast[type] === 'function') {
        window.toast[type](message);
        return;
    }

    if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
        Toast.show(message, type);
        return;
    }

    if (type === 'error') {
        console.error('[customer-reports]', message);
        return;
    }

    console.log('[customer-reports]', message);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    customerReportsRender.renderPage({ t, getNavHTML: buildTopNavHTML });
    initializeElements();
    loadCustomers();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function initializeElements() {
    customerSelect = document.getElementById('customerSelect');
    reportContainer = document.getElementById('reportContainer');
    totalSalesEl = document.getElementById('totalSales');
    totalPurchasesEl = document.getElementById('totalPurchases');
    totalReceiptsEl = document.getElementById('totalReceipts');
    totalPaymentsOutEl = document.getElementById('totalPaymentsOut');
    totalSalesReturnsEl = document.getElementById('totalSalesReturns');
    totalPurchaseReturnsEl = document.getElementById('totalPurchaseReturns');
    customerReportTableBody = document.getElementById('customerReportTableBody');
    balanceFooterEl = document.getElementById('balanceFooter');
    totalClosingBalanceEl = document.getElementById('totalClosingBalance');
    closingBalanceBadgeEl = document.getElementById('closingBalanceBadge');
    closingBalanceCardEl = document.getElementById('closingBalanceCard');
    customerReportPaginationEl = document.getElementById('customerReportPagination');

    window.financialPagination?.bind(customerReportPaginationEl, {
        onPageChange: (page) => {
            statementState.page = page;
            renderStatementTable();
            renderStatementPagination();
        },
        onPageSizeChange: (pageSize) => {
            statementState.pageSize = pageSize;
            statementState.page = 1;
            statementState.totalPages = Math.max(1, Math.ceil(statementState.transactions.length / statementState.pageSize));
            renderStatementTable();
            renderStatementPagination();
        }
    });

    const now = new Date();
    const yearStart = `${now.getFullYear()}-01-01`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    document.getElementById('dateFrom').value = yearStart;
    document.getElementById('dateTo').value = tomorrowStr;

    const triggerLoad = () => {
        const customerId = customerSelect.value;
        if (customerId) {
            document.getElementById('emptyState').style.display = 'none';
            reportContainer.style.display = 'block';
            loadCustomerReport(customerId);
        } else {
            reportContainer.style.display = 'none';
            document.getElementById('emptyState').style.display = '';
        }
    };

    document.getElementById('showReportBtn').addEventListener('click', triggerLoad);

    customerSelect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            triggerLoad();
        }
    });

    ['dateFrom', 'dateTo'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    triggerLoad();
                }
            });
        }
    });

    reportContainer.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        if (action === 'save-pdf') {
            showPdfModal();
            return;
        }

        if (action === 'toggle-items') {
            toggleItems(actionEl.dataset.rowId, actionEl, actionEl.dataset.type, Number.parseInt(actionEl.dataset.id, 10));
        }
    });
}

async function loadCustomers() {
    const customers = await window.electronAPI.getCustomers();
    customerSelect.innerHTML = `<option value="">${t('customerReports.selectCustomerPlaceholder', 'اختر العميل...')}</option>`;

    const grouped = { customer: [], supplier: [], both: [] };
    customers.forEach((c) => {
        const key = (c.type === 'supplier') ? 'supplier' : (c.type === 'both') ? 'both' : 'customer';
        grouped[key].push(c);
    });

    const sections = [
        { key: 'customer', label: 'العملاء' },
        { key: 'supplier', label: 'الموردين' },
        { key: 'both', label: 'عميل ومورد' }
    ];

    sections.forEach((sec) => {
        if (grouped[sec.key].length === 0) return;
        const optgroup = document.createElement('optgroup');
        optgroup.label = sec.label;
        grouped[sec.key].forEach((customer) => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            optgroup.appendChild(option);
        });
        customerSelect.appendChild(optgroup);
    });

    if (customerAutocomplete) {
        customerAutocomplete.refresh();
    } else {
        customerAutocomplete = new Autocomplete(customerSelect);
        if (customerAutocomplete.input) {
            customerAutocomplete.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (customerAutocomplete.selectedIndex === -1 && customerAutocomplete.list && customerAutocomplete.list.classList.contains('visible')) {
                        const firstItem = customerAutocomplete.list.querySelector('.autocomplete-item');
                        if (firstItem) {
                            firstItem.click();
                        }
                    }
                    setTimeout(() => {
                        document.getElementById('showReportBtn').click();
                    }, 50);
                }
            });
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('customerId');
    if (customerId) {
        customerSelect.value = customerId;
        if (customerAutocomplete) customerAutocomplete.refresh();
        if (customerSelect.value === customerId) {
            document.getElementById('showReportBtn').click();
        }
    }
}

async function loadCustomerReport(customerId) {
    const startDate = document.getElementById('dateFrom').value || undefined;
    const endDate = document.getElementById('dateTo').value || undefined;

    const result = await window.electronAPI.getCustomerDetailedStatement({ customerId, startDate, endDate });

    if (!result || !result.success) {
        statementState.transactions = [];
        statementState.totals = {};
        statementState.page = 1;
        statementState.totalPages = 1;
        renderStatementPagination();
        if (totalClosingBalanceEl) totalClosingBalanceEl.textContent = '0.00 ' + CUR;
        if (closingBalanceBadgeEl) closingBalanceBadgeEl.style.display = 'none';
        if (closingBalanceCardEl) closingBalanceCardEl.className = 'summary-card card-closing-balance';
        customerReportTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="8">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${(result && result.error) || t('customerReports.unexpectedError', 'حدث خطأ غير متوقع')}
                </td>
            </tr>`;
        return;
    }

    const visibleStatement = buildVisibleStatementData(result.transactions, result.totals);
    const { transactions, totals } = visibleStatement;

    totalSalesEl.textContent = formatCurrency(totals.totalSales);
    totalPurchasesEl.textContent = formatCurrency(totals.totalPurchases);
    totalReceiptsEl.textContent = formatCurrency(totals.totalPaymentsIn);
    totalPaymentsOutEl.textContent = formatCurrency(totals.totalPaymentsOut);
    if (totalSalesReturnsEl) totalSalesReturnsEl.textContent = formatCurrency(totals.totalSalesReturns);
    if (totalPurchaseReturnsEl) totalPurchaseReturnsEl.textContent = formatCurrency(totals.totalPurchaseReturns);

    statementState.transactions = [...transactions].reverse();
    statementState.totals = totals;
    statementState.page = 1;
    statementState.totalPages = Math.max(1, Math.ceil(statementState.transactions.length / statementState.pageSize));

    renderStatementTable();
    renderStatementPagination();

    const balance = totals.closingBalance;
    let balClass = 'zero';
    let balText = formatCurrency(balance);
    let balLabel = '';
    if (balance > 0) {
        balClass = 'positive';
        balLabel = t('customerReports.balanceForUs', 'لينا (مدين)');
    } else if (balance < 0) {
        balClass = 'negative';
        balText = formatCurrency(Math.abs(balance));
        balLabel = t('customerReports.balanceAgainstUs', 'علينا (دائن)');
    }

    balanceFooterEl.innerHTML = `
        <span class="bf-label"><i class="fas fa-coins"></i> ${t('customerReports.closingBalance', 'الرصيد الختامي')}</span>
        <span class="bf-value ${balClass}">${balText} ${balLabel}</span>
    `;

    if (totalClosingBalanceEl) {
        totalClosingBalanceEl.textContent = balText;
        totalClosingBalanceEl.className = `sc-value ${balClass}`;
    }
    if (closingBalanceBadgeEl) {
        if (balLabel) {
            closingBalanceBadgeEl.textContent = balLabel;
            closingBalanceBadgeEl.className = `sc-badge ${balClass}`;
            closingBalanceBadgeEl.style.display = 'inline-block';
        } else {
            closingBalanceBadgeEl.textContent = '';
            closingBalanceBadgeEl.style.display = 'none';
        }
    }
    if (closingBalanceCardEl) {
        closingBalanceCardEl.className = `summary-card card-closing-balance ${balClass}`;
    }
}

function renderStatementPagination() {
    if (!customerReportPaginationEl) return;
    window.financialPagination?.render(customerReportPaginationEl, {
        page: statementState.page,
        pageSize: statementState.pageSize,
        totalPages: statementState.totalPages,
        total: statementState.transactions.length
    });
}

function renderStatementTable({ renderAll = false } = {}) {
    if (!customerReportTableBody) return;
    const transactions = Array.isArray(statementState.transactions) ? statementState.transactions : [];
    const totals = statementState.totals || {};

    customerReportTableBody.innerHTML = '';

    const openingBalance = Number(totals.openingBalance) || 0;
    if (openingBalance !== 0) {
        const obRow = document.createElement('tr');
        obRow.className = 'opening-row';
        const obClass = openingBalance > 0 ? 'positive' : 'negative';
        const obLabel = openingBalance > 0
            ? t('customerReports.balanceForUs', 'لينا (مدين)')
            : t('customerReports.balanceAgainstUs', 'علينا (دائن)');

        obRow.innerHTML = `
            <td colspan="5" class="ob-label">
                <i class="fas fa-flag"></i>
                ${t('customerReports.openingBalance', 'رصيد أول المدة')}
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td class="running-bal ${obClass}">${formatCurrency(Math.abs(openingBalance))} ${obLabel}</td>
        `;
        customerReportTableBody.appendChild(obRow);
    }

    if (transactions.length === 0 && openingBalance === 0) {
        customerReportTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="9">
                    <i class="fas fa-inbox"></i>
                    ${t('customerReports.noTransactions', 'لا توجد عمليات لهذا العميل')}
                </td>
            </tr>`;
        return;
    }

    const startIndex = renderAll ? 0 : ((statementState.page - 1) * statementState.pageSize);
    const displayedTransactions = renderAll
        ? transactions
        : transactions.slice(startIndex, startIndex + statementState.pageSize);

    displayedTransactions.forEach((item, idx) => {
        const globalIdx = startIndex + idx;
        const mainRow = document.createElement('tr');
        mainRow.className = `trans-main-row trans-type-${item.type}`;
        let typeBadge = '';
        
        let totalInvoiceVal = '—';
        let paidVal = '—';
        let remainingVal = '—';

        const hasDetails = ['sales', 'purchase', 'local_sale'].includes(item.type);
        const rowId = `items-${globalIdx}`;

        if (item.type === 'sales') {
            typeBadge = `<span class="badge badge-sales"><i class="fas fa-shopping-cart"></i> ${t('customerReports.salesBadge', 'مبيعات')}</span>`;
            totalInvoiceVal = formatCurrency(item.total_amount);
            paidVal = formatCurrency(item.paid_amount);
            remainingVal = formatCurrency(item.remaining_amount);
        } else if (item.type === 'local_sale') {
            typeBadge = `<span class="badge badge-sales"><i class="fas fa-store"></i> ${t('customerReports.localSalesBadge', 'مبيعات محلية')}</span>`;
            totalInvoiceVal = formatCurrency(item.total_amount);
            paidVal = formatCurrency(item.paid_amount);
            remainingVal = formatCurrency(item.remaining_amount);
        } else if (item.type === 'purchase') {
            typeBadge = `<span class="badge badge-purchase"><i class="fas fa-shopping-bag"></i> ${t('customerReports.purchaseBadge', 'مشتريات')}</span>`;
            totalInvoiceVal = formatCurrency(item.total_amount);
            paidVal = formatCurrency(item.paid_amount);
            remainingVal = formatCurrency(item.remaining_amount);
        } else if (item.type === 'payment_in') {
            typeBadge = `<span class="badge badge-receipt"><i class="fas fa-hand-holding-usd"></i> ${t('customerReports.receiptBadge', 'تحصيل')}</span>`;
            paidVal = formatCurrency(item.paid_amount);
        } else if (item.type === 'payment_out') {
            typeBadge = `<span class="badge badge-payment"><i class="fas fa-money-bill-wave"></i> ${t('customerReports.paymentBadge', 'سداد')}</span>`;
            paidVal = formatCurrency(item.paid_amount);
        }

        const rb = item.running_balance;
        const rbClass = rb > 0 ? 'positive' : rb < 0 ? 'negative' : '';
        const rbLabel = rb > 0 ? t('customerReports.balanceForUs', 'لينا (مدين)') : rb < 0 ? t('customerReports.balanceAgainstUs', 'علينا (دائن)') : '';
        const rbText = `${formatCurrency(Math.abs(rb))} ${rbLabel}`;

        const toggleBtn = hasDetails
            ? `<button class="btn-toggle" data-action="toggle-items" data-row-id="${rowId}" data-type="${item.type}" data-id="${item.id}" title="${t('customerReports.showItems', 'عرض الأصناف')}"><i class="fas fa-chevron-down"></i></button>`
            : '';
        const docNumberCellHtml = window.renderDocNumberCell
            ? window.renderDocNumberCell(item.doc_number, { numberTag: 'span' })
            : `<span>${escapeHtml(item.doc_number || '—')}</span>`;

        mainRow.innerHTML = `
            <td class="idx-cell">${globalIdx + 1} ${toggleBtn}</td>
            <td>${item.trans_date}</td>
            <td>${typeBadge}</td>
            <td>${docNumberCellHtml}${(item.type === 'payment_in' || item.type === 'payment_out') ? ` <span class="ta-slot" data-ta-tx-id="${item.id}" data-ta-voucher="${escapeHtml(item.doc_number || '')}" style="margin-right:6px;"></span>` : ''}</td>
            <td class="notes-cell">${escapeHtml(item.notes || '—')}</td>
            <td class="amt-cell">${totalInvoiceVal}</td>
            <td class="amt-cell">${paidVal}</td>
            <td class="amt-cell">${remainingVal}</td>
            <td class="running-bal ${rbClass}">${rbText}</td>
        `;
        customerReportTableBody.appendChild(mainRow);

        if (hasDetails) {
            const detailRow = document.createElement('tr');
            detailRow.id = rowId;
            detailRow.className = 'items-detail-row';
            detailRow.dataset.loaded = 'false';
            detailRow.dataset.detailType = item.type;
            detailRow.dataset.detailId = String(item.id);
            detailRow.innerHTML = `<td colspan="9"><div class="items-loading"><i class="fas fa-spinner fa-spin"></i> ${t('customerReports.loadingItems', 'جاري تحميل الأصناف...')}</div></td>`;
            customerReportTableBody.appendChild(detailRow);
        }
    });
    window.treasuryAttachmentsViewer?.hydrateSlots?.(customerReportTableBody);
}

async function toggleItems(rowId, btn, type, id) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const isHidden = !row.classList.contains('expanded');
    row.classList.toggle('expanded', isHidden);
    const icon = btn.querySelector('i');
    icon.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';

    if (isHidden && row.dataset.loaded === 'false') {
        const result = await window.electronAPI.getStatementItemDetails({ type, id });
        if (result && result.success && result.details.length > 0) {
            const isPurchaseDetail = type === 'purchase';
            let itemsHTML = `
                <td colspan="9">
                    <div class="items-detail-box">
                        <table class="items-inner-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>${t('customerReports.itemHeaders.name', 'الصنف')}</th>
                                    <th>${t('customerReports.itemHeaders.unit', 'الوحدة')}</th>
                                    ${isPurchaseDetail ? `
                                    <th>${t('customerReports.itemHeaders.rawQty', 'الكمية الخام')}</th>
                                    <th>${t('customerReports.itemHeaders.net1Qty', 'صافي 1%')}</th>
                                    <th>${t('customerReports.itemHeaders.ratePercent', 'المعدل %')}</th>
                                    <th>${t('customerReports.itemHeaders.netQty', 'الكمية النهائية')}</th>` : `
                                    <th>${t('customerReports.itemHeaders.qty', 'الكمية')}</th>`}
                                    <th>${t('customerReports.itemHeaders.price', 'السعر')}</th>
                                    <th>${t('customerReports.itemHeaders.total', 'الإجمالي')}</th>
                                </tr>
                            </thead>
                            <tbody>`;
            result.details.forEach((itm, i) => {
                const rawQty = Number(itm.raw_quantity);
                const rawQtyText = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : itm.quantity;
                const net1Qty = Number(itm.net1_quantity);
                const net1QtyText = Number.isFinite(net1Qty) && net1Qty > 0
                    ? net1Qty
                    : Math.round(((Number(rawQtyText) || 0) * 0.99 + Number.EPSILON) * 100) / 100;
                const rateVal = Number(itm.rate_percent);
                const rateText = Number.isFinite(rateVal) && rateVal > 0 ? `${rateVal}%` : '—';
                const qtyCells = isPurchaseDetail
                    ? `
                                    <td>${rawQtyText}</td>
                                    <td>${net1QtyText}</td>
                                    <td>${rateText}</td>
                                    <td>${itm.quantity}</td>`
                    : `
                                    <td>${itm.quantity}</td>`;
                itemsHTML += `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${escapeHtml(itm.item_name)}</td>
                                    <td>${escapeHtml(itm.unit_name || '—')}</td>
                                    ${qtyCells}
                                    <td>${formatCurrency(itm.price || 0)}</td>
                                    <td>${formatCurrency(itm.total_price || 0)}</td>
                                </tr>`;
            });
            itemsHTML += `
                            </tbody>
                        </table>
                    </div>
                </td>`;
            row.innerHTML = itemsHTML;
        } else {
            row.innerHTML = `<td colspan="9"><div class="items-loading">${t('customerReports.noItems', 'لا توجد أصناف')}</div></td>`;
        }
        row.dataset.loaded = 'true';
    }
}

async function deleteTransaction(id) {
    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('customerReports.deleteTransactionConfirm', 'هل أنت متأكد من حذف هذه العملية المالية؟'))
        : false;
    if (!confirmed) return;

    try {
        const result = await window.electronAPI.deleteTreasuryTransaction(id);
        if (result.success) {
            notifyCustomerReports(t('customerReports.deleteSuccess', 'تم الحذف بنجاح'), 'success');
            const customerId = document.getElementById('customerSelect').value;
            if (customerId) loadCustomerReport(customerId);
        } else {
            notifyCustomerReports(fmt(t('customerReports.deleteError', 'حدث خطأ: {error}'), { error: result.error }), 'error');
        }
    } catch (error) {
        console.error(error);
        notifyCustomerReports(t('customerReports.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
    }
}

function showPdfModal() {
    const modal = document.getElementById('pdfModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closePdfModal() {
    const modal = document.getElementById('pdfModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function getPdfExportContext() {
    const customerId = customerSelect ? customerSelect.value : '';
    if (!customerId) {
        notifyCustomerReports(t('customerReports.selectCustomerPlaceholder', 'اختر العميل...'), 'error');
        return null;
    }
    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    return {
        t,
        formatCurrency,
        escapeHtml,
        customerId,
        customerName: selectedOption ? selectedOption.textContent.trim() : '',
        startDate: document.getElementById('dateFrom').value || undefined,
        endDate: document.getElementById('dateTo').value || undefined
    };
}

// Modal event listeners
document.addEventListener('click', (event) => {
    const detailedBtn = event.target.closest('#detailedPdfBtn');
    const summaryBtn = event.target.closest('#summaryPdfBtn');
    const closeBtn = event.target.closest('#pdfModalClose');
    const modalOverlay = event.target.closest('.modal-overlay');

    if (detailedBtn) {
        closePdfModal();
        const ctx = getPdfExportContext();
        if (ctx) window.customerReportsPdf.exportDetailed(ctx);
    } else if (summaryBtn) {
        closePdfModal();
        const ctx = getPdfExportContext();
        if (ctx) window.customerReportsPdf.exportSummary(ctx);
    } else if (closeBtn || modalOverlay) {
        closePdfModal();
    }
});
