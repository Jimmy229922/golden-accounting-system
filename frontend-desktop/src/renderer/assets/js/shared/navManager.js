async function loadNavigation(configPath = '../../assets/config/navigation.json') {
    const response = await fetch(configPath);
    if (!response.ok) {
        throw new Error(`Failed to load navigation config: ${response.status}`);
    }
    return response.json();
}

function isActiveLink(href) {
    if (!href) return false;
    const current = window.location.pathname.replace(/\\/g, '/');
    const target = new URL(href, window.location.href).pathname.replace(/\\/g, '/');
    return current.endsWith(target);
}

function buildNavigationHtml(items) {
    return items
        .map((item) => {
            const activeClass = isActiveLink(item.href) ? 'active' : '';
            return `<a class="nav-item ${activeClass}" href="${item.href}" data-nav-id="${item.id}">${item.label}</a>`;
        })
        .join('');
}

function normalizePath(value) {
    return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function isRunningInsideShellFrame() {
    try {
        return Boolean(window.top && window.top !== window && typeof window.top.__shellNavigate === 'function');
    } catch (_err) {
        return false;
    }
}

function tryShellNavigation(targetHref) {
    try {
        if (window.top && window.top !== window && typeof window.top.__shellNavigate === 'function') {
            return window.top.__shellNavigate(targetHref) === true;
        }

        if (typeof window.__shellNavigate === 'function') {
            return window.__shellNavigate(targetHref) === true;
        }
    } catch (_err) {
        // Ignore shell bridge errors and fallback to default navigation.
    }

    return false;
}

window.__navigateWithinShell = tryShellNavigation;

function resolveSharedConfirmDialog() {
    const candidates = [];

    try {
        candidates.push(window);
    } catch (_err) {
        // Ignore inaccessible window.
    }

    try {
        if (window.parent && window.parent !== window) {
            candidates.push(window.parent);
        }
    } catch (_err) {
        // Ignore cross-context errors.
    }

    try {
        if (window.top && !candidates.includes(window.top)) {
            candidates.push(window.top);
        }
    } catch (_err) {
        // Ignore cross-context errors.
    }

    for (const candidate of candidates) {
        try {
            if (candidate && typeof candidate.showConfirmDialog === 'function') {
                return candidate.showConfirmDialog.bind(candidate);
            }
        } catch (_err) {
            // Try next candidate.
        }
    }

    return null;
}

function ensureSharedConfirmDialogBridge() {
    if (typeof window.showConfirmDialog === 'function') return;

    const sharedConfirm = resolveSharedConfirmDialog();
    if (typeof sharedConfirm !== 'function') return;

    window.showConfirmDialog = (message, options) => sharedConfirm(message, options);
}

ensureSharedConfirmDialogBridge();

function resolveViewsPrefix(pathname = window.location.pathname) {
    const normalized = normalizePath(pathname);
    if (normalized.includes('/views/reports/debtor-creditor/')) {
        return '../../';
    }
    return '../';
}

function buildTopNavItems(prefix) {
    const withPrefix = (target) => `${prefix}${target}`;
    return [
        { key: 'common.nav.dashboard', fallback: 'Dashboard', href: withPrefix('dashboard/index.html') },
        {
            key: 'common.nav.masterData',
            fallback: 'Master Data',
            children: [
                { key: 'common.nav.units', fallback: 'Units', href: withPrefix('items/units.html') },
                { key: 'common.nav.items', fallback: 'Items', href: withPrefix('items/items.html') },
                { key: 'common.nav.customersSuppliers', fallback: 'Customers & Suppliers', href: withPrefix('customers/index.html') },
                { key: 'common.nav.openingBalance', fallback: 'Opening Balance', href: withPrefix('opening-balance/index.html') },
                { key: 'common.nav.userManagement', fallback: 'User Management', href: withPrefix('auth-users/index.html') }
            ]
        },
        {
            key: 'common.nav.sales',
            fallback: 'Sales',
            children: [
                { key: 'common.nav.salesInvoice', fallback: 'Sales Invoice', href: withPrefix('sales/index.html') },
                { key: 'common.nav.salesReturns', fallback: 'Sales Returns', href: withPrefix('sales-returns/index.html') },
                { key: '', fallback: 'إقفال وردية', href: withPrefix('sales/index.html?openShiftClose=1') }
            ]
        },
        {
            key: 'common.nav.purchases',
            fallback: 'Purchases',
            children: [
                { key: 'common.nav.purchaseInvoice', fallback: 'Purchase Invoice', href: withPrefix('purchases/index.html') },
                { key: 'common.nav.purchaseReturns', fallback: 'Purchase Returns', href: withPrefix('purchase-returns/index.html') }
            ]
        },
        { key: 'common.nav.inventory', fallback: 'Inventory', href: withPrefix('inventory/index.html') },
        { key: 'common.nav.finance', fallback: 'Finance', href: withPrefix('finance/index.html') },
        { key: 'common.nav.receipt', fallback: 'Receipt', href: withPrefix('payments/receipt.html') },
        { key: 'common.nav.payment', fallback: 'Payment', href: withPrefix('payments/payment.html') },
        {
            key: 'common.nav.reports',
            fallback: 'Reports',
            children: [
                { key: 'common.nav.generalReports', fallback: 'General Reports', href: withPrefix('reports/index.html') },
                { key: 'common.nav.customerReports', fallback: 'Customer Reports', href: withPrefix('customer-reports/index.html') },
                { key: 'common.nav.debtorCreditor', fallback: 'Debtor & Creditor', href: withPrefix('reports/debtor-creditor/index.html') }
            ]
        },
        { key: 'common.nav.settings', fallback: 'Settings', href: withPrefix('settings/index.html') }
    ];
}

const SHIFT_CLOSE_QUERY_KEY = 'openShiftClose';
const SHIFT_CLOSE_QUERY_VALUE = '1';

const salesShiftCloseState = {
    isOpen: false,
    eventsBound: false,
    preview: null,
    closings: [],
    editingId: null,
    searchTimer: null,
    previousBodyOverflow: '',
    dom: {
        overlay: null,
        periodStart: null,
        periodEnd: null,
        totalInput: null,
        collectionsInput: null,
        drawerInput: null,
        difference: null,
        notesInput: null,
        createdByInput: null,
        searchInput: null,
        tableBody: null,
        submitBtn: null,
        submitLabel: null
    }
};

function isShiftCloseHref(href) {
    if (!href) return false;
    try {
        const url = new URL(href, window.location.href);
        return url.searchParams.get(SHIFT_CLOSE_QUERY_KEY) === SHIFT_CLOSE_QUERY_VALUE;
    } catch (_) {
        return false;
    }
}

function normalizeShiftCloseNumberString(value) {
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

function parseShiftCloseFloat(value) {
    const normalized = normalizeShiftCloseNumberString(value);
    const num = parseFloat(normalized);
    return Number.isFinite(num) ? num : NaN;
}

function roundShiftCloseMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseShiftCloseMoneyInput(value, { allowEmpty = false } = {}) {
    const normalized = normalizeShiftCloseNumberString(value);
    if (normalized === '') {
        return allowEmpty ? null : NaN;
    }

    const parsed = parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return NaN;
    }

    return roundShiftCloseMoney(parsed);
}

function formatShiftCloseMoney(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0.00';
    return roundShiftCloseMoney(num).toFixed(2);
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

function getShiftCloseHistoryRowStatus(row = {}) {
    const hasDrawer = row?.drawer_amount !== null && row?.drawer_amount !== undefined && String(row.drawer_amount).trim() !== '';
    if (!hasDrawer) return 'missing';

    const totalValue = Number(row?.sales_paid_total);
    const drawerValue = Number(row?.drawer_amount);
    if (!Number.isFinite(totalValue) || !Number.isFinite(drawerValue)) {
        return 'mismatch';
    }

    const difference = roundShiftCloseMoney(drawerValue - totalValue);
    return difference === 0 ? 'match' : 'mismatch';
}

function escapeShiftCloseHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function notifyShiftClose(message, type = 'info') {
    if (!message) return;

    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }

    if (window.toast && typeof window.toast[type] === 'function') {
        window.toast[type](message);
        return;
    }

    if (type === 'error') {
        console.error('[sales-shift-close]', message);
        return;
    }

    console.log('[sales-shift-close]', message);
}

function resolveShiftCloseApi() {
    const api = window.electronAPI;
    if (!api) return null;

    const requiredMethods = [
        'getSalesShiftClosePreview',
        'createSalesShiftClosing',
        'getSalesShiftClosings',
        'updateSalesShiftClosing',
        'deleteSalesShiftClosing'
    ];

    const hasAllMethods = requiredMethods.every((method) => typeof api[method] === 'function');
    return hasAllMethods ? api : null;
}

function ensureShiftCloseStyles() {
    if (document.getElementById('global-sales-shift-close-styles')) return;

    const style = document.createElement('style');
    style.id = 'global-sales-shift-close-styles';
    style.textContent = `
        .gshift-overlay {
            position: fixed;
            inset: 0;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(6, 13, 28, 0.62);
            backdrop-filter: blur(4px);
            z-index: 120000;
        }

        .gshift-overlay.is-open {
            display: flex;
        }

        .gshift-modal {
            width: min(1180px, 100%);
            max-height: 92vh;
            overflow: auto;
            border: 1px solid var(--card-border, rgba(255, 255, 255, 0.15));
            border-radius: 16px;
            background:
                radial-gradient(circle at 88% -10%, rgba(37, 99, 235, 0.14), transparent 40%),
                var(--card-bg, #0f172a);
            box-shadow: 0 30px 70px rgba(0, 0, 0, 0.35);
        }

        .gshift-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 16px;
            border-bottom: 1px solid var(--card-border, rgba(255, 255, 255, 0.15));
        }

        .gshift-title {
            margin: 0;
            color: var(--text-color, #ffffff);
            font-size: 1.06rem;
            font-weight: 800;
        }

        .gshift-subtitle {
            margin: 4px 0 0;
            color: var(--text-muted, #94a3b8);
            font-size: 0.86rem;
        }

        .gshift-body {
            display: grid;
            gap: 12px;
            padding: 16px;
        }

        .gshift-summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
        }

        .gshift-summary-item {
            border: 1px solid var(--card-border, rgba(255, 255, 255, 0.15));
            border-radius: 10px;
            padding: 10px;
            background: var(--bg-color, rgba(15, 23, 42, 0.45));
            display: grid;
            gap: 4px;
        }

        .gshift-summary-item span {
            color: var(--text-muted, #94a3b8);
            font-size: 0.84rem;
        }

        .gshift-summary-item strong {
            color: var(--text-color, #ffffff);
            font-size: 0.96rem;
            font-weight: 800;
        }

        #globalShiftCloseDifference.gshift-positive {
            color: var(--success-color, #16a34a);
        }

        #globalShiftCloseDifference.gshift-negative {
            color: var(--danger-color, #dc2626);
        }

        .gshift-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }

        .gshift-group {
            display: grid;
            gap: 6px;
        }

        .gshift-group.gshift-notes {
            grid-column: 1 / -1;
        }

        .gshift-label {
            color: var(--text-color, #ffffff);
            font-size: 0.9rem;
            font-weight: 700;
        }

        .gshift-input {
            width: 100%;
            min-height: 44px;
            border-radius: 10px;
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.2));
            background: var(--input-bg, rgba(15, 23, 42, 0.6));
            color: var(--text-color, #ffffff);
            padding: 0 12px;
            outline: none;
        }

        .gshift-textarea {
            width: 100%;
            min-height: 74px;
            border-radius: 10px;
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.2));
            background: var(--input-bg, rgba(15, 23, 42, 0.6));
            color: var(--text-color, #ffffff);
            padding: 10px 12px;
            outline: none;
            resize: vertical;
        }

        .gshift-input:focus,
        .gshift-textarea:focus {
            border-color: var(--primary-color, #3b82f6);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        .gshift-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .gshift-btn {
            min-height: 42px;
            border-radius: 10px;
            border: 1px solid transparent;
            padding: 0 14px;
            cursor: pointer;
            color: var(--text-color, #ffffff);
            background: rgba(51, 65, 85, 0.6);
            font-weight: 700;
        }

        .gshift-btn:hover {
            filter: brightness(1.08);
        }

        .gshift-btn-outline {
            border-color: var(--input-border, rgba(255, 255, 255, 0.2));
            background: transparent;
        }

        .gshift-btn-primary {
            background: linear-gradient(135deg, rgba(21, 128, 61, 0.92), rgba(5, 150, 105, 0.88));
            min-width: 240px;
        }

        .gshift-btn-primary.is-loading {
            opacity: 0.65;
            cursor: not-allowed;
        }

        .gshift-history-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }

        .gshift-history-title {
            margin: 0;
            color: var(--text-color, #ffffff);
            font-size: 0.96rem;
            font-weight: 800;
        }

        .gshift-search {
            max-width: 320px;
        }

        .gshift-table-wrap {
            border: 1px solid var(--table-border, rgba(255, 255, 255, 0.16));
            border-radius: 12px;
            overflow: auto;
            background: var(--card-bg, #0f172a);
        }

        .gshift-table {
            width: 100%;
            min-width: 1060px;
            border-collapse: collapse;
        }

        .gshift-table th,
        .gshift-table td {
            font-size: 0.84rem;
            padding: 10px 8px;
            text-align: center;
            border-bottom: 1px solid var(--table-border, rgba(255, 255, 255, 0.16));
            color: var(--text-color, #ffffff);
        }

        .gshift-table th {
            background: rgba(30, 41, 59, 0.62);
            font-weight: 800;
        }

        .gshift-table tr.gshift-status-match td:first-child {
            border-inline-start: 4px solid var(--success-color, #16a34a);
        }

        .gshift-table tr.gshift-status-mismatch td:first-child {
            border-inline-start: 4px solid var(--danger-color, #dc2626);
        }

        .gshift-table tr.gshift-status-missing td:first-child {
            border-inline-start: 4px solid var(--warning-color, #f59e0b);
        }

        .gshift-note-cell {
            max-width: 240px;
            text-align: start;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .gshift-row-actions {
            display: inline-flex;
            gap: 6px;
        }

        .gshift-row-actions .gshift-btn {
            min-height: 34px;
            padding: 0 10px;
            font-size: 0.8rem;
        }

        .gshift-empty {
            color: var(--text-muted, #94a3b8);
            font-weight: 700;
            padding: 20px;
        }

        @media (max-width: 980px) {
            .gshift-summary-grid,
            .gshift-form-grid {
                grid-template-columns: 1fr;
            }

            .gshift-history-head {
                align-items: stretch;
                flex-direction: column;
            }

            .gshift-search,
            .gshift-btn-primary {
                width: 100%;
                max-width: 100%;
            }
        }
    `;

    document.head.appendChild(style);
}

function assignShiftCloseDomRefs() {
    salesShiftCloseState.dom.overlay = document.getElementById('globalSalesShiftCloseModal');
    salesShiftCloseState.dom.periodStart = document.getElementById('globalShiftClosePeriodStart');
    salesShiftCloseState.dom.periodEnd = document.getElementById('globalShiftClosePeriodEnd');
    salesShiftCloseState.dom.totalInput = document.getElementById('globalShiftCloseTotal');
    salesShiftCloseState.dom.collectionsInput = document.getElementById('globalShiftCloseCollections');
    salesShiftCloseState.dom.drawerInput = document.getElementById('globalShiftCloseDrawer');
    salesShiftCloseState.dom.difference = document.getElementById('globalShiftCloseDifference');
    salesShiftCloseState.dom.notesInput = document.getElementById('globalShiftCloseNotes');
    salesShiftCloseState.dom.createdByInput = document.getElementById('globalShiftCloseCreatedBy');
    salesShiftCloseState.dom.searchInput = document.getElementById('globalShiftCloseSearch');
    salesShiftCloseState.dom.tableBody = document.getElementById('globalShiftCloseTableBody');
    salesShiftCloseState.dom.submitBtn = document.getElementById('globalShiftCloseSubmitBtn');
    salesShiftCloseState.dom.submitLabel = document.getElementById('globalShiftCloseSubmitLabel');
}

function ensureShiftCloseModal() {
    ensureShiftCloseStyles();

    let overlay = document.getElementById('globalSalesShiftCloseModal');
    if (!overlay) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div id="globalSalesShiftCloseModal" class="gshift-overlay" aria-hidden="true">
                <div class="gshift-modal" role="dialog" aria-modal="true" aria-label="إقفال وردية المبيعات">
                    <div class="gshift-header">
                        <div>
                            <h3 class="gshift-title">إقفال وردية المبيعات</h3>
                            <p class="gshift-subtitle">إجمالي المقبوض من آخر إقفال حتى الآن للمقارنة مع درج الكاش.</p>
                        </div>
                        <button type="button" class="gshift-btn gshift-btn-outline" data-shift-action="close">إغلاق</button>
                    </div>

                    <div class="gshift-body">
                        <div class="gshift-summary-grid">
                            <div class="gshift-summary-item">
                                <span>بداية الفترة</span>
                                <strong id="globalShiftClosePeriodStart">-</strong>
                            </div>
                            <div class="gshift-summary-item">
                                <span>نهاية الفترة</span>
                                <strong id="globalShiftClosePeriodEnd">-</strong>
                            </div>
                            <div class="gshift-summary-item">
                                <span>الفرق</span>
                                <strong id="globalShiftCloseDifference">0.00</strong>
                            </div>
                        </div>

                        <div class="gshift-form-grid">
                            <div class="gshift-group">
                                <label class="gshift-label">إجمالي المقبوض من المبيعات</label>
                                <input type="number" id="globalShiftCloseTotal" class="gshift-input" min="0" step="0.01" value="0.00">
                            </div>
                            <div class="gshift-group">
                                <label class="gshift-label">إجمالي تحصيل العملاء</label>
                                <input type="number" id="globalShiftCloseCollections" class="gshift-input" min="0" step="0.01" value="0.00" readonly>
                            </div>
                            <div class="gshift-group">
                                <label class="gshift-label">المبلغ الفعلي في الدرج (اختياري)</label>
                                <input type="number" id="globalShiftCloseDrawer" class="gshift-input" min="0" step="0.01" placeholder="اختياري">
                            </div>
                            <div class="gshift-group">
                                <label class="gshift-label">المستخدم</label>
                                <input type="text" id="globalShiftCloseCreatedBy" class="gshift-input" placeholder="اسم المستخدم الحالي">
                            </div>
                            <div class="gshift-group gshift-notes">
                                <label class="gshift-label">ملاحظة</label>
                                <textarea id="globalShiftCloseNotes" class="gshift-textarea" rows="2" placeholder="ملاحظة اختيارية"></textarea>
                            </div>
                        </div>

                        <div class="gshift-actions">
                            <button type="button" class="gshift-btn gshift-btn-outline" data-shift-action="refresh">تحديث الرقم</button>
                            <button type="button" class="gshift-btn gshift-btn-outline" data-shift-action="reset">تهيئة نموذج الإقفال</button>
                            <button id="globalShiftCloseSubmitBtn" type="button" class="gshift-btn gshift-btn-primary" data-shift-action="submit">
                                <span id="globalShiftCloseSubmitLabel">تأكيد الإقفال وترحيل المالية</span>
                            </button>
                        </div>

                        <div class="gshift-history-head">
                            <h4 class="gshift-history-title">سجل إقفالات الوردية</h4>
                            <input type="text" id="globalShiftCloseSearch" class="gshift-input gshift-search" placeholder="بحث في سجل الإقفالات">
                        </div>

                        <div class="gshift-table-wrap">
                            <table class="gshift-table">
                                <thead>
                                    <tr>
                                        <th>رقم الإقفال</th>
                                        <th>من</th>
                                        <th>إلى</th>
                                        <th>إجمالي مرحل</th>
                                        <th>الدرج</th>
                                        <th>الفرق</th>
                                        <th>المستخدم</th>
                                        <th>ملاحظة</th>
                                        <th>آخر تعديل</th>
                                        <th>إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody id="globalShiftCloseTableBody">
                                    <tr>
                                        <td colspan="10" class="gshift-empty">لا توجد إقفالات مسجلة حتى الآن.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        overlay = wrapper.querySelector('#globalSalesShiftCloseModal');
        if (overlay) {
            document.body.appendChild(overlay);
        }
    }

    assignShiftCloseDomRefs();
    bindShiftCloseModalEvents();
}

