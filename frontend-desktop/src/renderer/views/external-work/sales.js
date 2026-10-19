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
        totalSalesCount: 0,
        totalSoldTons: 0,
        totalSalesAmountEgp: 0,
        totalCostEgp: 0,
        totalNetProfitEgp: 0,
        avgSalePricePerTon: 0
    },
    availableShipments: [],
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
    await loadShipmentsDropdown();
    await loadSales();
});

function renderPage() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    appEl.innerHTML = `
        ${buildTopNavHTML()}
        <main class="external-work-container">
            <section class="external-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                </div>
                <div class="hero-content">
                    <h1>شغل خارجي - المبيعات</h1>
                    <p>توثيق ومتابعة مبيعات بضائع الشغل الخارجي، خصم الكميات من شحنات المشتريات، وحساب الأرباح المحققة</p>
                </div>
                <div class="external-hero-actions">
                    <button type="button" class="btn btn-primary" id="openAddModalBtn" style="padding: 10px 24px; font-weight: bold; border-radius: 8px;">
                        <i class="fas fa-plus"></i>
                        تسجيل إذن بيع جديد
                    </button>
                    <button type="button" class="btn btn-outline" id="exportPdfBtn" style="padding: 10px 20px; border-radius: 8px; background: rgba(255,255,255,0.15); color: #fff; border-color: rgba(255,255,255,0.3);">
                        <i class="fas fa-file-pdf"></i>
                        تصدير PDF
                    </button>
                </div>
            </section>

            <section class="stats-grid-5">
                <div class="stat-card stat-sales">
                    <div class="stat-icon"><i class="fas fa-cash-register"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي قيمة المبيعات</div>
                        <div class="stat-value" id="statSalesAmount">0.00 ج.م</div>
                        <div class="stat-subtext" id="statSalesCount">عدد أذونات البيع: 0</div>
                    </div>
                </div>

                <div class="stat-card stat-count">
                    <div class="stat-icon"><i class="fas fa-weight-hanging"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">إجمالي الكميات المباعة</div>
                        <div class="stat-value" id="statSoldTons">0.00 طن</div>
                        <div class="stat-subtext">أوزان أذونات البيع</div>
                    </div>
                </div>

                <div class="stat-card stat-commissions">
                    <div class="stat-icon"><i class="fas fa-tag"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">متوسط سعر بيع الطن</div>
                        <div class="stat-value" id="statAvgPrice">0.00 ج.م</div>
                        <div class="stat-subtext">متوسط الطن المباع</div>
                    </div>
                </div>

                <div class="stat-card stat-costs">
                    <div class="stat-icon"><i class="fas fa-calculator"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">تكلفة البضاعة المباعة</div>
                        <div class="stat-value" id="statTotalCost">0.00 ج.م</div>
                        <div class="stat-subtext">محسوبة من تكلفة المشتريات</div>
                    </div>
                </div>

                <div class="stat-card stat-profit-card">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">صافي أرباح المبيعات</div>
                        <div class="stat-value" id="statNetProfit">0.00 ج.م</div>
                        <div class="stat-subtext">المبيعات - التكلفة</div>
                    </div>
                </div>
            </section>

            <section class="external-filters-card">
                <div class="filter-grid-external" style="grid-template-columns: 2fr 1.5fr 1fr 1fr auto;">
                    <div class="form-group">
                        <label>بحث سريع</label>
                        <input type="text" id="searchInput" class="form-control" placeholder="رقم الإذن، اسم العميل، رقم الشحنة...">
                    </div>
                    <div class="form-group">
                        <label>شحنة المشتريات</label>
                        <select id="filterShipment" class="form-control">
                            <option value="">جميع الشحنات</option>
                        </select>
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
                        <i class="fas fa-file-invoice-dollar" style="color: #059669;"></i>
                        <span>كشف مبيعات الشغل الخارجي</span>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-muted);">
                        عدد العمليات: <strong id="salesCount">0</strong>
                    </div>
                </div>

                <div class="external-print-header">
                    <h2>كشف مبيعات الشغل الخارجي</h2>
                    <p id="printRange"></p>
                </div>

                <div class="external-table-wrap">
                    <table class="external-table">
                        <thead>
                            <tr>
                                <th>رقم الإذن</th>
                                <th>التاريخ</th>
                                <th>العميل / المشتري</th>
                                <th>شحنة المشتريات</th>
                                <th>الصنف / البضاعة</th>
                                <th>الكمية المباعة (طن)</th>
                                <th>سعر الطن (ج.م)</th>
                                <th>إجمالي البيع (ج.م)</th>
                                <th>تكلفة البضاعة</th>
                                <th>صافي الربح</th>
                                <th style="text-align: center;">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="salesBody"></tbody>
                    </table>
                </div>
                <div class="petty-pagination" id="pagination" style="padding: 16px 20px;"></div>
            </section>
        </main>

        <div id="saleModal" class="external-modal-overlay hidden">
            <div class="external-modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
                <div class="external-modal-header">
                    <div class="external-modal-title">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <h2 id="modalTitle">تسجيل إذن بيع شغل خارجي</h2>
                    </div>
                    <button type="button" class="external-modal-close" id="closeModalBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="saleForm">
                    <div class="external-modal-body">
                        <div class="modal-section-card">
                            <div class="modal-section-title">
                                <i class="fas fa-user-check"></i>
                                <span>1. بيانات البيع والعميل</span>
                            </div>
                            <div class="form-grid-3">
                                <div class="form-group">
                                    <label>رقم إذن البيع / الفاتورة <span class="required-asterisk">*</span></label>
                                    <div class="input-with-addon">
                                        <input type="text" id="modalSaleNumber" class="form-control" required>
                                        <button type="button" class="addon-btn" id="refreshNumberBtn" title="توليد رقم جديد">
                                            <i class="fas fa-sync-alt"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>تاريخ البيع <span class="required-asterisk">*</span></label>
                                    <input type="date" id="modalSaleDate" class="form-control" required>
                                </div>
                                <div class="form-group">
                                    <label>اسم العميل / المشتري <span class="required-asterisk">*</span></label>
                                    <input type="text" id="modalCustomerName" class="form-control" placeholder="أدخل اسم العميل..." required>
                                </div>
                            </div>
                        </div>

                        <div class="modal-section-card">
                            <div class="modal-section-title">
                                <i class="fas fa-link"></i>
                                <span>2. ربط شحنة المشتريات والصنف</span>
                            </div>
                            <div class="form-grid-2" style="margin-bottom: 12px;">
                                <div class="form-group">
                                    <label>شحنة المشتريات المرتبطة <span class="required-asterisk">*</span></label>
                                    <div class="searchable-select-wrap" id="shipmentCombobox">
                                        <input type="hidden" id="modalShipmentId">
                                        <div class="searchable-select-input-container">
                                            <input type="text" id="modalShipmentSearch" class="form-control searchable-select-input" placeholder="اكتب رقم الشحنة أو اختر من القائمة..." autocomplete="off">
                                            <button type="button" class="searchable-select-toggle" id="shipmentComboboxToggle" tabindex="-1" title="عرض الشحنات">
                                                <i class="fas fa-chevron-down"></i>
                                            </button>
                                        </div>
                                        <div class="searchable-select-dropdown" id="shipmentDropdown"></div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>الصنف / البضاعة</label>
                                    <input type="text" id="modalItemDescription" class="form-control uneditable" readonly placeholder="يتم تحديده تلقائياً من الشحنة...">
                                </div>
                            </div>
                            <div class="form-grid-2">
                                <div class="form-group">
                                    <label>تكلفة الطن في الشراء (ج.م)</label>
                                    <input type="text" id="modalCostPerTon" class="form-control uneditable" readonly placeholder="0.00">
                                </div>
                                <div class="form-group">
                                    <label>الكمية المتاحة في الشحنة (بالطن)</label>
                                    <input type="text" id="modalAvailableTons" class="form-control uneditable" readonly style="color: #9333ea; font-weight: 800;" placeholder="0.00 طن">
                                </div>
                            </div>
                        </div>

                        <div class="modal-section-card">
                            <div class="modal-section-title">
                                <i class="fas fa-balance-scale"></i>
                                <span>3. الكمية المباعة وأسعار البيع (ج.م)</span>
                            </div>
                            <div class="form-grid-3">
                                <div class="form-group">
                                    <label>الكمية المباعة (بالطن) <span class="required-asterisk">*</span></label>
                                    <input type="text" inputmode="decimal" id="modalQuantityTons" class="form-control money-input" placeholder="0.00" required>
                                </div>
                                <div class="form-group">
                                    <label>سعر بيع الطن (ج.م) <span class="required-asterisk">*</span></label>
                                    <input type="text" inputmode="decimal" id="modalUnitPriceEgp" class="form-control money-input" placeholder="0.00" required>
                                </div>
                                <div class="form-group">
                                    <label>إجمالي قيمة البيع (ج.م) <span style="font-size: 0.76rem; color: #059669;">(تلقائي)</span></label>
                                    <input type="text" id="modalTotalAmountEgp" class="form-control uneditable" readonly style="color: #059669; font-weight: 800;" placeholder="0.00">
                                </div>
                            </div>
                        </div>

                        <div class="calculation-callout">
                            <div class="calc-item">
                                <span class="calc-label">إجمالي قيمة البيع</span>
                                <span class="calc-val profit-highlight" id="calloutSaleTotal">0.00 ج.م</span>
                            </div>
                            <div class="calc-item">
                                <span class="calc-label">تكلفة البضاعة المباعة</span>
                                <span class="calc-val" id="calloutCostTotal" style="color: #dc2626;">0.00 ج.م</span>
                            </div>
                            <div class="calc-item" style="grid-column: span 2;">
                                <span class="calc-label">صافي الربح المحقق</span>
                                <span class="calc-val profit-highlight" id="calloutProfitTotal">0.00 ج.م</span>
                            </div>
                        </div>

                        <div class="form-grid-2">
                            <div class="form-group">
                                <label>البيان</label>
                                <input type="text" id="modalStatement" class="form-control" placeholder="بيان أو وصف لعملية البيع...">
                            </div>
                            <div class="form-group">
                                <label>ملاحظات إضافية</label>
                                <input type="text" id="modalNotes" class="form-control" placeholder="أية ملاحظات أخرى متعلقة بإذن البيع...">
                            </div>
                        </div>
                    </div>

                    <div class="external-modal-footer">
                        <button type="button" class="btn btn-outline" id="cancelModalBtn">إلغاء</button>
                        <button type="submit" class="btn btn-primary submit-btn">
                            <i class="fas fa-check-circle"></i> حفظ إذن البيع
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div id="detailsModal" class="external-modal-overlay hidden">
            <div class="external-modal-card" style="max-width: 680px;" role="dialog" aria-modal="true">
                <div class="external-modal-header">
                    <div class="external-modal-title">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <h2 id="detailsTitle">تفاصيل إذن بيع شغل خارجي</h2>
                    </div>
                    <button type="button" class="external-modal-close" id="closeDetailsModalBtn" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="external-modal-body" id="detailsContent"></div>
                <div class="external-modal-footer">
                    <button type="button" class="btn btn-primary" id="printDetailsBtn">
                        <i class="fas fa-print"></i> طباعة إذن البيع
                    </button>
                    <button type="button" class="btn btn-outline" id="closeDetailsBtn">إغلاق</button>
                </div>
            </div>
        </div>
    `;
}

