let ar = {};

function t(key, fallback = '') {
    if (!key) return fallback;
    const parts = key.split('.');
    let cur = ar;
    for (const p of parts) {
        if (!cur || typeof cur !== 'object') return fallback;
        cur = cur[p];
    }
    return cur || fallback;
}

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

function formatMoney(value) {
    return (Number(value) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function parseNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    const cleaned = String(value)
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٬،]/g, '.')
        .replace(/,/g, '')
        .replace(/\s+/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
}

function formatMoneyInputValue(value) {
    if (value === null || value === undefined || value === '') return '';
    const cleaned = String(value)
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٬،]/g, '.')
        .replace(/,/g, '')
        .replace(/\s+/g, '');
    if (!cleaned) return '';

    const parts = cleaned.split('.');
    const integerPart = (parts.shift() || '').replace(/[^0-9]/g, '');
    const decimalPart = parts.join('').replace(/[^0-9]/g, '');
    const formattedInteger = (integerPart ? Number(integerPart) : 0).toLocaleString('en-US');
    const hasDot = cleaned.includes('.');

    if (hasDot) {
        return `${formattedInteger}.${decimalPart}`;
    }

    return formattedInteger;
}

function formatInputWithCursor(input) {
    if (!input) return;
    const val = input.value || '';
    const oldCursor = input.selectionStart ?? val.length;

    let digitCount = 0;
    for (let i = 0; i < oldCursor && i < val.length; i++) {
        if (/[0-9.]/.test(val[i])) digitCount++;
    }

    const formatted = formatMoneyInputValue(val);
    input.value = formatted;

    let newCursor = formatted.length;
    let currentDigits = 0;
    for (let i = 0; i < formatted.length; i++) {
        if (/[0-9.]/.test(formatted[i])) {
            currentDigits++;
        }
        if (currentDigits === digitCount) {
            newCursor = i + 1;
            break;
        }
    }

    try {
        input.setSelectionRange(newCursor, newCursor);
    } catch (_) {}
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const state = {
    rows: [],
    page: 1,
    pageSize: 50,
    totalPages: 1,
    totalCount: 0,
    stats: {
        totalShipments: 0,
        totalSalesUsd: 0,
        totalSalesEgp: 0,
        totalPurchasesEgp: 0,
        totalShippingEgp: 0,
        totalBankFeesEgp: 0,
        totalQuantityTons: 0,
        totalSoldTons: 0,
        totalRemainingTons: 0,
        avgCostPerTon: 0,
        totalCostsEgp: 0,
        totalNetProfitEgp: 0
    },
    editingId: null,
    isSaving: false
};

function getRowById(id) {
    return state.rows.find((row) => String(row.id) === String(id));
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    renderPage();
    bindEvents();
    await refreshShipmentNumber();
    await loadShipments();
});

