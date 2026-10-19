let refreshBtn;
let lastUpdatedEl;
let startDateInput;
let endDateInput;
let applyFilterBtn;
let clearFilterBtn;
let periodLabelEl;
let appVersionEl;
let lastStats = null;
let cachedLastSyncAt = localStorage.getItem('golden_last_cloud_sync_at') || null;
let chartPeriod = '7';
let ar = {};
let currentFilters = { startDate: '', endDate: '' };
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
const dashboardRender = window.dashboardPageRender;

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    dashboardRender.renderPage({ t, getNavHTML });
    bindEvents();
    if (window.electronAPI && typeof window.electronAPI.onCloudSyncStatus === 'function') {
        window.electronAPI.onCloudSyncStatus((status) => {
            if (status) {
                if (status.success && status.lastSyncAt) {
                    cachedLastSyncAt = status.lastSyncAt;
                    try { localStorage.setItem('golden_last_cloud_sync_at', cachedLastSyncAt); } catch (_) {}
                }
                updateSyncStatusUI(status);

                const modal = document.getElementById('syncLogModal');
                if (modal && typeof window.refreshSyncLogModalData === 'function') {
                    window.refreshSyncLogModalData();
                }
            }
        });
    }
    loadDashboardStats(currentFilters, false);
    if (window.electronAPI && typeof window.electronAPI.checkInitialOnboarding === 'function') {
        window.electronAPI.checkInitialOnboarding().then((check) => {
            if (check && check.needed && typeof window.showOnboardingWizardModal === 'function') {
                window.showOnboardingWizardModal();
            }
        }).catch(() => {});
    }
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function getNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

function money(val) {
    const n = Number(val) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + t('common.currency.egpSymbol', 'ج.م');
}

function trendHTML(percent) {
    if (percent > 0) return `<span class="trend-up"><i class="fas fa-arrow-up"></i> ${percent}%</span>`;
    if (percent < 0) return `<span class="trend-down"><i class="fas fa-arrow-down"></i> ${Math.abs(percent)}%</span>`;
    return `<span class="trend-same">— ${t('dashboard.trendSame', 'ثابت')}</span>`;
}

function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.round(n).toString();
}

function formatDateForUi(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('ar-EG');
}

function getPeriodText(filters = currentFilters) {
    const startDate = filters.startDate || '';
    const endDate = filters.endDate || '';
    if (!startDate && !endDate) return t('dashboard.allPeriods', 'كل الفترات');
    const startText = startDate ? formatDateForUi(startDate) : '';
    const endText = endDate ? formatDateForUi(endDate) : '';
    if (startDate && endDate) return `من ${startText} إلى ${endText}`;
    if (startDate) return `من ${startText}`;
    return `حتى ${endText}`;
}

function updatePeriodLabel(filters = currentFilters) {
    if (!periodLabelEl) return;
    periodLabelEl.textContent = getPeriodText(filters);
}

function getFilterValues() {
    return {
        startDate: startDateInput && startDateInput.value ? startDateInput.value : '',
        endDate: endDateInput && endDateInput.value ? endDateInput.value : ''
    };
}

function applyDashboardFilters() {
    currentFilters = getFilterValues();
    loadDashboardStats(currentFilters, false);
}

function clearDashboardFilters() {
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    currentFilters = { startDate: '', endDate: '' };
    loadDashboardStats(currentFilters, false);
}

function bindEvents() {
    refreshBtn = document.getElementById('refreshBtn');
    lastUpdatedEl = document.getElementById('lastUpdated');
    startDateInput = document.getElementById('dashboardFromDate');
    endDateInput = document.getElementById('dashboardToDate');
    applyFilterBtn = document.getElementById('dashboardApplyBtn');
    clearFilterBtn = document.getElementById('dashboardClearBtn');
    periodLabelEl = document.getElementById('dashboardPeriod');
    appVersionEl = document.getElementById('dashboardAppVersion');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadDashboardStats(currentFilters, true));
    }

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyDashboardFilters);
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearDashboardFilters);
    }

    const syncStatusBadgeEl = document.getElementById('syncStatusBadge');
    if (syncStatusBadgeEl) {
        syncStatusBadgeEl.addEventListener('click', () => {
            if (typeof window.showSyncLogModal === 'function') {
                window.showSyncLogModal();
            }
        });
    }

    updatePeriodLabel();

    startRealTimeClock();
    loadAppVersion();

    document.querySelectorAll('.chart-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            chartPeriod = btn.dataset.period;
            if (lastStats && lastStats.chartData) renderChart(lastStats.chartData);
        });
    });

    window.addEventListener('resize', () => {
        if (lastStats && lastStats.chartData) renderChart(lastStats.chartData);
    });
}

async function loadAppVersion() {
    if (!appVersionEl || !window.electronAPI || typeof window.electronAPI.getAppVersion !== 'function') {
        return;
    }

    try {
        const result = await window.electronAPI.getAppVersion();
        if (result && result.success && result.version) {
            appVersionEl.textContent = result.version;
        }
    } catch (_) {
    }
}

function startRealTimeClock() {
    const update = () => {
        const now = new Date();
        const formatted = now.toLocaleString('ar-EG');
        if (lastUpdatedEl) {
            lastUpdatedEl.innerHTML = `<i class="fas fa-clock"></i> ${formatted}`;
        }
    };

    update();
    setInterval(update, 1000);
}

function renderChart(chartData) {
    const canvas = document.getElementById('dashChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 45, left: 65 };

    const days = parseInt(chartPeriod, 10);
    const now = new Date();

    const salesMap = {};
    const purchasesMap = {};
    (chartData.dailySales || []).forEach((d) => { salesMap[d.date] = d.total; });
    (chartData.dailyPurchases || []).forEach((d) => { purchasesMap[d.date] = d.total; });

    const labels = [];
    const salesData = [];
    const purchasesData = [];

    for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(now.getTime() - i * 86400000);
        const dateStr = d.toISOString().slice(0, 10);
        labels.push(d.getDate() + '/' + (d.getMonth() + 1));
        salesData.push(salesMap[dateStr] || 0);
        purchasesData.push(purchasesMap[dateStr] || 0);
    }

    const maxVal = Math.max(...salesData, ...purchasesData, 100);
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';

    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
        const y = padding.top + (plotH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    ctx.fillStyle = textColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i += 1) {
        const y = padding.top + (plotH / 4) * i;
        const val = maxVal - (maxVal / 4) * i;
        ctx.fillText(formatNum(val), padding.left - 8, y + 4);
    }

    const barGroupWidth = plotW / days;
    const barWidth = Math.min(Math.max(barGroupWidth * 0.3, 4), 24);
    const gap = Math.max(barWidth * 0.15, 2);

    for (let i = 0; i < days; i += 1) {
        const x = padding.left + barGroupWidth * i + barGroupWidth / 2;

        const sH = Math.max((salesData[i] / maxVal) * plotH, 0);
        if (sH > 0) {
            const sg = ctx.createLinearGradient(0, padding.top + plotH - sH, 0, padding.top + plotH);
            sg.addColorStop(0, '#34d875');
            sg.addColorStop(1, '#11998e');
            ctx.fillStyle = sg;
            drawRoundRect(ctx, x - barWidth - gap / 2, padding.top + plotH - sH, barWidth, sH, 3);
        }

        const pH = Math.max((purchasesData[i] / maxVal) * plotH, 0);
        if (pH > 0) {
            const pg = ctx.createLinearGradient(0, padding.top + plotH - pH, 0, padding.top + plotH);
            pg.addColorStop(0, '#ff9966');
            pg.addColorStop(1, '#ff5e62');
            ctx.fillStyle = pg;
            drawRoundRect(ctx, x + gap / 2, padding.top + plotH - pH, barWidth, pH, 3);
        }

        const labelStep = days <= 7 ? 1 : Math.ceil(days / 10);
        if (i % labelStep === 0) {
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.font = '10px sans-serif';
            ctx.fillText(labels[i], x, padding.top + plotH + 20);
        }
    }

    ctx.strokeStyle = 'rgba(128,128,128,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH);
    ctx.lineTo(width - padding.right, padding.top + plotH);
    ctx.stroke();
}

