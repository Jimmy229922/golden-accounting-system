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
    const submitBtn = document.querySelector('#underCollectionForm .submit-btn');
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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getRowById(id) {
    return state.rows.find((row) => String(row.id) === String(id));
}

function getContainerText(row) {
    const sizes = [];
    if (Number(row.container_20)) sizes.push('20');
    if (Number(row.container_40)) sizes.push('40');
    return `${row.container_count || 0} × ${sizes.join(' / ')}`;
}

function updateTotalPreview() {
    const tons = Number(document.getElementById('tonsCount')?.value) || 0;
    const price = Number(document.getElementById('tonPrice')?.value) || 0;
    const total = tons * price;
    const totalInput = document.getElementById('totalUsd');
    if (totalInput) {
        totalInput.value = Number.isFinite(total) ? total.toFixed(2) : '0.00';
    }
}

function formatRemainingText(row) {
    const value = Number(row.remaining_value) || 0;
    const amount = Number(row.remaining_usd) || 0;
    if (value <= 0 && amount <= 0) return '';

    if (String(row.remaining_type || 'percent') === 'usd') {
        return `المتبقي ${formatMoney(amount)} $`;
    }

    return `المتبقي ${formatMoney(value)}% = ${formatMoney(amount)} $`;
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
        <main class="petty-page under-collection-page">
            <section class="petty-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                </div>
                <div class="hero-content">
                    <h1>تحت التحصيل</h1>
                    <p>تسجيل ومتابعة الفواتير التي لم يتم تحصيلها بعد</p>
                </div>
                <div class="hero-bottom">
                    <div class="petty-hero-actions">
                        <button type="button" class="btn btn-primary" id="openAddModalBtn" style="padding: 10px 24px; font-weight: bold; border-radius: 8px;">
                            <i class="fas fa-plus"></i>
                            تسجيل تحت التحصيل
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
                        <div class="stat-title">إجمالي الفواتير بالدولار</div>
                        <div class="stat-value" id="underCollectionTotalAmount">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-count">
                    <div class="stat-icon"><i class="fas fa-file-invoice"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">عدد السجلات</div>
                        <div class="stat-value" id="underCollectionTotalCount">0</div>
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
                        <h2 class="form-title">كشف تحت التحصيل</h2>
                    </div>

                    <div class="petty-print-title">
                        <h2>كشف تحت التحصيل</h2>
                        <p id="printRange"></p>
                    </div>

                    <div class="petty-table-wrap">
                        <table class="petty-table">
                            <thead>
                                <tr>
                                    <th>التسلسل</th>
                                    <th>التاريخ</th>
                                    <th>نوع الحاوية</th>
                                    <th>البيان</th>
                                    <th>رقم الفاتورة</th>
                                    <th>عدد الأطنان * السعر</th>
                                    <th>إجمالي الفاتورة بالدولار</th>
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
            <div class="petty-modal-card" role="dialog" aria-modal="true" aria-labelledby="underCollectionModalTitle">
                <div class="petty-modal-header">
                    <div class="petty-modal-title">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <h2 id="underCollectionModalTitle">إضافة سجل تحت التحصيل</h2>
                    </div>
                    <button type="button" class="petty-modal-close" id="closeModalBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="underCollectionForm">
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
                                    <label><i class="fas fa-box text-icon"></i> نوع الحاوية <span class="required-asterisk">*</span></label>
                                    <div class="container-type-box">
                                        <input type="number" id="containerCount" class="form-control" min="1" step="1" placeholder="عدد الحاويات" required>
                                        <div class="container-size-options">
                                            <label class="check-pill"><input type="checkbox" id="container20"> 20</label>
                                            <label class="check-pill"><input type="checkbox" id="container40"> 40</label>
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-pen text-icon"></i> البيان <span class="required-asterisk">*</span></label>
                                    <input type="text" id="statement" class="form-control statement-input" placeholder="اكتب البيان..." required>
                                </div>
                            </div>

                            <div class="petty-modal-row three-cols">
                                <div class="form-group">
                                    <label><i class="fas fa-file-invoice text-icon"></i> رقم الفاتورة <span class="required-asterisk">*</span></label>
                                    <input type="text" id="invoiceNumber" class="form-control" placeholder="رقم الفاتورة" required>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-weight-hanging text-icon"></i> عدد الأطنان * السعر <span class="required-asterisk">*</span></label>
                                    <div class="tons-price-box">
                                        <div class="input-with-unit">
                                            <input type="number" id="tonsCount" class="form-control" min="0" step="0.01" placeholder="0.00" required>
                                            <span class="unit-badge">طن</span>
                                        </div>
                                        <input type="number" id="tonPrice" class="form-control" min="0" step="0.01" placeholder="السعر" required>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-dollar-sign text-icon"></i> إجمالي الفاتورة بالدولار</label>
                                    <input type="text" id="totalUsd" class="form-control uneditable" value="0.00" readonly>
                                    <div class="remaining-alert-box">
                                        <select id="remainingType" class="form-control">
                                            <option value="percent" selected>%</option>
                                            <option value="usd">دولار</option>
                                        </select>
                                        <input type="number" id="remainingValue" class="form-control" min="0" step="0.01" placeholder="المتبقي">
                                    </div>
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
    document.getElementById('underCollectionForm').addEventListener('submit', saveRecord);
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
    document.getElementById('tonsCount').addEventListener('input', updateTotalPreview);
    document.getElementById('tonPrice').addEventListener('input', updateTotalPreview);

    const modal = document.getElementById('addRecordModal');
    document.getElementById('openAddModalBtn').addEventListener('click', async () => {
        state.editingId = null;
        document.getElementById('underCollectionForm').reset();
        document.getElementById('recordDate').value = today();
        document.getElementById('remainingType').value = 'percent';
        updateTotalPreview();
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
}

async function refreshDocumentNumber() {
    const result = await window.electronAPI.getNextUnderCollectionNumber();
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
    const result = await window.electronAPI.getUnderCollectionRecords(getFilters());
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر تحميل تحت التحصيل', 'error');
        return;
    }

    state.rows = Array.isArray(result.rows) ? result.rows : [];
    state.totalPages = Number(result.totalPages) || 1;
    state.totalAmount = Number(result.totalAmount) || 0;
    state.totalCount = Number(result.total) || 0;
    renderRows();
    renderPagination();
    renderSummary();
}

function renderSummary() {
    const totalAmountEl = document.getElementById('underCollectionTotalAmount');
    const totalCountEl = document.getElementById('underCollectionTotalCount');

    if (totalAmountEl) {
        totalAmountEl.textContent = formatMoney(state.totalAmount);
    }

    if (totalCountEl) {
        totalCountEl.textContent = (Number(state.totalCount) || 0).toLocaleString('en-US');
    }
}

function renderRows() {
    const body = document.getElementById('recordsBody');
    if (!state.rows.length) {
        body.innerHTML = `<tr><td colspan="9" class="petty-empty">لا توجد سجلات تحت التحصيل</td></tr>`;
        return;
    }

    const startIndex = (state.page - 1) * state.pageSize;
    body.innerHTML = state.rows.map((row, index) => `
        <tr>
            <td>${escapeHtml(row.document_number || startIndex + index + 1)}</td>
            <td>${escapeHtml(row.record_date || '')}</td>
            <td>${escapeHtml(getContainerText(row))}</td>
            <td class="statement-cell">${escapeHtml(row.statement || '')}</td>
            <td>${escapeHtml(row.invoice_number || '')}</td>
            <td>${formatMoney(row.tons_count)} طن × ${formatMoney(row.ton_price)}</td>
            <td>
                <div class="invoice-total-cell">
                    <strong>${formatMoney(row.total_usd)}</strong>
                    ${formatRemainingText(row) ? `<span>${escapeHtml(formatRemainingText(row))}</span>` : ''}
                </div>
            </td>
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
    document.getElementById('containerCount').value = row.container_count ?? '';
    document.getElementById('container20').checked = Boolean(Number(row.container_20));
    document.getElementById('container40').checked = Boolean(Number(row.container_40));
    document.getElementById('statement').value = row.statement || '';
    document.getElementById('invoiceNumber').value = row.invoice_number || '';
    document.getElementById('tonsCount').value = row.tons_count ?? '';
    document.getElementById('tonPrice').value = row.ton_price ?? '';
    document.getElementById('remainingType').value = row.remaining_type || 'percent';
    document.getElementById('remainingValue').value = row.remaining_value ?? '';
    updateTotalPreview();
    document.getElementById('addRecordModal').classList.remove('hidden');
}

async function deleteRecord(id) {
    if (!window.showConfirmDialog) {
        showMessage('تعذر فتح نافذة التأكيد', 'error');
        return;
    }

    const confirmed = await window.showConfirmDialog('هل تريد حذف سجل تحت التحصيل؟');
    if (!confirmed) {
        return;
    }

    const result = await window.electronAPI.deleteUnderCollectionRecord(Number(id));
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر حذف السجل', 'error');
        return;
    }

    showMessage('تم حذف السجل بنجاح', 'success');
    await loadRecords();
}

async function toggleCollected(id, isCollected) {
    const result = await window.electronAPI.updateUnderCollectionCollected({
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
    const selectedRecordDate = document.getElementById('recordDate').value || today();
    const payload = {
        record_date: selectedRecordDate,
        container_count: document.getElementById('containerCount').value,
        container_20: document.getElementById('container20').checked ? 1 : 0,
        container_40: document.getElementById('container40').checked ? 1 : 0,
        statement: document.getElementById('statement').value,
        invoice_number: document.getElementById('invoiceNumber').value,
        tons_count: document.getElementById('tonsCount').value,
        ton_price: document.getElementById('tonPrice').value,
        remaining_type: document.getElementById('remainingType').value,
        remaining_value: document.getElementById('remainingValue').value
    };

    state.isSaving = true;
    setSubmitButtonLoading(true);
    try {
        if (state.editingId) {
            payload.id = state.editingId;
            const result = await window.electronAPI.updateUnderCollectionRecord(payload);
            if (!result || !result.success) {
                showMessage((result && result.error) || 'تعذر تعديل السجل', 'error');
                return;
            }

            showMessage('تم تعديل السجل بنجاح', 'success');
            state.editingId = null;
            document.getElementById('addRecordModal').classList.add('hidden');
            document.getElementById('underCollectionForm').reset();
            await loadRecords();
            return;
        }

        const result = await window.electronAPI.saveUnderCollectionRecord(payload);
        if (!result || !result.success) {
            showMessage((result && result.error) || 'تعذر حفظ السجل', 'error');
            return;
        }

        showMessage('تم حفظ السجل بنجاح', 'success');
        document.getElementById('underCollectionForm').reset();
        document.getElementById('recordDate').value = selectedRecordDate;
        document.getElementById('remainingType').value = 'percent';
        updateTotalPreview();
        await refreshDocumentNumber();
        document.getElementById('statement').focus();
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

    const exportResult = await window.electronAPI.getUnderCollectionRecords({
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
        const result = await window.electronAPI.saveUnderCollectionPdf({ defaultName: `Under_Collection_${date}.pdf` });
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
