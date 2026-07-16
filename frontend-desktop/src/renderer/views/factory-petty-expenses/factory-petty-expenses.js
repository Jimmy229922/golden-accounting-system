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
    const submitBtn = document.querySelector('#pettyForm .submit-btn');
    if (!submitBtn) return;
    submitBtn.disabled = Boolean(loading);
    submitBtn.style.opacity = loading ? '0.6' : '1';
    submitBtn.style.cursor = loading ? 'not-allowed' : 'pointer';
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

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    renderPage();
    bindEvents();
    document.getElementById('expenseDate').value = today();
    await refreshDocumentNumber();
    await loadExpenses();
});

function renderPage() {
    document.getElementById('app').innerHTML = `
        ${buildTopNavHTML()}
        <main class="petty-page">
            <section class="petty-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                </div>
                <div class="hero-content">
                    <h1>نثريات المصنع</h1>
                    <p>تسجيل ومتابعة المصاريف اليومية الخاصة بالمصنع</p>
                </div>
                <div class="hero-bottom">
                    <div class="petty-hero-actions">
                        <button type="button" class="btn btn-primary" id="openAddModalBtn" style="padding: 10px 24px; font-weight: bold; border-radius: 8px;">
                            <i class="fas fa-plus"></i>
                            تسجيل نثريات المصنع
                        </button>
                        <button type="button" class="btn btn-outline" id="exportPdfBtn">
                            <i class="fas fa-file-pdf"></i>
                            تصدير PDF
                        </button>
                    </div>
                </div>
            </section>

            <section class="stats-container petty-stats">
                <div class="stat-card stat-expense">
                    <div class="stat-icon"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي نثريات المصنع</div>
                        <div class="stat-value" id="pettyTotalAmount">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-count">
                    <div class="stat-icon"><i class="fas fa-file-invoice"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">عدد المستندات</div>
                        <div class="stat-value" id="pettyTotalCount">0</div>
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
                        <h2 class="form-title">كشف نثريات المصنع</h2>
                    </div>
                    
                    <div class="petty-print-title">
                        <h2>كشف نثريات المصنع</h2>
                        <p id="printRange"></p>
                    </div>

                    <div class="petty-table-wrap">
                        <table class="petty-table">
                            <thead>
                                <tr>
                                    <th>رقم المستند</th>
                                    <th>التاريخ</th>
                                    <th>المبلغ</th>
                                    <th>البيان</th>
                                    <th>الملاحظة</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody id="expensesBody"></tbody>
                        </table>
                    </div>
                    <div class="petty-pagination" id="pagination"></div>
                </div>
            </section>
        </main>

        <!-- مودال إضافة نثريات المصنع -->
        <div id="addExpenseModal" class="petty-modal-overlay hidden">
            <div class="petty-modal-card" role="dialog" aria-modal="true" aria-labelledby="pettyModalTitle">
                <div class="petty-modal-header">
                    <div class="petty-modal-title">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <h2 id="pettyModalTitle">إضافة مستند نثريات المصنع</h2>
                    </div>
                    <button type="button" class="petty-modal-close" id="closeModalBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="pettyForm">
                    <div class="petty-modal-body">
                        <div class="petty-modal-grid">
                            <div class="petty-modal-row">
                                <div class="form-group">
                                    <label><i class="fas fa-hashtag text-icon"></i> رقم المستند</label>
                                    <input type="text" id="documentNumber" class="form-control uneditable" readonly>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-calendar-alt text-icon"></i> التاريخ</label>
                                    <input type="date" id="expenseDate" class="form-control" required>
                                </div>
                            </div>

                            <div class="petty-modal-row wide-right">
                                <div class="form-group">
                                    <label><i class="fas fa-money-bill-wave text-icon"></i> المبلغ <span class="required-asterisk">*</span></label>
                                    <div class="input-with-currency">
                                        <input type="number" id="amount" class="form-control amount-input" min="0" step="any" placeholder="0.00" required>
                                        <span class="currency-badge">ج.م</span>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-pen text-icon"></i> البيان <span class="required-asterisk">*</span></label>
                                    <input type="text" id="statement" class="form-control statement-input" placeholder="اكتب هنا وصفاً موجزاً للمصروف..." required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label><i class="fas fa-comment-dots text-icon"></i> ملاحظات إضافية</label>
                                <textarea id="notes" class="form-control" rows="2" placeholder="أية تفاصيل أخرى متعلقة بالمصروف..."></textarea>
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
    document.getElementById('pettyForm').addEventListener('submit', saveExpense);
    document.getElementById('filterBtn').addEventListener('click', () => {
        state.page = 1;
        loadExpenses();
    });
    document.getElementById('resetFilterBtn').addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        state.page = 1;
        loadExpenses();
    });
    document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);

    // ربط أحداث النافذة المنبثقة (Modal)
    const modal = document.getElementById('addExpenseModal');
    document.getElementById('openAddModalBtn').addEventListener('click', async () => {
        state.editingId = null;
        document.getElementById('pettyForm').reset();
        document.getElementById('expenseDate').value = today();
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
            loadExpenses();
        },
        onPageSizeChange: (pageSize) => {
            state.pageSize = pageSize;
            state.page = 1;
            loadExpenses();
        }
    });
}

async function refreshDocumentNumber() {
    const result = await window.electronAPI.getNextFactoryPettyExpenseNumber();
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

async function loadExpenses() {
    const result = await window.electronAPI.getFactoryPettyExpenses(getFilters());
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر تحميل نثريات المصنع', 'error');
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
    const totalAmountEl = document.getElementById('pettyTotalAmount');
    const totalCountEl = document.getElementById('pettyTotalCount');

    if (totalAmountEl) {
        totalAmountEl.textContent = formatMoney(state.totalAmount);
    }

    if (totalCountEl) {
        totalCountEl.textContent = (Number(state.totalCount) || 0).toLocaleString('en-US');
    }
}

function renderRows() {
    const body = document.getElementById('expensesBody');
    if (!state.rows.length) {
        body.innerHTML = `<tr><td colspan="6" class="petty-empty">لا توجد نثريات مصنع مسجلة</td></tr>`;
        return;
    }

    body.innerHTML = state.rows.map((row) => `
        <tr>
            <td>${row.document_number || ''}</td>
            <td>${row.expense_date || ''}</td>
            <td style="font-weight: 700; color: var(--primary-color);">${formatMoney(row.amount)}</td>
            <td class="statement-cell">${row.statement || ''}</td>
            <td class="notes-cell">${row.notes || ''}</td>
            <td>
                <button type="button" class="btn btn-outline" data-action="edit-expense" data-id="${row.id}">
                    <i class="fas fa-pen"></i> تعديل
                </button>
                <button type="button" class="btn btn-outline" data-action="delete-expense" data-id="${row.id}">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </td>
        </tr>
    `).join('');

    body.querySelectorAll('[data-action="edit-expense"]').forEach((button) => {
        button.addEventListener('click', () => openEditModal(button.dataset.id));
    });

    body.querySelectorAll('[data-action="delete-expense"]').forEach((button) => {
        button.addEventListener('click', () => deleteExpense(button.dataset.id));
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
        showMessage('تعذر العثور على مستند نثريات المصنع', 'error');
        return;
    }

    state.editingId = row.id;
    document.getElementById('documentNumber').value = row.document_number || '';
    document.getElementById('expenseDate').value = row.expense_date || today();
    document.getElementById('amount').value = row.amount ?? '';
    document.getElementById('statement').value = row.statement || '';
    document.getElementById('notes').value = row.notes || '';
    document.getElementById('addExpenseModal').classList.remove('hidden');
}

async function deleteExpense(id) {
    if (!window.showConfirmDialog) {
        showMessage('تعذر فتح نافذة التأكيد', 'error');
        return;
    }

    const confirmed = await window.showConfirmDialog('هل تريد حذف مستند نثريات المصنع؟');
    if (!confirmed) {
        return;
    }

    const result = await window.electronAPI.deleteFactoryPettyExpense(Number(id));
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر حذف مستند نثريات المصنع', 'error');
        return;
    }

    showMessage('تم حذف مستند نثريات المصنع بنجاح', 'success');
    await loadExpenses();
}

async function saveExpense(event) {
    event.preventDefault();
    if (state.isSaving) return;
    const payload = {
        expense_date: document.getElementById('expenseDate').value || today(),
        amount: document.getElementById('amount').value,
        statement: document.getElementById('statement').value,
        notes: document.getElementById('notes').value
    };

    state.isSaving = true;
    setSubmitButtonLoading(true);
    try {
        if (state.editingId) {
            payload.id = state.editingId;
            const result = await window.electronAPI.updateFactoryPettyExpense(payload);
            if (!result || !result.success) {
                showMessage((result && result.error) || 'تعذر تعديل نثريات المصنع', 'error');
                return;
            }

            showMessage('تم تعديل نثريات المصنع بنجاح', 'success');
            state.editingId = null;
            document.getElementById('addExpenseModal').classList.add('hidden');
            document.getElementById('pettyForm').reset();
            await loadExpenses();
            return;
        }

        const result = await window.electronAPI.saveFactoryPettyExpense(payload);
        if (!result || !result.success) {
            showMessage((result && result.error) || 'تعذر حفظ نثريات المصنع', 'error');
            return;
        }

        showMessage('تم حفظ نثريات المصنع بنجاح', 'success');
        document.getElementById('addExpenseModal').classList.add('hidden');
        document.getElementById('pettyForm').reset();
        document.getElementById('expenseDate').value = today();
        await refreshDocumentNumber();
        state.page = 1;
        await loadExpenses();
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

    const exportResult = await window.electronAPI.getFactoryPettyExpenses({
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
        const result = await window.electronAPI.saveFactoryPettyExpensesPdf({ defaultName: `Factory_Petty_Expenses_${date}.pdf` });
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
