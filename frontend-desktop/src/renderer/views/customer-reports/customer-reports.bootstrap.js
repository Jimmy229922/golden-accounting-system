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
let customerAutocomplete = null;
let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
const customerReportsRender = window.customerReportsPageRender;
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
        customerReportTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="8">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${(result && result.error) || t('customerReports.unexpectedError', 'حدث خطأ غير متوقع')}
                </td>
            </tr>`;
        return;
    }

    const { transactions, totals } = result;

    totalSalesEl.textContent = formatCurrency(totals.totalSales);
    totalPurchasesEl.textContent = formatCurrency(totals.totalPurchases);
    totalReceiptsEl.textContent = formatCurrency(totals.totalPaymentsIn);
    totalPaymentsOutEl.textContent = formatCurrency(totals.totalPaymentsOut);
    totalSalesReturnsEl.textContent = formatCurrency(totals.totalSalesReturns);
    totalPurchaseReturnsEl.textContent = formatCurrency(totals.totalPurchaseReturns);

    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    document.getElementById('printCustomerName').textContent = selectedOption ? selectedOption.textContent : '—';
    const fromDate = document.getElementById('dateFrom').value;
    const toDate = document.getElementById('dateTo').value;
    let periodText = t('customerReports.allPeriods', 'كل الفترات');
    if (fromDate && toDate) periodText = `${fromDate}  إلى  ${toDate}`;
    else if (fromDate) periodText = `من ${fromDate}`;
    else if (toDate) periodText = `حتى ${toDate}`;
    document.getElementById('printPeriod').textContent = periodText;
    document.getElementById('printDate').textContent = new Date().toLocaleDateString('ar-EG');

    try {
        const settings = await window.electronAPI.getSettings();
        if (settings) {
            const companyNameEl = document.getElementById('printCompanyName');
            const companyInfoEl = document.getElementById('printCompanyInfo');
            const logoEl = document.getElementById('printHeaderLogo');
            if (companyNameEl) companyNameEl.textContent = settings.companyName || '';
            let infoText = '';
            if (settings.companyAddress) infoText += settings.companyAddress;
            if (settings.companyPhone) infoText += (infoText ? ' | ' : '') + settings.companyPhone;
            if (companyInfoEl) companyInfoEl.textContent = infoText;
            if (logoEl && settings.profileImage) {
                logoEl.innerHTML = `<img src="${settings.profileImage}" alt="logo">`;
            } else if (logoEl) {
                logoEl.innerHTML = '';
            }
        }
    } catch (_) {
    }

    customerReportTableBody.innerHTML = '';

    if (totals.openingBalance !== 0) {
        const obRow = document.createElement('tr');
        obRow.className = 'opening-row';
        const obClass = totals.openingBalance > 0 ? 'positive' : 'negative';
        const obLabel = totals.openingBalance > 0
            ? t('customerReports.balanceForUs', 'لينا (مدين)')
            : t('customerReports.balanceAgainstUs', 'علينا (دائن)');

        obRow.innerHTML = `
            <td colspan="5" class="ob-label">
                <i class="fas fa-flag"></i>
                ${t('customerReports.openingBalance', 'رصيد أول المدة')}
            </td>
            <td></td>
            <td></td>
            <td class="running-bal ${obClass}">${formatCurrency(Math.abs(totals.openingBalance))} ${obLabel}</td>
        `;
        customerReportTableBody.appendChild(obRow);
    }

    if (transactions.length === 0 && totals.openingBalance === 0) {
        customerReportTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="8">
                    <i class="fas fa-inbox"></i>
                    ${t('customerReports.noTransactions', 'لا توجد عمليات لهذا العميل')}
                </td>
            </tr>`;
    } else {
        transactions.forEach((item, idx) => {
            const mainRow = document.createElement('tr');
            mainRow.className = `trans-main-row trans-type-${item.type}`;
            let typeBadge = '';
            let debitVal = '';
            let creditVal = '';
            const hasDetails = ['sales', 'purchase', 'sales_return', 'purchase_return'].includes(item.type);
            const rowId = `items-${idx}`;

            if (item.type === 'sales') {
                typeBadge = `<span class="badge badge-sales"><i class="fas fa-shopping-cart"></i> ${t('customerReports.salesBadge', 'مبيعات')}</span>`;
                debitVal = item.debit ? formatCurrency(item.debit) : '';
            } else if (item.type === 'purchase') {
                typeBadge = `<span class="badge badge-purchase"><i class="fas fa-shopping-bag"></i> ${t('customerReports.purchaseBadge', 'مشتريات')}</span>`;
                creditVal = item.credit ? formatCurrency(item.credit) : '';
            } else if (item.type === 'payment_in') {
                typeBadge = `<span class="badge badge-receipt"><i class="fas fa-hand-holding-usd"></i> ${t('customerReports.receiptBadge', 'تحصيل')}</span>`;
                creditVal = item.credit ? formatCurrency(item.credit) : '';
            } else if (item.type === 'payment_out') {
                typeBadge = `<span class="badge badge-payment"><i class="fas fa-money-bill-wave"></i> ${t('customerReports.paymentBadge', 'سداد')}</span>`;
                debitVal = item.debit ? formatCurrency(item.debit) : '';
            } else if (item.type === 'sales_return') {
                typeBadge = `<span class="badge badge-sales-return"><i class="fas fa-undo"></i> ${t('customerReports.salesReturnBadge', 'مردود مبيعات')}</span>`;
                creditVal = item.credit ? formatCurrency(item.credit) : '';
            } else if (item.type === 'purchase_return') {
                typeBadge = `<span class="badge badge-purchase-return"><i class="fas fa-undo"></i> ${t('customerReports.purchaseReturnBadge', 'مردود مشتريات')}</span>`;
                debitVal = item.debit ? formatCurrency(item.debit) : '';
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
                <td class="idx-cell">${idx + 1} ${toggleBtn}</td>
                <td>${item.trans_date}</td>
                <td>${typeBadge}</td>
                <td>${docNumberCellHtml}</td>
                <td class="notes-cell">${item.notes || '—'}</td>
                <td class="amt-cell"><span class="amount debit">${debitVal}</span></td>
                <td class="amt-cell"><span class="amount credit">${creditVal}</span></td>
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
                detailRow.innerHTML = `<td colspan="8"><div class="items-loading"><i class="fas fa-spinner fa-spin"></i> ${t('customerReports.loadingItems', 'جاري تحميل الأصناف...')}</div></td>`;
                customerReportTableBody.appendChild(detailRow);
            }
        });
    }

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

    const totalDebit = totals.totalSales + totals.totalPaymentsOut + totals.totalPurchaseReturns;
    const totalCredit = totals.totalPurchases + totals.totalPaymentsIn + totals.totalSalesReturns;
    const netMovement = totalDebit - totalCredit;
    document.getElementById('summaryDebit').textContent = formatCurrency(totalDebit);
    document.getElementById('summaryCredit').textContent = formatCurrency(totalCredit);

    const netEl = document.getElementById('summaryNet');
    const netLabel = netMovement > 0 ? t('customerReports.balanceForUs', 'لينا (مدين)') : netMovement < 0 ? t('customerReports.balanceAgainstUs', 'علينا (دائن)') : '';
    netEl.textContent = `${formatCurrency(Math.abs(netMovement))} ${netLabel}`;
    netEl.className = netMovement > 0 ? 'net-positive' : netMovement < 0 ? 'net-negative' : '';

    document.getElementById('summaryOpening').textContent = `${formatCurrency(Math.abs(totals.openingBalance))} ${totals.openingBalance > 0 ? t('customerReports.balanceForUs', 'لينا (مدين)') : totals.openingBalance < 0 ? t('customerReports.balanceAgainstUs', 'علينا (دائن)') : ''}`;
    document.getElementById('summaryClosing').textContent = `${balText} ${balLabel}`;
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
            let itemsHTML = `
                <td colspan="8">
                    <div class="items-detail-box">
                        <table class="items-inner-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>${t('customerReports.itemHeaders.name', 'الصنف')}</th>
                                    <th>${t('customerReports.itemHeaders.unit', 'الوحدة')}</th>
                                    <th>${t('customerReports.itemHeaders.qty', 'الكمية')}</th>
                                    <th>${t('customerReports.itemHeaders.price', 'السعر')}</th>
                                    <th>${t('customerReports.itemHeaders.total', 'الإجمالي')}</th>
                                </tr>
                            </thead>
                            <tbody>`;
            result.details.forEach((itm, i) => {
                itemsHTML += `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${itm.item_name}</td>
                                    <td>${itm.unit_name || '—'}</td>
                                    <td>${itm.quantity}</td>
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
            row.innerHTML = `<td colspan="8"><div class="items-loading">${t('customerReports.noItems', 'لا توجد أصناف')}</div></td>`;
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

function editInvoice(id, type) {
    if (type === 'sales') {
        const target = `../sales/index.html?editId=${id}`;
        if (!window.__navigateWithinShell || !window.__navigateWithinShell(target)) {
            window.location.href = target;
        }
    } else if (type === 'purchase') {
        const target = `../purchases/index.html?editId=${id}`;
        if (!window.__navigateWithinShell || !window.__navigateWithinShell(target)) {
            window.location.href = target;
        }
    }
}

async function deleteInvoice(id, type) {
    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('customerReports.deleteInvoiceConfirm', 'هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إلغاء جميع التأثيرات المالية والمخزنية.'))
        : false;
    if (!confirmed) return;

    try {
        const result = await window.electronAPI.deleteInvoice(id, type);
        if (result.success) {
            notifyCustomerReports(t('customerReports.deleteSuccess', 'تم الحذف بنجاح'), 'success');
            const customerId = document.getElementById('customerSelect').value;
            if (customerId) loadCustomerReport(customerId);
        } else {
            notifyCustomerReports(fmt(t('customerReports.deleteError', 'حدث خطأ: {error}'), { error: result.error }), 'error');
        }
    } catch (error) {
        console.error('Error deleting invoice:', error);
        notifyCustomerReports(t('customerReports.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
    }
}

async function deleteSalesReturn(id) {
    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('customerReports.deleteReturnConfirm', 'هل أنت متأكد من حذف هذا المرتجع؟'))
        : false;
    if (!confirmed) return;

    try {
        const result = await window.electronAPI.deleteSalesReturn(id);
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

async function deletePurchaseReturn(id) {
    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('customerReports.deleteReturnConfirm', 'هل أنت متأكد من حذف هذا المرتجع؟'))
        : false;
    if (!confirmed) return;

    try {
        const result = await window.electronAPI.deletePurchaseReturn(id);
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

// Modal event listeners
document.addEventListener('click', (event) => {
    const detailedBtn = event.target.closest('#detailedPdfBtn');
    const summaryBtn = event.target.closest('#summaryPdfBtn');
    const closeBtn = event.target.closest('#pdfModalClose');
    const modalOverlay = event.target.closest('.modal-overlay');

    if (detailedBtn) {
        closePdfModal();
        savePDF();
    } else if (summaryBtn) {
        closePdfModal();
        saveSummaryPDF();
    } else if (closeBtn || modalOverlay) {
        closePdfModal();
    }
});

window.printReport = async () => {
    await window.customerReportsUtils.loadAllItemDetails({ t, formatCurrency });
    window.print();
};

window.savePDF = async () => {
    await window.customerReportsUtils.loadAllItemDetails({ t, formatCurrency });
    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    const customerName = selectedOption ? selectedOption.textContent.trim() : '';
    const date = new Date().toISOString().split('T')[0];
    const defaultName = `كشف_حساب_${customerName}_${date}.pdf`;

    // Force stable light capture mode for PDF regardless of current UI theme.
    document.documentElement.classList.add('customer-report-pdf-mode');
    document.body.classList.add('customer-report-pdf-mode');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
        const result = await window.electronAPI.saveCustomerReportPdf({ defaultName });
        if (result && result.success) {
            if (window.showToast) window.showToast(t('customerReports.pdfSaved', 'تم حفظ الملف بنجاح'), 'success');
        } else if (result && !result.canceled) {
            if (window.showToast) window.showToast(t('customerReports.pdfError', 'حدث خطأ أثناء الحفظ'), 'error');
        }
    } finally {
        document.documentElement.classList.remove('customer-report-pdf-mode');
        document.body.classList.remove('customer-report-pdf-mode');
    }
};

window.saveSummaryPDF = async () => {
    const customerId = customerSelect.value;
    if (!customerId) {
        if (window.showToast) window.showToast(t('customerReports.selectCustomerPlaceholder', 'اختر العميل...'), 'error');
        return;
    }

    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    const customerName = selectedOption ? selectedOption.textContent.trim() : '';
    const startDate = document.getElementById('dateFrom').value || undefined;
    const endDate = document.getElementById('dateTo').value || undefined;
    const date = new Date().toISOString().split('T')[0];
    const defaultName = `فاتورة_مجمعة_${customerName}_${date}.pdf`;

    // Fetch summary statement data from backend
    const result = await window.electronAPI.getCustomerSummaryStatement({ customerId, startDate, endDate });
    if (!result || !result.success) {
        if (window.showToast) window.showToast(t('customerReports.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
        return;
    }

    // Also fetch detailed statement for invoice-level rows (date | total | payment | balance)
    const detailedResult = await window.electronAPI.getCustomerDetailedStatement({ customerId, startDate, endDate });
    if (!detailedResult || !detailedResult.success) {
        if (window.showToast) window.showToast(t('customerReports.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
        return;
    }

    // Get company settings
    let settings = {};
    try {
        settings = await window.electronAPI.getSettings() || {};
    } catch (_) {}

    // Build period text
    let periodText = t('customerReports.allPeriods', 'كل الفترات');
    if (startDate && endDate) periodText = `${startDate}  إلى  ${endDate}`;
    else if (startDate) periodText = `من ${startDate}`;
    else if (endDate) periodText = `حتى ${endDate}`;

    const { transactions, totals } = detailedResult;
    const printDate = new Date().toLocaleDateString('ar-EG');

    // Company info
    const companyName = settings.companyName || '';
    let companyInfo = '';
    if (settings.companyAddress) companyInfo += settings.companyAddress;
    if (settings.companyPhone) companyInfo += (companyInfo ? ' | ' : '') + settings.companyPhone;
    const logoHtml = settings.profileImage
        ? `<img src="${settings.profileImage}" alt="logo" style="width:70px;height:70px;object-fit:cover;border-radius:50%;border:2px solid #333;">`
        : '';

    // Type labels
    const typeLabels = {
        sales: t('customerReports.salesBadge', 'مبيعات'),
        purchase: t('customerReports.purchaseBadge', 'مشتريات'),
        payment_in: t('customerReports.receiptBadge', 'تحصيل'),
        payment_out: t('customerReports.paymentBadge', 'سداد'),
        sales_return: t('customerReports.salesReturnBadge', 'مردود مبيعات'),
        purchase_return: t('customerReports.purchaseReturnBadge', 'مردود مشتريات')
    };

    // Build table rows
    let rowsHtml = '';
    let idx = 0;

    if (totals.openingBalance !== 0) {
        const obLabel = totals.openingBalance > 0
            ? t('customerReports.balanceForUs', 'لينا (مدين)')
            : t('customerReports.balanceAgainstUs', 'علينا (دائن)');
        const openingBalanceClass = totals.openingBalance > 0
            ? 'summary-cell-balance-positive'
            : 'summary-cell-balance-negative';
        rowsHtml += `
            <tr class="summary-opening-row">
                <td colspan="3" style="text-align:center;font-weight:800;background:linear-gradient(135deg,#dbeafe,#ede9fe);border:1px solid #999;padding:10px 8px;">
                    ${t('customerReports.openingBalance', 'رصيد أول المدة')}
                </td>
                <td class="summary-cell-balance ${openingBalanceClass}" style="font-weight:800;background:linear-gradient(135deg,#dbeafe,#ede9fe);border:1px solid #999;padding:10px 8px;text-align:center;">
                    ${formatCurrency(Math.abs(totals.openingBalance))} ${obLabel}
                </td>
            </tr>`;
    }

    for (const trans of transactions) {
        idx++;
        const typeLabel = typeLabels[trans.type] || trans.type;
        const invoiceTotal = (trans.type === 'sales' || trans.type === 'payment_out' || trans.type === 'purchase_return')
            ? formatCurrency(trans.total_amount)
            : '';
        const paymentAmount = (trans.type === 'purchase' || trans.type === 'payment_in' || trans.type === 'sales_return')
            ? formatCurrency(trans.total_amount)
            : '';

        const rb = trans.running_balance;
        const rbLabel = rb > 0 ? t('customerReports.balanceForUs', 'لينا (مدين)') : rb < 0 ? t('customerReports.balanceAgainstUs', 'علينا (دائن)') : '';
        const rbClass = rb > 0 ? 'color:#047857;' : rb < 0 ? 'color:#b91c1c;' : '';
        const rbBalanceClass = rb > 0
            ? 'summary-cell-balance-positive'
            : rb < 0
                ? 'summary-cell-balance-negative'
                : 'summary-cell-balance-neutral';

        rowsHtml += `
            <tr>
                <td style="border:1px solid #999;padding:10px 8px;text-align:center;">${trans.trans_date}<br><small style="color:#888;">${typeLabel}</small></td>
                <td class="summary-cell-debit" style="border:1px solid #999;padding:10px 8px;text-align:center;color:#047857;font-weight:700;">${invoiceTotal}</td>
                <td class="summary-cell-credit" style="border:1px solid #999;padding:10px 8px;text-align:center;color:#b91c1c;font-weight:700;">${paymentAmount}</td>
                <td class="summary-cell-balance ${rbBalanceClass}" style="border:1px solid #999;padding:10px 8px;text-align:center;${rbClass}font-weight:800;">${formatCurrency(Math.abs(rb))} ${rbLabel}</td>
            </tr>`;
    }

    // Closing balance
    const closingBal = totals.closingBalance;
    const closingLabel = closingBal > 0 ? t('customerReports.balanceForUs', 'لينا (مدين)') : closingBal < 0 ? t('customerReports.balanceAgainstUs', 'علينا (دائن)') : '';
    const closingColor = closingBal > 0 ? '#047857' : closingBal < 0 ? '#b91c1c' : '#333';
    const closingBalanceClass = closingBal > 0
        ? 'summary-cell-balance-positive'
        : closingBal < 0
            ? 'summary-cell-balance-negative'
            : 'summary-cell-balance-neutral';

    // Summary totals
    const totalDebit = totals.totalSales + totals.totalPaymentsOut + totals.totalPurchaseReturns;
    const totalCredit = totals.totalPurchases + totals.totalPaymentsIn + totals.totalSalesReturns;

    // Build full summary print HTML
    const summaryHtml = `
        <div id="summaryPrintView" class="summary-print-view" dir="rtl" style="
            font-family: 'Cairo','Segoe UI',Tahoma,sans-serif;
            background: #fff;
            color: #1a1a1a;
            padding: 20px 24px;
            max-width: 210mm;
            margin: 0 auto;
        ">
            <!-- Header -->
            <div style="text-align:center;margin-bottom:12px;padding-bottom:10px;border-bottom:3px double #333;">
                <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:6px;">
                    <div style="width:70px;height:70px;">${logoHtml}</div>
                    <div style="flex:1;text-align:center;">
                        <h2 style="font-size:18px;margin:0 0 2px 0;font-weight:800;letter-spacing:0.5px;">
                            ${t('customerReports.summaryInvoiceTitle', 'فاتورة مجمعة')}
                        </h2>
                        <div style="font-size:14px;font-weight:800;margin-top:2px;">${escapeHtml(companyName)}</div>
                        <div style="font-size:10px;color:#444;margin-top:2px;">${escapeHtml(companyInfo)}</div>
                    </div>
                    <div style="width:70px;height:70px;visibility:hidden;"></div>
                </div>
                <div style="display:flex;justify-content:center;gap:40px;font-size:11px;color:#333;">
                    <div><strong>${t('customerReports.printCustomer', 'العميل')}:</strong> ${escapeHtml(customerName)}</div>
                    <div><strong>${t('customerReports.printPeriod', 'الفترة')}:</strong> ${periodText}</div>
                    <div><strong>${t('customerReports.printDate', 'تاريخ الطباعة')}:</strong> ${printDate}</div>
                </div>
            </div>

            <!-- Summary Table (4 columns) -->
            <table style="width:100%;border-collapse:collapse;border:2px solid #555;margin-bottom:12px;">
                <thead>
                    <tr>
                        <th style="background:#d9d9d9;font-size:13px;padding:10px 8px;border:1px solid #999;font-weight:800;text-align:center;">
                            ${t('customerReports.summaryColDate', 'التاريخ / نوع الحركة')}
                        </th>
                        <th style="background:#d9d9d9;font-size:13px;padding:10px 8px;border:1px solid #999;font-weight:800;text-align:center;">
                            ${t('customerReports.summaryColDebit', 'لينا (مدين)')}
                        </th>
                        <th style="background:#d9d9d9;font-size:13px;padding:10px 8px;border:1px solid #999;font-weight:800;text-align:center;">
                            ${t('customerReports.summaryColCredit', 'علينا (دائن)')}
                        </th>
                        <th style="background:#d9d9d9;font-size:13px;padding:10px 8px;border:1px solid #999;font-weight:800;text-align:center;">
                            ${t('customerReports.summaryColBalance', 'الرصيد')}
                        </th>
                    </tr>
                </thead>
                <tbody style="font-size:12px;">
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background:#f0f0f0;border-top:3px double #333;">
                        <td style="font-size:13px;padding:10px 8px;border:1px solid #999;font-weight:800;text-align:center;">
                            ${t('customerReports.summaryTotals', 'الإجماليات')}
                        </td>
                        <td class="summary-cell-debit" style="font-size:13px;padding:10px 8px;border:1px solid #999;font-weight:800;text-align:center;color:#047857;">
                            ${formatCurrency(totalDebit)}
                        </td>
                        <td class="summary-cell-credit" style="font-size:13px;padding:10px 8px;border:1px solid #999;font-weight:800;text-align:center;color:#b91c1c;">
                            ${formatCurrency(totalCredit)}
                        </td>
                        <td class="summary-cell-balance ${closingBalanceClass}" style="font-size:14px;padding:10px 8px;border:2px solid #555;font-weight:800;text-align:center;color:${closingColor};background:#e8e8e8;">
                            ${formatCurrency(Math.abs(closingBal))} ${closingLabel}
                        </td>
                    </tr>
                </tfoot>
            </table>

            <!-- Item Aggregation Tables -->
            ${buildSummaryItemsSection(result, t)}
        </div>
    `;

    // Create a full-page overlay for PDF capture (hides the entire app UI)
    const overlay = document.createElement('div');
    overlay.className = 'summary-pdf-overlay';
    overlay.innerHTML = summaryHtml;
    document.body.appendChild(overlay);

    // Activate PDF capture mode — hides #app, shows only the overlay
    document.body.classList.add('summary-pdf-mode');

    // Wait for layout, then apply smart page breaks for item sections.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    applySummarySectionPageBreaks(overlay);
    await new Promise(r => setTimeout(r, 180));

    try {
        const pdfResult = await window.electronAPI.saveCustomerSummaryPdf({ defaultName });
        if (pdfResult && pdfResult.success) {
            if (window.showToast) window.showToast(t('customerReports.pdfSaved', 'تم حفظ الملف بنجاح'), 'success');
        } else if (pdfResult && !pdfResult.canceled) {
            if (window.showToast) window.showToast(t('customerReports.pdfError', 'حدث خطأ أثناء الحفظ'), 'error');
        }
    } finally {
        // Remove overlay and restore normal view
        document.body.classList.remove('summary-pdf-mode');
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
};

function buildSummaryItemsSection(result, t) {
    let html = '';

    const sections = [
        { key: 'salesItems', title: t('customerReports.summaryItemsSales', 'أصناف المبيعات'), color: '#059669', icon: 'fa-shopping-cart' },
        { key: 'purchaseItems', title: t('customerReports.summaryItemsPurchases', 'أصناف المشتريات'), color: '#d97706', icon: 'fa-shopping-bag' },
        { key: 'salesReturnItems', title: t('customerReports.summaryItemsSalesReturns', 'أصناف مردودات المبيعات'), color: '#9333ea', icon: 'fa-undo' },
        { key: 'purchaseReturnItems', title: t('customerReports.summaryItemsPurchaseReturns', 'أصناف مردودات المشتريات'), color: '#0d9488', icon: 'fa-undo' }
    ];

    sections.forEach((section, sectionIndex) => {
        const items = Array.isArray(result[section.key]) ? result[section.key] : [];
        const hasItems = items.length > 0;
        const sectionTotal = items.reduce((s, i) => s + i.total_amount, 0);
        const sectionContainerStyle = [
            `margin-top:${sectionIndex === 0 ? '0' : '10px'}`,
            'page-break-before:auto',
            'break-before:auto',
            'page-break-inside:avoid',
            'break-inside:avoid-page',
            'box-sizing:border-box',
            'padding-top:0'
        ].filter(Boolean).join(';');

        html += `
            <div class="summary-items-section" data-summary-section="${sectionIndex}" data-has-items="${hasItems ? '1' : '0'}" style="${sectionContainerStyle}">
                <div style="background:${section.color};color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;font-size:13px;font-weight:700;page-break-after:avoid;break-after:avoid-page;">
                    <i class="fas ${section.icon}"></i> ${section.title}
                </div>
                <table style="width:100%;border-collapse:collapse;border:2px solid ${section.color};border-top:none;page-break-before:avoid;break-before:avoid-page;">
                    <thead>
                        <tr>
                            <th style="background:#f3f3f3;font-size:11px;padding:8px 6px;border:1px solid #ccc;font-weight:700;text-align:center;">#</th>
                            <th style="background:#f3f3f3;font-size:11px;padding:8px 6px;border:1px solid #ccc;font-weight:700;text-align:center;">
                                ${t('customerReports.itemHeaders.name', 'الصنف')}
                            </th>
                            <th style="background:#f3f3f3;font-size:11px;padding:8px 6px;border:1px solid #ccc;font-weight:700;text-align:center;">
                                ${t('customerReports.itemHeaders.unit', 'الوحدة')}
                            </th>
                            <th style="background:#f3f3f3;font-size:11px;padding:8px 6px;border:1px solid #ccc;font-weight:700;text-align:center;">
                                ${t('customerReports.summaryItemQty', 'إجمالي الكمية')}
                            </th>
                            <th style="background:#f3f3f3;font-size:11px;padding:8px 6px;border:1px solid #ccc;font-weight:700;text-align:center;">
                                ${t('customerReports.summaryItemAvgPrice', 'متوسط السعر')}
                            </th>
                            <th style="background:#f3f3f3;font-size:11px;padding:8px 6px;border:1px solid #ccc;font-weight:700;text-align:center;">
                                ${t('customerReports.summaryItemTotal', 'الإجمالي')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>`;

        if (hasItems) {
            items.forEach((item, i) => {
                html += `
                        <tr style="page-break-inside:avoid;">
                            <td style="font-size:11px;padding:6px;border:1px solid #ddd;text-align:center;">${i + 1}</td>
                            <td style="font-size:11px;padding:6px;border:1px solid #ddd;text-align:center;font-weight:600;">${escapeHtml(item.item_name)}</td>
                            <td style="font-size:11px;padding:6px;border:1px solid #ddd;text-align:center;">${escapeHtml(item.unit_name || '—')}</td>
                            <td style="font-size:11px;padding:6px;border:1px solid #ddd;text-align:center;font-weight:700;">${item.total_qty}</td>
                            <td style="font-size:11px;padding:6px;border:1px solid #ddd;text-align:center;">${formatCurrency(item.avg_price || 0)}</td>
                            <td style="font-size:11px;padding:6px;border:1px solid #ddd;text-align:center;font-weight:700;">${formatCurrency(item.total_amount)}</td>
                        </tr>`;
            });

            html += `
                    </tbody>
                    <tfoot>
                        <tr style="background:#f8f8f8;page-break-inside:avoid;">
                            <td colspan="5" style="font-size:12px;padding:8px;border:1px solid #ccc;text-align:center;font-weight:800;">
                                ${t('customerReports.summaryTotals', 'الإجماليات')}
                            </td>
                            <td style="font-size:12px;padding:8px;border:1px solid #ccc;text-align:center;font-weight:800;color:${section.color};">
                                ${formatCurrency(sectionTotal)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
        } else {
            html += `
                        <tr style="page-break-inside:avoid;">
                            <td colspan="6" style="font-size:12px;padding:14px;border:1px solid #ddd;text-align:center;font-weight:700;color:#555;">
                                ${t('customerReports.noDataMessage', 'لا توجد بيانات')}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>`;
        }
    });

    return html;
}

