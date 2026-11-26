 (function () {
    function renderPage({ t, getNavHTML }) {
        const app = document.getElementById('app');
        app.innerHTML = `
            ${getNavHTML()}

            <div class="content">
            <div class="page-hero">
                <div class="page-hero-right">
                    <div class="page-hero-icon"><i class="fas fa-chart-line"></i></div>
                    <div>
                        <h1>${t('customerReports.title', 'تقارير العملاء')}</h1>
                        <p>${t('customerReports.subtitle', 'عرض تفصيلي لحركة العمليات والأرصدة لكل عميل')}</p>
                    </div>
                </div>
            </div>

            <div class="selection-card">
                <div class="form-group" style="flex:2; min-width: 250px;">
                    <label><i class="fas fa-user"></i> ${t('customerReports.selectCustomer', 'اختر العميل')}</label>
                    <select id="customerSelect" class="form-control">
                        <option value="">${t('customerReports.selectCustomerPlaceholder', 'اختر العميل...')}</option>
                    </select>
                </div>
                <div class="form-group date-group">
                    <label><i class="fas fa-calendar-alt"></i> ${t('customerReports.dateFrom', 'من تاريخ')}</label>
                    <input type="date" id="dateFrom" class="form-control">
                </div>
                <div class="form-group date-group">
                    <label><i class="fas fa-calendar-alt"></i> ${t('customerReports.dateTo', 'إلى تاريخ')}</label>
                    <input type="date" id="dateTo" class="form-control">
                </div>
                <div class="form-group" style="flex: 0 0 auto; align-self: flex-end;">
                    <button id="showReportBtn" class="btn-show-report">
                        <i class="fas fa-search"></i> ${t('customerReports.showReport', 'عرض التقرير')}
                    </button>
                </div>
            </div>

            <div id="emptyState" class="empty-state">
                <i class="fas fa-users"></i>
                <h3>${t('customerReports.emptyTitle', 'اختر عميل لعرض تقريره')}</h3>
                <p>${t('customerReports.emptyDesc', 'قم باختيار عميل من القائمة أعلاه لعرض جميع العمليات والأرصدة')}</p>
            </div>

            <div id="reportContainer" class="report-container">
                <div class="summary-strip">
                    <div class="summary-card">
                        <div class="sc-icon sales"><i class="fas fa-shopping-cart"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.totalSales', 'إجمالي المبيعات')}</div>
                            <div class="sc-value" id="totalSales">0.00</div>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="sc-icon purchase"><i class="fas fa-shopping-bag"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.totalPurchases', 'إجمالي المشتريات')}</div>
                            <div class="sc-value" id="totalPurchases">0.00</div>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="sc-icon receipts"><i class="fas fa-hand-holding-usd"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.totalReceipts', 'إجمالي التحصيلات')}</div>
                            <div class="sc-value" id="totalReceipts">0.00</div>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="sc-icon payments-out"><i class="fas fa-money-bill-wave"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.totalPaymentsOut', 'إجمالي السداد')}</div>
                            <div class="sc-value" id="totalPaymentsOut">0.00</div>
                        </div>
                    </div>
                    <div class="summary-card card-closing-balance" id="closingBalanceCard">
                        <div class="sc-icon balance"><i class="fas fa-coins"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.closingBalance', 'الرصيد الختامي')}</div>
                            <div class="sc-value" id="totalClosingBalance">0.00</div>
                            <div class="sc-badge" id="closingBalanceBadge" style="display: none;"></div>
                        </div>
                    </div>
                </div>

                <div class="table-card">
                    <div class="table-card-header">
                        <h3><i class="fas fa-list-alt"></i> ${t('customerReports.transactionLog', 'سجل العمليات')}</h3>
                        <button class="btn-icon no-print" title="${t('customerReports.savePdfBtn', 'حفظ PDF')}" data-action="save-pdf">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>${t('customerReports.tableHeaders.date', 'التاريخ')}</th>
                                <th>${t('customerReports.tableHeaders.type', 'النوع')}</th>
                                <th>${t('customerReports.tableHeaders.docNumber', 'رقم المستند')}</th>
                                <th>${t('customerReports.tableHeaders.description', 'البيان')}</th>
                                <th>${t('customerReports.tableHeaders.totalInvoice', 'إجمالي الفاتورة')}</th>
                                <th>${t('customerReports.tableHeaders.paid', 'المدفوع')}</th>
                                <th>${t('customerReports.tableHeaders.remaining', 'المتبقي')}</th>
                                <th>${t('customerReports.tableHeaders.runningBalance', 'الرصيد')}</th>
                            </tr>
                        </thead>
                        <tbody id="customerReportTableBody"></tbody>
                    </table>
                    <div class="balance-footer" id="balanceFooter"></div>
                    <div class="customer-report-pagination no-print" id="customerReportPagination"></div>
                </div>

                <!-- PDF Options Modal -->
                <div id="pdfModal" class="modal-overlay" style="display: none;">
                    <div class="modal-content pdf-modal">
                        <div class="modal-header">
                            <h3>خيارات الطباعة</h3>
                            <button class="modal-close" id="pdfModalClose">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <p>اختر نوع كشف الحساب:</p>
                            <div class="pdf-buttons">
                                <button class="pdf-btn detailed" id="detailedPdfBtn">
                                    <i class="fas fa-list-ul"></i>
                                    <span>كشف تفصيلي</span>
                                </button>
                                <button class="pdf-btn summary" id="summaryPdfBtn">
                                    <i class="fas fa-table"></i>
                                    <span>فاتورة مجمعة</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
    }

    window.customerReportsPageRender = {
        renderPage
    };
})();