function setShiftCloseSubmitMode(isEditMode) {
    const submitLabel = salesShiftCloseState.dom.submitLabel;
    const submitBtn = salesShiftCloseState.dom.submitBtn;
    const totalInput = salesShiftCloseState.dom.totalInput;
    if (!submitLabel || !submitBtn) return;

    if (isEditMode) {
        submitLabel.textContent = 'حفظ تعديل الإقفال';
        submitBtn.title = 'تحديث سجل الإقفال مع تعديل رصيد المالية';
        if (totalInput) {
            totalInput.readOnly = false;
            totalInput.title = 'يمكنك تعديل إجمالي المرحل عند مراجعة السجل';
        }
        return;
    }

    submitLabel.textContent = 'تأكيد الإقفال وترحيل المالية';
    submitBtn.title = 'ترحيل إجمالي المقبوض إلى المالية كعملية واحدة';
    if (totalInput) {
        totalInput.readOnly = true;
        totalInput.title = 'يتم احتساب الإجمالي تلقائيًا من مدفوع فواتير البيع';
    }
}

function updateShiftCloseDifferenceDisplay() {
    const differenceEl = salesShiftCloseState.dom.difference;
    if (!differenceEl) return;

    const salesOnlyValue = parseShiftCloseMoneyInput(salesShiftCloseState.dom.totalInput?.value, { allowEmpty: false });
    const collectionsValue = parseShiftCloseMoneyInput(salesShiftCloseState.dom.collectionsInput?.value, { allowEmpty: false });
    const drawerValue = parseShiftCloseMoneyInput(salesShiftCloseState.dom.drawerInput?.value, { allowEmpty: true });

    differenceEl.classList.remove('gshift-positive', 'gshift-negative');

    if (!Number.isFinite(salesOnlyValue) || !Number.isFinite(collectionsValue)) {
        differenceEl.textContent = '0.00';
        return;
    }

    if (Number.isNaN(drawerValue) || drawerValue === null) {
        differenceEl.textContent = '0.00';
        return;
    }

    const totalTransferred = roundShiftCloseMoney(salesOnlyValue + collectionsValue);
    const difference = roundShiftCloseMoney(drawerValue - totalTransferred);
    differenceEl.textContent = difference.toFixed(2);

    if (difference > 0) {
        differenceEl.classList.add('gshift-positive');
    } else if (difference < 0) {
        differenceEl.classList.add('gshift-negative');
    }
}