function measureMillimetersInPixels(mm) {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.left = '-100000px';
    probe.style.top = '0';
    probe.style.width = '1px';
    probe.style.height = `${mm}mm`;
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    document.body.appendChild(probe);
    const heightPx = probe.getBoundingClientRect().height;
    if (probe.parentNode) probe.parentNode.removeChild(probe);
    return heightPx;
}

function applySummarySectionPageBreaks(overlay) {
    if (!overlay) return;
    const summaryView = overlay.querySelector('#summaryPrintView');
    if (!summaryView) return;

    const sections = Array.from(summaryView.querySelectorAll('.summary-items-section'));
    if (!sections.length) return;

    const pageHeightPx = measureMillimetersInPixels(297);
    if (!Number.isFinite(pageHeightPx) || pageHeightPx <= 0) return;
    const pageContentHeightPx = pageHeightPx;

    const rootRect = summaryView.getBoundingClientRect();

    const getRelativeTop = (element) => element.getBoundingClientRect().top - rootRect.top;

    // Reset to baseline so re-running this function stays deterministic.
    sections.forEach((section) => {
        section.style.pageBreakBefore = 'auto';
        section.style.breakBefore = 'auto';
        section.style.pageBreakInside = 'avoid';
        section.style.breakInside = 'avoid-page';
    });

    // Prevent split sections with a safety margin:
    // If a section (especially empty/small section) is close to the page end,
    // force it to the next page as one block.
    for (let pass = 0; pass < 3; pass += 1) {
        let changed = false;

        for (let index = 0; index < sections.length; index += 1) {
            const section = sections[index];
            const sectionHeight = section.getBoundingClientRect().height;
            if (!Number.isFinite(sectionHeight) || sectionHeight <= 0) continue;

            const top = getRelativeTop(section);
            const currentPageEnd = (Math.floor(top / pageContentHeightPx) + 1) * pageContentHeightPx;
            const remainingSpace = currentPageEnd - top;
            const hasItems = section.dataset.hasItems === '1';
            const safetyBuffer = hasItems ? 70 : 130;
            const requiredHeight = sectionHeight + safetyBuffer;
            const canFitOnOnePage = requiredHeight <= (pageContentHeightPx - 14);

            if (canFitOnOnePage && requiredHeight > remainingSpace) {
                if (section.style.pageBreakBefore !== 'always') {
                    section.style.pageBreakBefore = 'always';
                    section.style.breakBefore = 'page';
                    changed = true;
                }
            }
        }

        if (!changed) break;
    }
}
