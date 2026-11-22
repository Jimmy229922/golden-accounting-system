let reportData = null;
let ar = {};
const { t } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f };

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

function showDailyReportToast(message, type = 'info') {
    if (!message) return;
    if (window.toast && typeof window.toast[type] === 'function') {
        window.toast[type](message);
        return;
    }
    if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
        Toast.show(message, type);
        return;
    }
    console.log('[daily-report]', message);
}

function formatCurrency(amount) {
    const n = Number(amount) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getYesterdayString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getWeekRange() {
    const d = new Date();
    const day = d.getDay();
    const diff = (day + 1) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - diff);
    
    const yearS = start.getFullYear();
    const monthS = String(start.getMonth() + 1).padStart(2, '0');
    const dayS = String(start.getDate()).padStart(2, '0');

    const yearE = d.getFullYear();
    const monthE = String(d.getMonth() + 1).padStart(2, '0');
    const dayE = String(d.getDate()).padStart(2, '0');

    return {
        startDate: `${yearS}-${monthS}-${dayS}`,
        endDate: `${yearE}-${monthE}-${dayE}`
    };
}

function getMonthRange() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return {
        startDate: `${year}-${month}-01`,
        endDate: `${year}-${month}-${day}`
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
            ar = await window.i18n.loadArabicDictionary();
        }
        renderPage();
        setupEventListeners();
        setPreset('today');
    } catch (error) {
        console.error('Initialization Error:', error);
    }
});