function drawRoundRect(ctx, x, y, w, h, r) {
    if (h <= 0 || w <= 0) return;
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
}

function formatSyncTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function updateSyncStatusUI(syncResult) {
    const badge = document.getElementById('syncStatusBadge');
    if (!badge) return;

    if (!syncResult) {
        const timeText = cachedLastSyncAt ? `آخر مزامنة: ${formatSyncTime(cachedLastSyncAt)}` : 'المزامنة التلقائية كل 30 ثانية';
        badge.className = 'sync-status is-synced';
        badge.innerHTML = `
            <i class="fas fa-check-circle sync-icon"></i>
            <div class="sync-status-details">
                <span class="sync-status-main">المزامنة السحابية: متصلة</span>
                <span class="sync-status-time" id="syncStatusTime">${timeText}</span>
            </div>
        `;
        badge.title = cachedLastSyncAt ? `آخر مزامنة: ${formatSyncTime(cachedLastSyncAt)} (تعمل تلقائياً كل 30 ثانية)` : 'متصلة وتعمل تلقائياً كل 30 ثانية';
        return;
    }

    if (syncResult.disabled) {
        badge.className = 'sync-status is-disabled';
        badge.innerHTML = `
            <i class="fas fa-cloud-slash sync-icon"></i>
            <div class="sync-status-details">
                <span class="sync-status-main">المزامنة: غير مفعلة</span>
                <span class="sync-status-time">${syncResult?.reason || 'المزامنة معطلة'}</span>
            </div>
        `;
        badge.title = syncResult?.reason || 'المزامنة معطلة';
        return;
    }

    if (syncResult.success) {
        if (syncResult.lastSyncAt) {
            cachedLastSyncAt = syncResult.lastSyncAt;
            try { localStorage.setItem('golden_last_cloud_sync_at', cachedLastSyncAt); } catch (_) {}
        }
        const timeText = cachedLastSyncAt ? `آخر مزامنة: ${formatSyncTime(cachedLastSyncAt)}` : 'متصلة ومحدثة';
        badge.className = 'sync-status is-synced';
        badge.innerHTML = `
            <i class="fas fa-check-circle sync-icon"></i>
            <div class="sync-status-details">
                <span class="sync-status-main">المزامنة السحابية: متصلة</span>
                <span class="sync-status-time" id="syncStatusTime">${timeText}</span>
            </div>
        `;
        badge.title = cachedLastSyncAt ? `آخر مزامنة: ${formatSyncTime(cachedLastSyncAt)}` : 'متصلة ومحدثة';
    } else {
        badge.className = 'sync-status is-error';
        const errMsg = syncResult.error || syncResult.reason || 'تعذر الاتصال';
        const timeText = cachedLastSyncAt ? `آخر مزامنة: ${formatSyncTime(cachedLastSyncAt)}` : 'تعذر الاتصال بالسحابة';
        badge.innerHTML = `
            <i class="fas fa-exclamation-circle sync-icon"></i>
            <div class="sync-status-details">
                <span class="sync-status-main">المزامنة: تعذر الاتصال</span>
                <span class="sync-status-time">${timeText}</span>
            </div>
        `;
        badge.title = `خطأ: ${errMsg}`;
    }
}

async function loadDashboardStats(filters = currentFilters, triggerSync = false) {
    let icon;
    try {
        if (refreshBtn) {
            refreshBtn.disabled = true;
            icon = refreshBtn.querySelector('i');
            if (icon) icon.classList.add('refresh-spin');
        }

        updatePeriodLabel(filters);
        const syncBadge = document.getElementById('syncStatusBadge');
        if (triggerSync && syncBadge) {
            syncBadge.className = 'sync-status is-syncing';
            syncBadge.innerHTML = `
                <i class="fas fa-sync-alt fa-spin sync-icon"></i>
                <div class="sync-status-details">
                    <span class="sync-status-main">جاري المزامنة...</span>
                    <span class="sync-status-time">جاري تحديث البيانات مع السحابة</span>
                </div>
            `;
        } else if (!triggerSync) {
            updateSyncStatusUI();
            if (window.electronAPI && typeof window.electronAPI.triggerManualSync === 'function') {
                window.electronAPI.triggerManualSync({ statusOnly: true }).then((status) => {
                    if (status && status.lastSyncAt) {
                        cachedLastSyncAt = status.lastSyncAt;
                        try { localStorage.setItem('golden_last_cloud_sync_at', cachedLastSyncAt); } catch (_) {}
                        updateSyncStatusUI(status);
                    }
                }).catch(() => {});
            }
        }

        let stats;
        let syncResult;
        if (triggerSync) {
            [stats, syncResult] = await Promise.all([
                window.electronAPI.getDashboardStats(filters),
                (window.electronAPI && typeof window.electronAPI.triggerManualSync === 'function')
                    ? window.electronAPI.triggerManualSync().catch((err) => ({ success: false, error: err.message }))
                    : Promise.resolve({ success: false, disabled: true })
            ]);
            updateSyncStatusUI(syncResult);
        } else {
            stats = await window.electronAPI.getDashboardStats(filters);
        }
        lastStats = stats;

        const ts = stats.todaySummary || {};
        document.getElementById('todayInvoices').textContent = ts.invoiceCount || 0;
        document.getElementById('todaySales').textContent = money(ts.salesTotal);
        document.getElementById('todayCollections').textContent = money(ts.collections);
        document.getElementById('todayPayments').textContent = money(ts.payments);

        const totalExpensesEl = document.getElementById('totalExpenses');
        if (totalExpensesEl) totalExpensesEl.textContent = money(stats.totalExpenses);
        const totalRevenuesEl = document.getElementById('totalRevenues');
        if (totalRevenuesEl) totalRevenuesEl.textContent = money(stats.totalRevenues);
        const salesMonthEl = document.getElementById('salesMonth');
        if (salesMonthEl) salesMonthEl.textContent = money(stats.salesMonth);
        document.getElementById('purchasesMonth').textContent = money(stats.purchasesMonth);
        document.getElementById('netProfit').textContent = money(stats.netProfit);
        document.getElementById('treasuryBalance').textContent = money(stats.treasuryBalance);
        document.getElementById('stockValue').textContent = money(stats.stockValue);
        const itemsCountEl = document.getElementById('itemsCount');
        if (itemsCountEl) itemsCountEl.textContent = stats.itemsCount || 0;
        document.getElementById('receivables').textContent = money(stats.receivables);
        document.getElementById('payables').textContent = money(stats.payables);

        document.getElementById('customersCount').textContent = stats.customersCount || 0;
        document.getElementById('suppliersCount').textContent = stats.suppliersCount || 0;

        if (stats.trends) {
            const teTrend = document.getElementById('totalExpensesTrend');
            if (teTrend && stats.trends.totalExpenses !== undefined) teTrend.innerHTML = trendHTML(stats.trends.totalExpenses);
            const trTrend = document.getElementById('totalRevenuesTrend');
            if (trTrend && stats.trends.totalRevenues !== undefined) trTrend.innerHTML = trendHTML(stats.trends.totalRevenues);
            const smTrend = document.getElementById('salesMonthTrend');
            const pmTrend = document.getElementById('purchasesMonthTrend');
            if (smTrend) smTrend.innerHTML = trendHTML(stats.trends.salesMonth);
            if (pmTrend) pmTrend.innerHTML = trendHTML(stats.trends.purchasesMonth);
        }

        if (stats.chartData) renderChart(stats.chartData);

        dashboardRender.renderRecentTransactions({ transactions: stats.recentTransactions, t });

        if (stats.alerts) {
            dashboardRender.renderAlerts({ alerts: stats.alerts, t, fmt });
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        const list = document.getElementById('alertsList');
        if (list) list.innerHTML = `<li>${t('dashboard.loadError', 'تعذر تحميل البيانات، حاول مرة أخرى.')}</li>`;
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            if (icon) icon.classList.remove('refresh-spin');
        }
    }
}