function bindEvents() {
    document.getElementById('filterBtn').addEventListener('click', () => {
        state.page = 1;
        loadSales();
    });

    document.getElementById('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            state.page = 1;
            loadSales();
        }
    });

    document.getElementById('filterShipment').addEventListener('change', () => {
        state.page = 1;
        loadSales();
    });

    document.getElementById('resetFilterBtn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('filterShipment').value = '';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        state.page = 1;
        loadSales();
    });

    document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);

    const modal = document.getElementById('saleModal');
    document.getElementById('openAddModalBtn').addEventListener('click', async () => {
        state.editingId = null;
        document.getElementById('modalTitle').textContent = 'تسجيل إذن بيع شغل خارجي';
        document.getElementById('saleForm').reset();
        document.getElementById('modalSaleDate').value = today();
        const hiddenId = document.getElementById('modalShipmentId');
        if (hiddenId) hiddenId.value = '';
        const shipmentSearch = document.getElementById('modalShipmentSearch');
        if (shipmentSearch) shipmentSearch.value = '';
        document.getElementById('modalCostPerTon').value = '';
        document.getElementById('modalAvailableTons').value = '';
        document.getElementById('modalItemDescription').value = '';
        closeShipmentDropdown();
        await refreshSaleNumber();
        await loadShipmentsDropdown();
        updateModalLiveCalculations();
        document.body.classList.add('modal-open');
        modal.classList.remove('hidden');
    });

    document.getElementById('refreshNumberBtn').addEventListener('click', refreshSaleNumber);

    const closeModal = () => {
        state.editingId = null;
        closeShipmentDropdown();
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

    const shipmentSearchInput = document.getElementById('modalShipmentSearch');
    const shipmentToggleBtn = document.getElementById('shipmentComboboxToggle');
    const shipmentComboboxWrap = document.getElementById('shipmentCombobox');

    if (shipmentSearchInput) {
        shipmentSearchInput.addEventListener('focus', () => {
            openShipmentDropdown();
        });

        shipmentSearchInput.addEventListener('input', (e) => {
            openShipmentDropdown();
            renderShipmentDropdownItems(e.target.value);

            const rawVal = (e.target.value || '').trim();
            const val = rawVal.toLowerCase();
            const matched = state.availableShipments.find((s) => {
                const num = String(s.shipment_number || '').trim().toLowerCase();
                return num === val || num.replace(/^ext-0*/i, '') === val.replace(/^ext-0*/i, '');
            });

            if (matched) {
                applySelectedShipment(matched, false);
            } else {
                const hiddenId = document.getElementById('modalShipmentId');
                if (hiddenId) hiddenId.value = '';
                const descEl = document.getElementById('modalItemDescription');
                const costEl = document.getElementById('modalCostPerTon');
                const availEl = document.getElementById('modalAvailableTons');
                const qtyInput = document.getElementById('modalQuantityTons');
                if (descEl) descEl.value = '';
                if (costEl) costEl.value = '';
                if (availEl) availEl.value = '';
                if (qtyInput) delete qtyInput.dataset.maxAvailable;
                updateModalLiveCalculations();
            }
        });

        shipmentSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeShipmentDropdown();
            }
        });
    }

    if (shipmentToggleBtn) {
        shipmentToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (shipmentComboboxWrap?.classList.contains('is-open')) {
                closeShipmentDropdown();
            } else {
                openShipmentDropdown();
                shipmentSearchInput?.focus();
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#shipmentCombobox')) {
            closeShipmentDropdown();
        }
    });

    const formattedInputs = ['modalQuantityTons', 'modalUnitPriceEgp'];
    formattedInputs.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', (e) => {
            formatInputWithCursor(e.target);
            updateModalLiveCalculations();
        });
    });

    document.getElementById('saleForm').addEventListener('submit', saveSale);

    window.financialPagination?.bind(document.getElementById('pagination'), {
        onPageChange: (newPage) => {
            state.page = newPage;
            loadSales();
        }
    });
}