function renderPage() {
    const app = document.getElementById('app');
    const today = getTodayString();

    app.innerHTML = `
        ${buildTopNavHTML()}
        <div class="content">
            <div class="print-report-header">
                <h2>التقرير المالي اليومي الشامل</h2>
                <p id="printPeriodText">الفترة: من ${today} إلى ${today}</p>
            </div>

            <div class="dr-hero">
                <div class="hero-shapes">
                    <div class="hero-shape shape-1"></div>
                    <div class="hero-shape shape-2"></div>
                </div>
                <div class="hero-content">
                    <h1>التقرير المالي اليومي الشامل</h1>
                    <p>كشف تفصيلي شامل لكافة المقبوضات والمصروفات وحركة السيولة النقدية</p>
                </div>
            </div>

            <div class="dr-presets">
                <button type="button" class="preset-btn active" data-preset="today">اليوم</button>
                <button type="button" class="preset-btn" data-preset="yesterday">أمس</button>
                <button type="button" class="preset-btn" data-preset="week">هذا الأسبوع</button>
                <button type="button" class="preset-btn" data-preset="month">هذا الشهر</button>
            </div>

            <div class="dr-filters">
                <div class="form-group">
                    <label><i class="fas fa-calendar-alt"></i> من تاريخ</label>
                    <input type="date" id="startDate" class="form-control" value="${today}">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-calendar-alt"></i> إلى تاريخ</label>
                    <input type="date" id="endDate" class="form-control" value="${today}">
                </div>
                <div class="filter-actions">
                    <button type="button" id="btnFilter" class="btn btn-primary">
                        <i class="fas fa-search"></i> عرض التقرير
                    </button>
                    <button type="button" id="btnExportPdf" class="btn btn-action" style="background:#0284c7;color:#fff;">
                        <i class="fas fa-file-pdf"></i> تصدير PDF
                    </button>
                    <button type="button" id="btnPrint" class="btn btn-action" style="background:#475569;color:#fff;">
                        <i class="fas fa-print"></i> طباعة
                    </button>
                </div>
            </div>

            <div class="dr-summary">
                <div class="dr-summary-card card-income">
                    <div class="dr-card-icon"><i class="fas fa-arrow-down"></i></div>
                    <div class="dr-card-info">
                        <div class="dr-card-label">إجمالي المقبوضات (الداخل)</div>
                        <div class="dr-card-value text-green" id="totalIncomeVal">0.00 ج.م</div>
                    </div>
                </div>
                <div class="dr-summary-card card-expense">
                    <div class="dr-card-icon"><i class="fas fa-arrow-up"></i></div>
                    <div class="dr-card-info">
                        <div class="dr-card-label">إجمالي المصروفات (الخارج)</div>
                        <div class="dr-card-value text-red" id="totalExpenseVal">0.00 ج.م</div>
                    </div>
                </div>
                <div class="dr-summary-card card-net">
                    <div class="dr-card-icon"><i class="fas fa-wallet"></i></div>
                    <div class="dr-card-info">
                        <div class="dr-card-label">صافي الحركة النقدية</div>
                        <div class="dr-card-value" id="netFlowVal">0.00 ج.م</div>
                    </div>
                </div>
            </div>

            <div class="dr-sections-grid">
                <div class="finance-column">
                    <div class="finance-box">
                        <div class="finance-box-header income-header">
                            <h3><i class="fas fa-file-invoice-dollar"></i> مبيعات نقدية (مدفوعة)</h3>
                            <span class="finance-box-badge income-badge" id="salesPaidSubtotal">0.00 ج.م</span>
                        </div>
                        <div class="dr-table-responsive">
                            <table class="dr-table">
                                <thead>
                                    <tr>
                                        <th>رقم الفاتورة</th>
                                        <th>العميل</th>
                                        <th>المدفوع كاش</th>
                                        <th>إجمالي الفاتورة</th>
                                    </tr>
                                </thead>
                                <tbody id="salesInvoicesBody">
                                    <tr class="empty-row"><td colspan="4">لا توجد بيانات</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="finance-box">
                        <div class="finance-box-header income-header">
                            <h3><i class="fas fa-store"></i> مبيعات محلية</h3>
                            <span class="finance-box-badge income-badge" id="localSalesSubtotal">0.00 ج.م</span>
                        </div>
                        <div class="dr-table-responsive">
                            <table class="dr-table">
                                <thead>
                                    <tr>
                                        <th>رقم السند</th>
                                        <th>العميل</th>
                                        <th>البيان</th>
                                        <th>المبلغ</th>
                                    </tr>
                                </thead>
                                <tbody id="localSalesBody">
                                    <tr class="empty-row"><td colspan="4">لا توجد بيانات</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="finance-box">
                        <div class="finance-box-header income-header">
                            <h3><i class="fas fa-globe-americas"></i> إيرادات التصدير</h3>
                            <span class="finance-box-badge income-badge" id="exportRevenuesSubtotal">0.00 ج.م</span>
                        </div>
                        <div class="dr-table-responsive">
                            <table class="dr-table">
                                <thead>
                                    <tr>
                                        <th>رقم السند</th>
                                        <th>البيان</th>
                                        <th>المبلغ بالعملة</th>
                                        <th>المعادل بالمصري</th>
                                    </tr>
                                </thead>
                                <tbody id="exportRevenuesBody">
                                    <tr class="empty-row"><td colspan="4">لا توجد بيانات</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="finance-box">
                        <div class="finance-box-header income-header">
                            <h3><i class="fas fa-hand-holding-usd"></i> مقبوضات وسندات قبض الخزينة</h3>
                            <span class="finance-box-badge income-badge" id="treasuryIncomeSubtotal">0.00 ج.م</span>
                        </div>
                        <div class="dr-table-responsive">
                            <table class="dr-table">
                                <thead>
                                    <tr>
                                        <th>رقم السند</th>
                                        <th>الطرف</th>
                                        <th>البيان</th>
                                        <th>المبلغ</th>
                                    </tr>
                                </thead>
                                <tbody id="treasuryIncomeBody">
                                    <tr class="empty-row"><td colspan="4">لا توجد بيانات</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="finance-column">
                    <div class="finance-box">
                        <div class="finance-box-header expense-header">
                            <h3><i class="fas fa-shopping-cart"></i> مشتريات نقدية (مدفوعة)</h3>
                            <span class="finance-box-badge expense-badge" id="purchasesPaidSubtotal">0.00 ج.م</span>
                        </div>
                        <div class="dr-table-responsive">
                            <table class="dr-table">
                                <thead>
                                    <tr>
                                        <th>رقم الفاتورة</th>
                                        <th>المورد</th>
                                        <th>المدفوع كاش</th>
                                        <th>إجمالي الفاتورة</th>
                                    </tr>
                                </thead>
                                <tbody id="purchaseInvoicesBody">
                                    <tr class="empty-row"><td colspan="4">لا توجد بيانات</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="finance-box">
                        <div class="finance-box-header expense-header">
                            <h3><i class="fas fa-receipt"></i> نثريات الشركة</h3>
                            <span class="finance-box-badge expense-badge" id="pettyExpensesSubtotal">0.00 ج.م</span>
                        </div>
                        <div class="dr-table-responsive">
                            <table class="dr-table">
                                <thead>
                                    <tr>
                                        <th>رقم السند</th>
                                        <th>البند</th>
                                        <th>البيان</th>
                                        <th>المبلغ</th>
                                    </tr>
                                </thead>
                                <tbody id="pettyExpensesBody">
                                    <tr class="empty-row"><td colspan="4">لا توجد بيانات</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="finance-box">
                        <div class="finance-box-header expense-header">
                            <h3><i class="fas fa-industry"></i> نثريات المصنع</h3>
                            <span class="finance-box-badge expense-badge" id="factoryPettyExpensesSubtotal">0.00 ج.م</span>
                        </div>
                        <div class="dr-table-responsive">
                            <table class="dr-table">
                                <thead>
                                    <tr>
                                        <th>رقم السند</th>
                                        <th>البند</th>
                                        <th>البيان</th>
                                        <th>المبلغ</th>
                                    </tr>
                                </thead>
                                <tbody id="factoryPettyExpensesBody">
                                    <tr class="empty-row"><td colspan="4">لا توجد بيانات</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="finance-box">
                        <div class="finance-box-header expense-header">
                            <h3><i class="fas fa-money-bill-wave"></i> مصروفات وسندات صرف الخزينة</h3>
                            <span class="finance-box-badge expense-badge" id="treasuryExpenseSubtotal">0.00 ج.م</span>
                        </div>
                        <div class="dr-table-responsive">
                            <table class="dr-table">
                                <thead>
                                    <tr>
                                        <th>رقم السند</th>
                                        <th>الطرف</th>
                                        <th>البيان</th>
                                        <th>المبلغ</th>
                                    </tr>
                                </thead>
                                <tbody id="treasuryExpenseBody">
                                    <tr class="empty-row"><td colspan="4">لا توجد بيانات</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function setPreset(preset) {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === preset);
    });

    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');

    if (preset === 'today') {
        const today = getTodayString();
        startInput.value = today;
        endInput.value = today;
    } else if (preset === 'yesterday') {
        const yesterday = getYesterdayString();
        startInput.value = yesterday;
        endInput.value = yesterday;
    } else if (preset === 'week') {
        const range = getWeekRange();
        startInput.value = range.startDate;
        endInput.value = range.endDate;
    } else if (preset === 'month') {
        const range = getMonthRange();
        startInput.value = range.startDate;
        endInput.value = range.endDate;
    }

    loadReport();
}

function setupEventListeners() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setPreset(btn.dataset.preset);
        });
    });

    document.getElementById('btnFilter')?.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
        loadReport();
    });

    document.getElementById('btnExportPdf')?.addEventListener('click', exportPdf);
    document.getElementById('btnPrint')?.addEventListener('click', () => window.print());
}

async function loadReport() {
    const startDate = document.getElementById('startDate')?.value || getTodayString();
    const endDate = document.getElementById('endDate')?.value || startDate;

    const printPeriodEl = document.getElementById('printPeriodText');
    if (printPeriodEl) {
        printPeriodEl.textContent = `الفترة: من ${startDate} إلى ${endDate}`;
    }

    try {
        const electronApi = window.electronAPI || window.api;
        const response = await electronApi.getDailyFinanceReport({ startDate, endDate });
        if (!response || !response.success) {
            showDailyReportToast(response?.error || 'فشل جلب التقرير المالي', 'error');
            return;
        }

        reportData = response;
        renderReportData(response);
    } catch (error) {
        console.error('loadReport error:', error);
        showDailyReportToast('حدث خطأ أثناء تحميل التقرير', 'error');
    }
}

function renderReportData(data) {
    const totals = data.totals || {};
    const income = data.income || {};
    const expense = data.expense || {};

    const totalIncome = totals.totalIncome || 0;
    const totalExpense = totals.totalExpense || 0;
    const netFlow = totals.netFlow || 0;

    document.getElementById('totalIncomeVal').textContent = `${formatCurrency(totalIncome)} ج.م`;
    document.getElementById('totalExpenseVal').textContent = `${formatCurrency(totalExpense)} ج.م`;
    
    const netEl = document.getElementById('netFlowVal');
    netEl.textContent = `${formatCurrency(netFlow)} ج.م`;
    netEl.className = 'dr-card-value ' + (netFlow >= 0 ? 'text-green' : 'text-red');

    document.getElementById('salesPaidSubtotal').textContent = `${formatCurrency(income.subtotals?.salesPaid || 0)} ج.م`;
    document.getElementById('localSalesSubtotal').textContent = `${formatCurrency(income.subtotals?.localSales || 0)} ج.م`;
    document.getElementById('exportRevenuesSubtotal').textContent = `${formatCurrency(income.subtotals?.exportRevenues || 0)} ج.م`;
    document.getElementById('treasuryIncomeSubtotal').textContent = `${formatCurrency(income.subtotals?.treasuryIncome || 0)} ج.م`;

    document.getElementById('purchasesPaidSubtotal').textContent = `${formatCurrency(expense.subtotals?.purchasesPaid || 0)} ج.م`;
    document.getElementById('pettyExpensesSubtotal').textContent = `${formatCurrency(expense.subtotals?.pettyExpenses || 0)} ج.م`;
    document.getElementById('factoryPettyExpensesSubtotal').textContent = `${formatCurrency(expense.subtotals?.factoryPettyExpenses || 0)} ج.م`;
    document.getElementById('treasuryExpenseSubtotal').textContent = `${formatCurrency(expense.subtotals?.treasuryExpense || 0)} ج.م`;

    renderTableBody('salesInvoicesBody', income.salesInvoices, (row) => `
        <tr>
            <td><strong>#${row.invoice_number || row.id}</strong></td>
            <td>${escapeHtml(row.customer_name || 'عميل نقدي')}</td>
            <td class="text-green font-weight-bold">${formatCurrency(row.paid_amount)}</td>
            <td>${formatCurrency(row.total_amount)}</td>
        </tr>
    `, 4);

    renderTableBody('localSalesBody', income.localSales, (row) => `
        <tr>
            <td><strong>#${row.document_number || row.id}</strong></td>
            <td>${escapeHtml(row.customer_name || '—')}</td>
            <td>${escapeHtml(row.statement || '—')}</td>
            <td class="text-green font-weight-bold">${formatCurrency(row.total)}</td>
        </tr>
    `, 4);

    renderTableBody('exportRevenuesBody', income.exportRevenues, (row) => `
        <tr>
            <td><strong>#${row.document_number || row.id}</strong></td>
            <td>${escapeHtml(row.statement || '—')}</td>
            <td>${formatCurrency(row.amount)} ${escapeHtml(row.currency || '')}</td>
            <td class="text-green font-weight-bold">${formatCurrency(row.amount_egp)}</td>
        </tr>
    `, 4);

    renderTableBody('treasuryIncomeBody', income.treasuryIncome, (row) => `
        <tr>
            <td><strong>#${row.voucher_number || row.id}</strong> <span class="ta-slot" data-ta-tx-id="${row.id}" data-ta-voucher="${escapeHtml(row.voucher_number || '')}" style="margin-right:6px;"></span></td>
            <td>${escapeHtml(row.customer_name || '—')}</td>
            <td>${escapeHtml(row.description || '—')}</td>
            <td class="text-green font-weight-bold">${formatCurrency(row.amount)}</td>
        </tr>
    `, 4);

    renderTableBody('purchaseInvoicesBody', expense.purchaseInvoices, (row) => `
        <tr>
            <td><strong>#${row.invoice_number || row.id}</strong></td>
            <td>${escapeHtml(row.supplier_name || 'مورد نقدي')}</td>
            <td class="text-red font-weight-bold">${formatCurrency(row.paid_amount)}</td>
            <td>${formatCurrency(row.total_amount)}</td>
        </tr>
    `, 4);

    renderTableBody('pettyExpensesBody', expense.pettyExpenses, (row) => `
        <tr>
            <td><strong>#${row.document_number || row.id}</strong></td>
            <td>${escapeHtml(row.category || 'عام')}</td>
            <td>${escapeHtml(row.statement || row.notes || '—')}</td>
            <td class="text-red font-weight-bold">${formatCurrency(row.amount)}</td>
        </tr>
    `, 4);

    renderTableBody('factoryPettyExpensesBody', expense.factoryPettyExpenses, (row) => `
        <tr>
            <td><strong>#${row.document_number || row.id}</strong></td>
            <td>${escapeHtml(row.category || 'عام')}</td>
            <td>${escapeHtml(row.statement || row.notes || '—')}</td>
            <td class="text-red font-weight-bold">${formatCurrency(row.amount)}</td>
        </tr>
    `, 4);

    renderTableBody('treasuryExpenseBody', expense.treasuryExpense, (row) => `
        <tr>
            <td><strong>#${row.voucher_number || row.id}</strong> <span class="ta-slot" data-ta-tx-id="${row.id}" data-ta-voucher="${escapeHtml(row.voucher_number || '')}" style="margin-right:6px;"></span></td>
            <td>${escapeHtml(row.party_name || '—')}</td>
            <td>${escapeHtml(row.description || '—')}</td>
            <td class="text-red font-weight-bold">${formatCurrency(row.amount)}</td>
        </tr>
    `, 4);
    window.treasuryAttachmentsViewer?.hydrateSlots?.(document.getElementById('app'));
}

function renderTableBody(containerId, list, rowRenderer, colSpan) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!Array.isArray(list) || list.length === 0) {
        el.innerHTML = `<tr class="empty-row"><td colspan="${colSpan}">لا توجد عمليات</td></tr>`;
        return;
    }

    el.innerHTML = list.map(rowRenderer).join('');
}

function buildDailyReportPrintHtml(startDate, endDate) {
    const summaryEl = document.querySelector('.dr-summary');
    const sectionsEl = document.querySelector('.dr-sections-grid');
    const printedAt = new Date().toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    const summaryHtml = summaryEl ? summaryEl.outerHTML : '';
    const sectionsHtml = sectionsEl ? sectionsEl.outerHTML : '';

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>التقرير المالي اليومي الشامل</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
html, body {
    margin: 0;
    padding: 0;
    background: #ffffff !important;
    color: #0f172a !important;
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    direction: rtl;
    font-size: 12px;
    line-height: 1.5;
}
.pdf-header {
    background: linear-gradient(135deg, #0b132b 0%, #1c2541 100%);
    color: #ffffff;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 16px;
    border-bottom: 3px solid #d4af37;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.pdf-header h1 {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
}
.pdf-header .sub {
    margin: 0;
    font-size: 11px;
    color: #f3e5ab;
}
.pdf-header .meta {
    text-align: left;
    font-size: 10.5px;
    color: #cbd5e1;
    line-height: 1.6;
}
.dr-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 16px;
}
.dr-summary-card {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 3px solid #0284c7;
}
.dr-summary-card.income-card { border-top-color: #059669; }
.dr-summary-card.expense-card { border-top-color: #dc2626; }
.dr-summary-card.net-card { border-top-color: #0284c7; }
.dr-card-icon { display: none; }
.dr-card-title { font-size: 11px; color: #475569; font-weight: 700; margin-bottom: 4px; }
.dr-card-value { font-size: 16px; font-weight: 800; color: #0f172a; }
.dr-sections-grid { display: block; }
.finance-column { margin-bottom: 16px; }
.finance-col-title {
    font-size: 14px;
    font-weight: 800;
    color: #0f172a;
    padding: 6px 10px;
    border-radius: 8px;
    margin: 0 0 10px;
    background: #f1f5f9;
    border-right: 4px solid #0284c7;
}
.finance-col-title.income-title { border-right-color: #059669; color: #065f46; background: #ecfdf5; }
.finance-col-title.expense-title { border-right-color: #dc2626; color: #991b1b; background: #fef2f2; }
.finance-box {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    margin-bottom: 12px;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
}
.finance-box-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
}
.finance-box-title {
    font-size: 12.5px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
}
.finance-box-badge {
    font-size: 11px;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 999px;
    background: #e2e8f0;
    color: #0f172a;
}
.finance-box-badge.income-badge { background: #dcfce7; color: #166534; }
.finance-box-badge.expense-badge { background: #fee2e2; color: #991b1b; }
.dr-table-responsive { overflow: visible; max-height: none; }
.dr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
}
.dr-table th {
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
    padding: 7px 10px;
    text-align: right;
    border-bottom: 1.5px solid #cbd5e1;
}
.dr-table td {
    padding: 6px 10px;
    color: #1e293b;
    border-bottom: 1px solid #e2e8f0;
    text-align: right;
}
.dr-table tbody tr:nth-child(even) td { background: #f8fafc; }
.dr-table tbody tr:last-child td { border-bottom: none; }
.empty-row td { text-align: center; color: #64748b; padding: 10px; }
i.fas, i.fab, i.far { display: none; }
</style>
</head>
<body>
    <div class="pdf-header">
        <div>
            <h1>التقرير المالي اليومي الشامل</h1>
            <p class="sub">Golden Accounting System</p>
        </div>
        <div class="meta">
            <div>الفترة: من ${startDate} إلى ${endDate}</div>
            <div>تاريخ التصدير: ${printedAt}</div>
        </div>
    </div>
    ${summaryHtml}
    ${sectionsHtml}
</body>
</html>`;
}

async function exportPdf() {
    const startDate = document.getElementById('startDate')?.value || getTodayString();
    const endDate = document.getElementById('endDate')?.value || startDate;
    const defaultName = `تقرير_مالي_${startDate}_إلى_${endDate}.pdf`;

    try {
        const electronApi = window.electronAPI || window.api;
        const html = buildDailyReportPrintHtml(startDate, endDate);
        const result = await electronApi.saveDailyFinanceReportPdf({ defaultName, html });
        if (result && result.success) {
            showDailyReportToast('تم حفظ ملف PDF بنجاح', 'success');
        } else if (result && !result.canceled) {
            showDailyReportToast(result.error || 'فشل حفظ ملف PDF', 'error');
        }
    } catch (error) {
        console.error('exportPdf error:', error);
        showDailyReportToast('حدث خطأ أثناء تصدير التقرير', 'error');
    }
}