window.showNetProfitDetails = function() {
    if (!lastStats || !lastStats.profitDetails) return;
    
    let modal = document.getElementById('profitDetailsModal');
    if (modal) modal.remove();

    const p = lastStats.profitDetails;
    const periodText = getPeriodText();
    const m = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';

    modal = document.createElement('div');
    modal.id = 'profitDetailsModal';
    modal.className = 'confirm-dialog-overlay';
    modal.style.zIndex = '999999';
    
    modal.innerHTML = `
        <div class="confirm-dialog-card" style="width: min(500px, 90%); padding: 0;">
            <div class="confirm-dialog-header" style="background: var(--nav-bg, #0f172a); border-bottom: 2px solid var(--border-color, rgba(255,255,255,0.05)); display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
                <span style="font-size: 1.1rem; color: #38bdf8;"><i class="fas fa-coins" style="margin-inline-end: 8px;"></i> تفاصيل صافي الربح التقديري</span>
                <button onclick="document.getElementById('profitDetailsModal').remove()" style="background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; font-size: 1.2rem;"><i class="fas fa-times"></i></button>
            </div>
            <div class="confirm-dialog-message" style="padding: 20px; font-size: 0.95rem; line-height: 1.8; color: var(--text-color, #fff);">
                <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); border-radius: 8px; padding: 10px 12px; margin-bottom: 15px; font-size: 0.9rem;">
                    <i class="fas fa-calendar-alt" style="margin-inline-end: 6px; color: #38bdf8;"></i> ${t('dashboard.periodLabel', 'الفترة')}: ${periodText}
                </div>
                
                <div style="background: var(--secondary-bg, rgba(15,23,42,0.6)); border: 1px solid var(--border-color, rgba(255,255,255,0.05)); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: var(--text-muted, #cbd5e1)"><i class="fas fa-sack-dollar" style="margin-inline-end: 8px; color: #22c55e;"></i> أولاً: الإيرادات:</span>
                        <strong style="color: #22c55e; font-size: 1.1rem;">${m(p.totalRevenues)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: var(--text-muted, #cbd5e1)"><i class="fas fa-receipt" style="margin-inline-end: 8px; color: #f59e0b;"></i> ثانياً: إجمالي المصروفات:</span>
                        <strong style="color: #f59e0b; font-size: 1.1rem;">${m(p.totalExpenses)}</strong>
                    </div>

                </div>













                <div style="background: ${p.netProfit >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'}; border: 1px solid ${p.netProfit >= 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}; border-radius: 8px; padding: 15px;">
                    <h4 style="margin: 0 0 5px 0; color: ${p.netProfit >= 0 ? '#10b981' : '#ef4444'}; font-size: 1.1rem; text-align: center;">الخلاصة (الإيرادات - المصروفات)</h4>
                    <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 10px;">
                        <strong style="color: ${p.netProfit >= 0 ? '#10b981' : '#ef4444'}; font-size: 1.4rem;">${m(p.netProfit)}</strong>
                    </div>
                    <div style="text-align: center; margin-top: 12px; font-size: 0.8rem; color: var(--text-muted, #94a3b8); line-height: 1.6;">
                        <i class="fas fa-info-circle"></i> ${p.netProfit >= 0 ? 'صافي أرباح تشغيلية (فائض الإيرادات عن إجمالي المصروفات)' : 'صافي خسائر تشغيلية (زيادة المصروفات عن الإيرادات)'}
                    </div>
                </div>
            </div>
            
            <div class="confirm-dialog-actions" style="border-top: 1px solid var(--border-color, rgba(255,255,255,0.05)); padding: 15px 20px; text-align: center; display: block;">
                <button onclick="document.getElementById('profitDetailsModal').remove()" class="confirm-dialog-btn confirm" style="width: 100%; max-width: 200px;">فهمت، إغلاق</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
    modal.addEventListener('click', (e) => {
        if(e.target === modal) modal.remove();
    });
};

window.showExpensesDetails = function() {
    if (!lastStats || !lastStats.expensesBreakdown) return;

    let modal = document.getElementById('expensesDetailsModal');
    if (modal) modal.remove();

    const b = lastStats.expensesBreakdown;
    const periodText = getPeriodText();
    const m = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';

    modal = document.createElement('div');
    modal.id = 'expensesDetailsModal';
    modal.className = 'confirm-dialog-overlay';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
        <div class="confirm-dialog-card" style="width: min(520px, 92%); padding: 0;">
            <div class="confirm-dialog-header" style="background: var(--nav-bg, #0f172a); border-bottom: 2px solid var(--border-color, rgba(255,255,255,0.05)); display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
                <span style="font-size: 1.1rem; color: #38bdf8;"><i class="fas fa-receipt" style="margin-inline-end: 8px;"></i> تفاصيل إجمالي المصروفات</span>
                <button onclick="document.getElementById('expensesDetailsModal').remove()" style="background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; font-size: 1.2rem;"><i class="fas fa-times"></i></button>
            </div>
            <div class="confirm-dialog-message" style="padding: 20px; font-size: 0.95rem; line-height: 1.8; color: var(--text-color, #fff);">
                <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); border-radius: 8px; padding: 10px 12px; margin-bottom: 15px; font-size: 0.9rem;">
                    <i class="fas fa-calendar-alt" style="margin-inline-end: 6px; color: #38bdf8;"></i> ${t('dashboard.periodLabel', 'الفترة')}: ${periodText}
                </div>

                <div style="background: var(--secondary-bg, rgba(15,23,42,0.6)); border: 1px solid var(--border-color, rgba(255,255,255,0.05)); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: var(--text-muted, #cbd5e1)"><i class="fas fa-coins" style="margin-inline-end: 8px; color: #f59e0b;"></i> إجمالي النثريات:</span>
                        <strong style="color: var(--text-color, #fff)">${m(b.pettyGeneral)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: var(--text-muted, #cbd5e1)"><i class="fas fa-search" style="margin-inline-end: 8px; color: #38bdf8;"></i> إجمالي الفحص:</span>
                        <strong style="color: var(--text-color, #fff)">${m(b.pettyInspection)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: var(--text-muted, #cbd5e1)"><i class="fas fa-box" style="margin-inline-end: 8px; color: #a855f7;"></i> إجمالي الشكاير:</span>
                        <strong style="color: var(--text-color, #fff)">${m(b.pettyBags)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: var(--text-muted, #cbd5e1)"><i class="fas fa-truck-moving" style="margin-inline-end: 8px; color: #06b6d4;"></i> إجمالي الشحن والتخليص:</span>
                        <strong style="color: var(--text-color, #fff)">${m(b.pettyShippingClearance)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: var(--text-muted, #cbd5e1)"><i class="fas fa-cogs" style="margin-inline-end: 8px; color: #ec4899;"></i> إجمالي التشغيل:</span>
                        <strong style="color: var(--text-color, #fff)">${m(b.pettyOperation)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                        <span style="color: var(--text-muted, #cbd5e1)"><i class="fas fa-shopping-basket" style="margin-inline-end: 8px; color: #10b981;"></i> إجمالي المشتريات (التقارير العامة):</span>
                        <strong style="color: var(--text-color, #fff)">${m(b.purchasesTotal)}</strong>
                    </div>
                    ${b.purchaseOpeningBalance > 0 ? `
                    <div style="font-size: 0.8rem; color: var(--text-muted, #94a3b8); margin-top: 4px; padding-right: 24px;">
                        (فواتير المشتريات: ${m(b.purchasesInvoices)} + بداية المدة: ${m(b.purchaseOpeningBalance)})
                    </div>
                    ` : ''}
                </div>

                <div style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 8px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; color: #38bdf8; font-size: 1.05rem;">المجموع الكلي (إجمالي المصروفات):</h4>
                        <strong style="color: #38bdf8; font-size: 1.3rem;">${m(b.totalExpenses)}</strong>
                    </div>
                </div>
            </div>

            <div class="confirm-dialog-actions" style="border-top: 1px solid var(--border-color, rgba(255,255,255,0.05)); padding: 15px 20px; text-align: center; display: block;">
                <button onclick="document.getElementById('expensesDetailsModal').remove()" class="confirm-dialog-btn confirm" style="width: 100%; max-width: 200px;">فهمت، إغلاق</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
    modal.addEventListener('click', (e) => {
        if(e.target === modal) modal.remove();
    });
};

window.showRevenuesDetails = function() {
    if (!lastStats || !lastStats.revenuesBreakdown) return;

    let modal = document.getElementById('revenuesDetailsModal');
    if (modal) modal.remove();

    const b = lastStats.revenuesBreakdown;
    const periodText = getPeriodText();
    const m = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';

    modal = document.createElement('div');
    modal.id = 'revenuesDetailsModal';
    modal.className = 'confirm-dialog-overlay';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
        <div class="confirm-dialog-card" style="width: min(520px, 92%); padding: 0;">
            <div class="confirm-dialog-header" style="background: var(--nav-bg, #0f172a); border-bottom: 2px solid var(--border-color, rgba(255,255,255,0.05)); display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
                <span style="font-size: 1.1rem; color: #38bdf8;"><i class="fas fa-sack-dollar" style="margin-inline-end: 8px;"></i> تفاصيل الإيرادات</span>
                <button onclick="document.getElementById('revenuesDetailsModal').remove()" style="background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; font-size: 1.2rem;"><i class="fas fa-times"></i></button>
            </div>
            <div class="confirm-dialog-message" style="padding: 20px; font-size: 0.95rem; line-height: 1.8; color: var(--text-color, #fff);">
                <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); border-radius: 8px; padding: 10px 12px; margin-bottom: 15px; font-size: 0.9rem;">
                    <i class="fas fa-calendar-alt" style="margin-inline-end: 6px; color: #38bdf8;"></i> ${t('dashboard.periodLabel', 'الفترة')}: ${periodText}
                </div>

                <div style="background: var(--secondary-bg, rgba(15,23,42,0.6)); border: 1px solid var(--border-color, rgba(255,255,255,0.05)); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: var(--text-muted, #cbd5e1)"><i class="fas fa-globe" style="margin-inline-end: 8px; color: #22c55e;"></i> إيرادات التصدير (الإجمالي المصري):</span>
                        <strong style="color: var(--text-color, #fff)">${m(b.exportRevenuesEgp)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                        <span style="color: var(--text-muted, #cbd5e1)"><i class="fas fa-cash-register" style="margin-inline-end: 8px; color: #38bdf8;"></i> المبيعات المحلية (إجمالي الإجمالي):</span>
                        <strong style="color: var(--text-color, #fff)">${m(b.localSalesTotal)}</strong>
                    </div>
                </div>

                <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 8px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; color: #22c55e; font-size: 1.05rem;">المجموع الكلي (الإيرادات):</h4>
                        <strong style="color: #22c55e; font-size: 1.3rem;">${m(b.totalRevenues)}</strong>
                    </div>
                </div>
            </div>

            <div class="confirm-dialog-actions" style="border-top: 1px solid var(--border-color, rgba(255,255,255,0.05)); padding: 15px 20px; text-align: center; display: block;">
                <button onclick="document.getElementById('revenuesDetailsModal').remove()" class="confirm-dialog-btn confirm" style="width: 100%; max-width: 200px;">فهمت، إغلاق</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
    modal.addEventListener('click', (e) => {
        if(e.target === modal) modal.remove();
    });
};

window.showOnboardingWizardModal = function() {
    let existing = document.getElementById('onboardingWizardModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'onboardingWizardModal';
    modal.className = 'confirm-dialog-overlay';
    modal.style.zIndex = '9999999';

    modal.innerHTML = `
        <div class="confirm-dialog-card" style="width: min(540px, 94%); padding: 0; display: flex; flex-direction: column; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); border: 1px solid rgba(56, 189, 248, 0.25);">
            <div class="confirm-dialog-header" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 22px 24px; display: flex; align-items: center; gap: 14px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(56, 189, 248, 0.15); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(56, 189, 248, 0.3);">
                    <i class="fas fa-building" style="color: #38bdf8; font-size: 1.4rem;"></i>
                </div>
                <div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #f8fafc;">مرحباً بك في نظام المحاسبة المتكامل</div>
                    <div style="font-size: 0.84rem; color: #94a3b8; margin-top: 2px;">يرجى تسجيل بيانات منشأتك لبدء الاستخدام وتفعيل المزامنة</div>
                </div>
            </div>
            
            <form id="onboardingWizardForm" style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="display: block; font-size: 0.88rem; font-weight: 600; color: #e2e8f0; margin-bottom: 6px;">اسم المؤسسة / الشركة / المحل <span style="color: #f87171;">*</span></label>
                    <input type="text" id="onboardingCompName" required placeholder="مثال: مؤسسة الأمل للتجارة" style="width: 100%; box-sizing: border-box; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 14px; color: #f8fafc; font-size: 0.95rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#38bdf8'" onblur="this.style.borderColor='rgba(255,255,255,0.15)'" />
                </div>

                <div>
                    <label style="display: block; font-size: 0.88rem; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">النشاط التجاري</label>
                    <input type="text" id="onboardingCompActivity" placeholder="مثال: تجارة عامة، تجارة ذهب، مواد غذائية..." style="width: 100%; box-sizing: border-box; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 14px; color: #f8fafc; font-size: 0.95rem; outline: none;" />
                </div>

                <div>
                    <label style="display: block; font-size: 0.88rem; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">رقم هاتف التواصل</label>
                    <input type="tel" id="onboardingCompPhone" placeholder="01xxxxxxxxx" style="width: 100%; box-sizing: border-box; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 14px; color: #f8fafc; font-size: 0.95rem; outline: none;" />
                </div>

                <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
                    <button type="submit" id="onboardingSubmitBtn" class="confirm-dialog-btn confirm" style="width: 100%; background: #0284c7; color: #fff; padding: 12px; font-size: 1rem; font-weight: 600; border-radius: 8px; cursor: pointer; border: none; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s;">
                        <i class="fas fa-check"></i> حفظ وبدء استخدام النظام
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => {
        modal.classList.add('show');
        const nameInp = document.getElementById('onboardingCompName');
        if (nameInp) nameInp.focus();
    });

    const form = modal.querySelector('#onboardingWizardForm');
    const submitBtn = modal.querySelector('#onboardingSubmitBtn');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const compName = (document.getElementById('onboardingCompName')?.value || '').trim();
            const compActivity = (document.getElementById('onboardingCompActivity')?.value || '').trim();
            const compPhone = (document.getElementById('onboardingCompPhone')?.value || '').trim();

            if (!compName) return;

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> جاري حفظ البيانات...';
            }

            try {
                if (window.electronAPI && typeof window.electronAPI.completeInitialOnboarding === 'function') {
                    await window.electronAPI.completeInitialOnboarding({
                        companyName: compName,
                        companyActivity: compActivity,
                        companyPhone: compPhone
                    });
                }
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            } catch (_) {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-check"></i> حفظ وبدء استخدام النظام';
                }
            }
        });
    }
};