function openShipmentDropdown() {
    const wrap = document.getElementById('shipmentCombobox');
    if (!wrap) return;
    wrap.classList.add('is-open');
    const searchInput = document.getElementById('modalShipmentSearch');
    renderShipmentDropdownItems(searchInput ? searchInput.value : '');
}

function closeShipmentDropdown() {
    const wrap = document.getElementById('shipmentCombobox');
    if (wrap) {
        wrap.classList.remove('is-open');
    }
}

function renderShipmentDropdownItems(filterText = '') {
    const dropdown = document.getElementById('shipmentDropdown');
    if (!dropdown) return;

    const query = String(filterText || '').trim().toLowerCase();
    const currentSelectedId = Number(document.getElementById('modalShipmentId')?.value) || null;

    const filtered = (state.availableShipments || []).filter((s) => {
        if (!query) return true;
        const num = String(s.shipment_number || '').toLowerCase();
        const desc = String(s.item_description || '').toLowerCase();
        return num.includes(query) || desc.includes(query);
    });

    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="combobox-empty"><i class="fas fa-search" style="margin-left: 6px; opacity: 0.5;"></i>لا توجد شحنات مطابقة</div>';
        return;
    }

    dropdown.innerHTML = filtered.map((s) => {
        const isSelected = currentSelectedId === Number(s.id);
        const descText = s.item_description ? escapeHtml(s.item_description) : 'بدون صنف';
        return `
            <div class="combobox-item ${isSelected ? 'is-selected' : ''}" data-shipment-id="${s.id}">
                <div class="combobox-item-main">
                    <span class="combobox-item-number">${escapeHtml(s.shipment_number)}</span>
                    <span class="combobox-item-desc">${descText}</span>
                </div>
                <span class="combobox-item-stock">المتاح: ${formatMoney(s.remaining_tons)} طن</span>
            </div>
        `;
    }).join('');

    dropdown.querySelectorAll('.combobox-item').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const sId = Number(item.dataset.shipmentId);
            const selected = state.availableShipments.find((s) => Number(s.id) === sId);
            if (selected) {
                applySelectedShipment(selected, true);
            }
            closeShipmentDropdown();
        });
    });
}