function applyShiftClosePreviewToUi(preview) {
    if (salesShiftCloseState.dom.periodStart) {
        salesShiftCloseState.dom.periodStart.textContent = formatShiftCloseDateTime(preview?.period_start_at);
    }

    if (salesShiftCloseState.dom.periodEnd) {
        salesShiftCloseState.dom.periodEnd.textContent = formatShiftCloseDateTime(preview?.period_end_at);
    }

    if (salesShiftCloseState.dom.collectionsInput) {
        const collectionsTotal = Number(preview?.customer_collections_total);
        salesShiftCloseState.dom.collectionsInput.value = Number.isFinite(collectionsTotal)
            ? formatShiftCloseMoney(collectionsTotal)
            : '0.00';
    }
}

function setShiftCloseSubmitLoading(loading) {
    const submitBtn = salesShiftCloseState.dom.submitBtn;
    if (!submitBtn) return;

    submitBtn.disabled = Boolean(loading);
    submitBtn.classList.toggle('is-loading', Boolean(loading));
}

async function resolveShiftCloseUsername() {
    try {
        const api = window.electronAPI;
        if (!api || typeof api.getActiveAuthUser !== 'function') {
            return '';
        }

        let sessionToken = '';
        if (typeof api.getAuthSessionToken === 'function') {
            sessionToken = await api.getAuthSessionToken();
        }

        const activeUser = await api.getActiveAuthUser({ sessionToken });
        return String(activeUser?.username || '').trim();
    } catch (_error) {
        return '';
    }
}