window.showSyncLogModal = async function() {
    let modal = document.getElementById('syncLogModal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'syncLogModal';
    modal.className = 'confirm-dialog-overlay';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
        <div class="confirm-dialog-card" style="width: min(880px, 94%); max-height: 88vh; padding: 0; display: flex; flex-direction: column;">
            <div class="confirm-dialog-header" style="background: var(--secondary-bg, #f8fafc); border-bottom: 1px solid var(--border-color, #e2e8f0); display: flex; justify-content: space-between; align-items: center; padding: 16px 22px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-cloud-arrow-up" style="color: #0284c7; font-size: 1.3rem;"></i>
                    <div>
                        <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-color, #0f172a);">سجل وتشخيص المزامنة السحابية</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted, #64748b);">متابعة حالة الربط اللحظي بين البرنامج وتطبيق الموبايل</div>
                    </div>
                </div>
                <button id="syncModalCloseTopBtn" style="background: none; border: none; color: var(--text-muted, #64748b); cursor: pointer; font-size: 1.25rem; padding: 4px 8px; border-radius: 6px;"><i class="fas fa-times"></i></button>
            </div>
            
            <div id="syncLogModalContent" style="padding: 20px; overflow-y: auto; flex: 1;">
                <div style="text-align: center; padding: 50px 20px; color: var(--text-muted, #64748b);">
                    <i class="fas fa-circle-notch fa-spin" style="font-size: 2.2rem; color: #0284c7; margin-bottom: 14px;"></i>
                    <div style="font-size: 0.95rem;">جاري قراءة سجلات المزامنة وفحص حالة الخادم السحابي...</div>
                </div>
            </div>

            <div class="confirm-dialog-actions" style="border-top: 1px solid var(--border-color, #e2e8f0); padding: 12px 22px; display: flex; justify-content: space-between; align-items: center; background: var(--secondary-bg, #f8fafc);">
                <div style="font-size: 0.8rem; color: var(--text-muted, #64748b);" id="syncModalFooterInfo">
                    تعمل المزامنة التلقائية كل 30 ثانية
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="syncModalReportBtn" class="confirm-dialog-btn" style="background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.25); padding: 8px 14px; font-size: 0.88rem; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-paper-plane"></i> إرسال تقرير فني للدعم
                    </button>
                    <button id="syncModalTriggerBtn" class="confirm-dialog-btn confirm" style="background: #0284c7; color: #fff; padding: 8px 18px; font-size: 0.88rem; border-radius: 6px; cursor: pointer; border: none; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-rotate"></i> مزامنة فورية الآن
                    </button>
                    <button id="syncModalCloseBottomBtn" class="confirm-dialog-btn" style="background: var(--card-bg, #ffffff); color: var(--text-color, #334155); padding: 8px 16px; font-size: 0.88rem; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color, #cbd5e1);">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));

    let syncLiveTimer = setInterval(() => {
        const m = document.getElementById('syncLogModal');
        if (!m) {
            clearInterval(syncLiveTimer);
            return;
        }
        loadData(false);
    }, 4000);

    const closeModal = () => {
        if (syncLiveTimer) clearInterval(syncLiveTimer);
        window.refreshSyncLogModalData = null;
        modal.remove();
    };

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const closeTopBtn = modal.querySelector('#syncModalCloseTopBtn');
    if (closeTopBtn) closeTopBtn.addEventListener('click', closeModal);

    const closeBottomBtn = modal.querySelector('#syncModalCloseBottomBtn');
    if (closeBottomBtn) closeBottomBtn.addEventListener('click', closeModal);

    let latestSyncResponse = null;

    const reportBtn = modal.querySelector('#syncModalReportBtn');
    if (reportBtn) {
        reportBtn.addEventListener('click', async () => {
            const diag = latestSyncResponse ? latestSyncResponse.diagnostics : null;
            const hasError = latestSyncResponse && (
                latestSyncResponse.success === false ||
                !!latestSyncResponse.error ||
                (diag && diag.counts && (diag.counts.failed > 0 || diag.counts.pending > 0)) ||
                (diag && Array.isArray(diag.recentBatches) && diag.recentBatches.some(b => b.status === 'failed' || !!b.last_error))
            );

            if (!hasError) {
                reportBtn.innerHTML = '<i class="fas fa-check-circle"></i> لا توجد أخطاء بالمزامنة لإرسالها';
                reportBtn.style.color = '#0284c7';
                reportBtn.style.borderColor = 'rgba(2, 132, 199, 0.3)';
                reportBtn.style.background = 'rgba(2, 132, 199, 0.1)';
                setTimeout(() => {
                    if (reportBtn) {
                        reportBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال تقرير فني للدعم';
                        reportBtn.style.color = '#dc2626';
                        reportBtn.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                        reportBtn.style.background = 'rgba(239, 68, 68, 0.1)';
                    }
                }, 3000);
                return;
            }

            reportBtn.disabled = true;
            reportBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> جاري إرسال تقرير العطل...';
            try {
                if (window.electronAPI && typeof window.electronAPI.sendSyncDiagnosticReport === 'function') {
                    const sendRes = await window.electronAPI.sendSyncDiagnosticReport();
                    if (sendRes && sendRes.noError) {
                        reportBtn.innerHTML = '<i class="fas fa-check-circle"></i> لا توجد أخطاء للإرسال';
                        reportBtn.style.color = '#0284c7';
                        reportBtn.style.borderColor = 'rgba(2, 132, 199, 0.3)';
                        reportBtn.style.background = 'rgba(2, 132, 199, 0.1)';
                    } else {
                        reportBtn.innerHTML = '<i class="fas fa-check"></i> تم إرسال تقرير العطل بنجاح';
                        reportBtn.style.color = '#16a34a';
                        reportBtn.style.borderColor = 'rgba(22, 163, 74, 0.3)';
                        reportBtn.style.background = 'rgba(22, 163, 74, 0.1)';
                    }
                }
            } catch (_) {
                reportBtn.innerHTML = '<i class="fas fa-times"></i> تعذر الإرسال';
            } finally {
                setTimeout(() => {
                    if (reportBtn) {
                        reportBtn.disabled = false;
                        reportBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال تقرير فني للدعم';
                        reportBtn.style.color = '#dc2626';
                        reportBtn.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                        reportBtn.style.background = 'rgba(239, 68, 68, 0.1)';
                    }
                }, 4000);
            }
        });
    }

    const loadData = async (isManualTrigger = false) => {
        const contentEl = document.getElementById('syncLogModalContent');
        const triggerBtn = document.getElementById('syncModalTriggerBtn');
        if (!contentEl) return;

        if (isManualTrigger && triggerBtn) {
            triggerBtn.disabled = true;
            triggerBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> جاري المزامنة...';
        }

        try {
            let res = null;
            if (window.electronAPI && typeof window.electronAPI.triggerManualSync === 'function') {
                if (isManualTrigger) {
                    res = await window.electronAPI.triggerManualSync();
                } else {
                    res = await window.electronAPI.triggerManualSync({ getDiagnostics: true });
                }
            }

            latestSyncResponse = res;
            renderSyncDiagnostics(res);
        } catch (err) {
            if (contentEl) {
                contentEl.innerHTML = `
                    <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 18px; color: #dc2626; text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 1.6rem; margin-bottom: 8px;"></i>
                        <div>تعذر قراءة بيانات المزامنة: ${err.message || 'خطأ غير متوقع'}</div>
                    </div>
                `;
            }
        } finally {
            if (triggerBtn) {
                triggerBtn.disabled = false;
                triggerBtn.innerHTML = '<i class="fas fa-rotate"></i> مزامنة فورية الآن';
            }
        }
    };

    window.refreshSyncLogModalData = () => loadData(false);

    const triggerBtn = modal.querySelector('#syncModalTriggerBtn');
    if (triggerBtn) {
        triggerBtn.addEventListener('click', () => loadData(true));
    }

    await loadData(false);
};