function renderPage() {
    document.getElementById('app').innerHTML = `
        ${buildTopNavHTML()}
        <main class="external-page">
            <section class="external-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                </div>
                <div class="hero-content">
                    <h1>شغل خارجي - المشتريات</h1>
                    <p>متابعة صفقات استيراد وتشغيل الشغل الخارجي، دفعات الشراء، المصاريف البنكية والشحن، وتكلفة الطن</p>
                </div>
                <div class="external-hero-actions">
                    <button type="button" class="btn btn-primary" id="openAddModalBtn" style="padding: 10px 24px; font-weight: bold; border-radius: 8px;">
                        <i class="fas fa-plus"></i>
                        تسجيل صفقة / شحنة مشتريات
                    </button>
                    <button type="button" class="btn btn-outline" id="exportPdfBtn" style="padding: 10px 20px; border-radius: 8px; background: rgba(255,255,255,0.15); color: #fff; border-color: rgba(255,255,255,0.3);">
                        <i class="fas fa-file-pdf"></i>
                        تصدير PDF
                    </button>
                </div>
            </section>

            <section class="stats-grid-5">
                <div class="stat-card stat-sales">
                    <div class="stat-icon"><i class="fas fa-hand-holding-usd"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي دفعات الشراء</div>
                        <div class="stat-value" id="statSalesEgp">0.00</div>
                        <div class="stat-subtext" id="statSalesUsd">المقابل: $0.00</div>
                    </div>
                </div>

                <div class="stat-card stat-costs">
                    <div class="stat-icon"><i class="fas fa-shipping-fast"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">مصاريف الشحن والتخليص</div>
                        <div class="stat-value" id="statShippingEgp">0.00</div>
                        <div class="stat-subtext">إجمالي مصاريف الشحن</div>
                    </div>
                </div>

                <div class="stat-card stat-commissions">
                    <div class="stat-icon"><i class="fas fa-university"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">عمولات ومصاريف البنك</div>
                        <div class="stat-value" id="statBankFeesEgp">0.00</div>
                        <div class="stat-subtext">رسوم التحويل والسويفت</div>
                    </div>
                </div>

                <div class="stat-card stat-profit">
                    <div class="stat-icon"><i class="fas fa-shopping-cart"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي التكلفة الكلية</div>
                        <div class="stat-value" id="statPurchasesEgp">0.00</div>
                        <div class="stat-subtext">شراء + عمولات + شحن</div>
                    </div>
                </div>

                <div class="stat-card stat-count">
                    <div class="stat-icon"><i class="fas fa-weight-hanging"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي الكميات (بالطن)</div>
                        <div class="stat-value" id="statQuantityTons">0.00</div>
                        <div class="stat-subtext" id="statAvgCostPerTon">متوسط الطن: 0.00 ج.م</div>
                    </div>
                </div>
            </section>

            <section class="external-filters-card">
                <div class="filter-grid-external">
                    <div class="form-group">
                        <label>بحث سريع</label>
                        <input type="text" id="searchInput" class="form-control" placeholder="رقم الشحنة، نوع الصنف...">
                    </div>
                    <div class="form-group">
                        <label>التاريخ من</label>
                        <input type="date" id="startDate" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>التاريخ إلى</label>
                        <input type="date" id="endDate" class="form-control">
                    </div>
                    <div class="external-filter-actions">
                        <button type="button" class="btn btn-primary" id="filterBtn" style="border-radius: 8px;">
                            <i class="fas fa-search"></i> بحث
                        </button>
                        <button type="button" class="btn btn-outline" id="resetFilterBtn" style="border-radius: 8px;">
                            <i class="fas fa-times"></i> مسح
                        </button>
                    </div>
                </div>
            </section>

            <section class="external-table-card print-container">
                <div class="external-table-header">
                    <div class="external-table-title">
                        <i class="fas fa-boxes" style="color: #0284c7;"></i>
                        <span>كشف صفقات وشحنات مشتريات الشغل الخارجي</span>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-muted);">
                        عدد الصفقات: <strong id="shipmentsCount">0</strong>
                    </div>
                </div>

                <div class="external-print-header">
                    <h2>كشف مشتريات الشغل الخارجي</h2>
                    <p id="printRange"></p>
                </div>

                <div class="external-table-wrap">
                    <table class="external-table">
                        <thead>
                            <tr>
                                <th>رقم الشحنة</th>
                                <th>التاريخ</th>
                                <th>الصنف / البضاعة</th>
                                <th>إجمالي الشراء ($)</th>
                                <th>المقابل بالجنيه</th>
                                <th>مصاريف شحن/تخليص</th>
                                <th>عمولة البنك</th>
                                <th>التكلفة الكلية (ج.م)</th>
                                <th>الكمية (طن)</th>
                                <th>تكلفة الطن (ج.م)</th>
                                <th style="text-align: center;">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="shipmentsBody"></tbody>
                    </table>
                </div>
                <div class="petty-pagination" id="pagination" style="padding: 16px 20px;"></div>
            </section>
        </main>

        <div id="shipmentModal" class="external-modal-overlay hidden">
            <div class="external-modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
                <div class="external-modal-header">
                    <div class="external-modal-title">
                        <i class="fas fa-file-invoice"></i>
                        <h2 id="modalTitle">تسجيل شحنة مشتريات شغل خارجي</h2>
                    </div>
                    <button type="button" class="external-modal-close" id="closeModalBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="shipmentForm">
                    <div class="external-modal-body">
                        <div class="modal-section-card">
                            <div class="modal-section-title">
                                <i class="fas fa-info-circle"></i>
                                <span>1. بيانات الشحنة</span>
                            </div>
                            <div class="form-grid-3">
                                <div class="form-group">
                                    <label>رقم الشحنة / الفاتورة <span class="required-asterisk">*</span></label>
                                    <div class="input-with-addon">
                                        <input type="text" id="modalShipmentNumber" class="form-control" required>
                                        <button type="button" class="addon-btn" id="refreshNumberBtn" title="توليد رقم جديد">
                                            <i class="fas fa-sync-alt"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>تاريخ الشحنة <span class="required-asterisk">*</span></label>
                                    <input type="date" id="modalShipmentDate" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label>الصنف / البضاعة</label>
                                    <input type="text" id="modalItemDescription" class="form-control" placeholder="مثال: إكليل الجبل Rosemary...">
                                </div>
                            </div>
                        </div>

                        <div class="modal-section-card">
                            <div class="modal-section-title">
                                <i class="fas fa-dollar-sign"></i>
                                <span>2. دفعات الشراء والتحويلات الخارجية ($ -> ج.م)</span>
                            </div>
                            <div class="form-grid-3" style="margin-bottom: 12px;">
                                <div class="form-group">
                                    <label>الدفعة المقدمة ($)</label>
                                    <input type="text" inputmode="decimal" id="modalAdvanceUsd" class="form-control money-input" placeholder="0.00">
                                </div>
                                <div class="form-group">
                                    <label>سعر صرف المقدم (ج.م)</label>
                                    <input type="text" inputmode="decimal" id="modalAdvanceRate" class="form-control money-input" placeholder="مثال: 51.00">
                                </div>
                                <div class="form-group">
                                    <label>المقابل للدفعة المقدمة (ج.م)</label>
                                    <input type="text" id="modalAdvanceEgp" class="form-control uneditable" readonly placeholder="0.00">
                                </div>
                            </div>

                            <div class="form-grid-3">
                                <div class="form-group">
                                    <label>الدفعة النهائية ($)</label>
                                    <input type="text" inputmode="decimal" id="modalFinalUsd" class="form-control money-input" placeholder="0.00">
                                </div>
                                <div class="form-group">
                                    <label>سعر صرف النهائي (ج.م)</label>
                                    <input type="text" inputmode="decimal" id="modalFinalRate" class="form-control money-input" placeholder="مثال: 53.13">
                                </div>
                                <div class="form-group">
                                    <label>المقابل للدفعة النهائية (ج.م)</label>
                                    <input type="text" id="modalFinalEgp" class="form-control uneditable" readonly placeholder="0.00">
                                </div>
                            </div>
                        </div>

                        <div class="modal-section-card">
                            <div class="modal-section-title">
                                <i class="fas fa-receipt"></i>
                                <span>3. المشتريات والتكاليف المحلية والعمولات (ج.م)</span>
                            </div>
                            <div class="form-grid-3">
                                <div class="form-group">
                                    <label>مصاريف شحن/تخليص (ج.م)</label>
                                    <input type="text" inputmode="decimal" id="modalShippingExpensesEgp" class="form-control money-input" placeholder="0.00">
                                </div>
                                <div class="form-group">
                                    <label>عمولة ومصاريف البنك (ج.م)</label>
                                    <input type="text" inputmode="decimal" id="modalBankCommissionEgp" class="form-control money-input" placeholder="0.00">
                                </div>
                                <div class="form-group">
                                    <label>إجمالي تكلفة المشتريات (ج.م) <span style="font-size: 0.76rem; color: #0284c7;">(تلقائي)</span></label>
                                    <input type="text" id="modalPurchaseCostEgp" class="form-control uneditable" readonly placeholder="0.00">
                                </div>
                            </div>
                            <div class="form-grid-2" style="margin-top: 12px;">
                                <div class="form-group">
                                    <label>الكمية (بالطن)</label>
                                    <input type="text" inputmode="decimal" id="modalQuantityTons" class="form-control money-input" placeholder="أدخل الكمية بالطن...">
                                </div>
                                <div class="form-group">
                                    <label>تكلفة الطن (ج.م) <span style="font-size: 0.76rem; color: #0284c7;">(المشتريات ÷ الكمية)</span></label>
                                    <input type="text" id="modalCostPerTonEgp" class="form-control uneditable" readonly placeholder="0.00">
                                </div>
                            </div>
                        </div>

                        <div class="calculation-callout">
                            <div class="calc-item">
                                <span class="calc-label">إجمالي دفعات الشراء ($)</span>
                                <span class="calc-val" id="calloutTotalUsd">$0.00</span>
                            </div>
                            <div class="calc-item">
                                <span class="calc-label">المقابل الكلي للشراء (ج.م)</span>
                                <span class="calc-val" id="calloutTotalEgp">0.00 ج.م</span>
                            </div>
                            <div class="calc-item">
                                <span class="calc-label">إجمالي تكلفة المشتريات</span>
                                <span class="calc-val profit-highlight" id="calloutTotalPurchases">0.00 ج.م</span>
                            </div>
                            <div class="calc-item">
                                <span class="calc-label">تكلفة الطن الواحد</span>
                                <span class="calc-val" id="calloutCostPerTon" style="color: #9333ea;">0.00 ج.م/طن</span>
                            </div>
                        </div>

                        <div class="form-grid-2">
                            <div class="form-group">
                                <label>البيان</label>
                                <input type="text" id="modalStatement" class="form-control" placeholder="وصف العملية أو الصفقة...">
                            </div>
                            <div class="form-group">
                                <label>ملاحظات إضافية</label>
                                <input type="text" id="modalNotes" class="form-control" placeholder="أية ملاحظات أخرى متعلقة بالشحنة...">
                            </div>
                        </div>
                    </div>

                    <div class="external-modal-footer">
                        <button type="button" class="btn btn-outline" id="cancelModalBtn">إلغاء</button>
                        <button type="submit" class="btn btn-primary submit-btn">
                            <i class="fas fa-check-circle"></i> حفظ شحنة المشتريات
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div id="detailsModal" class="external-modal-overlay hidden">
            <div class="external-modal-card" style="max-width: 680px;" role="dialog" aria-modal="true">
                <div class="external-modal-header">
                    <div class="external-modal-title">
                        <i class="fas fa-file-alt"></i>
                        <h2 id="detailsTitle">تفاصيل شحنة مشتريات شغل خارجي</h2>
                    </div>
                    <button type="button" class="external-modal-close" id="closeDetailsModalBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="external-modal-body" id="detailsContent"></div>
                <div class="external-modal-footer">
                    <button type="button" class="btn btn-primary" id="printDetailsBtn">
                        <i class="fas fa-print"></i> طباعة إذن الصفقة
                    </button>
                    <button type="button" class="btn btn-outline" id="closeDetailsBtn">إغلاق</button>
                </div>
            </div>
        </div>

        <div id="profitModal" class="external-modal-overlay hidden">
            <div class="external-modal-card" style="max-width: 840px;" role="dialog" aria-modal="true">
                <div class="external-modal-header">
                    <div class="external-modal-title">
                        <i class="fas fa-chart-line" style="color: #059669;"></i>
                        <h2 id="profitModalTitle">تقرير ربحية ومبيعات الشحنة</h2>
                    </div>
                    <button type="button" class="external-modal-close" id="closeProfitModalBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="external-modal-body" id="profitContent"></div>
                <div class="external-modal-footer">
                    <button type="button" class="btn btn-primary" id="printProfitBtn">
                        <i class="fas fa-print"></i> طباعة تقرير الربحية
                    </button>
                    <button type="button" class="btn btn-outline" id="closeProfitBtn">إغلاق</button>
                </div>
            </div>
        </div>
    `;
}

