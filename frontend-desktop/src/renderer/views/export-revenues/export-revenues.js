let ar = {};
const { t } = window.i18n?.createPageHelpers?.(() => ar) || { t: (_k, fallback = '') => fallback };

const state = {
    page: 1,
    pageSize: 50,
    totalPages: 1,
    rows: [],
    editingId: null,
    totalAmount: 0,
    totalEgp: 0,
    totalCount: 0
};

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function showMessage(message, type = 'info') {
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }

    if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
        Toast.show(message, type);
        return;
    }

    console.log(message);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeNumberString(value) {
    if (value === null || value === undefined) return '';
    let s = String(value).trim();
    if (!s) return '';

    const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
    const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';

    s = s.replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)));
    s = s.replace(/[۰-۹]/g, (d) => String(easternArabicIndic.indexOf(d)));
    s = s.replace(/[٬,]/g, '');
    s = s.replace(/[٫]/g, '.');
    s = s.replace(/[^0-9.]/g, '');

    const parts = s.split('.');
    if (parts.length > 2) {
        s = `${parts.shift()}.${parts.join('')}`;
    }

    return s;
}

function parseNumberInput(value) {
    const normalized = normalizeNumberString(value);
    if (!normalized) return NaN;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : NaN;
}

function formatNumber(value, options = {}) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';

    const min = Number.isFinite(options.min) ? options.min : 0;
    const max = Number.isFinite(options.max) ? options.max : 2;

    return num.toLocaleString('en-US', {
        minimumFractionDigits: min,
        maximumFractionDigits: max
    });
}

function formatInputValue(rawValue) {
    const normalized = normalizeNumberString(rawValue);
    if (!normalized) return '';

    const hasTrailingDot = normalized.endsWith('.');
    const decimals = normalized.includes('.') ? normalized.split('.')[1] : '';
    const num = Number(normalized);

    if (!Number.isFinite(num)) return '';

    const fractionLength = Math.min(decimals.length, 2);
    const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: fractionLength,
        maximumFractionDigits: 2
    });

    return hasTrailingDot ? `${formatted}.` : formatted;
}

function formatWeekday(dateValue) {
    if (!dateValue) return '-';
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ar-EG', { weekday: 'long' });
}

function updateEgyptianAmount() {
    const amount = parseNumberInput(document.getElementById('amountInput').value);
    const rate = parseNumberInput(document.getElementById('exchangeRateInput').value);
    const egyptianInput = document.getElementById('amountEgp');

    if (!Number.isFinite(amount) || !Number.isFinite(rate)) {
        egyptianInput.value = '';
        return;
    }

    const total = amount * rate;
    egyptianInput.value = formatNumber(total);
}

function attachNumberFormatting(input) {
    input.addEventListener('input', () => {
        const formatted = formatInputValue(input.value);
        input.value = formatted;
        updateEgyptianAmount();
    });
}

function getRowById(id) {
    return state.rows.find((row) => String(row.id) === String(id));
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    renderPage();
    bindEvents();
    document.getElementById('recordDate').value = today();
    await refreshDocumentNumber();
    await loadRecords();
});