async function hydrateShiftCloseUserField() {
    const createdByInput = salesShiftCloseState.dom.createdByInput;
    if (!createdByInput) return;

    if (String(createdByInput.value || '').trim() !== '') {
        return;
    }

    const username = await resolveShiftCloseUsername();
    if (username) {
        createdByInput.value = username;
    }
}

function renderShiftCloseHistoryRows() {
    const tableBody = salesShiftCloseState.dom.tableBody;
    if (!tableBody) return;

    const rows = Array.isArray(salesShiftCloseState.closings) ? salesShiftCloseState.closings : [];
    if (!rows.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="gshift-empty">لا توجد إقفالات مسجلة حتى الآن.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = rows.map((row) => {
        const rowId = Number(row?.id) || 0;
        const isEditing = Number(salesShiftCloseState.editingId) === rowId;
        const rowStatus = getShiftCloseHistoryRowStatus(row);
        const rowClass = rowStatus === 'match'
            ? 'gshift-status-match'
            : rowStatus === 'mismatch'
                ? 'gshift-status-mismatch'
                : 'gshift-status-missing';
        const periodStart = formatShiftCloseDateTime(row?.period_start_at);
        const periodEnd = formatShiftCloseDateTime(row?.period_end_at);
        const total = formatShiftCloseMoney(row?.sales_paid_total);

        const hasDrawer = row?.drawer_amount !== null && row?.drawer_amount !== undefined && String(row.drawer_amount).trim() !== '';
        const drawer = hasDrawer ? formatShiftCloseMoney(row.drawer_amount) : '-';

        const hasDifference = row?.difference_amount !== null && row?.difference_amount !== undefined && String(row.difference_amount).trim() !== '';
        const difference = hasDifference ? formatShiftCloseMoney(row.difference_amount) : '-';

        const createdBy = row?.created_by ? escapeShiftCloseHtml(row.created_by) : '-';
        const notes = row?.notes ? escapeShiftCloseHtml(row.notes) : '-';
        const updatedAt = row?.updated_at ? formatShiftCloseDateTime(row.updated_at) : '-';

        return `
            <tr class="${rowClass}">
                <td>${rowId}</td>
                <td>${escapeShiftCloseHtml(periodStart)}</td>
                <td>${escapeShiftCloseHtml(periodEnd)}</td>
                <td>${total}</td>
                <td>${drawer}</td>
                <td>${difference}</td>
                <td>${createdBy}</td>
                <td class="gshift-note-cell" title="${notes}">${notes}</td>
                <td>${escapeShiftCloseHtml(updatedAt)}</td>
                <td>
                    <div class="gshift-row-actions">
                        <button type="button" class="gshift-btn gshift-btn-outline" data-shift-action="edit" data-id="${rowId}">${isEditing ? 'جاري التعديل' : 'تعديل'}</button>
                        <button type="button" class="gshift-btn gshift-btn-outline" data-shift-action="delete" data-id="${rowId}">حذف</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadShiftCloseHistory() {
    const api = resolveShiftCloseApi();
    if (!api) {
        notifyShiftClose('واجهة إقفال الوردية غير متاحة في هذه الصفحة', 'error');
        return;
    }

    const search = String(salesShiftCloseState.dom.searchInput?.value || '').trim();
    const result = await api.getSalesShiftClosings({ search });

    if (!result || !result.success) {
        notifyShiftClose((result && result.error) || 'تعذر تحميل سجل إقفالات الوردية', 'error');
        return;
    }

    salesShiftCloseState.closings = Array.isArray(result.closings) ? result.closings : [];
    renderShiftCloseHistoryRows();
}

function queueShiftCloseHistoryRefresh() {
    if (salesShiftCloseState.searchTimer) {
        clearTimeout(salesShiftCloseState.searchTimer);
    }

    salesShiftCloseState.searchTimer = setTimeout(() => {
        loadShiftCloseHistory();
    }, 180);
}

function resetShiftCloseForm({ keepSearch = false } = {}) {
    salesShiftCloseState.editingId = null;
    setShiftCloseSubmitMode(false);

    if (!keepSearch && salesShiftCloseState.dom.searchInput) {
        salesShiftCloseState.dom.searchInput.value = '';
    }

    if (salesShiftCloseState.dom.notesInput) {
        salesShiftCloseState.dom.notesInput.value = '';
    }

    if (salesShiftCloseState.dom.drawerInput) {
        salesShiftCloseState.dom.drawerInput.value = '';
    }

    if (salesShiftCloseState.dom.totalInput) {
        const previewTotal = salesShiftCloseState.preview?.sales_only_total;
        salesShiftCloseState.dom.totalInput.value = Number.isFinite(Number(previewTotal))
            ? formatShiftCloseMoney(previewTotal)
            : '0.00';
    }

    if (salesShiftCloseState.dom.collectionsInput) {
        const previewCollections = salesShiftCloseState.preview?.customer_collections_total;
        salesShiftCloseState.dom.collectionsInput.value = Number.isFinite(Number(previewCollections))
            ? formatShiftCloseMoney(previewCollections)
            : '0.00';
    }

    applyShiftClosePreviewToUi(salesShiftCloseState.preview || null);
    updateShiftCloseDifferenceDisplay();
    hydrateShiftCloseUserField();
    renderShiftCloseHistoryRows();
}

async function refreshShiftClosePreview({ keepCurrentAmounts = false } = {}) {
    const api = resolveShiftCloseApi();
    if (!api) {
        notifyShiftClose('واجهة إقفال الوردية غير متاحة في هذه الصفحة', 'error');
        return false;
    }

    const result = await api.getSalesShiftClosePreview();
    if (!result || !result.success) {
        notifyShiftClose((result && result.error) || 'تعذر تحميل إجمالي المقبوض للفترة الحالية', 'error');
        return false;
    }

    salesShiftCloseState.preview = result;
    applyShiftClosePreviewToUi(result);

    if (!keepCurrentAmounts && !salesShiftCloseState.editingId && salesShiftCloseState.dom.totalInput) {
        const salesOnlyTotal = Number(result.sales_only_total);
        salesShiftCloseState.dom.totalInput.value = Number.isFinite(salesOnlyTotal)
            ? formatShiftCloseMoney(salesOnlyTotal)
            : formatShiftCloseMoney(result.sales_paid_total);
    }

    updateShiftCloseDifferenceDisplay();
    return true;
}

function editShiftCloseFromRowId(id) {
    const rowId = Number(id);
    if (!Number.isFinite(rowId) || rowId <= 0) return;

    const row = (salesShiftCloseState.closings || []).find((entry) => Number(entry?.id) === rowId);
    if (!row) return;

    salesShiftCloseState.editingId = rowId;
    setShiftCloseSubmitMode(true);

    if (salesShiftCloseState.dom.periodStart) {
        salesShiftCloseState.dom.periodStart.textContent = formatShiftCloseDateTime(row.period_start_at);
    }

    if (salesShiftCloseState.dom.periodEnd) {
        salesShiftCloseState.dom.periodEnd.textContent = formatShiftCloseDateTime(row.period_end_at);
    }

    if (salesShiftCloseState.dom.collectionsInput) {
        const collectionsTotal = Number(row.customer_collections_total);
        const normalizedCollectionsTotal = Number.isFinite(collectionsTotal)
            ? roundShiftCloseMoney(Math.max(collectionsTotal, 0))
            : 0;
        salesShiftCloseState.dom.collectionsInput.value = formatShiftCloseMoney(normalizedCollectionsTotal);

        const rowTransferredTotal = Number(row.sales_paid_total);
        const salesOnlyTotal = Number.isFinite(rowTransferredTotal)
            ? roundShiftCloseMoney(Math.max(rowTransferredTotal - normalizedCollectionsTotal, 0))
            : 0;
        if (salesShiftCloseState.dom.totalInput) {
            salesShiftCloseState.dom.totalInput.value = formatShiftCloseMoney(salesOnlyTotal);
        }
    } else if (salesShiftCloseState.dom.totalInput) {
        salesShiftCloseState.dom.totalInput.value = formatShiftCloseMoney(row.sales_paid_total);
    }

    if (salesShiftCloseState.dom.drawerInput) {
        const hasDrawer = row.drawer_amount !== null && row.drawer_amount !== undefined && String(row.drawer_amount).trim() !== '';
        salesShiftCloseState.dom.drawerInput.value = hasDrawer ? formatShiftCloseMoney(row.drawer_amount) : '';
    }

    if (salesShiftCloseState.dom.notesInput) {
        salesShiftCloseState.dom.notesInput.value = row.notes || '';
    }

    if (salesShiftCloseState.dom.createdByInput) {
        salesShiftCloseState.dom.createdByInput.value = row.created_by || salesShiftCloseState.dom.createdByInput.value || '';
    }

    updateShiftCloseDifferenceDisplay();
    renderShiftCloseHistoryRows();
}

async function deleteShiftCloseFromRowId(id) {
    const rowId = Number(id);
    if (!Number.isFinite(rowId) || rowId <= 0) return;

    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog('هل أنت متأكد من حذف سجل الإقفال؟ سيتم خصم قيمته من المالية.')
        : false;
    if (!confirmed) return;

    const api = resolveShiftCloseApi();
    if (!api) {
        notifyShiftClose('واجهة إقفال الوردية غير متاحة في هذه الصفحة', 'error');
        return;
    }

    const result = await api.deleteSalesShiftClosing(rowId);
    if (!result || !result.success) {
        notifyShiftClose((result && result.error) || 'تعذر حذف سجل الإقفال', 'error');
        return;
    }

    notifyShiftClose('تم حذف سجل الإقفال وتحديث المالية', 'success');

    if (Number(salesShiftCloseState.editingId) === rowId) {
        resetShiftCloseForm({ keepSearch: true });
    }

    await refreshShiftClosePreview({ keepCurrentAmounts: false });
    await loadShiftCloseHistory();
}

async function submitShiftClose() {
    const salesOnlyValue = parseShiftCloseMoneyInput(salesShiftCloseState.dom.totalInput?.value, { allowEmpty: false });
    if (!Number.isFinite(salesOnlyValue) || salesOnlyValue < 0) {
        notifyShiftClose('يرجى إدخال إجمالي صحيح (صفر أو أكثر)', 'error');
        return;
    }

    const collectionsValue = parseShiftCloseMoneyInput(salesShiftCloseState.dom.collectionsInput?.value, { allowEmpty: false });
    if (!Number.isFinite(collectionsValue) || collectionsValue < 0) {
        notifyShiftClose('قيمة إجمالي تحصيل العملاء غير صحيحة', 'error');
        return;
    }

    const totalTransferred = roundShiftCloseMoney(salesOnlyValue + collectionsValue);
    const drawerValue = parseShiftCloseMoneyInput(salesShiftCloseState.dom.drawerInput?.value, { allowEmpty: true });
    if (Number.isNaN(drawerValue)) {
        notifyShiftClose('قيمة الدرج الفعلية غير صحيحة', 'error');
        return;
    }

    const api = resolveShiftCloseApi();
    if (!api) {
        notifyShiftClose('واجهة إقفال الوردية غير متاحة في هذه الصفحة', 'error');
        return;
    }

    const notes = String(salesShiftCloseState.dom.notesInput?.value || '').trim();
    let createdBy = String(salesShiftCloseState.dom.createdByInput?.value || '').trim();
    if (!createdBy) {
        createdBy = await resolveShiftCloseUsername();
        if (createdBy && salesShiftCloseState.dom.createdByInput) {
            salesShiftCloseState.dom.createdByInput.value = createdBy;
        }
    }

    setShiftCloseSubmitLoading(true);
    try {
        const editingId = Number(salesShiftCloseState.editingId);
        const isEditMode = Number.isFinite(editingId) && editingId > 0;
        let result;

        if (isEditMode) {
            result = await api.updateSalesShiftClosing({
                id: editingId,
                sales_paid_total: totalTransferred,
                customer_collections_total: collectionsValue,
                drawer_amount: drawerValue,
                notes,
                created_by: createdBy,
                updated_by: createdBy
            });
        } else {
            result = await api.createSalesShiftClosing({
                drawer_amount: drawerValue,
                notes,
                created_by: createdBy,
                period_end_at: new Date().toISOString()
            });
        }

        if (!result || !result.success) {
            notifyShiftClose((result && result.error) || 'تعذر حفظ إقفال الوردية', 'error');
            return;
        }

        notifyShiftClose(isEditMode ? 'تم تعديل الإقفال وتحديث المالية' : 'تم إقفال الوردية وترحيل القيمة إلى المالية', 'success');

        await refreshShiftClosePreview({ keepCurrentAmounts: false });
        resetShiftCloseForm({ keepSearch: true });
        await loadShiftCloseHistory();
    } catch (error) {
        notifyShiftClose(error.message || 'حدث خطأ أثناء حفظ الإقفال', 'error');
    } finally {
        setShiftCloseSubmitLoading(false);
    }
}

function bindShiftCloseModalEvents() {
    if (salesShiftCloseState.eventsBound) return;

    const overlay = salesShiftCloseState.dom.overlay;
    if (!overlay) return;

    overlay.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-shift-action]');
        if (actionEl) {
            const action = actionEl.getAttribute('data-shift-action');

            if (action === 'close') {
                closeSalesShiftCloseModal();
                return;
            }

            if (action === 'refresh') {
                refreshShiftClosePreview({ keepCurrentAmounts: false });
                return;
            }

            if (action === 'reset') {
                resetShiftCloseForm({ keepSearch: true });
                return;
            }

            if (action === 'submit') {
                submitShiftClose();
                return;
            }

            if (action === 'edit') {
                editShiftCloseFromRowId(actionEl.dataset.id);
                return;
            }

            if (action === 'delete') {
                deleteShiftCloseFromRowId(actionEl.dataset.id);
                return;
            }
        }

        if (event.target === overlay) {
            closeSalesShiftCloseModal();
        }
    });

    if (salesShiftCloseState.dom.searchInput) {
        salesShiftCloseState.dom.searchInput.addEventListener('input', queueShiftCloseHistoryRefresh);
    }

    if (salesShiftCloseState.dom.drawerInput) {
        salesShiftCloseState.dom.drawerInput.addEventListener('input', updateShiftCloseDifferenceDisplay);
    }

    if (salesShiftCloseState.dom.totalInput) {
        salesShiftCloseState.dom.totalInput.addEventListener('input', updateShiftCloseDifferenceDisplay);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (!salesShiftCloseState.isOpen) return;
        closeSalesShiftCloseModal();
    });

    salesShiftCloseState.eventsBound = true;
}

async function openSalesShiftCloseModal() {
    ensureShiftCloseModal();

    const overlay = salesShiftCloseState.dom.overlay;
    if (!overlay) return false;

    if (!salesShiftCloseState.isOpen) {
        salesShiftCloseState.previousBodyOverflow = document.body.style.overflow || '';
    }

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    salesShiftCloseState.isOpen = true;

    await hydrateShiftCloseUserField();
    await refreshShiftClosePreview({ keepCurrentAmounts: false });
    resetShiftCloseForm({ keepSearch: true });
    await loadShiftCloseHistory();
    return true;
}

function closeSalesShiftCloseModal() {
    const overlay = salesShiftCloseState.dom.overlay;
    if (!overlay) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');

    document.body.style.overflow = salesShiftCloseState.previousBodyOverflow || '';
    salesShiftCloseState.isOpen = false;
}

function isTopNavLinkActive(href) {
    if (!href) return false;
    if (isShiftCloseHref(href)) return false;
    try {
        const current = normalizePath(window.location.pathname);
        const target = normalizePath(new URL(href, window.location.href).pathname);
        return current.endsWith(target);
    } catch (_) {
        return false;
    }
}

function buildTopNavLink(item, t) {
    const activeClass = isTopNavLinkActive(item.href) ? ' class="active"' : '';
    return `<li><a href="${item.href}"${activeClass}>${t(item.key, item.fallback)}</a></li>`;
}

function buildTopNavDropdown(item, t) {
    const hasActiveChild = item.children.some((child) => isTopNavLinkActive(child.href));
    const activeClass = hasActiveChild ? ' class="active"' : '';
    const childrenHtml = item.children
        .map((child) => {
            const childActive = isTopNavLinkActive(child.href) ? ' class="active"' : '';
            return `<a href="${child.href}"${childActive}>${t(child.key, child.fallback)}</a>`;
        })
        .join('');

    return `
        <li class="dropdown">
            <a href="#"${activeClass}>${t(item.key, item.fallback)}</a>
            <div class="dropdown-content">
                ${childrenHtml}
            </div>
        </li>
    `;
}

function getTopNavHTML(t, options = {}) {
    if (isRunningInsideShellFrame()) {
        return '';
    }

    const translate = typeof t === 'function' ? t : ((_, fallback = '') => fallback);
    const basePrefix = options.basePrefix || resolveViewsPrefix(options.pathname);
    const wrap = options.wrap !== false;

    const items = buildTopNavItems(basePrefix);
    const linksHtml = items
        .map((item) => (item.children ? buildTopNavDropdown(item, translate) : buildTopNavLink(item, translate)))
        .join('');

    const innerHtml = `
        <div class="nav-brand">${translate('common.nav.brand', 'Accounting System')}</div>
        <ul class="nav-links">${linksHtml}</ul>
    `;

    if (!wrap) {
        return innerHtml;
    }

    return `<nav class="top-nav">${innerHtml}</nav>`;
}

async function renderNavigation(targetSelector, configPath) {
    const target = document.querySelector(targetSelector);
    if (!target) return;

    try {
        const items = await loadNavigation(configPath);
        target.innerHTML = buildNavigationHtml(items);
    } catch (error) {
        console.error('[navManager] failed to render navigation', error);
    }
}

window.navManager = {
    loadNavigation,
    renderNavigation,
    getTopNavItems: buildTopNavItems,
    resolveViewsPrefix,
    getTopNavHTML,
    openSalesShiftCloseModal,
    closeSalesShiftCloseModal
};

document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    // Handle only top navbar links
    const link = e.target.closest('.top-nav a');
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) return;

    if (isShiftCloseHref(href)) {
        e.preventDefault();
        openSalesShiftCloseModal();
        return;
    }

    const currentUrl = new URL(window.location.href);
    const targetUrl = new URL(link.href, window.location.href);
    const isSamePage =
        normalizePath(currentUrl.pathname) === normalizePath(targetUrl.pathname) &&
        currentUrl.search === targetUrl.search &&
        currentUrl.hash === targetUrl.hash;

    if (isSamePage) {
        e.preventDefault();
        return;
    }

    // Navigate immediately without delay
    e.preventDefault();
    if (!tryShellNavigation(targetUrl.href)) {
        window.location.href = targetUrl.href;
    }
});