function bindEvents() {
    document.getElementById('shipmentForm').addEventListener('submit', saveShipment);

    const triggerSearch = () => {
        state.page = 1;
        loadShipments();
    };

    document.getElementById('filterBtn').addEventListener('click', triggerSearch);
    document.getElementById('searchInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            triggerSearch();
        }
    });

    document.getElementById('resetFilterBtn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        state.page = 1;
        loadShipments();
    });

    document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);

    const modal = document.getElementById('shipmentModal');
    document.getElementById('openAddModalBtn').addEventListener('click', async () => {
        state.editingId = null;
        document.getElementById('modalTitle').textContent = 'تسجيل شحنة مشتريات شغل خارجي';
        document.getElementById('shipmentForm').reset();
        document.getElementById('modalShipmentDate').value = today();
        await refreshShipmentNumber();
        updateModalLiveCalculations();
        document.body.classList.add('modal-open');
        modal.classList.remove('hidden');
    });

    document.getElementById('refreshNumberBtn').addEventListener('click', refreshShipmentNumber);

    const closeModal = () => {
        state.editingId = null;
        document.body.classList.remove('modal-open');
        modal.classList.add('hidden');
    };
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const detailsModal = document.getElementById('detailsModal');
    const closeDetails = () => {
        document.body.classList.remove('modal-open');
        detailsModal.classList.add('hidden');
    };
    document.getElementById('closeDetailsModalBtn').addEventListener('click', closeDetails);
    document.getElementById('closeDetailsBtn').addEventListener('click', closeDetails);
    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) closeDetails();
    });

    document.getElementById('printDetailsBtn').addEventListener('click', () => {
        window.print();
    });

    const profitModal = document.getElementById('profitModal');
    const closeProfit = () => {
        document.body.classList.remove('modal-open');
        profitModal.classList.add('hidden');
    };
    document.getElementById('closeProfitModalBtn')?.addEventListener('click', closeProfit);
    document.getElementById('closeProfitBtn')?.addEventListener('click', closeProfit);
    profitModal?.addEventListener('click', (e) => {
        if (e.target === profitModal) closeProfit();
    });

    document.getElementById('printProfitBtn')?.addEventListener('click', () => {
        window.print();
    });

    const formattedInputs = [
        'modalAdvanceUsd', 'modalAdvanceRate',
        'modalFinalUsd', 'modalFinalRate',
        'modalShippingExpensesEgp',
        'modalBankCommissionEgp',
        'modalQuantityTons'
    ];
    formattedInputs.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', (e) => {
            formatInputWithCursor(e.target);
            updateModalLiveCalculations();
        });
    });

    window.financialPagination?.bind(document.getElementById('pagination'), {
        onPageChange: (newPage) => {
            state.page = newPage;
            loadShipments();
        }
    });
}