function applySelectedShipment(shipment, updateSearchText = true) {
    const hiddenIdEl = document.getElementById('modalShipmentId');
    const searchInput = document.getElementById('modalShipmentSearch');
    const descEl = document.getElementById('modalItemDescription');
    const costEl = document.getElementById('modalCostPerTon');
    const availEl = document.getElementById('modalAvailableTons');
    const qtyInput = document.getElementById('modalQuantityTons');

    if (shipment) {
        if (hiddenIdEl) hiddenIdEl.value = String(shipment.id);
        if (updateSearchText && searchInput) {
            searchInput.value = shipment.shipment_number || '';
        }
        if (descEl) descEl.value = shipment.item_description || '';
        if (costEl) costEl.value = formatMoney(shipment.cost_per_ton_egp);
        if (availEl) availEl.value = `${formatMoney(shipment.remaining_tons)} طن`;
        if (qtyInput) qtyInput.dataset.maxAvailable = String(shipment.remaining_tons);
    } else {
        if (hiddenIdEl) hiddenIdEl.value = '';
        if (updateSearchText && searchInput) searchInput.value = '';
        if (descEl) descEl.value = '';
        if (costEl) costEl.value = '';
        if (availEl) availEl.value = '';
        if (qtyInput) delete qtyInput.dataset.maxAvailable;
    }
    updateModalLiveCalculations();
}