function formatSyncSampleInfo(raw) {
    if (!raw || typeof raw !== 'string') return '<span style="color: var(--text-muted, #64748b);">تحديثات محاسبية تفاضلية</span>';

    const DOC_MAP = {
        'purchase_invoice': { label: 'فاتورة مشتريات', color: '#ea580c' },
        'sales_invoice': { label: 'فاتورة مبيعات', color: '#16a34a' },
        'voucher_payment': { label: 'سند صرف', color: '#e11d48' },
        'voucher_receipt': { label: 'سند قبض', color: '#0284c7' },
        'opening_balance': { label: 'رصيد افتتاحي', color: '#9333ea' },
        'local_sale': { label: 'مبيعات نقدية', color: '#65a30d' }
    };

    let text = raw.trim();

    for (const [key, meta] of Object.entries(DOC_MAP)) {
        if (text.includes(key)) {
            const parts = text.split(/[،,]\s*/);
            const otherParts = parts.filter(p => p !== key && !DOC_MAP[p] && p.trim() !== '');
            if (otherParts.length > 0) {
                return `<span style="color: ${meta.color}; font-weight: 700;">${meta.label}:</span> <span style="color: var(--text-color, #1e293b); font-weight: 500;">${otherParts.join('، ')}</span>`;
            }
            return `<span style="color: ${meta.color}; font-weight: 700;">${meta.label}</span>`;
        }
    }

    for (const [, meta] of Object.entries(DOC_MAP)) {
        if (text.startsWith(meta.label + ':') || text.startsWith(meta.label + ' -')) {
            const remainder = text.slice(meta.label.length + 1).trim();
            return `<span style="color: ${meta.color}; font-weight: 700;">${meta.label}:</span> <span style="color: var(--text-color, #1e293b); font-weight: 500;">${remainder.replace(/^[:\-\s]+/, '')}</span>`;
        }
        if (text.includes(meta.label)) {
            const parts = text.split(/[،,]\s*/);
            const otherParts = parts.filter(p => p !== meta.label && p.trim() !== '');
            if (otherParts.length > 0) {
                return `<span style="color: ${meta.color}; font-weight: 700;">${meta.label}:</span> <span style="color: var(--text-color, #1e293b); font-weight: 500;">${otherParts.join('، ')}</span>`;
            }
            return `<span style="color: ${meta.color}; font-weight: 700;">${meta.label}</span>`;
        }
    }

    return `<span style="color: var(--text-color, #1e293b);">${text}</span>`;
}

