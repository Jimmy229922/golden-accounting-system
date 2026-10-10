(function () {
    function renderPage({ t, CUR }) {
        const app = document.getElementById('app');
        app.innerHTML = `
        ${buildTopNavHTML(t)}

        <main class="content reports-content">
            <div class="reports-page">
                <section class="reports-hero">
                    <div class="reports-hero-main">
                        <div class="page-hero-icon"><i class="fas fa-chart-bar"></i></div>
                        <div>
                            <span class="hero-eyebrow">${t('reports.hero.label', 'لوحة متابعة الفواتير')}</span>
                            <h1>${t('reports.title', 'التقارير العامة')}</h1>
                            <p>${t('reports.subtitle', 'عرض وإدارة جميع فواتير المبيعات والمشتريات')}</p>
                        </div>
                    </div>

                    <div class="hero-stats">
                        <div class="hero-stat-card">
                            <span>${t('reports.hero.currentResults', 'النتائج الحالية')}</span>
                            <strong id="heroResultCount">0</strong>
                        </div>
                        <div class="hero-stat-card">
                            <span>${t('reports.hero.lastRefresh', 'آخر تحديث')}</span>
                            <strong id="lastUpdatedLabel">-</strong>
                        </div>
                    </div>
                </section>

                <div id="reportsStatus" class="reports-status status-info">
                    ${t('reports.loading', 'جارٍ تحميل البيانات...')}
                </div>

                <section class="summary-strip" aria-label="${t('reports.summary.title', 'ملخص التقارير')}">
                    <article class="summary-card card-total">
                        <div class="sc-icon"><i class="fas fa-file-invoice"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.totalInvoices', 'إجمالي الفواتير')}</div>
                            <div class="sc-value" id="totalInvoices">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-sales">
                        <div class="sc-icon"><i class="fas fa-arrow-up"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.salesCount', 'فواتير المبيعات')}</div>
                            <div class="sc-value" id="salesCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-purchase">
                        <div class="sc-icon"><i class="fas fa-arrow-down"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.purchaseCount', 'فواتير المشتريات')}</div>
                            <div class="sc-value" id="purchaseCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-purchase-opening">
                        <div class="sc-icon"><i class="fas fa-hourglass-start"></i></div>
                        <div>
                            <div class="sc-label">بداية مدة المشتريات</div>
                            <div class="sc-value" id="purchaseOpeningBalanceAmount">0.00 ${CUR}</div>
                        </div>
                    </article>

                    <article class="summary-card card-purchase-total">
                        <div class="sc-icon"><i class="fas fa-cash-register"></i></div>
                        <div>
                            <div class="sc-label">إجمالي المشتريات</div>
                            <div class="sc-value" id="purchaseTotalAmount">0.00 ${CUR}</div>
                        </div>
                    </article>

                    <article class="summary-card card-amount">
                        <div class="sc-icon"><i class="fas fa-coins"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.totalAmount', 'إجمالي المبالغ')}</div>
                            <div class="sc-value" id="totalAmount">0.00 ${CUR}</div>
                        </div>
                    </article>

                    <article class="summary-card card-receipt">
                        <div class="sc-icon"><i class="fas fa-hand-holding-usd"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.receiptCount', 'سندات التحصيل')}</div>
                            <div class="sc-value" id="receiptCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-payment">
                        <div class="sc-icon"><i class="fas fa-money-bill-wave"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.paymentCount', 'سندات السداد')}</div>
                            <div class="sc-value" id="paymentCount">0</div>
                        </div>
                    </article>
                </section>

                <section class="filters-panel">
                    <div class="filters-head">
                        <h2>${t('reports.filtersTitle', 'تصفية السجل')}</h2>
                        <p>${t('reports.filtersSubtitle', 'اختر نوع الفاتورة والعميل والفترة الزمنية ثم اضغط بحث.')}</p>
                    </div>

                    <div class="filters-grid">
                        <div class="form-group">
                            <label for="typeFilter"><i class="fas fa-filter"></i> ${t('reports.invoiceType', 'نوع الفاتورة')}</label>
                            <select id="typeFilter" class="form-control">
                                <option value="all">${t('reports.allTypes', 'الكل')}</option>
                                <option value="sales">${t('reports.salesType', 'مبيعات')}</option>
                                <option value="purchase">${t('reports.purchaseType', 'مشتريات')}</option>
                                <option value="receipt">${t('reports.receiptType', 'سندات تحصيل')}</option>
                                <option value="payment">${t('reports.paymentType', 'سندات سداد')}</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="customerFilter"><i class="fas fa-user"></i> ${t('reports.customerSupplier', 'العميل / المورد')}</label>
                            <select id="customerFilter" class="form-control">
                                <option value="">${t('reports.allCustomers', 'الكل')}</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="startDate"><i class="fas fa-calendar-alt"></i> ${t('reports.fromDate', 'من تاريخ')}</label>
                            <input type="date" id="startDate" class="form-control">
                        </div>

                        <div class="form-group">
                            <label for="endDate"><i class="fas fa-calendar-alt"></i> ${t('reports.toDate', 'إلى تاريخ')}</label>
                            <input type="date" id="endDate" class="form-control">
                        </div>
                    </div>

                    <div class="period-opening-panel">
                        <div class="period-opening-copy">
                            <h3>بداية مدة المشتريات</h3>
                            <p>قيمة تضاف إلى إجمالي المشتريات في التقرير العام عندما تبدأ الفترة من 01-01.</p>
                        </div>
                        <div class="period-opening-controls">
                            <div class="period-opening-summary-chip">
                                <span class="chip-label"><i class="fas fa-coins"></i> القيمة الحالية:</span>
                                <strong id="purchaseOpeningDisplayValue" class="chip-value">0.00 ${CUR}</strong>
                                <span id="purchaseOpeningDisplayCount" class="chip-badge">(0 بنود)</span>
                            </div>
                            <button id="openPurchaseOpeningModalBtn" type="button" class="btn-primary">
                                <i class="fas fa-list-ul"></i>
                                <span>إدارة بنود بداية المدة</span>
                            </button>
                        </div>
                    </div>

                    <div class="filters-actions">
                        <button id="resetBtn" type="button" class="btn-secondary">
                            <i class="fas fa-undo"></i>
                            <span>${t('reports.resetFilters', 'إعادة ضبط')}</span>
                        </button>
                        <button id="searchBtn" type="button" class="btn-primary">
                            <i class="fas fa-search"></i>
                            <span>${t('reports.search', 'بحث')}</span>
                        </button>
                    </div>
                </section>

                <section class="table-card">
                    <div class="table-card-header">
                        <h3><i class="fas fa-list"></i> ${t('reports.tableTitle', 'سجل الفواتير')}</h3>
                        <div class="header-actions">
                            <span id="resultCount" class="result-count"></span>
                        </div>
                    </div>

                    <div class="table-wrap">
                        <table class="table reports-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>${t('reports.tableHeaders.date', 'التاريخ')}</th>
                                    <th>${t('reports.tableHeaders.invoiceNumber', 'رقم الفاتورة')}</th>
                                    <th>${t('reports.tableHeaders.type', 'النوع')}</th>
                                    <th>${t('reports.tableHeaders.customerSupplier', 'العميل / المورد')}</th>
                                    <th>${t('reports.tableHeaders.amount', 'المبلغ')}</th>
                                    <th>${t('reports.tableHeaders.paid', 'المدفوع')}</th>
                                    <th>${t('reports.tableHeaders.remaining', 'المتبقي')}</th>
                                    <th>${t('reports.tableHeaders.actions', 'إجراءات')}</th>
                                </tr>
                            </thead>
                            <tbody id="reportsTableBody"></tbody>
                        </table>
                    </div>

                    <div id="paginationBar" class="pagination-bar" style="display: none;">
                        <div class="pagination-info" id="paginationInfo"></div>
                        <div class="pagination-btns" id="paginationBtns"></div>
                    </div>
                </section>
            </div>

            <div id="voucherModal" class="voucher-modal-overlay" aria-hidden="true">
                <div class="voucher-modal" role="dialog" aria-modal="true" aria-labelledby="voucherModalTitle">
                    <div class="voucher-modal-header">
                        <div class="voucher-modal-title-wrap">
                            <div class="voucher-modal-icon"><i class="fas fa-receipt"></i></div>
                            <div>
                                <h3 id="voucherModalTitle">${t('reports.voucherPreviewTitle', 'عرض السند')}</h3>
                                <p id="voucherModalSubtitle">${t('reports.loading', 'جارٍ تحميل البيانات...')}</p>
                            </div>
                        </div>
                        <button type="button" class="voucher-modal-close" id="voucherModalCloseBtn" aria-label="${t('reports.close', 'إغلاق')}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="voucher-modal-content" id="voucherModalBody">
                        <div class="voucher-modal-loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>${t('reports.loading', 'جارٍ تحميل البيانات...')}</span>
                        </div>
                    </div>

                    <div class="voucher-modal-footer">
                        <button type="button" class="btn-primary" id="voucherModalPrintBtn">
                            <i class="fas fa-print"></i>
                            <span>${t('reports.printVoucher', 'طباعة السند')}</span>
                        </button>
                        <button type="button" class="btn-secondary" id="voucherModalCloseBtnFooter">
                            ${t('reports.close', 'إغلاق')}
                        </button>
                    </div>
                </div>
            </div>

            <div id="purchaseOpeningModal" class="voucher-modal-overlay" aria-hidden="true">
                <div class="voucher-modal purchase-opening-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="purchaseOpeningModalTitle">
                    <div class="voucher-modal-header">
                        <div class="voucher-modal-title-wrap">
                            <div class="voucher-modal-icon"><i class="fas fa-hourglass-start"></i></div>
                            <div>
                                <h3 id="purchaseOpeningModalTitle">بنود بداية مدة المشتريات</h3>
                                <p id="purchaseOpeningModalSubtitle">أدخل مبالغ بداية المدة مع ملاحظة لكل بند، وسيتم جمعها تلقائياً لإجمالي المشتريات.</p>
                            </div>
                        </div>
                        <button type="button" class="voucher-modal-close" id="purchaseOpeningModalCloseBtn" aria-label="${t('reports.close', 'إغلاق')}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="voucher-modal-content purchase-opening-modal-content">
                        <form id="purchaseOpeningItemForm" class="purchase-opening-form">
                            <div class="purchase-opening-form-grid">
                                <div class="form-group form-group-amount">
                                    <label for="newOpeningItemAmount"><i class="fas fa-coins"></i> المبلغ (${CUR})</label>
                                    <input type="text" id="newOpeningItemAmount" class="form-control" inputmode="decimal" placeholder="0.00" required>
                                </div>
                                <div class="form-group form-group-note">
                                    <label for="newOpeningItemNote"><i class="fas fa-sticky-note"></i> البيان / الملاحظة</label>
                                    <input type="text" id="newOpeningItemNote" class="form-control" placeholder="اكتب ملاحظة أو تفاصيل هذا المبلغ..." required>
                                </div>
                                <div class="form-group form-group-add">
                                    <label class="invisible-label">&nbsp;</label>
                                    <button type="submit" id="addOpeningItemBtn" class="btn-primary">
                                        <i class="fas fa-plus"></i>
                                        <span>إضافة</span>
                                    </button>
                                </div>
                            </div>
                        </form>

                        <div class="purchase-opening-table-wrap">
                            <table class="table purchase-opening-table">
                                <thead>
                                    <tr>
                                        <th style="width: 50px;">#</th>
                                        <th style="width: 150px;">المبلغ</th>
                                        <th>البيان والملاحظة</th>
                                        <th style="width: 80px; text-align: center;">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody id="purchaseOpeningTableBody"></tbody>
                            </table>
                            <div id="purchaseOpeningEmptyState" class="purchase-opening-empty">
                                <i class="fas fa-inbox"></i>
                                <span>لا توجد بنود مضافة حالياً. أضف أول بند من النموذج أعلاه.</span>
                            </div>
                        </div>

                        <div class="purchase-opening-total-bar">
                            <div class="total-bar-info">
                                <span class="total-bar-label">إجمالي مبالغ بداية المدة:</span>
                                <strong id="modalPurchaseOpeningTotal">0.00 ${CUR}</strong>
                            </div>
                            <div class="total-bar-count" id="modalPurchaseOpeningCount">0 بنود</div>
                        </div>
                    </div>

                    <div class="voucher-modal-footer">
                        <button type="button" class="btn-primary" id="saveOpeningBalanceModalBtn">
                            <i class="fas fa-save"></i>
                            <span>حفظ التغييرات</span>
                        </button>
                        <button type="button" class="btn-secondary" id="cancelOpeningBalanceModalBtn">
                            ${t('reports.close', 'إغلاق')}
                        </button>
                    </div>
                </div>
            </div>

        </main>
    `;
    }

    function buildTopNavHTML(t) {
        if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
            return window.navManager.getTopNavHTML(t);
        }
        return '';
    }

    window.reportsPageRender = {
        renderPage
    };
})();