async function loadShipmentsDropdown(excludeSaleId = null) {
    if (!window.electronAPI || typeof window.electronAPI.getExternalWorkAvailableShipments !== 'function') {
        return;
    }

    const result = await window.electronAPI.getExternalWorkAvailableShipments({ excludeSaleId });
    if (result && result.success && Array.isArray(result.shipments)) {
        state.availableShipments = result.shipments;

        const searchInput = document.getElementById('modalShipmentSearch');
        renderShipmentDropdownItems(searchInput ? searchInput.value : '');

        const filterSelect = document.getElementById('filterShipment');
        const currentFilterVal = filterSelect ? filterSelect.value : '';
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">جميع الشحنات</option>' +
                state.availableShipments.map((s) => {
                    return `<option value="${s.id}">${escapeHtml(s.shipment_number)} - ${escapeHtml(s.item_description || '')}</option>`;
                }).join('');
            if (currentFilterVal) {
                filterSelect.value = currentFilterVal;
            }
        }
    }
}

function updateModalLiveCalculations() {
    const qty = parseNumber(document.getElementById('modalQuantityTons').value);
    const unitPrice = parseNumber(document.getElementById('modalUnitPriceEgp').value);
    const totalAmount = Math.round((qty * unitPrice + Number.EPSILON) * 100) / 100;
    document.getElementById('modalTotalAmountEgp').value = totalAmount ? formatMoney(totalAmount) : '';

    const costPerTon = parseNumber(document.getElementById('modalCostPerTon').value);
    const totalCost = Math.round((qty * costPerTon + Number.EPSILON) * 100) / 100;
    const netProfit = Math.round((totalAmount - totalCost + Number.EPSILON) * 100) / 100;

    document.getElementById('calloutSaleTotal').textContent = `${formatMoney(totalAmount)} ج.م`;
    document.getElementById('calloutCostTotal').textContent = `${formatMoney(totalCost)} ج.م`;

    const profitEl = document.getElementById('calloutProfitTotal');
    profitEl.textContent = `${formatMoney(netProfit)} ج.م`;
    if (netProfit < 0) {
        profitEl.className = 'calc-val loss-highlight';
    } else {
        profitEl.className = 'calc-val profit-highlight';
    }

    const qtyInput = document.getElementById('modalQuantityTons');
    const maxAvailable = parseFloat(qtyInput.dataset.maxAvailable || '0');
    if (maxAvailable > 0 && qty > maxAvailable + 0.0001) {
        qtyInput.style.borderColor = '#ef4444';
        qtyInput.title = `الكمية المدخلة (${qty} طن) أكبر من المتاح (${maxAvailable} طن)`;
    } else {
        qtyInput.style.borderColor = '';
        qtyInput.title = '';
    }
}

async function refreshSaleNumber() {
    if (window.electronAPI && typeof window.electronAPI.getNextExternalWorkSaleNumber === 'function') {
        const result = await window.electronAPI.getNextExternalWorkSaleNumber();
        if (result && result.success && result.saleNumber) {
            document.getElementById('modalSaleNumber').value = result.saleNumber;
        }
    }
}

function getFilters() {
    return {
        search: (document.getElementById('searchInput')?.value || '').trim(),
        shipmentId: document.getElementById('filterShipment')?.value || '',
        startDate: document.getElementById('startDate')?.value || '',
        endDate: document.getElementById('endDate')?.value || ''
    };
}