function updateModalLiveCalculations() {
    const advanceUsd = parseNumber(document.getElementById('modalAdvanceUsd').value);
    const advanceRate = parseNumber(document.getElementById('modalAdvanceRate').value);
    const advanceEgp = Math.round((advanceUsd * advanceRate + Number.EPSILON) * 100) / 100;
    document.getElementById('modalAdvanceEgp').value = advanceEgp ? formatMoney(advanceEgp) : '';

    const finalUsd = parseNumber(document.getElementById('modalFinalUsd').value);
    const finalRate = parseNumber(document.getElementById('modalFinalRate').value);
    const finalEgp = Math.round((finalUsd * finalRate + Number.EPSILON) * 100) / 100;
    document.getElementById('modalFinalEgp').value = finalEgp ? formatMoney(finalEgp) : '';

    const totalUsd = Math.round((advanceUsd + finalUsd + Number.EPSILON) * 100) / 100;
    const totalEgp = Math.round((advanceEgp + finalEgp + Number.EPSILON) * 100) / 100;

    const shipping = parseNumber(document.getElementById('modalShippingExpensesEgp').value);
    const bankCommission = parseNumber(document.getElementById('modalBankCommissionEgp').value);

    const purchaseCost = Math.round((finalEgp + advanceEgp + bankCommission + shipping + Number.EPSILON) * 100) / 100;
    document.getElementById('modalPurchaseCostEgp').value = purchaseCost ? formatMoney(purchaseCost) : '';

    const quantityTons = parseNumber(document.getElementById('modalQuantityTons').value);
    const costPerTon = quantityTons > 0 ? Math.round((purchaseCost / quantityTons + Number.EPSILON) * 100) / 100 : 0;
    document.getElementById('modalCostPerTonEgp').value = costPerTon ? formatMoney(costPerTon) : '';

    document.getElementById('calloutTotalUsd').textContent = `$${formatMoney(totalUsd)}`;
    document.getElementById('calloutTotalEgp').textContent = `${formatMoney(totalEgp)} ج.م`;
    document.getElementById('calloutTotalPurchases').textContent = `${formatMoney(purchaseCost)} ج.م`;
    document.getElementById('calloutCostPerTon').textContent = `${formatMoney(costPerTon)} ج.م/طن`;
}

async function refreshShipmentNumber() {
    if (window.electronAPI && typeof window.electronAPI.getNextExternalWorkShipmentNumber === 'function') {
        const result = await window.electronAPI.getNextExternalWorkShipmentNumber();
        if (result && result.success && result.shipmentNumber) {
            document.getElementById('modalShipmentNumber').value = result.shipmentNumber;
        }
    }
}

function getFilters() {
    return {
        search: (document.getElementById('searchInput')?.value || '').trim(),
        startDate: document.getElementById('startDate')?.value || '',
        endDate: document.getElementById('endDate')?.value || ''
    };
}

