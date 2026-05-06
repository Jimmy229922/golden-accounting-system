let refreshBtn;
let lastUpdatedEl;
let startDateInput;
let endDateInput;
let applyFilterBtn;
let clearFilterBtn;
let periodLabelEl;
let lastStats = null;
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
    loadDashboardStats();
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
    return (val || 0).toFixed(2) + ' ' + t('common.currency.egpSymbol', 'ج.م');
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
    loadDashboardStats(currentFilters);
}

function clearDashboardFilters() {
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    currentFilters = { startDate: '', endDate: '' };
    loadDashboardStats(currentFilters);
}

function bindEvents() {
    refreshBtn = document.getElementById('refreshBtn');
    lastUpdatedEl = document.getElementById('lastUpdated');
    startDateInput = document.getElementById('dashboardFromDate');
    endDateInput = document.getElementById('dashboardToDate');
    applyFilterBtn = document.getElementById('dashboardApplyBtn');
    clearFilterBtn = document.getElementById('dashboardClearBtn');
    periodLabelEl = document.getElementById('dashboardPeriod');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadDashboardStats(currentFilters));
    }

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyDashboardFilters);
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearDashboardFilters);
    }

    updatePeriodLabel();

    startRealTimeClock();

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

async function loadDashboardStats(filters = currentFilters) {
    let icon;
    try {
        if (refreshBtn) {
            refreshBtn.disabled = true;
            icon = refreshBtn.querySelector('i');
            if (icon) icon.classList.add('refresh-spin');
        }

        updatePeriodLabel(filters);
        const stats = await window.electronAPI.getDashboardStats(filters);
        lastStats = stats;

        const ts = stats.todaySummary || {};
        document.getElementById('todayInvoices').textContent = ts.invoiceCount || 0;
        document.getElementById('todaySales').textContent = money(ts.salesTotal);
        document.getElementById('todayCollections').textContent = money(ts.collections);
        document.getElementById('todayPayments').textContent = money(ts.payments);

        document.getElementById('salesMonth').textContent = money(stats.salesMonth);
        document.getElementById('purchasesMonth').textContent = money(stats.purchasesMonth);
        document.getElementById('netProfit').textContent = money(stats.netProfit);
        document.getElementById('treasuryBalance').textContent = money(stats.treasuryBalance);
        document.getElementById('stockValue').textContent = money(stats.stockValue);
        document.getElementById('itemsCount').textContent = stats.itemsCount || 0;
        document.getElementById('receivables').textContent = money(stats.receivables);
        document.getElementById('payables').textContent = money(stats.payables);

        document.getElementById('customersCount').textContent = stats.customersCount || 0;
        document.getElementById('suppliersCount').textContent = stats.suppliersCount || 0;

        if (stats.trends) {
            const smTrend = document.getElementById('salesMonthTrend');
            const pmTrend = document.getElementById('purchasesMonthTrend');
            if (smTrend) smTrend.innerHTML = trendHTML(stats.trends.salesMonth);
            if (pmTrend) pmTrend.innerHTML = trendHTML(stats.trends.purchasesMonth);
        }

        if (stats.chartData) renderChart(stats.chartData);

        dashboardRender.renderRecentTransactions({ transactions: stats.recentTransactions, t });
        dashboardRender.renderTopItems({ topItems: stats.topItems, t });

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
                <span style="font-size: 1.1rem; color: #38bdf8;"><i class="fas fa-calculator" style="margin-inline-end: 8px;"></i> تفاصيل مجمل الربح للإيضاح</span>
                <button onclick="document.getElementById('profitDetailsModal').remove()" style="background: none; border: none; color: var(--text-muted, #94a3b8); cursor: pointer; font-size: 1.2rem;"><i class="fas fa-times"></i></button>
            </div>
            <div class="confirm-dialog-message" style="padding: 20px; font-size: 0.95rem; line-height: 1.8; color: var(--text-color, #fff);">
                <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); border-radius: 8px; padding: 10px 12px; margin-bottom: 15px; font-size: 0.9rem;">
                    <i class="fas fa-calendar-alt" style="margin-inline-end: 6px; color: #38bdf8;"></i> ${t('dashboard.periodLabel', 'الفترة')}: ${periodText}
                </div>
                
                <div style="background: var(--secondary-bg, rgba(15,23,42,0.6)); border: 1px solid var(--border-color, rgba(255,255,255,0.05)); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #10b981; font-size: 1rem;"><i class="fas fa-shopping-cart" style="margin-inline-end:5px;"></i> أولاً: المبيعات الفعّالة (الفترة المحددة)</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: var(--text-muted, #cbd5e1)">إجمالي الفواتير:</span>
                        <strong style="color: var(--text-color, #fff)">${m(p.salesTotalMonth)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color:#ef4444">- مردودات (مرتجعات):</span>
                        <strong style="color: #ef4444">${m(p.salesReturnsTotalMonth)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px dashed var(--border-color, rgba(255,255,255,0.1)); padding-top: 10px;">
                        <span style="color:#0ea5e9; font-weight:bold;">= صافي المبيعات:</span>
                        <strong style="color: #0ea5e9; font-size: 1.1rem;">${m(p.salesMonth)}</strong>
                    </div>
                </div>

                <div style="background: var(--secondary-bg, rgba(15,23,42,0.6)); border: 1px solid var(--border-color, rgba(255,255,255,0.05)); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #f59e0b; font-size: 1rem;"><i class="fas fa-boxes" style="margin-inline-end:5px;"></i> ثانياً: تكلفة المبيعات (رأس المال)</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: var(--text-muted, #cbd5e1)">تكلفة البضاعة الخارجة:</span>
                        <strong style="color: var(--text-color, #fff)">${m(p.cogsMonthSales)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color:#10b981">- تكلفة المرتجعات:</span>
                        <strong style="color: #10b981">${m(p.cogsMonthReturns)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px dashed var(--border-color, rgba(255,255,255,0.1)); padding-top: 10px;">
                        <span style="color:#f59e0b; font-weight:bold;">= التكلفة الفعلية (المخصومة):</span>
                        <strong style="color: #f59e0b; font-size: 1.1rem;">${m(p.cogsMonth)}</strong>
                    </div>
                </div>

                <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 15px;">
                    <h4 style="margin: 0 0 5px 0; color: var(--text-color, #fff); font-size: 1.1rem; text-align: center;">الخلاصة (صافي المبيعات - التكلفة)</h4>
                    <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 10px;">
                        <strong style="color: #10b981; font-size: 1.4rem;">${m(p.netProfit)}</strong>
                    </div>
                    <div style="text-align: center; margin-top: 12px; font-size: 0.8rem; color: var(--text-muted, #94a3b8); line-height: 1.6;">
                        <i class="fas fa-info-circle"></i> يمثل هذا الرقم "مجمل الربح التجاري" من البضاعة، ولا يخصم منه المصروفات الإدارية المسجلة بالخزينة لضمان دقة قياس أداء حركة الأصناف.
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
            background: var(--card-bg, #0f172a); border: 1px solid var(--border-color, rgba(255,255,255,0.1));
            border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            max-height: 90vh; overflow-y: auto; color: var(--text-color, #fff); direction: rtl;
        }
        .interactive-card:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.3); border-color: rgba(56, 189, 248, 0.4) !important; }
        `;
        document.head.appendChild(s);
    }
})();