function renderPage() {
    document.getElementById('app').innerHTML = `
        ${buildTopNavHTML()}
        <main class="petty-page export-revenues-page">
            <section class="petty-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                </div>
                <div class="hero-content">
                    <h1>إيرادات التصدير</h1>
                    <p>تسجيل ومتابعة إيرادات التصدير اليومية</p>
                </div>
                <div class="hero-bottom">
                    <div class="petty-hero-actions">
                        <button type="button" class="btn btn-primary" id="openAddModalBtn" style="padding: 10px 24px; font-weight: bold; border-radius: 8px;">
                            <i class="fas fa-plus"></i>
                            تسجيل إيراد تصدير
                        </button>
                        <button type="button" class="btn btn-outline" id="exportPdfBtn">
                            <i class="fas fa-file-pdf"></i>
                            تصدير PDF
                        </button>
                    </div>
                </div>
            </section>

            <section class="stats-container petty-stats">
                <div class="stat-card stat-amount">
                    <div class="stat-icon"><i class="fas fa-coins"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي المبالغ</div>
                        <div class="stat-value" id="exportRevenuesTotalAmount">0</div>
                    </div>
                </div>
                <div class="stat-card stat-egp">
                    <div class="stat-icon"><i class="fas fa-sack-dollar"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي المصري</div>
                        <div class="stat-value" id="exportRevenuesTotalEgp">0</div>
                    </div>
                </div>
            </section>

            <section class="invoice-form-container petty-filters-card">
                <div class="invoice-shell">
                    <div class="form-title-row" style="padding-bottom: 0; border-bottom: none;"></div>
                    <div class="invoice-top-grid filter-grid">
                        <div class="form-group">
                            <label>التاريخ من</label>
                            <input type="date" id="startDate" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>التاريخ إلى</label>
                            <input type="date" id="endDate" class="form-control">
                        </div>
                        <div class="petty-filter-actions">
                            <button type="button" class="btn btn-primary" id="filterBtn" style="border-radius: 8px; flex: 1;">
                                <i class="fas fa-search" style="margin-inline-end: 5px;"></i> بحث
                            </button>
                            <button type="button" class="btn btn-outline" id="resetFilterBtn" style="border-radius: 8px; flex: 1;">
                                <i class="fas fa-times" style="margin-inline-end: 5px;"></i> مسح
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section class="invoice-form-container print-container">
                <div class="invoice-shell" style="padding-bottom: 10px;">
                    <div class="form-title-row" style="border-bottom: none; padding-bottom: 0;">
                        <h2 class="form-title">كشف إيرادات التصدير</h2>
                    </div>

                    <div class="petty-print-title">
                        <h2>كشف إيرادات التصدير</h2>
                        <p id="printRange"></p>
                    </div>

                    <div class="petty-table-wrap">
                        <table class="petty-table">
                            <thead>
                                <tr>
                                    <th>التسلسل</th>
                                    <th>اليوم</th>
                                    <th>التاريخ</th>
                                    <th>المبلغ</th>
                                    <th>العملة</th>
                                    <th>الصرف</th>
                                    <th>المصري</th>
                                    <th>البيان</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody id="recordsBody"></tbody>
                        </table>
                    </div>
                    <div class="petty-pagination" id="pagination"></div>
                </div>
            </section>
        </main>

        <div id="addRecordModal" class="petty-modal-overlay hidden">
            <div class="petty-modal-card" role="dialog" aria-modal="true" aria-labelledby="exportRevenuesModalTitle">
                <div class="petty-modal-header">
                    <div class="petty-modal-title">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <h2 id="exportRevenuesModalTitle">إضافة إيراد تصدير</h2>
                    </div>
                    <button type="button" class="petty-modal-close" id="closeModalBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="exportRevenuesForm">
                    <div class="petty-modal-body">
                        <div class="petty-modal-grid">
                            <div class="petty-modal-row">
                                <div class="form-group">
                                    <label><i class="fas fa-hashtag text-icon"></i> رقم المسلسل</label>
                                    <input type="text" id="documentNumber" class="form-control uneditable" readonly>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-calendar-alt text-icon"></i> التاريخ</label>
                                    <input type="date" id="recordDate" class="form-control" required>
                                </div>
                            </div>

                            <div class="petty-modal-row three-cols">
                                <div class="form-group">
                                    <label><i class="fas fa-coins text-icon"></i> المبلغ <span class="required-asterisk">*</span></label>
                                    <input type="text" id="amountInput" class="form-control number-input" placeholder="0" required>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-dollar-sign text-icon"></i> العملة <span class="required-asterisk">*</span></label>
                                    <input type="text" id="currencyInput" class="form-control" placeholder="مثال: دولار" required>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-exchange-alt text-icon"></i> الصرف <span class="required-asterisk">*</span></label>
                                    <input type="text" id="exchangeRateInput" class="form-control number-input" placeholder="0" required>
                                </div>
                            </div>

                            <div class="petty-modal-row">
                                <div class="form-group">
                                    <label><i class="fas fa-sack-dollar text-icon"></i> المصري</label>
                                    <input type="text" id="amountEgp" class="form-control uneditable number-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-pen text-icon"></i> البيان</label>
                                    <input type="text" id="statementInput" class="form-control" placeholder="اكتب البيان (اختياري)">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="petty-modal-footer">
                        <button type="button" class="btn btn-outline" id="cancelModalBtn">إلغاء</button>
                        <button type="submit" class="btn btn-primary submit-btn">
                            <i class="fas fa-check-circle"></i> حفظ واعتماد
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function bindEvents() {
    document.getElementById('exportRevenuesForm').addEventListener('submit', saveRecord);
    document.getElementById('filterBtn').addEventListener('click', () => {
        state.page = 1;
        loadRecords();
    });
    document.getElementById('resetFilterBtn').addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        state.page = 1;
        loadRecords();
    });
    document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);

    const modal = document.getElementById('addRecordModal');
    document.getElementById('openAddModalBtn').addEventListener('click', async () => {
        state.editingId = null;
        document.getElementById('exportRevenuesForm').reset();
        document.getElementById('recordDate').value = today();
        document.getElementById('amountEgp').value = '';
        await refreshDocumentNumber();
        modal.classList.remove('hidden');
    });

    const closeModal = () => {
        state.editingId = null;
        modal.classList.add('hidden');
    };
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    attachNumberFormatting(document.getElementById('amountInput'));
    attachNumberFormatting(document.getElementById('exchangeRateInput'));
}

async function refreshDocumentNumber() {
    const result = await window.electronAPI.getNextExportRevenueNumber();
    if (result && result.success) {
        document.getElementById('documentNumber').value = result.documentNumber;
    }
}

function getFilters() {
    return {
        page: state.page,
        pageSize: state.pageSize,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value
    };
}

async function loadRecords() {
    const result = await window.electronAPI.getExportRevenues(getFilters());
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر تحميل إيرادات التصدير', 'error');
        return;
    }

    state.rows = Array.isArray(result.rows) ? result.rows : [];
    state.totalPages = Number(result.totalPages) || 1;
    state.totalAmount = Number(result.totalAmount) || 0;
    state.totalEgp = Number(result.totalEgp) || 0;
    state.totalCount = Number(result.total) || 0;
    renderRows();
    renderPagination();
    renderSummary();
}

function renderSummary() {
    const totalAmountEl = document.getElementById('exportRevenuesTotalAmount');
    const totalEgpEl = document.getElementById('exportRevenuesTotalEgp');

    if (totalAmountEl) {
        totalAmountEl.textContent = formatNumber(state.totalAmount);
    }

    if (totalEgpEl) {
        totalEgpEl.textContent = formatNumber(state.totalEgp);
    }
}

function renderRows() {
    const body = document.getElementById('recordsBody');
    if (!state.rows.length) {
        body.innerHTML = `<tr><td colspan="9" class="petty-empty">لا توجد إيرادات تصدير مسجلة</td></tr>`;
        return;
    }

    const startIndex = (state.page - 1) * state.pageSize;
    body.innerHTML = state.rows.map((row, index) => `
        <tr>
            <td>${escapeHtml(row.document_number || startIndex + index + 1)}</td>
            <td>${escapeHtml(formatWeekday(row.record_date))}</td>
            <td>${escapeHtml(row.record_date || '')}</td>
            <td class="amount-cell">${formatNumber(row.amount)}</td>
            <td class="currency-cell">${escapeHtml(row.currency || '')}</td>
            <td class="rate-cell">${formatNumber(row.exchange_rate)}</td>
            <td class="egp-cell">${formatNumber(row.amount_egp)}</td>
            <td class="statement-cell">${escapeHtml(row.statement || '')}</td>
            <td>
                <button type="button" class="btn btn-outline" data-action="edit-record" data-id="${row.id}">
                    <i class="fas fa-pen"></i> تعديل
                </button>
                <button type="button" class="btn btn-outline" data-action="delete-record" data-id="${row.id}">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </td>
        </tr>
    `).join('');

    body.querySelectorAll('[data-action="edit-record"]').forEach((button) => {
        button.addEventListener('click', () => openEditModal(button.dataset.id));
    });

    body.querySelectorAll('[data-action="delete-record"]').forEach((button) => {
        button.addEventListener('click', () => deleteRecord(button.dataset.id));
    });
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    if (state.totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    pagination.innerHTML = `
        <button type="button" class="btn btn-outline" id="prevPage" ${state.page <= 1 ? 'disabled' : ''}>السابق</button>
        <span>صفحة ${state.page} من ${state.totalPages}</span>
        <button type="button" class="btn btn-outline" id="nextPage" ${state.page >= state.totalPages ? 'disabled' : ''}>التالي</button>
    `;

    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (state.page <= 1) return;
        state.page -= 1;
        loadRecords();
    });
    document.getElementById('nextPage')?.addEventListener('click', () => {
        if (state.page >= state.totalPages) return;
        state.page += 1;
        loadRecords();
    });
}

async function openEditModal(id) {
    const row = getRowById(id);
    if (!row) {
        showMessage('تعذر العثور على السجل', 'error');
        return;
    }

    state.editingId = row.id;
    document.getElementById('documentNumber').value = row.document_number || '';
    document.getElementById('recordDate').value = row.record_date || today();
    document.getElementById('amountInput').value = formatNumber(row.amount);
    document.getElementById('currencyInput').value = row.currency || '';
    document.getElementById('exchangeRateInput').value = formatNumber(row.exchange_rate);
    document.getElementById('amountEgp').value = formatNumber(row.amount_egp);
    document.getElementById('statementInput').value = row.statement || '';
    document.getElementById('addRecordModal').classList.remove('hidden');
}

async function deleteRecord(id) {
    if (!window.showConfirmDialog) {
        showMessage('تعذر فتح نافذة التأكيد', 'error');
        return;
    }

    const confirmed = await window.showConfirmDialog('هل تريد حذف سجل إيرادات التصدير؟');
    if (!confirmed) {
        return;
    }

    const result = await window.electronAPI.deleteExportRevenue(Number(id));
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر حذف السجل', 'error');
        return;
    }

    showMessage('تم حذف السجل بنجاح', 'success');
    await loadRecords();
}

async function saveRecord(event) {
    event.preventDefault();
    const payload = {
        record_date: document.getElementById('recordDate').value || today(),
        amount: parseNumberInput(document.getElementById('amountInput').value),
        currency: document.getElementById('currencyInput').value,
        exchange_rate: parseNumberInput(document.getElementById('exchangeRateInput').value),
        statement: document.getElementById('statementInput').value
    };

    if (state.editingId) {
        payload.id = state.editingId;
        const result = await window.electronAPI.updateExportRevenue(payload);
        if (!result || !result.success) {
            showMessage((result && result.error) || 'تعذر تعديل السجل', 'error');
            return;
        }

        showMessage('تم تعديل السجل بنجاح', 'success');
        state.editingId = null;
        document.getElementById('addRecordModal').classList.add('hidden');
        document.getElementById('exportRevenuesForm').reset();
        await loadRecords();
        return;
    }

    const result = await window.electronAPI.saveExportRevenue(payload);
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر حفظ السجل', 'error');
        return;
    }

    showMessage('تم حفظ السجل بنجاح', 'success');
    document.getElementById('addRecordModal').classList.add('hidden');
    document.getElementById('exportRevenuesForm').reset();
    document.getElementById('recordDate').value = today();
    document.getElementById('amountEgp').value = '';
    await refreshDocumentNumber();
    state.page = 1;
    await loadRecords();
}

async function exportPdf() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const currentRows = state.rows.slice();
    document.getElementById('printRange').textContent = startDate || endDate
        ? `الفترة: ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}`
        : '';

    const exportResult = await window.electronAPI.getExportRevenues({
        page: 1,
        pageSize: 100000,
        startDate,
        endDate
    });

    if (exportResult && exportResult.success) {
        state.rows = Array.isArray(exportResult.rows) ? exportResult.rows : [];
        renderRows();
    }

    document.body.classList.add('petty-pdf-mode');
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
        const date = today();
        const result = await window.electronAPI.saveExportRevenuesPdf({ defaultName: `Export_Revenues_${date}.pdf` });
        if (result && result.success) {
            showMessage('تم حفظ ملف PDF بنجاح', 'success');
        } else if (result && !result.canceled) {
            showMessage(result.error || 'تعذر حفظ ملف PDF', 'error');
        }
    } finally {
        document.body.classList.remove('petty-pdf-mode');
        state.rows = currentRows;
        renderRows();
    }
}
