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

                    <article class="summary-card card-amount">
                        <div class="sc-icon"><i class="fas fa-coins"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.totalAmount', 'إجمالي المبالغ')}</div>
                            <div class="sc-value" id="totalAmount">0.00 ${CUR}</div>
                        </div>
                    </article>

                    <article class="summary-card card-sales-return">
                        <div class="sc-icon"><i class="fas fa-undo"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.salesReturnCount', 'مردودات المبيعات')}</div>
                            <div class="sc-value" id="salesReturnCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-purchase-return">
                        <div class="sc-icon"><i class="fas fa-undo"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.purchaseReturnCount', 'مردودات المشتريات')}</div>
                            <div class="sc-value" id="purchaseReturnCount">0</div>
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
                                <option value="sales_return">${t('reports.salesReturnType', 'مردودات مبيعات')}</option>
                                <option value="purchase_return">${t('reports.purchaseReturnType', 'مردودات مشتريات')}</option>
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
