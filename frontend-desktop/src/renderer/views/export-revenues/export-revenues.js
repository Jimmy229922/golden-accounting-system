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
    totalEgp: 0,
    totalCount: 0,
    currentLinkedInvoice: null
};

let invoiceLookupTimeout = null;

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
    const submitBtn = document.querySelector('#exportRevenuesForm .submit-btn');
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
    if (!Number.isFinite(num)) return '0.00';

    const min = Number.isFinite(options.min) ? options.min : 2;
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
                    <p>تسجيل ومتابعة عوائد التصدير وتحصيل الفواتير الخارجية بالعملة الأجنبية والمصري</p>
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
                        <div class="stat-value" id="exportRevenuesTotalAmount">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-egp">
                    <div class="stat-icon"><i class="fas fa-sack-dollar"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي المصري</div>
                        <div class="stat-value" id="exportRevenuesTotalEgp">0.00</div>
                    </div>
                </div>
            </section>

            <section class="invoice-form-container petty-filters-card">
                <div class="invoice-shell">
                    <div class="form-title-row" style="padding-bottom: 0; border-bottom: none;"></div>
                    <div class="invoice-top-grid filter-grid" style="grid-template-columns: repeat(4, minmax(0, 1fr)) auto; gap: 12px; align-items: flex-end;">
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
                            <button type="button" class="btn btn-primary" id="filterBtn" style="border-radius: 8px;">
                                <i class="fas fa-search" style="margin-inline-end: 5px;"></i> بحث
                            </button>
                            <button type="button" class="btn btn-outline" id="resetFilterBtn" style="border-radius: 8px;">
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
                                    <th>رقم الفاتورة</th>
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
            <div class="petty-modal-card" style="width: min(95vw, 980px); max-width: 980px;" role="dialog" aria-modal="true" aria-labelledby="exportRevenuesModalTitle">
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
                            <div class="petty-modal-row three-cols">
                                <div class="form-group">
                                    <label><i class="fas fa-hashtag text-icon"></i> رقم المسلسل</label>
                                    <input type="text" id="documentNumber" class="form-control uneditable" readonly>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-calendar-alt text-icon"></i> التاريخ</label>
                                    <input type="date" id="recordDate" class="form-control" required>
                                </div>
                                <div class="form-group" style="position: relative;">
                                    <label><i class="fas fa-file-invoice text-icon"></i> رقم الفاتورة (تحت التحصيل)</label>
                                    <div class="invoice-dropdown-wrap">
                                        <input type="text" id="invoiceNumberInput" class="form-control" placeholder="اكتب للبحث أو اختر رقم الفاتورة..." autocomplete="off">
                                        <button type="button" id="toggleInvoiceDropdownBtn" class="invoice-dropdown-arrow" aria-label="عرض الفواتير">
                                            <i class="fas fa-chevron-down"></i>
                                        </button>
                                        <div id="invoiceCustomDropdown" class="invoice-custom-dropdown hidden"></div>
                                    </div>
                                </div>
                            </div>

                            <div id="underCollectionInfoCard" class="under-collection-info-card" style="display: none;"></div>

                            <div class="petty-modal-row three-cols">
                                <div class="form-group">
                                    <label><i class="fas fa-coins text-icon"></i> المبلغ <span class="required-asterisk">*</span></label>
                                    <input type="text" id="amountInput" class="form-control number-input" placeholder="0" required>
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-dollar-sign text-icon"></i> العملة <span class="required-asterisk">*</span></label>
                                    <input type="text" id="currencyInput" class="form-control" value="دولار" placeholder="مثال: دولار" required>
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
                        <button type="button" class="btn btn-outline" id="previewInvoiceSyncBtn" style="margin-inline-end: auto; display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: #0284c7; border-color: rgba(2, 132, 199, 0.4);">
                            <i class="fas fa-eye"></i> معاينة أثر التحصيل (قبل / بعد)
                        </button>
                        <button type="button" class="btn btn-outline" id="cancelModalBtn">إلغاء</button>
                        <button type="submit" class="btn btn-primary submit-btn">
                            <i class="fas fa-check-circle"></i> حفظ واعتماد
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div id="invoiceSyncPreviewModal" class="petty-modal-overlay hidden" style="z-index: 100001;">
            <div class="petty-modal-card" style="width: min(92vw, 760px); max-width: 760px;" role="dialog" aria-modal="true" aria-labelledby="syncPreviewTitle">
                <div class="petty-modal-header" style="padding: 14px 22px;">
                    <div class="petty-modal-title">
                        <i class="fas fa-exchange-alt" style="color: #0284c7;"></i>
                        <h2 id="syncPreviewTitle">معاينة مقارنة الفاتورة تحت التحصيل (قبل / بعد)</h2>
                    </div>
                    <button type="button" class="petty-modal-close" id="closeSyncPreviewBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="petty-modal-body" id="invoiceSyncPreviewContent" style="padding: 18px 22px; max-height: 80vh;"></div>
                <div class="petty-modal-footer" style="padding: 12px 22px; justify-content: flex-end;">
                    <button type="button" class="btn btn-primary" id="confirmSyncPreviewBtn" style="border-radius: 8px; padding: 8px 24px;">
                        إغلاق المعاينة
                    </button>
                </div>
            </div>
        </div>
    `;
}

function bindEvents() {
    document.getElementById('exportRevenuesForm').addEventListener('submit', saveRecord);
    
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
        document.getElementById('invoiceNumberFilter').value = '';
        document.getElementById('statementFilter').value = '';
        state.page = 1;
        loadRecords();
    });
    document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);

    const modal = document.getElementById('addRecordModal');
    document.getElementById('openAddModalBtn').addEventListener('click', async () => {
        state.editingId = null;
        state.currentLinkedInvoice = null;
        document.getElementById('exportRevenuesForm').reset();
        document.getElementById('recordDate').value = today();
        document.getElementById('currencyInput').value = 'دولار';
        document.getElementById('amountEgp').value = '';
        document.getElementById('invoiceNumberInput').value = '';
        renderUnderCollectionInfoCard(null);
        closeInvoiceDropdown();
        await refreshDocumentNumber();
        await loadUnderCollectionInvoices();
        modal.classList.remove('hidden');
    });

    const closeModal = () => {
        state.editingId = null;
        state.currentLinkedInvoice = null;
        closeInvoiceDropdown();
        modal.classList.add('hidden');
    };
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    attachNumberFormatting(document.getElementById('amountInput'));
    attachNumberFormatting(document.getElementById('exchangeRateInput'));

    const invoiceInput = document.getElementById('invoiceNumberInput');
    invoiceInput?.addEventListener('input', () => {
        renderInvoiceDropdown(invoiceInput.value);
        onInvoiceNumberInput();
    });
    invoiceInput?.addEventListener('focus', () => {
        renderInvoiceDropdown(invoiceInput.value);
    });

    document.getElementById('toggleInvoiceDropdownBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const dd = document.getElementById('invoiceCustomDropdown');
        if (dd && dd.classList.contains('hidden')) {
            renderInvoiceDropdown(invoiceInput?.value || '');
        } else {
            closeInvoiceDropdown();
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.invoice-dropdown-wrap')) {
            closeInvoiceDropdown();
        }
    });

    document.getElementById('previewInvoiceSyncBtn')?.addEventListener('click', openInvoiceSyncPreview);
    document.getElementById('closeSyncPreviewBtn')?.addEventListener('click', closeInvoiceSyncPreview);
    document.getElementById('confirmSyncPreviewBtn')?.addEventListener('click', closeInvoiceSyncPreview);
    const syncModal = document.getElementById('invoiceSyncPreviewModal');
    syncModal?.addEventListener('click', (e) => {
        if (e.target === syncModal) closeInvoiceSyncPreview();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const previewModal = document.getElementById('invoiceSyncPreviewModal');
            if (previewModal && !previewModal.classList.contains('hidden')) {
                closeInvoiceSyncPreview();
                e.stopPropagation();
            } else {
                closeInvoiceDropdown();
            }
        }
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

let cachedUnderCollectionInvoices = [];

async function loadUnderCollectionInvoices() {
    try {
        const res = await window.electronAPI.getUnderCollectionInvoicesForExport();
        if (res && res.success && Array.isArray(res.rows)) {
            cachedUnderCollectionInvoices = res.rows;
        } else {
            cachedUnderCollectionInvoices = [];
        }
    } catch (_) {
        cachedUnderCollectionInvoices = [];
    }
}

function renderInvoiceDropdown(filterText = '') {
    const dropdown = document.getElementById('invoiceCustomDropdown');
    if (!dropdown) return;

    const term = String(filterText || '').trim().toLowerCase();
    const filtered = cachedUnderCollectionInvoices.filter((r) => {
        if (!term) return true;
        const invNum = String(r.invoice_number || '').toLowerCase();
        const docNum = String(r.document_number || '').toLowerCase();
        const stmt = String(r.statement || '').toLowerCase();
        return invNum.includes(term) || docNum.includes(term) || stmt.includes(term);
    });

    if (!filtered.length) {
        dropdown.innerHTML = `<div class="invoice-drop-empty"><i class="fas fa-search text-icon"></i> لا توجد فواتير مطابقة</div>`;
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = filtered.map((r) => {
        const remaining = Number(r.remaining_usd) || 0;
        const net = Number(r.net_usd) || 0;
        const totalPaid = Number(r.total_paid) || 0;
        const isFullyCollected = remaining <= 0 && net > 0;
        const isPartialCollected = !isFullyCollected && (totalPaid > 0 || (Number(r.is_collected) === 1 && remaining < net));

        let badgeText = 'تحت التحصيل';
        let badgeClass = 'badge-pending';
        if (isFullyCollected) {
            badgeText = 'مكتملة التحصيل';
            badgeClass = 'badge-collected';
        } else if (isPartialCollected) {
            badgeText = 'تحصيل جزئي';
            badgeClass = 'badge-partial';
        }

        return `
            <div class="invoice-drop-item" data-invoice="${escapeHtml(r.invoice_number)}">
                <div class="invoice-drop-header">
                    <span class="invoice-drop-num">
                        <i class="fas fa-file-invoice text-icon"></i>
                        فاتورة: ${escapeHtml(r.invoice_number)} (${escapeHtml(r.document_number)})
                    </span>
                    <span class="invoice-drop-badge ${badgeClass}">
                        ${badgeText}
                    </span>
                </div>
                <div class="invoice-drop-details">
                    <span class="invoice-drop-desc" title="${escapeHtml(r.statement || '')}">
                        ${escapeHtml(r.statement || 'بدون بيان')}
                    </span>
                    <span class="invoice-drop-rem">
                        المتبقي: ${formatNumber(remaining)} $
                    </span>
                </div>
            </div>
        `;
    }).join('');

    dropdown.querySelectorAll('.invoice-drop-item').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectInvoiceFromDropdown(item.dataset.invoice);
        });
    });

    dropdown.classList.remove('hidden');
}

function selectInvoiceFromDropdown(invoiceNumber) {
    const input = document.getElementById('invoiceNumberInput');
    if (input) {
        input.value = invoiceNumber;
    }
    closeInvoiceDropdown();
    onInvoiceNumberInput(true);
}

function closeInvoiceDropdown() {
    document.getElementById('invoiceCustomDropdown')?.classList.add('hidden');
}

async function onInvoiceNumberInput() {
    clearTimeout(invoiceLookupTimeout);
    invoiceLookupTimeout = setTimeout(async () => {
        const invNum = document.getElementById('invoiceNumberInput')?.value?.trim();
        if (!invNum) {
            state.currentLinkedInvoice = null;
            renderUnderCollectionInfoCard(null);
            return;
        }

        const res = await window.electronAPI.getUnderCollectionInvoiceDetails({
            invoiceNumber: invNum,
            exportRevenueId: state.editingId
        });

        if (res && res.success && res.found) {
            state.currentLinkedInvoice = res.invoice;
            renderUnderCollectionInfoCard(res.invoice);
        } else {
            state.currentLinkedInvoice = null;
            renderUnderCollectionInfoCard({ notFound: true, invoiceNumber: invNum });
        }
    }, 200);
}

function renderUnderCollectionInfoCard(inv) {
    const card = document.getElementById('underCollectionInfoCard');
    if (!card) return;

    if (!inv) {
        card.style.display = 'none';
        card.innerHTML = '';
        return;
    }

    if (inv.notFound) {
        card.style.display = 'block';
        card.innerHTML = `
            <div class="uc-linked-notice">
                <i class="fas fa-info-circle text-icon"></i>
                <span>لم يتم العثور على فاتورة تحت التحصيل برقم (<strong>${escapeHtml(inv.invoiceNumber)}</strong>). سيتم تسجيل الإيراد بشكل منفصل.</span>
            </div>
        `;
        return;
    }

    card.style.display = 'block';
    card.innerHTML = `
        <div class="uc-linked-box">
            <div class="uc-linked-header">
                <span class="uc-badge"><i class="fas fa-link"></i> مرتبطة بفاتورة تحت التحصيل (${escapeHtml(inv.document_number)})</span>
                <span class="uc-status ${inv.is_collected ? 'collected' : 'pending'}">${inv.is_collected ? 'مكتملة التحصيل' : 'تحت التحصيل'}</span>
            </div>
            <div class="uc-linked-grid">
                <div class="uc-linked-item">
                    <span class="uc-item-label">إجمالي الفاتورة:</span>
                    <span class="uc-item-val">${formatNumber(inv.total_usd)} $</span>
                </div>
                <div class="uc-linked-item">
                    <span class="uc-item-label">الصافي الحالي:</span>
                    <span class="uc-item-val">${formatNumber(inv.net_usd)} $</span>
                </div>
                <div class="uc-linked-item">
                    <span class="uc-item-label">المسدد سابقاً:</span>
                    <span class="uc-item-val" style="color: #10b981;">${formatNumber(inv.paidBefore)} $</span>
                </div>
                <div class="uc-linked-item">
                    <span class="uc-item-label">المتبقي الحالي:</span>
                    <span class="uc-item-val" style="color: #f59e0b;">${formatNumber(inv.remainingBefore)} $ (${inv.remainingPercentBefore}%)</span>
                </div>
            </div>
            <div class="uc-linked-discount">
                <label><i class="fas fa-tag text-icon"></i> تعديل خصم الفاتورة ($):</label>
                <input type="number" id="invoiceDiscountInput" class="form-control" min="0" step="any" value="${inv.discount_usd || ''}" placeholder="0.00">
            </div>
        </div>
    `;
}

function openInvoiceSyncPreview() {
    const invNum = document.getElementById('invoiceNumberInput')?.value?.trim();
    const modal = document.getElementById('invoiceSyncPreviewModal');
    const content = document.getElementById('invoiceSyncPreviewContent');
    if (!modal || !content) return;

    if (!invNum || !state.currentLinkedInvoice) {
        content.innerHTML = `
            <div style="text-align: center; padding: 30px 20px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; color: #f59e0b; margin-bottom: 12px; display: block;"></i>
                <h3 style="margin-bottom: 8px; font-weight: 800;">لم يتم تحديد فاتورة تحت التحصيل بعد</h3>
                <p style="color: var(--text-muted); font-size: 0.95rem;">يرجى كتابة أو اختيار رقم فاتورة مسجلة في شاشة (تحت التحصيل) لمعاينة المقارنة وأثر التحصيل.</p>
            </div>
        `;
        modal.classList.remove('hidden');
        return;
    }

    const inv = state.currentLinkedInvoice;
    const currentAmount = parseNumberInput(document.getElementById('amountInput').value) || 0;
    const currentRate = parseNumberInput(document.getElementById('exchangeRateInput').value) || 0;
    const currentAmountEgp = roundMoney(currentAmount * currentRate);

    const discountEl = document.getElementById('invoiceDiscountInput');
    const newDiscount = discountEl && discountEl.value !== '' ? Math.max(0, Number(discountEl.value) || 0) : Number(inv.discount_usd) || 0;
    const newNet = Math.max(0, roundMoney(inv.total_usd - newDiscount));

    const newTotalPaid = roundMoney(inv.paidBefore + currentAmount);
    const newRemaining = Math.max(0, roundMoney(newNet - newTotalPaid));
    const newPercent = newNet > 0 ? roundMoney((newRemaining / newNet) * 100) : 0;
    const newIsCollected = (newRemaining <= 0 && newNet > 0);

    content.innerHTML = `
        <div class="sync-preview-header-card">
            <div>
                <span class="sync-preview-title"><i class="fas fa-file-invoice text-icon"></i> فاتورة رقم: <strong>${escapeHtml(inv.invoice_number)}</strong> (${escapeHtml(inv.document_number)})</span>
                <div class="sync-preview-subtitle">${escapeHtml(inv.statement || '')}</div>
            </div>
            <div>
                <span class="discount-badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 0.95rem;">
                    دفعة جديدة: ${formatNumber(currentAmount)} $
                </span>
            </div>
        </div>

        <div class="sync-preview-table-wrap">
            <table class="sync-preview-table">
                <thead>
                    <tr>
                        <th>بند المقارنة</th>
                        <th>قبل التحصيل (الحالي)</th>
                        <th>بعد التحصيل (الجديد)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>إجمالي الفاتورة بالدولار</td>
                        <td>${formatNumber(inv.total_usd)} $</td>
                        <td>${formatNumber(inv.total_usd)} $</td>
                    </tr>
                    <tr>
                        <td>خصم الفاتورة</td>
                        <td>${formatNumber(inv.discount_usd)} $</td>
                        <td><strong style="color: #ef4444;">${formatNumber(newDiscount)} $</strong></td>
                    </tr>
                    <tr>
                        <td>الصافي المطلوب سداده</td>
                        <td>${formatNumber(inv.net_usd)} $</td>
                        <td><strong>${formatNumber(newNet)} $</strong></td>
                    </tr>
                    <tr>
                        <td>إجمالي المسدد والمحصل</td>
                        <td>${formatNumber(inv.paidBefore)} $</td>
                        <td><strong style="color: #10b981;">${formatNumber(newTotalPaid)} $</strong></td>
                    </tr>
                    <tr>
                        <td>المتبقي بالدولار</td>
                        <td>${formatNumber(inv.remainingBefore)} $</td>
                        <td><strong style="color: #f59e0b; font-size: 1.1rem;">${formatNumber(newRemaining)} $</strong></td>
                    </tr>
                    <tr>
                        <td>نسبة المتبقي (%)</td>
                        <td>${inv.remainingPercentBefore}%</td>
                        <td><strong>${newPercent}%</strong></td>
                    </tr>
                    <tr>
                        <td>حالة الفاتورة تحت التحصيل</td>
                        <td>
                            <span class="status-pill ${inv.is_collected ? 'pill-success' : 'pill-warning'}">
                                ${inv.is_collected ? 'مكتملة التحصيل' : 'تحت التحصيل'}
                            </span>
                        </td>
                        <td>
                            <span class="status-pill ${newIsCollected ? 'pill-success' : 'pill-warning'}">
                                ${newIsCollected ? 'مكتملة التحصيل' : 'متبقي جزئي'}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="sync-preview-footer-note">
            <i class="fas fa-calculator text-icon"></i>
            <span>قيد إيراد التصدير الجديد: تسجيل <strong>${formatNumber(currentAmount)} $</strong> بسعر صرف <strong>${formatNumber(currentRate)}</strong> = <strong>${formatNumber(currentAmountEgp)} ج.م</strong> مصري.</span>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closeInvoiceSyncPreview() {
    document.getElementById('invoiceSyncPreviewModal')?.classList.add('hidden');
}

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
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
        startDate: document.getElementById('startDate')?.value || '',
        endDate: document.getElementById('endDate')?.value || '',
        invoiceNumber: document.getElementById('invoiceNumberFilter')?.value?.trim() || '',
        statement: document.getElementById('statementFilter')?.value?.trim() || ''
    };
}

