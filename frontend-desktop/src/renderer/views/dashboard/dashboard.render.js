(function () {
    function renderPage({ t, getNavHTML }) {
        const app = document.getElementById('app');
        app.innerHTML = `
        ${getNavHTML()}

        <main class="content">
            <section class="dashboard-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                    <span class="hero-shape shape-4"></span>
                    <span class="hero-shape shape-5"></span>
                </div>
                <div class="hero-content">
                    <h1>${t('dashboard.title', 'لوحة التحكم')}</h1>
                    <p>${t('dashboard.subtitle', 'نظرة عامة على أداء نشاطك التجاري')}</p>
                </div>
                <div class="hero-bottom">
                    <div class="last-updated" id="lastUpdated">
                        <i class="fas fa-clock"></i> ${t('dashboard.lastUpdate', 'آخر تحديث: —')}
                    </div>
                    <div class="dashboard-actions">
                        <button id="refreshBtn" class="btn-refresh">
                            <i class="fas fa-sync-alt"></i> ${t('dashboard.refreshData', 'تحديث البيانات')}
                        </button>
                    </div>
                </div>
            </section>

            <section class="quick-actions-grid">
                <a href="../sales/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-shopping-cart"></i></div>
                    <span class="action-label">${t('dashboard.newSaleInvoice', 'فاتورة بيع جديدة')}</span>
                </a>
                <a href="../purchases/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-shopping-bag"></i></div>
                    <span class="action-label">${t('dashboard.newPurchaseInvoice', 'فاتورة شراء جديدة')}</span>
                </a>
                <a href="../items/items.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-plus-circle"></i></div>
                    <span class="action-label">${t('dashboard.addItem', 'إضافة صنف')}</span>
                </a>
                <a href="../customers/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-user-plus"></i></div>
                    <span class="action-label">${t('dashboard.addCustomer', 'إضافة عميل')}</span>
                </a>
                <a href="../reports/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-chart-pie"></i></div>
                    <span class="action-label">${t('dashboard.reportsLink', 'التقارير')}</span>
                </a>
                <section class="filters-panel">
                    <div class="filters-grid">
                        <div class="form-group">
                            <label for="dashboardFromDate"><i class="fas fa-calendar-alt"></i> ${t('dashboard.dateFrom', 'من تاريخ')}</label>
                            <input type="date" id="dashboardFromDate" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="dashboardToDate"><i class="fas fa-calendar-alt"></i> ${t('dashboard.dateTo', 'إلى تاريخ')}</label>
                            <input type="date" id="dashboardToDate" class="form-control">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-clock"></i> ${t('dashboard.periodLabel', 'الفترة')}</label>
                            <div id="dashboardPeriod" class="form-control">${t('dashboard.allPeriods', 'كل الفترات')}</div>
                        </div>
                    </div>

                    <div class="filters-actions">
                        <button id="dashboardClearBtn" type="button" class="btn-secondary">
                            <i class="fas fa-eraser"></i>
                            <span>${t('dashboard.clearFilter', 'مسح الفلتر')}</span>
                        </button>
                        <button id="dashboardApplyBtn" type="button" class="btn-primary">
                            <i class="fas fa-check"></i>
                            <span>${t('dashboard.applyFilter', 'تطبيق')}</span>
                        </button>
                    </div>
                </section>
            </section>

            <h3 class="section-title"><i class="fas fa-calendar-day"></i> ${t('dashboard.todaySummary', 'ملخص اليوم')}</h3>
            <div class="today-summary">
                <div class="today-stat">
                    <div class="today-stat-icon today-invoices"><i class="fas fa-file-invoice"></i></div>
                    <div class="today-stat-info">
                        <span class="today-stat-value" id="todayInvoices">—</span>
                        <span class="today-stat-label">${t('dashboard.todayInvoices', 'فواتير اليوم')}</span>
                    </div>
                </div>
                <div class="today-stat">
                    <div class="today-stat-icon today-sales"><i class="fas fa-cash-register"></i></div>
                    <div class="today-stat-info">
                        <span class="today-stat-value" id="todaySales">—</span>
                        <span class="today-stat-label">${t('dashboard.todaySalesTotal', 'مبيعات اليوم')}</span>
                    </div>
                </div>
                <div class="today-stat">
                    <div class="today-stat-icon today-collections"><i class="fas fa-hand-holding-usd"></i></div>
                    <div class="today-stat-info">
                        <span class="today-stat-value" id="todayCollections">—</span>
                        <span class="today-stat-label">${t('dashboard.todayCollections', 'تحصيلات اليوم')}</span>
                    </div>
                </div>
                <div class="today-stat">
                    <div class="today-stat-icon today-payments"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="today-stat-info">
                        <span class="today-stat-value" id="todayPayments">—</span>
                        <span class="today-stat-label">${t('dashboard.todayPayments', 'مدفوعات اليوم')}</span>
                    </div>
                </div>
            </div>

            <section class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-chart-line"></i></div>
                    </div>
                    <h3 class="metric-value" id="salesMonth">—</h3>
                    <p class="metric-label">${t('dashboard.salesMonth', 'إجمالي المبيعات')}</p>
                    <div class="metric-trend" id="salesMonthTrend"></div>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-shopping-basket"></i></div>
                    </div>
                    <h3 class="metric-value" id="purchasesMonth">—</h3>
                    <p class="metric-label">${t('dashboard.purchasesMonth', 'إجمالي المشتريات')}</p>
                    <div class="metric-trend" id="purchasesMonthTrend"></div>
                </div>
                  <div class="metric-card interactive-card" id="netProfitCard" style="cursor: pointer; position: relative" onclick="window.showNetProfitDetails()">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-coins"></i></div>
                    </div>
                    <h3 class="metric-value" id="netProfit">—</h3>
                    <p class="metric-label">${t('dashboard.netProfit', 'صافي الربح التقديري')}</p>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-landmark"></i></div>
                    </div>
                    <h3 class="metric-value" id="treasuryBalance">—</h3>
                    <p class="metric-label">${t('dashboard.treasuryBalance', 'رصيد الخزينة')}</p>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-boxes"></i></div>
                    </div>
                    <h3 class="metric-value" id="stockValue">—</h3>
                    <p class="metric-label">${t('dashboard.stockValue', 'إجمالي قيمة المخزون')}</p>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-tags"></i></div>
                    </div>
                    <h3 class="metric-value" id="itemsCount">—</h3>
                    <p class="metric-label">${t('dashboard.itemsCount', 'عدد الأصناف المسجلة')}</p>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-hand-holding-usd"></i></div>
                    </div>
                    <h3 class="metric-value" id="receivables">—</h3>
                    <p class="metric-label">${t('dashboard.receivables', 'المستحق على العملاء')}</p>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-file-invoice-dollar"></i></div>
                    </div>
                    <h3 class="metric-value" id="payables">—</h3>
                    <p class="metric-label">${t('dashboard.payables', 'المستحق للموردين')}</p>
                </div>
            </section>

            <section class="chart-section card">
                <div class="chart-header">
                    <h3 class="section-title" style="margin: 0;"><i class="fas fa-chart-bar"></i> ${t('dashboard.chartTitle', 'حركة المبيعات والمشتريات')}</h3>
                    <div class="chart-controls">
                        <div class="chart-legend">
                            <span class="legend-item"><span class="legend-color legend-sales"></span> ${t('dashboard.salesLabel', 'المبيعات')}</span>
                            <span class="legend-item"><span class="legend-color legend-purchases"></span> ${t('dashboard.purchasesLabel', 'المشتريات')}</span>
                        </div>
                        <div class="chart-toggle">
                            <button class="chart-btn active" data-period="7">${t('dashboard.last7Days', 'آخر 7 أيام')}</button>
                            <button class="chart-btn" data-period="30">${t('dashboard.last30Days', 'آخر 30 يوم')}</button>
                        </div>
                    </div>
                </div>
                <canvas id="dashChart"></canvas>
            </section>

            <div class="dashboard-middle-grid">
                <section class="card">
                    <h3 class="section-title" style="margin-top: 0;"><i class="fas fa-history"></i> ${t('dashboard.recentTransactions', 'آخر المعاملات')}</h3>
                    <div class="recent-table-wrap">
                        <table class="recent-table">
                            <thead>
                                <tr>
                                    <th>${t('dashboard.invoiceNum', 'رقم الفاتورة')}</th>
                                    <th>${t('dashboard.date', 'التاريخ')}</th>
                                    <th>${t('dashboard.typeLbl', 'النوع')}</th>
                                    <th>${t('dashboard.party', 'الطرف')}</th>
                                    <th>${t('dashboard.amount', 'المبلغ')}</th>
                                </tr>
                            </thead>
                            <tbody id="recentTransBody">
                                <tr><td colspan="5" style="text-align: center;">${t('dashboard.analyzingData', 'جاري تحليل البيانات...')}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>
                <section class="card">
                    <h3 class="section-title" style="margin-top: 0;"><i class="fas fa-trophy"></i> ${t('dashboard.topItems', 'أكثر الأصناف مبيعاً')}</h3>
                    <div id="topItemsList" class="top-items-list">
                        <p style="text-align: center; color: var(--text-secondary);">${t('dashboard.analyzingData', 'جاري تحليل البيانات...')}</p>
                    </div>
                </section>
            </div>

            <div class="dashboard-bottom-grid">
                <section class="card">
                    <h3 class="section-title" style="margin-top: 0;"><i class="fas fa-bell"></i> ${t('dashboard.alertsTitle', 'تنبيهات')}</h3>
                    <ul class="alerts-list" id="alertsList">
                        <li>${t('dashboard.analyzingData', 'جاري تحليل البيانات...')}</li>
                    </ul>
                </section>
                
                <section class="card">
                    <h3 class="section-title" style="margin-top: 0;"><i class="fas fa-info-circle"></i> ${t('dashboard.systemStatusTitle', 'حالة النظام')}</h3>
                    <div class="system-status-grid">
                        <div class="status-row">
                            <span>${t('dashboard.connectionStatus', 'حالة الاتصال')}</span>
                            <span style="color: #10b981; font-weight: bold;">${t('dashboard.connected', 'متصل')} <i class="fas fa-check-circle"></i></span>
                        </div>
                        <div class="status-row">
                            <span>${t('dashboard.appVersion', 'نسخة البرنامج')}</span>
                            <span style="font-weight: bold;">v1.1.5</span>
                        </div>
                        <div class="status-row">
                            <span>${t('dashboard.customersCount', 'قاعدة العملاء')}</span>
                            <span style="font-weight: bold;" id="customersCount">—</span>
                        </div>
                        <div class="status-row">
                            <span>${t('dashboard.suppliersCount', 'شبكة الموردين')}</span>
                            <span style="font-weight: bold;" id="suppliersCount">—</span>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    `;
    }

    function renderAlerts({ alerts, t, fmt }) {
        const list = document.getElementById('alertsList');
        if (!list) return;

        const items = [];

        if (alerts.lowStockItems && alerts.lowStockItems.length > 0) {
            alerts.lowStockItems.forEach((item) => {
                items.push(`<li class="alert-item alert-warning"><i class="fas fa-exclamation-triangle"></i> ${fmt(t('dashboard.alerts.lowStock', '⚠️ {name} — المتبقي: {qty} (حد الطلب: {reorder})'), { name: item.name, qty: item.stock_quantity, reorder: item.reorder_level })}</li>`);
            });
        }

        if (alerts.highReceivables && alerts.highReceivables.length > 0) {
            alerts.highReceivables.forEach((item) => {
                items.push(`<li class="alert-item alert-info"><i class="fas fa-coins"></i> ${fmt(t('dashboard.alerts.highReceivable', '💰 {name} — مستحقات: {amount} ج.م'), { name: item.name, amount: item.amount.toFixed(2) })}</li>`);
            });
        }

        if (alerts.oldInvoices && alerts.oldInvoices.length > 0) {
            alerts.oldInvoices.forEach((inv) => {
                items.push(`<li class="alert-item alert-danger"><i class="fas fa-clock"></i> ${fmt(t('dashboard.alerts.oldInvoice', 'فاتورة ({number}) بمبلغ {amount} ج.م متأخرة منذ {days} يوم'), { number: inv.invoice_number, amount: inv.amount.toFixed(2), days: inv.days_old })}</li>`);
            });
        }

        if (items.length === 0) {
            items.push(`<li class="alert-item alert-success"><i class="fas fa-check-circle"></i> ${t('dashboard.alerts.noAlerts', '✅ لا توجد تنبيهات — كل شيء على ما يرام!')}</li>`);
        }

        list.innerHTML = items.join('');
    }

    function renderRecentTransactions({ transactions, t }) {
        const tbody = document.getElementById('recentTransBody');
        if (!tbody) return;

        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">${t('dashboard.noTransactions', 'لا توجد معاملات بعد')}</td></tr>`;
            return;
        }

        tbody.innerHTML = transactions.map((tx) => {
            const invoiceNumberCell = window.renderDocNumberCell
                ? window.renderDocNumberCell(tx.invoice_number, { numberTag: 'strong' })
                : `<strong>${tx.invoice_number || '—'}</strong>`;

            return `
        <tr>
            <td>${invoiceNumberCell}</td>
            <td>${tx.date || '—'}</td>
            <td><span class="type-badge type-${tx.type}">${tx.type === 'sale' ? t('dashboard.saleType', 'بيع') : t('dashboard.purchaseType', 'شراء')}</span></td>
            <td>${tx.party_name || '—'}</td>
            <td><strong>${(tx.amount || 0).toFixed(2)}</strong></td>
        </tr>
    `;
        }).join('');
    }

    function renderTopItems({ topItems, t }) {
        const container = document.getElementById('topItemsList');
        if (!container) return;

        if (!topItems || topItems.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">${t('dashboard.noSales', 'لا توجد مبيعات بعد')}</p>`;
            return;
        }

        container.innerHTML = `
        <table class="recent-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>${t('dashboard.itemName', 'الصنف')}</th>
                    <th>${t('dashboard.qtySold', 'الكمية')}</th>
                    <th>${t('dashboard.totalValue', 'القيمة')}</th>
                </tr>
            </thead>
            <tbody>
                ${topItems.map((item, i) => `
                    <tr>
                        <td><span class="top-item-rank">${i + 1}</span></td>
                        <td>${item.name}</td>
                        <td>${item.total_qty}</td>
                        <td><strong>${item.total_value.toFixed(2)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    }

    window.dashboardPageRender = {
        renderPage,
        renderAlerts,
        renderRecentTransactions,
        renderTopItems
    };
})();