async function loadSales() {
    if (!window.electronAPI || typeof window.electronAPI.getExternalWorkSales !== 'function') {
        return;
    }

    const filters = getFilters();
    const result = await window.electronAPI.getExternalWorkSales({
        ...filters,
        page: state.page,
        pageSize: state.pageSize
    });

    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر تحميل مبيعات الشغل الخارجي', 'error');
        return;
    }

    state.rows = Array.isArray(result.sales) ? result.sales : [];
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
    document.getElementById('statSalesAmount').textContent = `${formatMoney(state.stats.totalSalesAmountEgp)} ج.م`;
    document.getElementById('statSalesCount').textContent = `عدد أذونات البيع: ${state.stats.totalSalesCount.toLocaleString('en-US')}`;
    document.getElementById('statSoldTons').textContent = `${formatMoney(state.stats.totalSoldTons)} طن`;
    document.getElementById('statAvgPrice').textContent = `${formatMoney(state.stats.avgSalePricePerTon)} ج.م`;
    document.getElementById('statTotalCost').textContent = `${formatMoney(state.stats.totalCostEgp)} ج.م`;

    const profitVal = Number(state.stats.totalNetProfitEgp) || 0;
    const profitEl = document.getElementById('statNetProfit');
    profitEl.textContent = `${formatMoney(profitVal)} ج.م`;
    profitEl.style.color = profitVal >= 0 ? '#059669' : '#dc2626';

    document.getElementById('salesCount').textContent = state.totalCount.toLocaleString('en-US');
}

