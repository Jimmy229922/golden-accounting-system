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
    totalCollected: 0,
    totalRemaining: 0,
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

function formatQuantity(value) {
    return (Number(value) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
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

let modalItems = [];

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function initModalItems(initialItems) {
    if (Array.isArray(initialItems) && initialItems.length) {
        modalItems = initialItems.map((item) => {
            const tons = item.tons !== undefined && item.tons !== null ? item.tons : '';
            const price = item.price !== undefined && item.price !== null ? item.price : '';
            const total = roundMoney((Number(tons) || 0) * (Number(price) || 0));
            return { tons, price, total };
        });
    } else {
        modalItems = [{ tons: '', price: '', total: 0 }];
    }
    renderModalItems();
}

function renderModalItems() {
    const container = document.getElementById('itemsContainer');
    if (!container) return;

    const canDelete = modalItems.length > 1;
    container.innerHTML = modalItems.map((item, index) => `
        <div class="item-row" data-index="${index}">
            <div class="input-with-unit">
                <input type="number" class="form-control item-tons" data-index="${index}" min="0" step="any" placeholder="عدد الأطنان" value="${item.tons}" required>
                <span class="unit-badge">طن</span>
            </div>
            <div class="input-with-unit">
                <input type="number" class="form-control item-price" data-index="${index}" min="0" step="any" placeholder="سعر الطن" value="${item.price}" required>
                <span class="unit-badge">$</span>
            </div>
            <div class="input-with-unit">
                <input type="text" class="form-control item-total uneditable" value="${formatMoney(item.total)}" readonly>
                <span class="unit-badge">$</span>
            </div>
            <button type="button" class="btn btn-outline remove-item-btn" data-index="${index}" style="${canDelete ? '' : 'visibility: hidden;'}" title="حذف هذا البند">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    container.querySelectorAll('.item-tons').forEach((input) => {
        input.addEventListener('input', (e) => {
            const idx = Number(e.target.dataset.index);
            if (modalItems[idx]) {
                modalItems[idx].tons = e.target.value;
                const tons = Number(e.target.value) || 0;
                const price = Number(modalItems[idx].price) || 0;
                modalItems[idx].total = roundMoney(tons * price);
                const totalEl = container.querySelector(`.item-row[data-index="${idx}"] .item-total`);
                if (totalEl) totalEl.value = formatMoney(modalItems[idx].total);
                updateTotalPreview();
            }
        });
    });

    container.querySelectorAll('.item-price').forEach((input) => {
        input.addEventListener('input', (e) => {
            const idx = Number(e.target.dataset.index);
            if (modalItems[idx]) {
                modalItems[idx].price = e.target.value;
                const tons = Number(modalItems[idx].tons) || 0;
                const price = Number(e.target.value) || 0;
                modalItems[idx].total = roundMoney(tons * price);
                const totalEl = container.querySelector(`.item-row[data-index="${idx}"] .item-total`);
                if (totalEl) totalEl.value = formatMoney(modalItems[idx].total);
                updateTotalPreview();
            }
        });
    });

    container.querySelectorAll('.remove-item-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.index);
            if (modalItems.length > 1) {
                modalItems.splice(idx, 1);
                renderModalItems();
                updateTotalPreview();
            }
        });
    });

    updateTotalPreview();
}

function updateTotalPreview() {
    let totalTons = 0;
    let totalUsd = 0;

    modalItems.forEach((item) => {
        const tons = Number(item.tons) || 0;
        const price = Number(item.price) || 0;
        totalTons += tons;
        totalUsd += roundMoney(tons * price);
    });

    totalTons = Math.round((totalTons + Number.EPSILON) * 1000) / 1000;
    totalUsd = roundMoney(totalUsd);
    const avgPrice = totalTons > 0 ? roundMoney(totalUsd / totalTons) : 0;

    const tonsInput = document.getElementById('tonsCount');
    if (tonsInput) {
        tonsInput.value = totalTons > 0 ? totalTons : '0.00';
    }

    const priceInput = document.getElementById('tonPrice');
    if (priceInput) {
        priceInput.value = avgPrice > 0 ? formatMoney(avgPrice) : '0.00';
    }

    const totalInput = document.getElementById('totalUsd');
    if (totalInput) {
        totalInput.value = formatMoney(totalUsd);
    }

    const discountInput = document.getElementById('discountUsd');
    let discount = Number(discountInput?.value) || 0;
    if (discount < 0) {
        discount = 0;
        if (discountInput) discountInput.value = '';
    }
    const net = Math.max(0, totalUsd - discount);
    const netInput = document.getElementById('netUsd');
    if (netInput) {
        netInput.value = formatMoney(net);
    }
}

function getTonsPriceDisplay(row) {
    let items = null;
    if (row.items_json) {
        try {
            items = JSON.parse(row.items_json);
        } catch (_) {}
    }
    if (Array.isArray(items) && items.length > 1) {
        return `<div><strong>${formatQuantity(row.tons_count)} طن</strong> <span class="discount-badge" style="background: rgba(59, 130, 246, 0.12); color: #2563eb; margin-inline-start: 4px;">(${items.length} أصناف)</span></div>`;
    }
    return `${formatQuantity(row.tons_count)} طن × ${formatMoney(row.ton_price)} $`;
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
                <div class="stat-card stat-collected">
                    <div class="stat-icon"><i class="fas fa-check-double"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي المحصل بالدولار</div>
                        <div class="stat-value" id="underCollectionTotalCollected">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-remaining">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي الفواتير بالدولار بعد التحصيل</div>
                        <div class="stat-value" id="underCollectionTotalRemaining">0.00</div>
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
                        <div class="form-group">
                            <label>رقم الفاتورة</label>
                            <input type="text" id="invoiceNumberFilter" class="form-control" placeholder="بحث برقم الفاتورة...">
                        </div>
                        <div class="form-group">
                            <label>البيان</label>
                            <input type="text" id="statementFilter" class="form-control" placeholder="بحث بالبيان...">
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
                        <div id="underCollectionLinkedAlert" style="display: none; align-items: center; gap: 8px; background: rgba(59, 130, 246, 0.12); color: #2563eb; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.25); font-weight: 600; font-size: 0.9rem; margin-bottom: 14px;">
                            <i class="fas fa-link"></i>
                            <span>تنبيه: هذا السجل مرتبط بمستند تشغيل وحركة خزينة، وسيتم تحديثهما تلقائياً عند حفظ التعديلات.</span>
                        </div>
                        <div class="petty-modal-grid">
                            <div class="petty-modal-row three-cols">
                                <div class="form-group">
                                    <label><i class="fas fa-hashtag text-icon"></i> التسلسل</label>
                                    <input type="text" id="documentNumber" class="form-control uneditable" readonly>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-calendar-alt text-icon"></i> التاريخ</label>
                                    <input type="date" id="recordDate" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-file-invoice text-icon"></i> رقم الفاتورة <span class="required-asterisk">*</span></label>
                                    <input type="text" id="invoiceNumber" class="form-control" placeholder="رقم الفاتورة" required>
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

                            <div class="items-breakdown-card" style="grid-column: 1 / -1;">
                                <div class="items-breakdown-header">
                                    <label style="margin: 0; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
                                        <i class="fas fa-cubes text-icon"></i> بنود الفاتورة (الأوزان والأسعار) <span class="required-asterisk">*</span>
                                    </label>
                                    <button type="button" class="btn btn-outline add-item-btn" id="addItemRowBtn">
                                        <i class="fas fa-plus"></i> إضافة بند آخر
                                    </button>
                                </div>
                                <div class="item-row-header">
                                    <div>عدد الأطنان</div>
                                    <div>سعر الطن ($)</div>
                                    <div>الإجمالي ($)</div>
                                    <div></div>
                                </div>
                                <div id="itemsContainer" class="items-table-wrapper"></div>
                            </div>

                            <div class="petty-modal-row six-cols">
                                <div class="form-group">
                                    <label><i class="fas fa-weight-hanging text-icon"></i> إجمالي الأطنان</label>
                                    <div class="input-with-unit">
                                        <input type="text" id="tonsCount" class="form-control uneditable" value="0.00" readonly>
                                        <span class="unit-badge">طن</span>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-tag text-icon"></i> متوسط السعر</label>
                                    <div class="input-with-unit">
                                        <input type="text" id="tonPrice" class="form-control uneditable" value="0.00" readonly>
                                        <span class="unit-badge">$</span>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-dollar-sign text-icon"></i> إجمالي الفاتورة</label>
                                    <div class="input-with-unit">
                                        <input type="text" id="totalUsd" class="form-control uneditable" value="0.00" readonly>
                                        <span class="unit-badge">$</span>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-percent text-icon"></i> الخصم</label>
                                    <div class="input-with-unit">
                                        <input type="number" id="discountUsd" class="form-control" min="0" step="any" placeholder="0.00">
                                        <span class="unit-badge">$</span>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-receipt text-icon"></i> الصافي</label>
                                    <div class="input-with-unit">
                                        <input type="text" id="netUsd" class="form-control uneditable" value="0.00" readonly>
                                        <span class="unit-badge">$</span>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-hand-holding-usd text-icon"></i> المتبقي</label>
                                    <div class="remaining-alert-box">
                                        <select id="remainingType" class="form-control">
                                            <option value="percent" selected>%</option>
                                            <option value="usd">$</option>
                                        </select>
                                        <input type="number" id="remainingValue" class="form-control" min="0" step="any" placeholder="المتبقي">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="petty-modal-footer">
                        <button type="button" class="btn btn-outline" id="previewOperationBtn" style="margin-inline-end: auto; display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: #0284c7; border-color: rgba(2, 132, 199, 0.4);">
                            <i class="fas fa-eye"></i> معاينة مستند التشغيل المتوقع
                        </button>
                        <button type="button" class="btn btn-outline" id="cancelModalBtn">إلغاء</button>
                        <button type="submit" class="btn btn-primary submit-btn">
                            <i class="fas fa-check-circle"></i> حفظ واعتماد
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div id="operationPreviewModal" class="petty-modal-overlay hidden" style="z-index: 100001;">
            <div class="petty-modal-card" style="width: min(92vw, 660px); max-width: 660px;" role="dialog" aria-modal="true" aria-labelledby="opPreviewTitle">
                <div class="petty-modal-header" style="padding: 14px 22px;">
                    <div class="petty-modal-title">
                        <i class="fas fa-cogs" style="color: #0284c7;"></i>
                        <h2 id="opPreviewTitle">معاينة مستند التشغيل وحركة الخزينة</h2>
                    </div>
                    <button type="button" class="petty-modal-close" id="closeOpPreviewBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="petty-modal-body" id="opPreviewContent" style="padding: 18px 22px; max-height: 80vh;"></div>
                <div class="petty-modal-footer" style="padding: 12px 22px; justify-content: flex-end;">
                    <button type="button" class="btn btn-primary" id="confirmOpPreviewBtn" style="border-radius: 8px; padding: 8px 24px;">
                        إغلاق المعاينة
                    </button>
                </div>
            </div>
        </div>
    `;
}

function bindEvents() {
    document.getElementById('underCollectionForm').addEventListener('submit', saveRecord);

    const triggerSearch = () => {
        state.page = 1;
        loadRecords();
    };

    document.getElementById('filterBtn').addEventListener('click', triggerSearch);
    document.getElementById('invoiceNumberFilter')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            triggerSearch();
        }
    });
    document.getElementById('statementFilter')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            triggerSearch();
        }
    });

    document.getElementById('resetFilterBtn').addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        const inv = document.getElementById('invoiceNumberFilter');
        if (inv) inv.value = '';
        const st = document.getElementById('statementFilter');
        if (st) st.value = '';
        state.page = 1;
        loadRecords();
    });

    document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);
    document.getElementById('discountUsd')?.addEventListener('input', updateTotalPreview);

    document.getElementById('addItemRowBtn')?.addEventListener('click', () => {
        modalItems.push({ tons: '', price: '', total: 0 });
        renderModalItems();
    });

    const modal = document.getElementById('addRecordModal');
    document.getElementById('openAddModalBtn').addEventListener('click', async () => {
        state.editingId = null;
        document.getElementById('underCollectionForm').reset();
        document.getElementById('recordDate').value = today();
        document.getElementById('discountUsd').value = '';
        document.getElementById('remainingType').value = 'percent';
        const alertEl = document.getElementById('underCollectionLinkedAlert');
        if (alertEl) alertEl.style.display = 'none';
        initModalItems([{ tons: '', price: '', total: 0 }]);
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

    document.getElementById('previewOperationBtn')?.addEventListener('click', openOperationPreview);
    document.getElementById('closeOpPreviewBtn')?.addEventListener('click', closeOperationPreview);
    document.getElementById('confirmOpPreviewBtn')?.addEventListener('click', closeOperationPreview);
    const opPreviewModal = document.getElementById('operationPreviewModal');
    opPreviewModal?.addEventListener('click', (e) => {
        if (e.target === opPreviewModal) closeOperationPreview();
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

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function openOperationPreview() {
    let totalTons = 0;
    modalItems.forEach((item) => {
        totalTons += Number(item.tons) || 0;
    });
    totalTons = Math.round((totalTons + Number.EPSILON) * 1000) / 1000;

    const invoiceNumber = document.getElementById('invoiceNumber')?.value?.trim() || '---';
    const recordDate = document.getElementById('recordDate')?.value || today();
    const statement = document.getElementById('statement')?.value?.trim() || '---';
    const operationAmount = roundMoney(totalTons * 2000);

    const containerCount = document.getElementById('containerCount')?.value || '0';
    const is20 = document.getElementById('container20')?.checked;
    const is40 = document.getElementById('container40')?.checked;
    const containerSizes = [];
    if (is20) containerSizes.push('20');
    if (is40) containerSizes.push('40');
    const containerText = `${containerCount} حاوية ${containerSizes.length ? `(${containerSizes.join(' + ')})` : ''}`;

    const contentEl = document.getElementById('opPreviewContent');
    if (!contentEl) return;

    contentEl.innerHTML = `
        <div class="op-preview-banner">
            <i class="fas fa-info-circle"></i>
            <span>سيتم إنشاء هذا القيد آلياً في شاشة (التشغيل) وحركة الخزينة فور الضغط على "حفظ واعتماد":</span>
        </div>

        <div class="op-preview-highlight">
            <div>
                <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">قيمة مصروف التشغيل (2,000 ج.م / طن)</div>
                <div style="font-size: 1.4rem; font-weight: 900; color: #10b981; margin-top: 2px;">
                    ${formatMoney(operationAmount)} <span style="font-size: 0.9rem; font-weight: 700;">ج.م</span>
                </div>
            </div>
            <div style="text-align: left;">
                <span class="discount-badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 0.9rem;">
                    ${formatQuantity(totalTons)} طن × 2,000 ج.م
                </span>
            </div>
        </div>

        <div class="op-preview-grid">
            <div class="op-preview-item">
                <span class="op-preview-label"><i class="fas fa-file-invoice text-icon"></i> رقم الفاتورة في التشغيل</span>
                <span class="op-preview-val">${escapeHtml(invoiceNumber)}</span>
            </div>
            <div class="op-preview-item">
                <span class="op-preview-label"><i class="fas fa-calendar-alt text-icon"></i> تاريخ القيد</span>
                <span class="op-preview-val">${escapeHtml(recordDate)}</span>
            </div>
            <div class="op-preview-item">
                <span class="op-preview-label"><i class="fas fa-layer-group text-icon"></i> التصنيف</span>
                <span class="op-preview-val">مصاريف تشغيل (operation)</span>
            </div>
            <div class="op-preview-item">
                <span class="op-preview-label"><i class="fas fa-box text-icon"></i> الحاويات</span>
                <span class="op-preview-val">${escapeHtml(containerText)}</span>
            </div>
            <div class="op-preview-item full-width">
                <span class="op-preview-label"><i class="fas fa-pen text-icon"></i> البيان المسجل في التشغيل</span>
                <span class="op-preview-val">${escapeHtml(statement)}</span>
            </div>
            <div class="op-preview-item full-width">
                <span class="op-preview-label"><i class="fas fa-university text-icon"></i> التأثير المالي على الخزينة</span>
                <span class="op-preview-val" style="color: #dc2626;">خصم مبلغ (${formatMoney(operationAmount)} ج.م) من رصيد الخزينة الرئيسية</span>
            </div>
        </div>

        <div class="op-preview-note">
            <i class="fas fa-shield-alt text-icon"></i>
            <span>تنبيه: هذا عرض توضيحي للمعاينة فقط، ولن يتم إجراء أي خصم أو تسجيل قيود في النظام إلا بعد النقر على "حفظ واعتماد".</span>
        </div>
    `;

    document.getElementById('operationPreviewModal')?.classList.remove('hidden');
}

function closeOperationPreview() {
    document.getElementById('operationPreviewModal')?.classList.add('hidden');
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
        startDate: document.getElementById('startDate')?.value || '',
        endDate: document.getElementById('endDate')?.value || '',
        invoiceNumber: document.getElementById('invoiceNumberFilter')?.value?.trim() || '',
        statement: document.getElementById('statementFilter')?.value?.trim() || ''
    };
}

async function loadRecords() {
    const result = await window.electronAPI.getUnderCollectionRecords(getFilters());
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر تحميل تحت التحصيل', 'error');
        return;
    }

    state.rows = Array.isArray(result.rows) ? result.rows : [];
    state.page = Number(result.page) || state.page;
    state.pageSize = Number(result.pageSize) || state.pageSize;
    state.totalPages = Number(result.totalPages) || 1;
    state.totalAmount = Number(result.totalAmount) || 0;
    state.totalCollected = Number(result.totalCollected) || 0;
    state.totalRemaining = Number(result.totalRemaining) || 0;
    state.totalCount = Number(result.total) || 0;
    renderRows();
    renderPagination();
    renderSummary();
}

function renderSummary() {
    const totalAmountEl = document.getElementById('underCollectionTotalAmount');
    const totalCollectedEl = document.getElementById('underCollectionTotalCollected');
    const totalRemainingEl = document.getElementById('underCollectionTotalRemaining');
    const totalCountEl = document.getElementById('underCollectionTotalCount');

    if (totalAmountEl) {
        totalAmountEl.textContent = formatMoney(state.totalAmount);
    }

    if (totalCollectedEl) {
        totalCollectedEl.textContent = formatMoney(state.totalCollected);
    }

    if (totalRemainingEl) {
        totalRemainingEl.textContent = formatMoney(state.totalRemaining);
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
            <td>${getTonsPriceDisplay(row)}</td>
            <td>
                <div class="invoice-total-cell">
                    <strong>${formatMoney(row.net_usd !== undefined && row.net_usd !== null && (Number(row.net_usd) > 0 || Number(row.discount_usd) > 0) ? row.net_usd : row.total_usd)} $</strong>
                    ${Number(row.discount_usd) > 0 ? `<span class="discount-badge"><i class="fas fa-tag"></i> خصم: ${formatMoney(row.discount_usd)} $</span>` : ''}
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
    document.getElementById('containerCount').value = row.container_count ?? '';
    document.getElementById('container20').checked = Boolean(Number(row.container_20));
    document.getElementById('container40').checked = Boolean(Number(row.container_40));
    document.getElementById('statement').value = row.statement || '';
    document.getElementById('invoiceNumber').value = row.invoice_number || '';
    document.getElementById('discountUsd').value = row.discount_usd ? Number(row.discount_usd) : '';
    document.getElementById('remainingType').value = row.remaining_type || 'percent';
    document.getElementById('remainingValue').value = row.remaining_value ?? '';
    const alertEl = document.getElementById('underCollectionLinkedAlert');
    if (alertEl) {
        if (row.operation_expense_id) {
            alertEl.style.display = 'flex';
        } else {
            alertEl.style.display = 'none';
        }
    }

    let items = null;
    if (row.items_json) {
        try {
            items = JSON.parse(row.items_json);
        } catch (_) {}
    }
    if (!Array.isArray(items) || !items.length) {
        items = [{
            tons: row.tons_count ?? '',
            price: row.ton_price ?? '',
            total: row.total_usd ?? 0
        }];
    }
    initModalItems(items);
    document.getElementById('addRecordModal').classList.remove('hidden');
}

async function deleteRecord(id) {
    if (!window.showConfirmDialog) {
        showMessage('تعذر فتح نافذة التأكيد', 'error');
        return;
    }

    const row = getRowById(id);
    const confirmMsg = (row && row.operation_expense_id)
        ? 'هل تريد حذف سجل تحت التحصيل؟\n\nتنبيه: هذا السجل مرتبط بمستند تشغيل وحركة في الخزينة، وسيتم حذفهما تلقائياً.'
        : 'هل تريد حذف سجل تحت التحصيل؟';
    const confirmed = await window.showConfirmDialog(confirmMsg);
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
    }
    await loadRecords();
}

async function saveRecord(event) {
    event.preventDefault();
    if (state.isSaving) return;

    let totalTons = 0;
    let totalUsd = 0;
    const cleanItems = [];

    modalItems.forEach((item) => {
        const tons = Number(item.tons) || 0;
        const price = Number(item.price) || 0;
        if (tons > 0 && price > 0) {
            const itemTotal = roundMoney(tons * price);
            totalTons += tons;
            totalUsd += itemTotal;
            cleanItems.push({
                tons,
                price: roundMoney(price),
                total: itemTotal
            });
        }
    });

    if (!cleanItems.length || totalTons <= 0) {
        showMessage('يرجى إدخال عدد أطنان وسعر صحيح للبند', 'error');
        return;
    }

    totalTons = Math.round((totalTons + Number.EPSILON) * 1000) / 1000;
    totalUsd = roundMoney(totalUsd);
    const tonPrice = totalTons > 0 ? roundMoney(totalUsd / totalTons) : (cleanItems[0]?.price || 0);

    const payload = {
        record_date: document.getElementById('recordDate').value || today(),
        container_count: document.getElementById('containerCount').value,
        container_20: document.getElementById('container20').checked ? 1 : 0,
        container_40: document.getElementById('container40').checked ? 1 : 0,
        statement: document.getElementById('statement').value,
        invoice_number: document.getElementById('invoiceNumber').value,
        tons_count: totalTons,
        ton_price: tonPrice,
        total_usd: totalUsd,
        discount_usd: document.getElementById('discountUsd').value || 0,
        remaining_type: document.getElementById('remainingType').value,
        remaining_value: document.getElementById('remainingValue').value,
        items_json: JSON.stringify(cleanItems)
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
        document.getElementById('addRecordModal').classList.add('hidden');
        document.getElementById('underCollectionForm').reset();
        document.getElementById('recordDate').value = today();
        document.getElementById('discountUsd').value = '';
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
    const filters = getFilters();
    const startDate = filters.startDate;
    const endDate = filters.endDate;
    const currentRows = state.rows.slice();
    document.getElementById('printRange').textContent = startDate || endDate
        ? `الفترة: ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}`
        : '';

    const exportResult = await window.electronAPI.getUnderCollectionRecords({
        ...filters,
        page: 1,
        pageSize: 100000
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