async function loadShipments() {
    if (!window.electronAPI || typeof window.electronAPI.getExternalWorkShipments !== 'function') {
        return;
    }

    const filters = getFilters();
    const result = await window.electronAPI.getExternalWorkShipments({
        ...filters,
        page: state.page,
        pageSize: state.pageSize
    });

    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر تحميل صفقات الشغل الخارجي', 'error');
        return;
    }

    state.rows = Array.isArray(result.shipments) ? result.shipments : [];
    state.page = Number(result.page) || state.page;
    state.pageSize = Number(result.pageSize) || state.pageSize;
    state.totalPages = Number(result.totalPages) || 1;
    state.totalCount = Number(result.total) || 0;
    state.stats = result.stats || state.stats;

    renderRows();
    renderPagination();
    renderSummary();
}

function renderSummary() {
    document.getElementById('statSalesEgp').textContent = `${formatMoney(state.stats.totalSalesEgp)} ج.م`;
    document.getElementById('statSalesUsd').textContent = `المقابل: $${formatMoney(state.stats.totalSalesUsd)}`;
    document.getElementById('statShippingEgp').textContent = `${formatMoney(state.stats.totalShippingEgp)} ج.م`;
    document.getElementById('statBankFeesEgp').textContent = `${formatMoney(state.stats.totalBankFeesEgp)} ج.م`;
    document.getElementById('statPurchasesEgp').textContent = `${formatMoney(state.stats.totalPurchasesEgp)} ج.م`;
    document.getElementById('statQuantityTons').textContent = `${formatMoney(state.stats.totalQuantityTons)} طن`;
    document.getElementById('statAvgCostPerTon').textContent = `متوسط: ${formatMoney(state.stats.avgCostPerTon)} ج.م (متبقي: ${formatMoney(state.stats.totalRemainingTons || 0)} طن)`;

    document.getElementById('shipmentsCount').textContent = state.totalCount.toLocaleString('en-US');
}

