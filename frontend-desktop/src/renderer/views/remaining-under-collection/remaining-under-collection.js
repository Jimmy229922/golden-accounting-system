let ar = {};
const { t } = window.i18n?.createPageHelpers?.(() => ar) || { t: (_k, fallback = '') => fallback };

const state = {
    page: 1,
    pageSize: 50,
    totalPages: 1,
    rows: [],
    editingId: null,
    isSaving: false,
    totalAmount: 0,
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

function setSubmitButtonLoading(loading) {
    const submitBtn = document.querySelector('#remainingUnderCollectionForm .submit-btn');
    if (!submitBtn) return;
    submitBtn.disabled = Boolean(loading);
    submitBtn.style.opacity = loading ? '0.6' : '1';
    submitBtn.style.cursor = loading ? 'not-allowed' : 'pointer';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatMoney(value) {
    return (Number(value) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
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
    document.getElementById('arrivalDate').value = today();
    await refreshDocumentNumber();
    await loadRecords();
});

function renderPage() {
    document.getElementById('app').innerHTML = `
        ${buildTopNavHTML()}
        <main class="petty-page under-collection-page">
            <section class="petty-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                </div>
                <div class="hero-content">
                    <h1>بيان المتبقي من تحت التحصيل</h1>
                    <p>متابعة المتبقي من سجلات تحت التحصيل</p>
                </div>
                <div class="hero-bottom">
                    <div class="petty-hero-actions">
                        <button type="button" class="btn btn-primary" id="openAddModalBtn" style="padding: 10px 24px; font-weight: bold; border-radius: 8px;">
                            <i class="fas fa-plus"></i>
                            تسجيل بيان المتبقي
                        </button>
                        <button type="button" class="btn btn-outline" id="exportPdfBtn">
                            <i class="fas fa-file-pdf"></i>
                            تصدير PDF
                        </button>
                    </div>
                </div>
            </section>

            <section class="stats-container petty-stats">
                <div class="stat-card stat-total">
                    <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي الفواتير ($)</div>
                        <div class="stat-value" id="remainingUnderCollectionTotalAmount">0</div>
                    </div>
                </div>
                <div class="stat-card stat-count">
                    <div class="stat-icon"><i class="fas fa-file-invoice"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">عدد السجلات</div>
                        <div class="stat-value" id="remainingUnderCollectionTotalCount">0</div>
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
                        <h2 class="form-title">بيان المتبقي من تحت التحصيل</h2>
                    </div>

                    <div class="petty-print-title">
                        <h2>بيان المتبقي من تحت التحصيل</h2>
                        <p id="printRange"></p>
                    </div>

                    <div class="petty-table-wrap">
                        <table class="petty-table">
                            <thead>
                                <tr>
                                    <th>التسلسل</th>
                                    <th>التاريخ</th>
                                    <th>البيان</th>
                                    <th>إجمالي الفاتورة ($)</th>
                                    <th>تاريخ الوصول</th>
                                    <th>الوصول من الفاتورة ($)</th>
                                    <th>المتبقي من الفاتورة ($)</th>
                                    <th>إجراءات</th>
                                    <th>تم التحصيل</th>
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
            <div class="petty-modal-card" role="dialog" aria-modal="true" aria-labelledby="remainingUnderCollectionModalTitle">
                <div class="petty-modal-header">
                    <div class="petty-modal-title">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <h2 id="remainingUnderCollectionModalTitle">إضافة سجل بيان المتبقي</h2>
                    </div>
                    <button type="button" class="petty-modal-close" id="closeModalBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="remainingUnderCollectionForm">
                    <div class="petty-modal-body">
                        <div class="petty-modal-grid">
                            <div class="petty-modal-row">
                                <div class="form-group">
                                    <label><i class="fas fa-hashtag text-icon"></i> التسلسل</label>
                                    <input type="text" id="documentNumber" class="form-control uneditable" readonly>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-calendar-alt text-icon"></i> التاريخ</label>
                                    <input type="date" id="recordDate" class="form-control" required>
                                </div>
                            </div>

                            <div class="petty-modal-row">
                                <div class="form-group">
                                    <label><i class="fas fa-pen text-icon"></i> البيان <span class="required-asterisk">*</span></label>
                                    <input type="text" id="statement" class="form-control statement-input" placeholder="اكتب البيان..." required>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-dollar-sign text-icon"></i> إجمالي الفاتورة ($) <span class="required-asterisk">*</span></label>
                                    <input type="number" id="invoiceTotal" class="form-control" min="0" step="any" placeholder="0" required>
                                </div>
                            </div>

                            <div class="petty-modal-row three-cols">
                                <div class="form-group">
                                    <label><i class="fas fa-calendar-check text-icon"></i> تاريخ الوصول</label>
                                    <input type="date" id="arrivalDate" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-hand-holding-usd text-icon"></i> الوصول من الفاتورة ($)</label>
                                    <input type="number" id="arrivalAmount" class="form-control" min="0" step="any" placeholder="0">
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-coins text-icon"></i> المتبقي من الفاتورة ($)</label>
                                    <input type="number" id="remainingAmount" class="form-control" min="0" step="any" placeholder="0">
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
    document.getElementById('remainingUnderCollectionForm').addEventListener('submit', saveRecord);
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
        document.getElementById('remainingUnderCollectionForm').reset();
        document.getElementById('recordDate').value = today();
        document.getElementById('arrivalDate').value = today();
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

    window.financialPagination?.bind(document.getElementById('pagination'), {
        onPageChange: (page) => {
            state.page = page;
            loadRecords();
        },
        onPageSizeChange: (pageSize) => {
            state.pageSize = pageSize;
            state.page = 1;
            loadRecords();
        }
    });
}

async function refreshDocumentNumber() {
    const result = await window.electronAPI.getNextRemainingUnderCollectionNumber();
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
    const result = await window.electronAPI.getRemainingUnderCollectionRecords(getFilters());
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر تحميل بيان المتبقي من تحت التحصيل', 'error');
        return;
    }

    state.rows = Array.isArray(result.rows) ? result.rows : [];
    state.page = Number(result.page) || state.page;
    state.pageSize = Number(result.pageSize) || state.pageSize;
    state.totalPages = Number(result.totalPages) || 1;
    state.totalAmount = Number(result.totalAmount) || 0;
    state.totalCount = Number(result.total) || 0;
    renderRows();
    renderPagination();
    renderSummary();
}

function renderSummary() {
    const totalAmountEl = document.getElementById('remainingUnderCollectionTotalAmount');
    const totalCountEl = document.getElementById('remainingUnderCollectionTotalCount');

    if (totalAmountEl) {
        totalAmountEl.textContent = `${formatMoney(state.totalAmount)} $`;
    }

    if (totalCountEl) {
        totalCountEl.textContent = (Number(state.totalCount) || 0).toLocaleString('en-US');
    }
}

function renderRows() {
    const body = document.getElementById('recordsBody');
    if (!state.rows.length) {
        body.innerHTML = `<tr><td colspan="9" class="petty-empty">لا توجد سجلات بيان المتبقي من تحت التحصيل</td></tr>`;
        return;
    }

    const startIndex = (state.page - 1) * state.pageSize;
    body.innerHTML = state.rows.map((row, index) => `
        <tr>
            <td>${escapeHtml(row.document_number || startIndex + index + 1)}</td>
            <td>${escapeHtml(row.record_date || '')}</td>
            <td class="statement-cell">${escapeHtml(row.statement || '')}</td>
            <td>${formatMoney(row.invoice_total)} $</td>
            <td>${escapeHtml(row.arrival_date || '')}</td>
            <td>${formatMoney(row.arrival_amount)} $</td>
            <td>${formatMoney(row.remaining_amount)} $</td>
            <td>
                <button type="button" class="btn btn-outline" data-action="edit-record" data-id="${row.id}">
                    <i class="fas fa-pen"></i> تعديل
                </button>
                <button type="button" class="btn btn-outline" data-action="delete-record" data-id="${row.id}">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </td>
            <td>
                <input type="checkbox" class="collected-checkbox" data-action="toggle-collected" data-id="${row.id}" ${Number(row.is_collected) ? 'checked' : ''}>
            </td>
        </tr>
    `).join('');

    body.querySelectorAll('[data-action="edit-record"]').forEach((button) => {
        button.addEventListener('click', () => openEditModal(button.dataset.id));
    });

    body.querySelectorAll('[data-action="delete-record"]').forEach((button) => {
        button.addEventListener('click', () => deleteRecord(button.dataset.id));
    });

    body.querySelectorAll('[data-action="toggle-collected"]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => toggleCollected(checkbox.dataset.id, checkbox.checked));
    });
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    window.financialPagination?.render(pagination, {
        page: state.page,
        pageSize: state.pageSize,
        totalPages: state.totalPages,
        total: state.totalCount
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
    document.getElementById('statement').value = row.statement || '';
    document.getElementById('invoiceTotal').value = row.invoice_total ?? '';
    document.getElementById('arrivalDate').value = row.arrival_date || today();
    document.getElementById('arrivalAmount').value = row.arrival_amount ?? '';
    document.getElementById('remainingAmount').value = row.remaining_amount ?? '';
    document.getElementById('addRecordModal').classList.remove('hidden');
}

async function deleteRecord(id) {
    if (!window.showConfirmDialog) {
        showMessage('تعذر فتح نافذة التأكيد', 'error');
        return;
    }

    const confirmed = await window.showConfirmDialog('هل تريد حذف سجل بيان المتبقي من تحت التحصيل؟');
    if (!confirmed) {
        return;
    }

    const result = await window.electronAPI.deleteRemainingUnderCollectionRecord(Number(id));
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر حذف السجل', 'error');
        return;
    }

    showMessage('تم حذف السجل بنجاح', 'success');
    await loadRecords();
}

async function toggleCollected(id, isCollected) {
    const result = await window.electronAPI.updateRemainingUnderCollectionCollected({
        id: Number(id),
        is_collected: isCollected ? 1 : 0
    });

    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر تحديث حالة التحصيل', 'error');
        await loadRecords();
    }
}

async function saveRecord(event) {
    event.preventDefault();
    if (state.isSaving) return;
    const payload = {
        record_date: document.getElementById('recordDate').value || today(),
        statement: document.getElementById('statement').value,
        invoice_total: document.getElementById('invoiceTotal').value,
        arrival_date: document.getElementById('arrivalDate').value || today(),
        arrival_amount: document.getElementById('arrivalAmount').value,
        remaining_amount: document.getElementById('remainingAmount').value
    };

    state.isSaving = true;
    setSubmitButtonLoading(true);
    try {
        if (state.editingId) {
            payload.id = state.editingId;
            const result = await window.electronAPI.updateRemainingUnderCollectionRecord(payload);
            if (!result || !result.success) {
                showMessage((result && result.error) || 'تعذر تعديل السجل', 'error');
                return;
            }

            showMessage('تم تعديل السجل بنجاح', 'success');
            state.editingId = null;
            document.getElementById('addRecordModal').classList.add('hidden');
            document.getElementById('remainingUnderCollectionForm').reset();
            await loadRecords();
            return;
        }

        const result = await window.electronAPI.saveRemainingUnderCollectionRecord(payload);
        if (!result || !result.success) {
            showMessage((result && result.error) || 'تعذر حفظ السجل', 'error');
            return;
        }

        showMessage('تم حفظ السجل بنجاح', 'success');
        document.getElementById('addRecordModal').classList.add('hidden');
        document.getElementById('remainingUnderCollectionForm').reset();
        document.getElementById('recordDate').value = today();
        document.getElementById('arrivalDate').value = today();
        await refreshDocumentNumber();
        state.page = 1;
        await loadRecords();
    } finally {
        state.isSaving = false;
        setSubmitButtonLoading(false);
    }
}

async function exportPdf() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const currentRows = state.rows.slice();
    document.getElementById('printRange').textContent = startDate || endDate
        ? `الفترة: ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}`
        : '';

    const exportResult = await window.electronAPI.getRemainingUnderCollectionRecords({
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
        const result = await window.electronAPI.saveRemainingUnderCollectionPdf({ defaultName: `Remaining_Under_Collection_${date}.pdf` });
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
