let customers = [];
let filteredCustomers = [];
let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

function showDebtorCreditorToast(message, type = 'info') {
    if (!message) return;

    if (window.toast && typeof window.toast[type] === 'function') {
        window.toast[type](message);
        return;
    }

    if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
        Toast.show(message, type);
        return;
    }

    if (type === 'error') {
        console.error('[debtor-creditor]', message);
        return;
    }

    console.log('[debtor-creditor]', message);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }
    renderPage();
    loadReport();
    setupEventListeners();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildTopNavHTML()}
        <div class="content">
            <div class="dc-hero">
                <div class="hero-shapes">
                    <div class="hero-shape shape-1"></div>
                    <div class="hero-shape shape-2"></div>
                    <div class="hero-shape shape-3"></div>
                </div>
                <div class="hero-content">
                    <h1>${t('debtorCreditor.title', 'كشف المدين والدائن')}</h1>
                    <p>${t('debtorCreditor.heroSubtitle', 'عرض شامل لأرصدة العملاء والموردين والمركز المالي')}</p>
                </div>
            </div>

            <div class="dc-summary">
                <div class="dc-summary-card card-debtor">
                    <div class="dc-card-icon"><i class="fas fa-arrow-down"></i></div>
                    <div class="dc-card-info">
                        <div class="dc-card-label">${t('debtorCreditor.totalDebtor', 'إجمالي الديون لينا (مدين)')}</div>
                        <div class="dc-card-value text-green" id="totalDebtor">0.00</div>
                    </div>
                </div>
                <div class="dc-summary-card card-creditor">
                    <div class="dc-card-icon"><i class="fas fa-arrow-up"></i></div>
                    <div class="dc-card-info">
                        <div class="dc-card-label">${t('debtorCreditor.totalCreditor', 'إجمالي المستحقات علينا (دائن)')}</div>
                        <div class="dc-card-value text-red" id="totalCreditor">0.00</div>
                    </div>
                </div>
                <div class="dc-summary-card card-net">
                    <div class="dc-card-icon"><i class="fas fa-balance-scale"></i></div>
                    <div class="dc-card-info">
                        <div class="dc-card-label">${t('debtorCreditor.netBalance', 'صافي الرصيد')}</div>
                        <div class="dc-card-value" id="netBalance">0.00</div>
                    </div>
                </div>
            </div>

            <div class="dc-filters">
                <div class="form-group">
                    <label><i class="fas fa-calendar-alt"></i> ${t('debtorCreditor.fromDate', 'من تاريخ')}</label>
                    <input type="date" id="startDate" class="form-control">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-calendar-alt"></i> ${t('debtorCreditor.toDate', 'إلى تاريخ')}</label>
                    <input type="date" id="endDate" class="form-control">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-users"></i> ${t('debtorCreditor.accountType', 'نوع الحساب')}</label>
                    <select id="typeFilter" class="form-control">
                        <option value="all">${t('debtorCreditor.allTypes', 'الكل')}</option>
                        <option value="customer">${t('debtorCreditor.customersType', 'عملاء')}</option>
                        <option value="supplier">${t('debtorCreditor.suppliersType', 'موردين')}</option>
                        <option value="both">${t('debtorCreditor.bothType', 'عميل ومورد معاً')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-filter"></i> ${t('debtorCreditor.balanceStatus', 'حالة الرصيد')}</label>
                    <select id="balanceStatusFilter" class="form-control">
                        <option value="all">${t('debtorCreditor.allStatuses', 'الكل')}</option>
                        <option value="debtor">${t('debtorCreditor.debtorStatus', 'لينا (مدين)')}</option>
                        <option value="creditor">${t('debtorCreditor.creditorStatus', 'علينا (دائن)')}</option>
                        <option value="balanced">${t('debtorCreditor.balancedStatus', 'متزن (صفر)')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-search"></i> ${t('debtorCreditor.searchByName', 'بحث بالاسم')}</label>
                    <input type="text" id="searchInput" class="form-control" placeholder="${t('debtorCreditor.searchPlaceholder', 'بحث باسم العميل/المورد...')}">
                </div>
                <div class="form-group" style="flex: 0;">
                    <label>&nbsp;</label>
                    <button id="printBtn" class="btn-print"><i class="fas fa-print"></i> ${t('debtorCreditor.printReport', 'طباعة التقرير')}</button>
                </div>
            </div>

            <div class="dc-table-card">
                <div class="dc-table-header">
                    <h3><i class="fas fa-table"></i> ${t('debtorCreditor.totalAccounts', 'إجمالي الحسابات')} <span class="count-badge" id="countBadge">0</span></h3>
                </div>
                <table class="dc-table">
                    <thead>
                        <tr>
                            <th>${t('debtorCreditor.tableHeaders.name', 'الاسم')}</th>
                            <th>${t('debtorCreditor.tableHeaders.type', 'النوع')}</th>
                            <th>${t('debtorCreditor.tableHeaders.openingBalance', 'رصيد افتتاحي')}</th>
                            <th>${t('debtorCreditor.tableHeaders.debit', 'لينا (مدين)')}</th>
                            <th>${t('debtorCreditor.tableHeaders.credit', 'علينا (دائن)')}</th>
                            <th>${t('debtorCreditor.tableHeaders.closingBalance', 'رصيد ختامي')}</th>
                            <th>${t('debtorCreditor.tableHeaders.status', 'الحالة')}</th>
                        </tr>
                    </thead>
                    <tbody id="reportTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

async function loadReport() {
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        customers = await window.electronAPI.getDebtorCreditorReport({ startDate, endDate });
        filterAndRender();
    } catch (error) {
        console.error('Error loading report:', error);
        showDebtorCreditorToast(t('debtorCreditor.loadError', 'حدث خطأ أثناء تحميل البيانات'), 'error');
    }
}

function setupEventListeners() {
    document.getElementById('typeFilter').addEventListener('change', filterAndRender);
    document.getElementById('balanceStatusFilter').addEventListener('change', filterAndRender);
    document.getElementById('searchInput').addEventListener('input', filterAndRender);
    document.getElementById('startDate').addEventListener('change', loadReport);
    document.getElementById('endDate').addEventListener('change', loadReport);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
}

function filterAndRender() {
    const typeFilter = document.getElementById('typeFilter').value;
    const balanceStatusFilter = document.getElementById('balanceStatusFilter').value;
    const searchText = document.getElementById('searchInput').value.toLowerCase();

    filteredCustomers = customers.filter(customer => {
        // Type Filter
        if (typeFilter !== 'all' && customer.type !== typeFilter) return false;

        // Search Filter
        if (searchText && !customer.name.toLowerCase().includes(searchText)) return false;

        // Balance Status Filter
        // Use closingBalance for status
        const balance = customer.closingBalance || 0;
        let status = 'balanced';
        
        if (balance > 0) status = 'debtor'; // They owe us
        else if (balance < 0) status = 'creditor'; // We owe them

        if (balanceStatusFilter !== 'all' && status !== balanceStatusFilter) return false;

        return true;
    });

    renderTable();
    updateSummary();
}

function renderTable() {
    const tbody = document.getElementById('reportTableBody');
    const countBadge = document.getElementById('countBadge');
    tbody.innerHTML = '';
    countBadge.textContent = filteredCustomers.length;

    if (filteredCustomers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="dc-empty"><i class="fas fa-inbox"></i><p>${t('debtorCreditor.noData', 'لا توجد بيانات')}</p></div></td></tr>`;
        return;
    }

    filteredCustomers.forEach(customer => {
        const tr = document.createElement('tr');
        const balance = customer.closingBalance || 0;
        let statusText = t('debtorCreditor.balancedLabel', 'متزن');
        let statusClass = 'dc-badge-balanced';
        let displayBalance = Math.abs(balance).toFixed(2);

        if (balance > 0) {
            statusText = t('debtorCreditor.debtorLabel', 'لينا (مدين)');
            statusClass = 'dc-badge-debtor';
        } else if (balance < 0) {
            statusText = t('debtorCreditor.creditorLabel', 'علينا (دائن)');
            statusClass = 'dc-badge-creditor';
        }

        let typeText = t('debtorCreditor.customerType', 'عميل');
        let typeClass = 'dc-badge-customer';
        if (customer.type === 'supplier') { typeText = t('debtorCreditor.supplierType', 'مورد'); typeClass = 'dc-badge-supplier'; }
        if (customer.type === 'both') { typeText = t('debtorCreditor.bothTypeLabel', 'عميل ومورد'); typeClass = 'dc-badge-both'; }

        tr.innerHTML = `
            <td>${customer.name}</td>
            <td><span class="dc-badge ${typeClass}">${typeText}</span></td>
            <td class="amount">${(customer.openingBalance || 0).toFixed(2)}</td>
            <td class="amount">${(customer.debitAmount || 0).toFixed(2)}</td>
            <td class="amount">${(customer.creditAmount || 0).toFixed(2)}</td>
            <td class="amount">${displayBalance}</td>
            <td><span class="dc-badge ${statusClass}">${statusText}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateSummary() {
    let totalDebtor = 0;
    let totalCreditor = 0;

    filteredCustomers.forEach(customer => {
        const balance = customer.closingBalance || 0;
        if (balance > 0) totalDebtor += balance;
        else if (balance < 0) totalCreditor += Math.abs(balance);
    });

    document.getElementById('totalDebtor').textContent = totalDebtor.toFixed(2);
    document.getElementById('totalCreditor').textContent = totalCreditor.toFixed(2);
    
    const net = totalDebtor - totalCreditor;
    const netElement = document.getElementById('netBalance');
    netElement.textContent = Math.abs(net).toFixed(2) + (net >= 0 ? ' ' + t('debtorCreditor.forUs', 'لينا (مدين)') : ' ' + t('debtorCreditor.againstUs', 'علينا (دائن)'));
    netElement.className = 'dc-card-value ' + (net >= 0 ? 'text-green' : 'text-red');
}