function renderRows() {
    const body = document.getElementById('shipmentsBody');
    if (!state.rows.length) {
        body.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--text-muted);">لا توجد صفقات مسجلة</td></tr>`;
        return;
    }

    body.innerHTML = state.rows.map((row) => {
        return `
            <tr>
                <td><span class="badge-shipment">${escapeHtml(row.shipment_number || '')}</span></td>
                <td style="white-space: nowrap;">${escapeHtml(row.shipment_date || '')}</td>
                <td><strong>${escapeHtml(row.item_description || '-')}</strong></td>
                <td style="font-weight: 700; color: #0284c7;">$${formatMoney(row.total_amount_usd)}</td>
                <td style="font-weight: 700;">${formatMoney(row.total_amount_egp)}</td>
                <td>${formatMoney(row.shipping_expenses_egp)}</td>
                <td style="color: #9333ea; font-weight: 600;">${formatMoney(row.bank_commission_egp)}</td>
                <td style="font-weight: 700; color: #059669;">${formatMoney(row.purchase_cost_egp)}</td>
                <td style="white-space: nowrap;">
                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                        <span class="badge-shipment" style="background: rgba(147, 51, 234, 0.1); color: #9333ea; font-weight: 700;">${formatMoney(row.quantity_tons)} طن</span>
                        <div style="display: flex; gap: 4px; font-size: 0.74rem;">
                            <span style="color: ${Number(row.remaining_tons) > 0 ? '#059669' : '#94a3b8'}; background: ${Number(row.remaining_tons) > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)'}; padding: 1px 6px; border-radius: 4px; font-weight: 700;" title="الكمية المتبقية للتصريف">متبقي: ${formatMoney(row.remaining_tons)}</span>
                            ${Number(row.sold_tons) > 0 ? `<span style="color: #0284c7; background: rgba(2, 132, 199, 0.12); padding: 1px 6px; border-radius: 4px; font-weight: 700;" title="الكمية المباعة">مباع: ${formatMoney(row.sold_tons)}</span>` : ''}
                        </div>
                    </div>
                </td>
                <td style="font-weight: 700;">${formatMoney(row.cost_per_ton_egp)}</td>
                <td style="text-align: center;">
                    <div class="table-actions" style="justify-content: center;">
                        <button type="button" class="action-btn view-btn" data-action="view-shipment" data-id="${row.id}" title="عرض التفاصيل">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="action-btn" data-action="profit-shipment" data-id="${row.id}" title="تقرير ربحية ومبيعات الشحنة" style="color: #059669; border-color: rgba(5, 150, 105, 0.25);">
                            <i class="fas fa-chart-line"></i>
                        </button>
                        <button type="button" class="action-btn edit-btn" data-action="edit-shipment" data-id="${row.id}" title="تعديل">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="action-btn delete-btn" data-action="delete-shipment" data-id="${row.id}" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    body.querySelectorAll('[data-action="view-shipment"]').forEach((btn) => {
        btn.addEventListener('click', () => viewShipmentDetails(btn.dataset.id));
    });

    body.querySelectorAll('[data-action="profit-shipment"]').forEach((btn) => {
        btn.addEventListener('click', () => viewShipmentProfitability(btn.dataset.id));
    });

    body.querySelectorAll('[data-action="edit-shipment"]').forEach((btn) => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });

    body.querySelectorAll('[data-action="delete-shipment"]').forEach((btn) => {
        btn.addEventListener('click', () => deleteShipment(btn.dataset.id));
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

function viewShipmentDetails(id) {
    const row = getRowById(id);
    if (!row) {
        showMessage('تعذر العثور على بيانات الشحنة', 'error');
        return;
    }

    document.getElementById('detailsContent').innerHTML = `
        <div class="details-grid">
            <div class="details-row">
                <span>رقم الشحنة:</span>
                <strong>${escapeHtml(row.shipment_number)}</strong>
            </div>
            <div class="details-row">
                <span>تاريخ الشحنة:</span>
                <strong>${escapeHtml(row.shipment_date)}</strong>
            </div>
            <div class="details-row" style="grid-column: span 2;">
                <span>الصنف / البضاعة:</span>
                <strong>${escapeHtml(row.item_description || '-')}</strong>
            </div>
        </div>

        <div class="modal-section-card" style="margin-top: 14px;">
            <div class="modal-section-title"><i class="fas fa-money-check-alt"></i> حركة دفعات الشراء والتحويلات الخارجية</div>
            <div class="details-grid">
                <div class="details-row">
                    <span>دفعة مقدمة:</span>
                    <span>$${formatMoney(row.advance_amount_usd)} (سعر صرف: ${formatMoney(row.advance_rate)})</span>
                </div>
                <div class="details-row">
                    <span>المقابل بالجنيه:</span>
                    <strong>${formatMoney(row.advance_amount_egp)} ج.م</strong>
                </div>
                <div class="details-row">
                    <span>دفعة نهائية:</span>
                    <span>$${formatMoney(row.final_amount_usd)} (سعر صرف: ${formatMoney(row.final_rate)})</span>
                </div>
                <div class="details-row">
                    <span>المقابل بالجنيه:</span>
                    <strong>${formatMoney(row.final_amount_egp)} ج.م</strong>
                </div>
                <div class="details-row highlight" style="grid-column: span 2;">
                    <span>إجمالي دفعات الشراء:</span>
                    <span>$${formatMoney(row.total_amount_usd)} = <strong>${formatMoney(row.total_amount_egp)} ج.م</strong></span>
                </div>
            </div>
        </div>

        <div class="modal-section-card" style="margin-top: 14px;">
            <div class="modal-section-title"><i class="fas fa-coins"></i> تكلفة المشتريات ومصاريف الشحن والتخليص</div>
            <div class="details-grid">
                <div class="details-row">
                    <span>مصاريف شحن/تخليص:</span>
                    <span>${formatMoney(row.shipping_expenses_egp)} ج.م</span>
                </div>
                <div class="details-row">
                    <span>عمولة ومصاريف البنك:</span>
                    <span style="color: #9333ea; font-weight: 700;">${formatMoney(row.bank_commission_egp)} ج.م</span>
                </div>
                <div class="details-row highlight" style="grid-column: span 2;">
                    <span>إجمالي تكلفة المشتريات:</span>
                    <strong style="color: #059669;">${formatMoney(row.purchase_cost_egp)} ج.م</strong>
                </div>
                <div class="details-row">
                    <span>الكمية المنفذة:</span>
                    <strong>${formatMoney(row.quantity_tons)} طن</strong>
                </div>
                <div class="details-row">
                    <span>تكلفة الطن الواحد:</span>
                    <strong style="color: #0284c7;">${formatMoney(row.cost_per_ton_egp)} ج.م/طن</strong>
                </div>
            </div>
        </div>

        <div class="modal-section-card" style="margin-top: 14px;">
            <div class="modal-section-title"><i class="fas fa-chart-line"></i> حالة المخزون والمبيعات</div>
            <div class="details-grid">
                <div class="details-row">
                    <span>الكمية المتبقية للتصريف:</span>
                    <strong style="color: #059669;">${formatMoney(row.remaining_tons ?? row.quantity_tons)} طن</strong>
                </div>
                <div class="details-row">
                    <span>الكمية المباعة:</span>
                    <strong style="color: #0284c7;">${formatMoney(row.sold_tons || 0)} طن</strong>
                </div>
                <div class="details-row highlight" style="grid-column: span 2;">
                    <span>صافي أرباح مبيعات الشحنة حتى الآن:</span>
                    <strong style="color: ${Number(row.total_sales_profit_egp || 0) >= 0 ? '#059669' : '#dc2626'}; font-size: 1.05rem;">${formatMoney(row.total_sales_profit_egp || 0)} ج.م</strong>
                </div>
            </div>
        </div>

        ${row.notes ? `
            <div style="margin-top: 10px; font-size: 0.9rem; color: var(--text-muted);">
                <strong>ملاحظات:</strong> ${escapeHtml(row.notes)}
            </div>
        ` : ''}
    `;

    document.body.classList.add('modal-open');
    document.getElementById('detailsModal').classList.remove('hidden');
}

async function viewShipmentProfitability(id) {
    if (!window.electronAPI || typeof window.electronAPI.getExternalWorkShipmentProfitability !== 'function') {
        showMessage('وظيفة تقرير الربحية غير متاحة', 'error');
        return;
    }

    const result = await window.electronAPI.getExternalWorkShipmentProfitability(id);
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر تحميل بيانات ربحية الشحنة', 'error');
        return;
    }

    const { shipment, sales, summary } = result;
    const profitColor = summary.totalProfitEgp >= 0 ? '#059669' : '#dc2626';

    document.getElementById('profitContent').innerHTML = `
        <div class="details-grid">
            <div class="details-row">
                <span>رقم الشحنة:</span>
                <strong>${escapeHtml(shipment.shipment_number)}</strong>
            </div>
            <div class="details-row">
                <span>تاريخ الشحنة:</span>
                <strong>${escapeHtml(shipment.shipment_date)}</strong>
            </div>
            <div class="details-row">
                <span>الصنف / البضاعة:</span>
                <strong>${escapeHtml(shipment.item_description || '-')}</strong>
            </div>
            <div class="details-row">
                <span>تكلفة شراء الطن:</span>
                <strong style="color: #0284c7;">${formatMoney(summary.costPerTonEgp)} ج.م/طن</strong>
            </div>
        </div>

        <div class="modal-section-card" style="margin-top: 14px;">
            <div class="modal-section-title"><i class="fas fa-chart-pie"></i> ملخص ربحية الشحنة والمبيعات المحققة</div>
            <div class="profit-stats-grid">
                <div class="profit-mini-card">
                    <span class="profit-mini-label">إجمالي تكلفة الشراء</span>
                    <span class="profit-mini-val" style="color: #64748b;">${formatMoney(summary.purchaseCostEgp)} ج.م</span>
                </div>
                <div class="profit-mini-card">
                    <span class="profit-mini-label">المبيعات المحققة (${summary.salesCount} إذن)</span>
                    <span class="profit-mini-val" style="color: #0284c7;">${formatMoney(summary.totalSalesAmountEgp)} ج.م</span>
                </div>
                <div class="profit-mini-card">
                    <span class="profit-mini-label">صافي الأرباح المحققة</span>
                    <span class="profit-mini-val" style="color: ${profitColor};">${formatMoney(summary.totalProfitEgp)} ج.م</span>
                </div>
                <div class="profit-mini-card">
                    <span class="profit-mini-label">المتبقي للتصريف</span>
                    <span class="profit-mini-val" style="color: #9333ea;">${formatMoney(summary.remainingTons)} طن</span>
                </div>
            </div>

            <div style="background: rgba(0, 0, 0, 0.02); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--card-border);">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700;">
                    <span>نسبة تصريف الشحنة (المباع): ${summary.soldPercentage}%</span>
                    <span>تم بيع ${formatMoney(summary.totalSoldTons)} طن من إجمالي ${formatMoney(summary.totalPurchasedTons)} طن</span>
                </div>
                <div class="profit-progress-wrap">
                    <div class="profit-progress-bar" style="width: ${summary.soldPercentage}%;"></div>
                </div>
            </div>
        </div>

        <div class="modal-section-card" style="margin-top: 14px;">
            <div class="modal-section-title"><i class="fas fa-list-alt"></i> حركة أذونات البيع المنفذة على هذه الشحنة</div>
            ${sales && sales.length ? `
                <div style="overflow-x: auto;">
                    <table class="profit-sales-table">
                        <thead>
                            <tr>
                                <th>رقم إذن البيع</th>
                                <th>تاريخ البيع</th>
                                <th>العميل / المشتري</th>
                                <th>الكمية (طن)</th>
                                <th>سعر الطن</th>
                                <th>إجمالي البيع</th>
                                <th>تكلفة البضاعة</th>
                                <th>صافي الربح</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sales.map((s) => `
                                <tr>
                                    <td><strong>${escapeHtml(s.sale_number)}</strong></td>
                                    <td>${escapeHtml(s.sale_date)}</td>
                                    <td>${escapeHtml(s.customer_name)}</td>
                                    <td style="color: #9333ea; font-weight: 700;">${formatMoney(s.quantity_tons)} طن</td>
                                    <td>${formatMoney(s.unit_price_egp)}</td>
                                    <td style="color: #059669; font-weight: 700;">${formatMoney(s.total_amount_egp)} ج.م</td>
                                    <td style="color: #64748b;">${formatMoney(s.total_cost_egp)}</td>
                                    <td style="font-weight: 800; color: ${Number(s.net_profit_egp) >= 0 ? '#059669' : '#dc2626'};">${formatMoney(s.net_profit_egp)} ج.م</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3">الإجمالي</td>
                                <td style="color: #9333ea;">${formatMoney(summary.totalSoldTons)} طن</td>
                                <td>-</td>
                                <td style="color: #059669;">${formatMoney(summary.totalSalesAmountEgp)} ج.م</td>
                                <td style="color: #64748b;">${formatMoney(summary.totalSalesCostEgp)} ج.م</td>
                                <td style="color: ${profitColor};">${formatMoney(summary.totalProfitEgp)} ج.م</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ` : `
                <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.9rem;">
                    <i class="fas fa-box-open" style="font-size: 2rem; opacity: 0.3; margin-bottom: 8px; display: block;"></i>
                    لم يتم تسجيل أي أذونات بيع لهذه الشحنة حتى الآن، كامل الكمية (${formatMoney(summary.totalPurchasedTons)} طن) متاحة للتصريف.
                </div>
            `}
        </div>
    `;

    document.body.classList.add('modal-open');
    document.getElementById('profitModal').classList.remove('hidden');
}

async function openEditModal(id) {
    const row = getRowById(id);
    if (!row) {
        showMessage('تعذر العثور على بيانات الشحنة', 'error');
        return;
    }

    state.editingId = row.id;
    document.getElementById('modalTitle').textContent = `تعديل شحنة مشتريات ${row.shipment_number}`;
    document.getElementById('modalShipmentNumber').value = row.shipment_number || '';
    document.getElementById('modalShipmentDate').value = row.shipment_date || today();
    document.getElementById('modalItemDescription').value = row.item_description || '';

    document.getElementById('modalAdvanceUsd').value = row.advance_amount_usd ? formatMoneyInputValue(row.advance_amount_usd) : '';
    document.getElementById('modalAdvanceRate').value = row.advance_rate ? formatMoneyInputValue(row.advance_rate) : '';
    document.getElementById('modalFinalUsd').value = row.final_amount_usd ? formatMoneyInputValue(row.final_amount_usd) : '';
    document.getElementById('modalFinalRate').value = row.final_rate ? formatMoneyInputValue(row.final_rate) : '';

    document.getElementById('modalShippingExpensesEgp').value = row.shipping_expenses_egp ? formatMoneyInputValue(row.shipping_expenses_egp) : '';
    document.getElementById('modalBankCommissionEgp').value = row.bank_commission_egp ? formatMoneyInputValue(row.bank_commission_egp) : '';
    document.getElementById('modalQuantityTons').value = row.quantity_tons ? formatMoneyInputValue(row.quantity_tons) : '';

    document.getElementById('modalStatement').value = row.statement || '';
    document.getElementById('modalNotes').value = row.notes || '';

    updateModalLiveCalculations();
    document.body.classList.add('modal-open');
    document.getElementById('shipmentModal').classList.remove('hidden');
}

async function deleteShipment(id) {
    const row = getRowById(id);
    const label = row ? `الشحنة رقم ${row.shipment_number}` : 'هذه الشحنة';

    let confirmed = false;
    if (typeof window.showConfirmDialog === 'function') {
        confirmed = await window.showConfirmDialog(`هل أنت متأكد من حذف ${label}؟`);
    } else {
        confirmed = window.confirm(`هل أنت متأكد من حذف ${label}؟`);
    }

    if (!confirmed) return;

    const result = await window.electronAPI.deleteExternalWorkShipment(id);
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر حذف الشحنة', 'error');
        return;
    }

    showMessage('تم حذف الشحنة بنجاح', 'success');
    await loadShipments();
}

async function saveShipment(event) {
    event.preventDefault();
    if (state.isSaving) return;

    const payload = {
        id: state.editingId,
        shipment_number: (document.getElementById('modalShipmentNumber').value || '').trim(),
        shipment_date: document.getElementById('modalShipmentDate').value || today(),
        client_name: state.editingId ? ((getRowById(state.editingId) && getRowById(state.editingId).client_name) || 'شغل خارجي') : 'شغل خارجي',
        item_description: (document.getElementById('modalItemDescription').value || '').trim(),
        advance_amount_usd: parseNumber(document.getElementById('modalAdvanceUsd').value),
        advance_rate: parseNumber(document.getElementById('modalAdvanceRate').value),
        final_amount_usd: parseNumber(document.getElementById('modalFinalUsd').value),
        final_rate: parseNumber(document.getElementById('modalFinalRate').value),
        shipping_expenses_egp: parseNumber(document.getElementById('modalShippingExpensesEgp').value),
        bank_commission_egp: parseNumber(document.getElementById('modalBankCommissionEgp').value),
        purchase_cost_egp: parseNumber(document.getElementById('modalPurchaseCostEgp').value),
        quantity_tons: parseNumber(document.getElementById('modalQuantityTons').value),
        cost_per_ton_egp: parseNumber(document.getElementById('modalCostPerTonEgp').value),
        statement: (document.getElementById('modalStatement').value || '').trim(),
        notes: (document.getElementById('modalNotes').value || '').trim()
    };

    const submitBtn = document.querySelector('#shipmentForm .submit-btn');
    try {
        state.isSaving = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
        }

        let result;
        if (state.editingId) {
            result = await window.electronAPI.updateExternalWorkShipment(payload);
            if (!result || !result.success) {
                showMessage((result && result.error) || 'تعذر تعديل الشحنة', 'error');
                return;
            }
            showMessage('تم تعديل الشحنة بنجاح', 'success');
        } else {
            result = await window.electronAPI.saveExternalWorkShipment(payload);
            if (!result || !result.success) {
                showMessage((result && result.error) || 'تعذر حفظ الشحنة', 'error');
                return;
            }
            showMessage('تم حفظ الشحنة بنجاح', 'success');
        }

        document.body.classList.remove('modal-open');
        document.getElementById('shipmentModal').classList.add('hidden');
        document.getElementById('shipmentForm').reset();
        await refreshShipmentNumber();
        state.page = 1;
        await loadShipments();
    } finally {
        state.isSaving = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
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

    const exportResult = await window.electronAPI.getExternalWorkShipments({
        ...filters,
        page: 1,
        pageSize: 100000
    });

    if (exportResult && exportResult.success) {
        state.rows = Array.isArray(exportResult.shipments) ? exportResult.shipments : [];
        renderRows();
    }

    try {
        const date = today();
        const result = await window.electronAPI.saveExternalWorkShipmentsPdf({
            defaultName: `External_Work_Shipments_${date}.pdf`
        });
        if (result && result.success) {
            showMessage('تم حفظ ملف PDF بنجاح', 'success');
        } else if (result && !result.canceled) {
            showMessage(result.error || 'تعذر حفظ ملف PDF', 'error');
        }
    } finally {
        state.rows = currentRows;
        renderRows();
    }
}