function renderSyncDiagnostics(res) {
    const contentEl = document.getElementById('syncLogModalContent');
    const footerInfoEl = document.getElementById('syncModalFooterInfo');
    if (!contentEl) return;

    const diag = res?.diagnostics || {};
    const counts = diag.counts || { synced: 0, pending: 0, failed: 0, total: 0 };
    const shadowCounts = diag.shadowCounts || { parties: 0, ledger: 0 };
    const batches = diag.recentBatches || [];
    const lastSyncStr = res?.lastSyncAt ? formatSyncTime(res.lastSyncAt) : 'لا يوجد بعد';
    const isHealthy = res?.success && counts.pending === 0 && counts.failed === 0;

    let bannerHTML = '';
    if (res?.disabled) {
        bannerHTML = `
            <div style="background: rgba(100, 116, 139, 0.08); border: 1px solid var(--border-color, #cbd5e1); border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; display: flex; align-items: center; gap: 14px;">
                <i class="fas fa-cloud-slash" style="color: var(--text-muted, #64748b); font-size: 1.5rem;"></i>
                <div>
                    <div style="font-weight: 700; color: var(--text-color, #1e293b); font-size: 0.95rem;">المزامنة السحابية غير مفعلة حالياً</div>
                    <div style="font-size: 0.82rem; color: var(--text-muted, #64748b);">${res.reason || 'المزامنة معطلة من إعدادات النظام'}</div>
                </div>
            </div>
        `;
    } else if (counts.pending > 0 && counts.failed === 0 && !res?.error) {
        bannerHTML = `
            <div style="background: rgba(2, 132, 199, 0.08); border: 1px solid rgba(2, 132, 199, 0.25); border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; display: flex; align-items: center; gap: 14px;">
                <i class="fas fa-cloud-arrow-up" style="color: #0284c7; font-size: 1.5rem;"></i>
                <div>
                    <div style="font-weight: 700; color: #0284c7; font-size: 0.95rem;">جاري رفع حركات جديدة للسحابة...</div>
                    <div style="font-size: 0.82rem; color: var(--text-color, #0369a1);">يتم الآن إرسال الدفعات وتحديث كشف الحساب وتطبيق الموبايل لحظياً.</div>
                </div>
            </div>
        `;
    } else if (!isHealthy) {
        const errorDetail = res?.error || (batches[0] && batches[0].last_error) || 'توجد حزم بانتظار اكتمال الاتصال بالإنترنت والسحابة';
        let humanReason = 'جاري محاولة الاتصال بخادم المزامنة وإرسال الحزم المعلقة.';
        if (typeof errorDetail === 'string') {
            if (errorDetail.includes('unauthorized') || errorDetail.includes('revoked')) {
                humanReason = 'هوية الجهاز غير مصرح لها على الخادم السحابي. يرجى مراجعة ترخيص الجهاز.';
            } else if (errorDetail.includes('clock') || errorDetail.includes('drift')) {
                humanReason = 'توقيت ساعة الكمبيوتر غير متطابق مع توقيت السيرفر العالمي (أكثر من 5 دقائق). اضبط ساعة الويندوز.';
            } else if (errorDetail.includes('Sequence conflict')) {
                humanReason = 'تم رصد اختلاف في تسلسل الدفعات ويقوم النظام بالاسترداد الذاتي التلقائي.';
            } else if (errorDetail.includes('fetch') || errorDetail.includes('network') || errorDetail.includes('ENOTFOUND') || errorDetail.includes('ETIMEDOUT') || errorDetail.includes('ECONNREFUSED') || errorDetail.includes('ECONNRESET') || errorDetail.includes('timeout') || errorDetail.includes('AbortError')) {
                humanReason = 'انقطاع في الاتصال بالإنترنت أو تعذر الوصول لخادم المزامنة السحابي حالياً.';
            } else if (errorDetail.includes('500') || errorDetail.includes('502') || errorDetail.includes('503') || errorDetail.includes('504')) {
                humanReason = 'خادم المزامنة السحابي يمر بصيانة مؤقتة وسيعاود النظام المحاولة تلقائياً.';
            }
        }

        bannerHTML = `
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 10px; padding: 14px 18px; margin-bottom: 18px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                    <i class="fas fa-circle-exclamation" style="color: #dc2626; font-size: 1.4rem;"></i>
                    <div style="font-weight: 700; color: #dc2626; font-size: 0.95rem;">تنبيه: تعثر في الاتصال بالسحابة أو توجد حزم معلقة</div>
                </div>
                <div style="font-size: 0.85rem; color: #b91c1c; line-height: 1.6; margin-inline-start: 32px;">
                    <div>${humanReason}</div>
                    <div style="font-size: 0.78rem; color: #dc2626; margin-top: 4px; opacity: 0.9;"><strong>التفاصيل الفنية:</strong> ${errorDetail}</div>
                </div>
            </div>
        `;
    } else {
        bannerHTML = `
            <div style="background: rgba(22, 163, 74, 0.08); border: 1px solid rgba(22, 163, 74, 0.25); border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; display: flex; align-items: center; gap: 14px;">
                <i class="fas fa-circle-check" style="color: #16a34a; font-size: 1.5rem;"></i>
                <div>
                    <div style="font-weight: 700; color: #15803d; font-size: 0.95rem;">المزامنة السحابية متصلة ومستقرة تماماً</div>
                    <div style="font-size: 0.82rem; color: #16a34a;">كافة حركات كشف الحساب وأرصدة العملاء والموردين مطابقة بنسبة 100% مع تطبيق الموبايل.</div>
                </div>
            </div>
        `;
    }

    const cardsHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px;">
            <div style="background: var(--secondary-bg, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 0.78rem; color: var(--text-muted, #64748b); margin-bottom: 4px;"><i class="fas fa-clock" style="color: #0284c7;"></i> آخر مزامنة</div>
                <div style="font-size: 0.92rem; font-weight: 700; color: var(--text-color, #0f172a);">${lastSyncStr}</div>
            </div>
            <div style="background: var(--secondary-bg, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 0.78rem; color: var(--text-muted, #64748b); margin-bottom: 4px;"><i class="fas fa-check-double" style="color: #16a34a;"></i> دفعات ناجحة</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #16a34a;">${counts.synced}</div>
            </div>
            <div style="background: var(--secondary-bg, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 0.78rem; color: var(--text-muted, #64748b); margin-bottom: 4px;"><i class="fas fa-hourglass-half" style="color: #d97706;"></i> دفعات معلقة</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: ${counts.pending > 0 ? '#d97706' : 'var(--text-muted, #64748b)'};">${counts.pending}</div>
            </div>
            <div style="background: var(--secondary-bg, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 0.78rem; color: var(--text-muted, #64748b); margin-bottom: 4px;"><i class="fas fa-users" style="color: #9333ea;"></i> أطراف متزامنة</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #9333ea;">${shadowCounts.parties}</div>
            </div>
            <div style="background: var(--secondary-bg, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 0.78rem; color: var(--text-muted, #64748b); margin-bottom: 4px;"><i class="fas fa-file-invoice-dollar" style="color: #0284c7;"></i> حركات أستاذ</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #0284c7;">${shadowCounts.ledger}</div>
            </div>
        </div>
    `;

    let tableRows = '';
    if (batches.length === 0) {
        tableRows = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted, #64748b);">لا توجد عمليات مسجلة في السجل حالياً</td></tr>`;
    } else {
        tableRows = batches.map(b => {
            let statusBadge = '';
            if (b.status === 'synced') {
                statusBadge = `<span style="background: rgba(22,163,74,0.12); color: #16a34a; border: 1px solid rgba(22,163,74,0.25); padding: 2px 8px; border-radius: 4px; font-size: 0.78rem;"><i class="fas fa-check"></i> ناجحة</span>`;
            } else if (b.status === 'idle') {
                statusBadge = `<span style="background: rgba(100, 116, 139, 0.1); color: var(--text-muted, #64748b); border: 1px solid rgba(100, 116, 139, 0.2); padding: 2px 8px; border-radius: 4px; font-size: 0.78rem;"><i class="fas fa-minus"></i> لا توجد تغييرات</span>`;
            } else if (b.status === 'pending') {
                statusBadge = `<span style="background: rgba(217,119,6,0.12); color: #d97706; border: 1px solid rgba(217,119,6,0.25); padding: 2px 8px; border-radius: 4px; font-size: 0.78rem;"><i class="fas fa-clock"></i> قيد الإرسال</span>`;
            } else {
                statusBadge = `<span style="background: rgba(220,38,38,0.12); color: #dc2626; border: 1px solid rgba(220,38,38,0.25); padding: 2px 8px; border-radius: 4px; font-size: 0.78rem;"><i class="fas fa-times"></i> متعثرة</span>`;
            }

            const timeStr = b.created_at ? new Date(b.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '—';
            let detailText = b.last_error
                ? `<span style="color: #dc2626;" title="${b.last_error}"><i class="fas fa-triangle-exclamation" style="margin-inline-end: 4px;"></i>${b.sample_info ? formatSyncSampleInfo(b.sample_info) + ' — ' : ''}${b.last_error.length > 45 ? b.last_error.slice(0, 45) + '...' : b.last_error}</span>`
                : formatSyncSampleInfo(b.sample_info);

            let seqBadge = '';
            if (b.sync_type === 'manual_check') {
                seqBadge = `<span style="background: rgba(2, 132, 199, 0.12); color: #0284c7; border: 1px solid rgba(2, 132, 199, 0.25); padding: 2px 8px; border-radius: 4px; font-size: 0.76rem;"><i class="fas fa-hand-pointer"></i> فحص فوري</span>`;
            } else if (b.sync_type === 'auto_idle' || b.sync_type === 'auto_check') {
                seqBadge = `<span style="background: rgba(100, 116, 139, 0.1); color: var(--text-color, #1e293b); border: 1px solid rgba(100, 116, 139, 0.2); padding: 2px 8px; border-radius: 4px; font-size: 0.76rem;"><i class="fas fa-clock-rotate-left"></i> فحص دوري</span>`;
            } else {
                seqBadge = `<span style="font-weight: 700; color: #0284c7;">#${b.seq_no || '—'}</span>`;
            }

            const sizeText = (b.sync_type === 'auto_idle' || b.status === 'idle')
                ? `<span style="color: var(--text-muted, #64748b); font-size: 0.78rem;">لا توجد بيانات</span>`
                : (b.sync_type === 'manual_check'
                    ? `<span style="color: var(--text-muted, #64748b); font-size: 0.78rem;">مطابقة تامة</span>`
                    : `<span style="color: var(--text-color, #1e293b); font-weight: 600;">${b.events_count} حدث</span>`);

            return `
                <tr style="border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.06)); font-size: 0.85rem;">
                    <td style="padding: 10px 12px;">${seqBadge}</td>
                    <td style="padding: 10px 12px;">${statusBadge}</td>
                    <td style="padding: 10px 12px;">${sizeText}</td>
                    <td style="padding: 10px 12px; color: var(--text-muted, #64748b);">${timeStr}</td>
                    <td style="padding: 10px 12px;">${detailText}</td>
                </tr>
            `;
        }).join('');
    }

    const tableHTML = `
        <div style="background: var(--card-bg, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; overflow: hidden;">
            <div style="padding: 12px 16px; background: var(--table-header-bg, #f8fafc); border-bottom: 1px solid var(--border-color, #e2e8f0); font-weight: 700; color: var(--text-color, #1e293b); font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fas fa-list-check" style="color: #0284c7; margin-inline-end: 6px;"></i> سجل آخر عمليات ودفعات المزامنة اللحظية</span>
                <span style="font-size: 0.78rem; color: var(--text-muted, #64748b);">يعرض آخر ${batches.length} عملية</span>
            </div>
            <div id="syncHistoryTableWrapper" style="max-height: 280px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: start;">
                    <thead>
                        <tr style="background: var(--secondary-bg, #f1f5f9); color: var(--text-muted, #64748b); font-size: 0.8rem; border-bottom: 1px solid var(--border-color, #e2e8f0);">
                            <th style="padding: 8px 12px;">رقم العملية</th>
                            <th style="padding: 8px 12px;">الحالة</th>
                            <th style="padding: 8px 12px;">الحجم</th>
                            <th style="padding: 8px 12px;">التوقيت</th>
                            <th style="padding: 8px 12px;">البيان والملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const prevScroll = contentEl.scrollTop;
    const oldTableWrapper = document.getElementById('syncHistoryTableWrapper');
    const prevTableScroll = oldTableWrapper ? oldTableWrapper.scrollTop : 0;

    contentEl.innerHTML = bannerHTML + cardsHTML + tableHTML;

    contentEl.scrollTop = prevScroll;
    const newTableWrapper = document.getElementById('syncHistoryTableWrapper');
    if (newTableWrapper && prevTableScroll > 0) {
        newTableWrapper.scrollTop = prevTableScroll;
    }

    if (footerInfoEl && diag.deviceId) {
        footerInfoEl.innerHTML = `
            <span>جهاز: <code>${diag.deviceId.slice(0, 8)}...</code> | إصدار: ${diag.desktopVersion || '10.1.0'} | التسلسل: #${diag.meta?.last_seq_no || '0'}</span>
        `;
    }
}

(function() {
    if (!document.getElementById('profitDetailsModalStyle')) {
        const s = document.createElement('style');
        s.id = 'profitDetailsModalStyle';
        s.innerHTML = `
        .confirm-dialog-overlay {
            position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
            background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px);
            opacity: 0; transition: opacity 0.2s ease;
        }
        .confirm-dialog-overlay.show { opacity: 1; }
        .confirm-dialog-card {
            background: var(--card-bg, #ffffff); border: 1px solid var(--border-color, #e2e8f0);
            border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            max-height: 90vh; overflow-y: auto; color: var(--text-color, #1e293b); direction: rtl;
        }
        .interactive-card:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.3); border-color: rgba(56, 189, 248, 0.4) !important; }
        `;
        document.head.appendChild(s);
    }
})();