function renderRows() {
    const body = document.getElementById('salesBody');
    if (!state.rows.length) {
        body.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--text-muted);">لا توجد مبيعات مسجلة حتى الآن</td></tr>`;
        return;
    }

    body.innerHTML = state.rows.map((row) => {
        const profit = Number(row.net_profit_egp) || 0;
        const profitClass = profit >= 0 ? 'profit-text-positive' : 'profit-text-negative';
        return `
            <tr>
                <td><span class="badge-shipment">${escapeHtml(row.sale_number || '')}</span></td>
                <td style="white-space: nowrap;">${escapeHtml(row.sale_date || '')}</td>
                <td><strong class="badge-customer">${escapeHtml(row.customer_name || '-')}</strong></td>
                <td><span class="badge-shipment-link"><i class="fas fa-boxes"></i> ${escapeHtml(row.shipment_number || '-')}</span></td>
                <td><strong>${escapeHtml(row.item_description || '-')}</strong></td>
                <td><span class="badge-shipment" style="background: rgba(147, 51, 234, 0.1); color: #9333ea;">${formatMoney(row.quantity_tons)} طن</span></td>
                <td style="font-weight: 700;">${formatMoney(row.unit_price_egp)}</td>
                <td style="font-weight: 800; color: #059669;">${formatMoney(row.total_amount_egp)} ج.م</td>
                <td style="font-weight: 600; color: #64748b;">${formatMoney(row.total_cost_egp)}</td>
                <td class="${profitClass}">${formatMoney(row.net_profit_egp)}</td>
                <td style="text-align: center;">
                    <div class="table-actions" style="justify-content: center;">
                        <button type="button" class="action-btn view-btn" data-action="view-sale" data-id="${row.id}" title="عرض التفاصيل">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="action-btn edit-btn" data-action="edit-sale" data-id="${row.id}" title="تعديل">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="action-btn delete-btn" data-action="delete-sale" data-id="${row.id}" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    body.querySelectorAll('[data-action="view-sale"]').forEach((btn) => {
        btn.addEventListener('click', () => viewSaleDetails(btn.dataset.id));
    });

    body.querySelectorAll('[data-action="edit-sale"]').forEach((btn) => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });

    body.querySelectorAll('[data-action="delete-sale"]').forEach((btn) => {
        btn.addEventListener('click', () => deleteSale(btn.dataset.id));
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

function viewSaleDetails(id) {
    const row = getRowById(id);
    if (!row) {
        showMessage('تعذر العثور على بيانات إذن البيع', 'error');
        return;
    }

    const profit = Number(row.net_profit_egp) || 0;
    const profitColor = profit >= 0 ? '#059669' : '#dc2626';

    document.getElementById('detailsContent').innerHTML = `
        <div class="details-grid">
            <div class="details-row">
                <span>رقم إذن البيع:</span>
                <strong>${escapeHtml(row.sale_number)}</strong>
            </div>
            <div class="details-row">
                <span>تاريخ البيع:</span>
                <strong>${escapeHtml(row.sale_date)}</strong>
            </div>
            <div class="details-row highlight" style="grid-column: span 2;">
                <span>العميل / المشتري:</span>
                <strong style="color: #0284c7; font-size: 1.05rem;">${escapeHtml(row.customer_name)}</strong>
            </div>
        </div>

        <div class="modal-section-card" style="margin-top: 14px;">
            <div class="modal-section-title"><i class="fas fa-box-open"></i> شحنة المشتريات المرتبطة</div>
            <div class="details-grid">
                <div class="details-row">
                    <span>رقم الشحنة:</span>
                    <strong>${escapeHtml(row.shipment_number || '-')}</strong>
                </div>
                <div class="details-row">
                    <span>الصنف / البضاعة:</span>
                    <strong>${escapeHtml(row.item_description || '-')}</strong>
                </div>
                <div class="details-row">
                    <span>تكلفة الطن في الشراء:</span>
                    <span>${formatMoney(row.cost_per_ton_egp)} ج.م/طن</span>
                </div>
                <div class="details-row">
                    <span>إجمالي تكلفة الكمية المباعة:</span>
                    <strong style="color: #64748b;">${formatMoney(row.total_cost_egp)} ج.م</strong>
                </div>
            </div>
        </div>

        <div class="modal-section-card" style="margin-top: 14px;">
            <div class="modal-section-title"><i class="fas fa-hand-holding-usd"></i> تفاصيل البيع والربحية</div>
            <div class="details-grid">
                <div class="details-row">
                    <span>الكمية المباعة:</span>
                    <strong style="color: #9333ea;">${formatMoney(row.quantity_tons)} طن</strong>
                </div>
                <div class="details-row">
                    <span>سعر بيع الطن:</span>
                    <strong>${formatMoney(row.unit_price_egp)} ج.م/طن</strong>
                </div>
                <div class="details-row highlight" style="grid-column: span 2;">
                    <span>إجمالي قيمة البيع:</span>
                    <strong style="color: #059669; font-size: 1.15rem;">${formatMoney(row.total_amount_egp)} ج.م</strong>
                </div>
                <div class="details-row profit-row" style="grid-column: span 2; background: rgba(16, 185, 129, 0.12);">
                    <span>صافي الربح المحقق من الإذن:</span>
                    <strong style="color: ${profitColor}; font-size: 1.2rem;">${formatMoney(profit)} ج.م</strong>
                </div>
            </div>
        </div>

        ${row.statement ? `
            <div style="margin-top: 10px; font-size: 0.9rem;">
                <strong>البيان:</strong> ${escapeHtml(row.statement)}
            </div>
        ` : ''}

        ${row.notes ? `
            <div style="margin-top: 8px; font-size: 0.9rem; color: var(--text-muted);">
                <strong>ملاحظات:</strong> ${escapeHtml(row.notes)}
            </div>
        ` : ''}
    `;

    document.body.classList.add('modal-open');
    document.getElementById('detailsModal').classList.remove('hidden');
}

async function openEditModal(id) {
    const row = getRowById(id);
    if (!row) {
        showMessage('تعذر العثور على بيانات إذن البيع', 'error');
        return;
    }

    state.editingId = row.id;
    await loadShipmentsDropdown(row.id);

    document.getElementById('modalTitle').textContent = `تعديل إذن بيع ${row.sale_number}`;
    document.getElementById('modalSaleNumber').value = row.sale_number || '';
    document.getElementById('modalSaleDate').value = row.sale_date || today();
    document.getElementById('modalCustomerName').value = row.customer_name || '';

    const shipment = state.availableShipments.find((s) => Number(s.id) === Number(row.shipment_id));
    if (shipment) {
        applySelectedShipment(shipment, true);
    } else {
        const hiddenId = document.getElementById('modalShipmentId');
        if (hiddenId) hiddenId.value = row.shipment_id ? String(row.shipment_id) : '';
        const shipmentSearch = document.getElementById('modalShipmentSearch');
        if (shipmentSearch) shipmentSearch.value = row.shipment_number || '';
        document.getElementById('modalItemDescription').value = row.item_description || '';
        document.getElementById('modalCostPerTon').value = formatMoney(row.cost_per_ton_egp);
        document.getElementById('modalAvailableTons').value = '-';
    }
    closeShipmentDropdown();

    document.getElementById('modalQuantityTons').value = row.quantity_tons ? formatMoneyInputValue(row.quantity_tons) : '';
    document.getElementById('modalUnitPriceEgp').value = row.unit_price_egp ? formatMoneyInputValue(row.unit_price_egp) : '';
    document.getElementById('modalStatement').value = row.statement || '';
    document.getElementById('modalNotes').value = row.notes || '';

    updateModalLiveCalculations();
    document.body.classList.add('modal-open');
    document.getElementById('saleModal').classList.remove('hidden');
}

async function deleteSale(id) {
    const row = getRowById(id);
    const label = row ? `إذن البيع رقم ${row.sale_number} للعميل ${row.customer_name}` : 'هذا الإذن';

    let confirmed = false;
    if (typeof window.showConfirmDialog === 'function') {
        confirmed = await window.showConfirmDialog(`هل أنت متأكد من حذف ${label}؟ سيتم استرجاع الكمية للشحنة.`);
    } else {
        confirmed = window.confirm(`هل أنت متأكد من حذف ${label}؟ سيتم استرجاع الكمية للشحنة.`);
    }

    if (!confirmed) return;

    const result = await window.electronAPI.deleteExternalWorkSale(id);
    if (!result || !result.success) {
        showMessage((result && result.error) || 'تعذر حذف إذن البيع', 'error');
        return;
    }

    showMessage('تم حذف إذن البيع بنجاح واسترجاع الكمية للشحنة', 'success');
    await loadShipmentsDropdown();
    await loadSales();
}

async function saveSale(event) {
    event.preventDefault();
    if (state.isSaving) return;

    const hiddenShipmentId = Number(document.getElementById('modalShipmentId')?.value);
    const searchVal = (document.getElementById('modalShipmentSearch')?.value || '').trim();
    let selectedShipment = null;
    if (hiddenShipmentId) {
        selectedShipment = state.availableShipments.find((s) => Number(s.id) === hiddenShipmentId);
    }
    if (!selectedShipment && searchVal) {
        selectedShipment = state.availableShipments.find((s) => 
            String(s.shipment_number || '').trim().toLowerCase() === searchVal.toLowerCase() ||
            String(s.shipment_number || '').replace(/^ext-0*/i, '') === searchVal.replace(/^ext-0*/i, '')
        );
    }

    if (!selectedShipment) {
        showMessage('يرجى كتابة أو اختيار شحنة المشتريات المرتبطة من القائمة', 'error');
        return;
    }

    const payload = {
        id: state.editingId,
        sale_number: (document.getElementById('modalSaleNumber').value || '').trim(),
        sale_date: document.getElementById('modalSaleDate').value || today(),
        customer_name: (document.getElementById('modalCustomerName').value || '').trim(),
        shipment_id: selectedShipment.id,
        shipment_number: selectedShipment.shipment_number,
        item_description: selectedShipment.item_description || (document.getElementById('modalItemDescription').value || '').trim(),
        cost_per_ton_egp: selectedShipment.cost_per_ton_egp,
        quantity_tons: parseNumber(document.getElementById('modalQuantityTons').value),
        unit_price_egp: parseNumber(document.getElementById('modalUnitPriceEgp').value),
        statement: (document.getElementById('modalStatement').value || '').trim(),
        notes: (document.getElementById('modalNotes').value || '').trim()
    };

    const submitBtn = document.querySelector('#saleForm .submit-btn');
    try {
        state.isSaving = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
        }

        let result;
        if (state.editingId) {
            result = await window.electronAPI.updateExternalWorkSale(payload);
            if (!result || !result.success) {
                showMessage((result && result.error) || 'تعذر تعديل إذن البيع', 'error');
                return;
            }
            showMessage('تم تعديل إذن البيع بنجاح', 'success');
        } else {
            result = await window.electronAPI.saveExternalWorkSale(payload);
            if (!result || !result.success) {
                showMessage((result && result.error) || 'تعذر حفظ إذن البيع', 'error');
                return;
            }
            showMessage('تم حفظ إذن البيع بنجاح وخصم الكمية من الشحنة', 'success');
        }

        document.body.classList.remove('modal-open');
        document.getElementById('saleModal').classList.add('hidden');
        document.getElementById('saleForm').reset();
        const hiddenId = document.getElementById('modalShipmentId');
        if (hiddenId) hiddenId.value = '';
        closeShipmentDropdown();
        await refreshSaleNumber();
        await loadShipmentsDropdown();
        state.page = 1;
        await loadSales();
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

    const exportResult = await window.electronAPI.getExternalWorkSales({
        ...filters,
        page: 1,
        pageSize: 100000
    });

    if (exportResult && exportResult.success) {
        state.rows = Array.isArray(exportResult.sales) ? exportResult.sales : [];
        renderRows();
    }

    try {
        const date = today();
        const result = await window.electronAPI.saveExternalWorkSalesPdf({
            defaultName: `External_Work_Sales_${date}.pdf`
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