async function loadRecords() {
    const result = await window.electronAPI.getExportRevenues(getFilters());
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر تحميل إيرادات التصدير', 'error');
        return;
    }

    state.rows = Array.isArray(result.rows) ? result.rows : [];
    state.page = Number(result.page) || state.page;
    state.pageSize = Number(result.pageSize) || state.pageSize;
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
        body.innerHTML = `<tr><td colspan="10" class="petty-empty">لا توجد إيرادات تصدير مسجلة</td></tr>`;
        return;
    }

    const startIndex = (state.page - 1) * state.pageSize;
    body.innerHTML = state.rows.map((row, index) => `
        <tr>
            <td>${escapeHtml(row.document_number || startIndex + index + 1)}</td>
            <td>${escapeHtml(formatWeekday(row.record_date))}</td>
            <td>${escapeHtml(row.record_date || '')}</td>
            <td><strong>${escapeHtml(row.invoice_number || '-')}</strong></td>
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
    document.getElementById('amountInput').value = formatNumber(row.amount);
    document.getElementById('currencyInput').value = row.currency || 'دولار';
    document.getElementById('exchangeRateInput').value = formatNumber(row.exchange_rate);
    document.getElementById('amountEgp').value = formatNumber(row.amount_egp);
    document.getElementById('statementInput').value = row.statement || '';
    document.getElementById('invoiceNumberInput').value = row.invoice_number || '';

    closeInvoiceDropdown();
    await loadUnderCollectionInvoices();

    if (row.invoice_number) {
        await onInvoiceNumberInput();
    } else {
        renderUnderCollectionInfoCard(null);
    }

    document.getElementById('addRecordModal').classList.remove('hidden');
}

async function deleteRecord(id) {
    if (!window.showConfirmDialog) {
        showMessage('تعذر فتح نافذة التأكيد', 'error');
        return;
    }

    const confirmed = await window.showConfirmDialog('هل تريد حذف سجل إيرادات التصدير؟ سيتم تحديث حالة الفاتورة المرتبطة إن وجدت.');
    if (!confirmed) {
        return;
    }

    const result = await window.electronAPI.deleteExportRevenue(Number(id));
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر حذف السجل', 'error');
        return;
    }

    showMessage('تم حذف السجل بنجاح وتحديث الرصيد', 'success');
    await loadRecords();
}

async function saveRecord(event) {
    event.preventDefault();
    if (state.isSaving) return;

    const discountEl = document.getElementById('invoiceDiscountInput');
    const payload = {
        record_date: document.getElementById('recordDate').value || today(),
        amount: parseNumberInput(document.getElementById('amountInput').value),
        currency: document.getElementById('currencyInput').value,
        exchange_rate: parseNumberInput(document.getElementById('exchangeRateInput').value),
        statement: document.getElementById('statementInput').value,
        invoice_number: document.getElementById('invoiceNumberInput')?.value?.trim() || '',
        discount_usd: discountEl && discountEl.value !== '' ? Number(discountEl.value) : undefined
    };

    state.isSaving = true;
    setSubmitButtonLoading(true);
    try {
        if (state.editingId) {
            payload.id = state.editingId;
            const result = await window.electronAPI.updateExportRevenue(payload);
            if (!result || !result.success) {
                showMessage((result && result.error) || 'تعذر تعديل السجل', 'error');
                return;
            }

            showMessage('تم تعديل السجل وتحديث الفاتورة المرتبطة بنجاح', 'success');
            state.editingId = null;
            state.currentLinkedInvoice = null;
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

        showMessage('تم حفظ السجل وتحديث حالة الفاتورة تحت التحصيل بنجاح', 'success');
        document.getElementById('addRecordModal').classList.add('hidden');
        document.getElementById('exportRevenuesForm').reset();
        document.getElementById('recordDate').value = today();
        document.getElementById('amountEgp').value = '';
        state.currentLinkedInvoice = null;
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
    const invoiceNumber = document.getElementById('invoiceNumberFilter')?.value?.trim() || '';
    const statement = document.getElementById('statementFilter')?.value?.trim() || '';
    const currentRows = state.rows.slice();

    const rangeParts = [];
    if (startDate || endDate) rangeParts.push(`الفترة: ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}`);
    if (invoiceNumber) rangeParts.push(`رقم الفاتورة: ${invoiceNumber}`);
    if (statement) rangeParts.push(`البيان: ${statement}`);
    document.getElementById('printRange').textContent = rangeParts.join(' | ');

    const exportResult = await window.electronAPI.getExportRevenues({
        page: 1,
        pageSize: 100000,
        startDate,
        endDate,
        invoiceNumber,
        statement
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
