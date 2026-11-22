(function () {
    const SUPABASE_URL = 'https://ryoqhtsdhfbydmejmaby.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b3FodHNkaGZieWRtZWptYWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3Mjk2MzMsImV4cCI6MjEwNzMwNTYzM30.y0tjIyjZZlII6ge9xkFpzqhF5sZjSngpp4XOoVrrTs4';
    const SESSION_STORAGE_KEY = 'golden_admin_panel_session';

    const FEATURE_CATALOG = [
        { key: 'page_dashboard', category: 'الصفحات الأساسية', label: 'لوحة التحكم', desc: 'إظهار صفحة لوحة التحكم الرئيسية (مفعلة افتراضياً).' },
        { key: 'page_sales', category: 'الصفحات الأساسية', label: 'فاتورة المبيعات', desc: 'إظهار صفحة فاتورة المبيعات (مفعلة افتراضياً).' },
        { key: 'page_purchases', category: 'الصفحات الأساسية', label: 'المشتريات', desc: 'إظهار صفحة فواتير المشتريات (مفعلة افتراضياً).' },
        { key: 'page_inventory', category: 'الصفحات الأساسية', label: 'المخزن', desc: 'إظهار صفحة المخزن والجرد (مفعلة افتراضياً).' },
        { key: 'page_receipt', category: 'الصفحات الأساسية', label: 'تحصيل من عميل', desc: 'إظهار صفحة سندات التحصيل من العملاء (مفعلة افتراضياً).' },
        { key: 'page_payment', category: 'الصفحات الأساسية', label: 'سداد لمورد', desc: 'إظهار صفحة سندات السداد للموردين (مفعلة افتراضياً).' },
        { key: 'page_settings', category: 'الصفحات الأساسية', label: 'الإعدادات', desc: 'إظهار صفحة إعدادات البرنامج (مفعلة افتراضياً).' },
        { key: 'master_units', category: 'البيانات الأساسية', label: 'الوحدات', desc: 'إظهار صفحة الوحدات ضمن قائمة البيانات الأساسية.' },
        { key: 'master_items', category: 'البيانات الأساسية', label: 'الأصناف', desc: 'إظهار صفحة الأصناف ضمن قائمة البيانات الأساسية.' },
        { key: 'master_customers', category: 'البيانات الأساسية', label: 'العملاء والموردين', desc: 'إظهار صفحة العملاء والموردين ضمن قائمة البيانات الأساسية.' },
        { key: 'master_users', category: 'البيانات الأساسية', label: 'إدارة المستخدمين', desc: 'إظهار صفحة إدارة المستخدمين ضمن قائمة البيانات الأساسية.' },
        { key: 'finance_treasury', category: 'التعاملات المالية', label: 'المالية', desc: 'إظهار صفحة المالية ضمن قائمة التعاملات المالية.' },
        { key: 'petty_expenses', category: 'التعاملات المالية', label: 'النثريات', desc: 'إظهار صفحة النثريات ضمن قائمة التعاملات المالية.' },
        { key: 'petty_bags', category: 'التعاملات المالية', label: 'الشكاير', desc: 'إظهار صفحة الشكاير ضمن قائمة التعاملات المالية.' },
        { key: 'petty_inspection', category: 'التعاملات المالية', label: 'الفحص', desc: 'إظهار صفحة الفحص ضمن قائمة التعاملات المالية.' },
        { key: 'petty_shipping_clearance', category: 'التعاملات المالية', label: 'الشحن والتخليص', desc: 'إظهار صفحة الشحن والتخليص ضمن قائمة التعاملات المالية.' },
        { key: 'petty_operation', category: 'التعاملات المالية', label: 'التشغيل', desc: 'إظهار صفحة التشغيل ضمن قائمة التعاملات المالية.' },
        { key: 'under_collection', category: 'التعاملات المالية', label: 'تحت التحصيل', desc: 'إظهار صفحة تحت التحصيل ضمن قائمة التعاملات المالية.' },
        { key: 'remaining_under_collection', category: 'التعاملات المالية', label: 'بيان المتبقي من تحت التحصيل', desc: 'إظهار صفحة بيان المتبقي من تحت التحصيل ضمن قائمة التعاملات المالية.' },
        { key: 'export_revenues', category: 'التعاملات المالية', label: 'إيرادات التصدير', desc: 'إظهار صفحة إيرادات التصدير ضمن قائمة التعاملات المالية.' },
        { key: 'local_sales', category: 'التعاملات المالية', label: 'المبيعات المحلية', desc: 'إظهار صفحة المبيعات المحلية ضمن قائمة التعاملات المالية.' },
        { key: 'reports_general', category: 'التقارير', label: 'التقارير العامة', desc: 'إظهار صفحة التقارير العامة ضمن قائمة التقارير.' },
        { key: 'reports_daily', category: 'التقارير', label: 'التقرير اليومي الشامل', desc: 'إظهار صفحة التقرير اليومي الشامل ضمن قائمة التقارير.' },
        { key: 'reports_customers', category: 'التقارير', label: 'تقارير العملاء', desc: 'إظهار صفحة تقارير العملاء ضمن قائمة التقارير.' },
        { key: 'reports_debit_credit', category: 'التقارير', label: 'كشف المدين والدائن', desc: 'إظهار صفحة كشف المدين والدائن ضمن قائمة التقارير.' },
        { key: 'reports_workers', category: 'التقارير', label: 'إدارة العمال', desc: 'إظهار صفحة إدارة العمال ضمن قائمة التقارير.' },
        { key: 'reports_factory_petty', category: 'التقارير', label: 'نثريات المصنع', desc: 'إظهار صفحة نثريات المصنع ضمن قائمة التقارير.' },
        { key: 'external_work', category: 'ميزات متقدمة والسحابة', label: 'شغل خارجي', desc: 'إظهار قسم المشتريات والمبيعات الخارجية في الهيدر.' },
        { key: 'treasury_attachments', category: 'ميزات متقدمة والسحابة', label: 'مرفقات السداد والتحصيل', desc: 'رفع صور مضغوطة وملفات PDF لسندات السداد والتحصيل مع شاشة المعاينة.' },
        { key: 'cloud_backup', category: 'ميزات متقدمة والسحابة', label: 'النسخ الاحتياطي السحابي', desc: 'تفعيل الرفع والاستعادة من السحابة مع بقاء النسخ المحلي متاحاً دائماً.' },
        { key: 'mobile_cloud_sync', category: 'ميزات متقدمة والسحابة', label: 'المزامنة السحابية للموبايل', desc: 'تفعيل الرفع والمزامنة اللحظية مع تطبيق الموبايل وإظهار حالة المزامنة في لوحة التحكم.' },
        { key: 'flex_full_layout', category: 'ميزات متقدمة والسحابة', label: 'تمدد المساحات المرن (Flex)', desc: 'نظام الأب والابن المرن لتمدد الصفحات ولوحة التحكم بالكامل.' },
        { key: 'sales_shift_close', category: 'ميزات متقدمة والسحابة', label: 'إقفال وردية المبيعات', desc: 'إظهار خيار إقفال الوردية أسفل قائمة المبيعات.' },
        { key: 'purchase_round_fifty', category: 'ميزات متقدمة والسحابة', label: 'تقريب المشتريات لأقرب 50', desc: 'تقريب صافي فاتورة المشتريات لأقرب 50 لأسفل بدلاً من الحساب بالقرش.' }
    ];

    const state = {
        accessToken: '',
        refreshToken: '',
        adminEmail: '',
        clients: [],
        stats: {},
        globalConfig: {
            min_supported_version: '10.0.0',
            support_whatsapp: '',
            force_update_message: ''
        },
        search: '',
        statusFilter: 'all',
        errorsLoaded: false,
        errorLogs: [],
        errorsPage: 1,
        errorsTotalPages: 1,
        errorsTotal: 0,
        auditPage: 1,
        auditTotalPages: 1,
        auditTotal: 0
    };

    const $ = (id) => document.getElementById(id);

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(message, type = 'info') {
        const container = $('toastContainer');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
        el.innerHTML = `<i class="fas ${icon}"></i><span>${escapeHtml(message)}</span>`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3800);
    }

    function formatRelativeTime(isoStr) {
        if (!isoStr) return 'لم يتصل بعد';
        const d = new Date(isoStr);
        if (Number.isNaN(d.getTime())) return '—';
        const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
        if (diffSec < 60) return 'الآن';
        if (diffSec < 3600) return `منذ ${Math.floor(diffSec / 60)} دقيقة`;
        if (diffSec < 86400) return `منذ ${Math.floor(diffSec / 3600)} ساعة`;
        const days = Math.floor(diffSec / 86400);
        if (days <= 30) return `منذ ${days} يوم`;
        return d.toLocaleDateString('ar-EG');
    }

    function formatDateShort(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatExactDateTime(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        if (Number.isNaN(d.getTime())) return '—';
        const datePart = d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timePart = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${datePart} — ${timePart}`;
    }

    function saveSession() {
        try {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                adminEmail: state.adminEmail
            }));
        } catch (_) {}
    }

    function clearSession() {
        state.accessToken = '';
        state.refreshToken = '';
        state.adminEmail = '';
        try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch (_) {}
    }

    function loadSavedSession() {
        try {
            const raw = localStorage.getItem(SESSION_STORAGE_KEY);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.accessToken) {
                state.accessToken = parsed.accessToken;
                state.refreshToken = parsed.refreshToken || '';
                state.adminEmail = parsed.adminEmail || '';
                return true;
            }
        } catch (_) {}
        return false;
    }

    async function refreshAccessToken() {
        if (!state.refreshToken) return false;
        try {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: state.refreshToken })
            });
            if (!res.ok) return false;
            const data = await res.json();
            if (!data?.access_token) return false;
            state.accessToken = data.access_token;
            state.refreshToken = data.refresh_token || state.refreshToken;
            saveSession();
            return true;
        } catch (_) {
            return false;
        }
    }

    async function callAdminApi(action, payload = {}, allowRetry = true) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-panel-gateway`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${state.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, ...payload })
        });

        if (res.status === 401 && allowRetry && await refreshAccessToken()) {
            return callAdminApi(action, payload, false);
        }

        const data = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }));
        if (res.status === 401 || res.status === 403) {
            if (res.status === 401) {
                clearSession();
                showLoginScreen();
            }
            throw new Error(data.error || 'غير مصرح لك بالوصول.');
        }

        if (!res.ok || !data.success) {
            throw new Error(data.error || 'حدث خطأ أثناء تنفيذ العملية.');
        }

        return data;
    }

    function showLoginScreen(errorMsg = '') {
        $('loginView').style.display = 'flex';
        $('dashboardView').style.display = 'none';
        const errEl = $('loginError');
        if (errEl) {
            errEl.textContent = errorMsg;
            errEl.style.display = errorMsg ? 'block' : 'none';
        }
    }

    function showDashboardScreen() {
        $('loginView').style.display = 'none';
        $('dashboardView').style.display = 'block';
        $('adminEmailLabel').textContent = state.adminEmail || 'Super Admin';
    }

    function openModal(title, bodyHtml, options = {}) {
        $('modalTitle').textContent = title;
        $('modalBody').innerHTML = bodyHtml;
        const card = $('modalBackdrop')?.querySelector('.modal-card');
        if (card) {
            card.style.width = options.wide ? 'min(780px, 96vw)' : '';
        }
        $('modalBackdrop').style.display = 'flex';
    }

    function closeModal() {
        $('modalBackdrop').style.display = 'none';
        $('modalBody').innerHTML = '';
    }

    function copyToClipboard(text, successMsg = 'تم النسخ بنجاح') {
        navigator.clipboard.writeText(text)
            .then(() => showToast(successMsg, 'success'))
            .catch(() => showToast('تعذر النسخ تلقائياً', 'error'));
    }

    async function loadOverview() {
        try {
            const data = await callAdminApi('dashboard_overview');
            state.adminEmail = data.admin_email || state.adminEmail;
            state.stats = data.stats || {};
            state.globalConfig = data.global_config || state.globalConfig;
            state.clients = Array.isArray(data.clients) ? data.clients : [];
            showDashboardScreen();
            renderStats();
            renderClientsTable();
            populateGlobalConfigForm();
        } catch (err) {
            showToast(err.message, 'error');
            if (!state.clients.length) {
                showLoginScreen(err.message);
            }
        }
    }

    function renderStats() {
        const s = state.stats || {};
        $('kpiTotal').textContent = s.total || 0;
        $('kpiActive').textContent = s.active || 0;
        $('kpiLifetime').textContent = s.lifetime || 0;
        $('kpiTrial').textContent = s.trial || 0;
        $('kpiInactive').textContent = (s.suspended || 0) + (s.expired || 0);
        $('kpiOnline').textContent = s.onlineToday || 0;
    }

    function renderStatusBadge(client) {
        const st = client.computed_status;
        if (st === 'lifetime') {
            return `<span class="badge badge-lifetime"><i class="fas fa-infinity"></i> دائم</span>`;
        }
        if (st === 'suspended') {
            return `<span class="badge badge-suspended"><i class="fas fa-ban"></i> موقوف</span>`;
        }
        if (st === 'expired') {
            return `<span class="badge badge-expired"><i class="fas fa-clock"></i> منتهي</span>`;
        }
        if (st === 'trial') {
            return `<span class="badge badge-trial"><i class="fas fa-hourglass-half"></i> تجريبي (${client.remaining_days} يوم)</span>`;
        }
        return `<span class="badge badge-active"><i class="fas fa-check-circle"></i> نشط (${client.remaining_days} يوم)</span>`;
    }

    function renderFeatureSummaryButton(client) {
        const features = client.features || {};
        const enabledCount = FEATURE_CATALOG.filter((f) => Boolean(features[f.key])).length;
        const totalCount = FEATURE_CATALOG.length;
        const btnClass = enabledCount > 0 ? 'btn-success' : 'btn-ghost';
        return `
            <button type="button" class="btn ${btnClass} btn-xs" data-action="manage-features" data-license-id="${escapeHtml(client.id)}">
                <i class="fas fa-sliders"></i>
                <span>الميزات (${enabledCount} / ${totalCount})</span>
            </button>
        `;
    }

    function getFilteredClients() {
        const q = state.search.trim().toLowerCase();
        return state.clients.filter((c) => {
            if (state.statusFilter !== 'all' && c.computed_status !== state.statusFilter) {
                return false;
            }
            if (!q) return true;
            const hay = [
                c.company_name,
                c.company_phone,
                c.company_activity,
                c.company_id,
                c.bound_machine_id,
                c.last_seen_machine_id,
                c.machine_id,
                c.desktop_version,
                ...(c.android_users || []).map((u) => u.email)
            ].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }

    function renderClientsTable() {
        const tbody = $('clientsTableBody');
        const list = getFilteredClients();
        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">لا توجد نتائج مطابقة للبحث.</td></tr>`;
            return;
        }

        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

        tbody.innerHTML = list.map((c) => {
            const boundMachineId = String(c.bound_machine_id || '').trim();
            const isBound = Boolean(boundMachineId);
            const lastSeenMachineId = String(c.last_seen_machine_id || c.machine_id || '').trim();
            const hbMs = c.last_heartbeat_at ? new Date(c.last_heartbeat_at).getTime() : 0;
            const isOnline = hbMs >= oneDayAgo;
            const androidCount = (c.android_users || []).length;
            const isSuspended = c.computed_status === 'suspended';

            return `
                <tr>
                    <td>
                        <div class="client-name-row">
                            <span>${escapeHtml(c.company_name || 'مؤسسة جديدة')}</span>
                            <button type="button" class="icon-mini-btn" data-action="edit-name" data-license-id="${escapeHtml(c.id)}" title="تعديل اسم الشركة">
                                <i class="fas fa-pen"></i>
                            </button>
                        </div>
                        ${(c.company_activity || c.company_phone) ? `
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:0.78rem;color:#cbd5e1;">
                                ${c.company_activity ? `<span><i class="fas fa-briefcase" style="color:#38bdf8;"></i> ${escapeHtml(c.company_activity)}</span>` : ''}
                                ${c.company_phone ? `<a href="https://wa.me/${escapeHtml(String(c.company_phone).replace(/[^0-9]/g, '').replace(/^01/, '201'))}" target="_blank" style="color:#4ade80;text-decoration:none;direction:ltr;display:inline-flex;align-items:center;gap:4px;" title="مراسلة العميل على واتساب"><i class="fab fa-whatsapp"></i> ${escapeHtml(c.company_phone)}</a>` : ''}
                            </div>
                        ` : ''}
                        <span class="sub-code" title="Company ID">${escapeHtml(c.company_id)}</span>
                    </td>
                    <td>
                        ${isBound
                            ? `<div style="font-family:Consolas,monospace;font-size:0.84rem;direction:ltr;display:inline-block;">${escapeHtml(boundMachineId)}</div>`
                            : `<div style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;background:rgba(245,158,11,0.16);border:1px solid rgba(245,158,11,0.45);color:#fbbf24;font-size:0.76rem;font-weight:700;"><i class="fas fa-unlink"></i> غير مربوط — جاهز للنقل</div>${lastSeenMachineId ? `<div style="color:#64748b;font-size:0.72rem;font-family:Consolas,monospace;margin-top:3px;direction:ltr;">آخر جهاز: ${escapeHtml(lastSeenMachineId)}</div>` : ''}`
                        }
                        <div style="color:#94a3b8;font-size:0.78rem;margin-top:4px;">الإصدار: <strong>v${escapeHtml(c.desktop_version || '—')}</strong></div>
                    </td>
                    <td>
                        ${(() => {
                            const fiveMinAgo = Date.now() - 5 * 60 * 1000;
                            const isLiveNow = hbMs >= fiveMinAgo;
                            const statusLabel = isLiveNow ? 'متصل الآن' : isOnline ? 'نشط اليوم' : (hbMs > 0 ? 'غير متصل' : 'لم يتصل');
                            const dotColor = isLiveNow ? '#22c55e' : isOnline ? '#10b981' : '#64748b';
                            const pillBg = isLiveNow ? 'rgba(34,197,94,0.16)' : isOnline ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.16)';
                            const pillBorder = isLiveNow ? 'rgba(34,197,94,0.45)' : isOnline ? 'rgba(16,185,129,0.35)' : 'rgba(100,116,139,0.3)';
                            return `
                                <div style="display:flex;flex-direction:column;gap:4px;">
                                    <div style="display:inline-flex;align-items:center;gap:6px;width:fit-content;padding:2px 9px;border-radius:999px;background:${pillBg};border:1px solid ${pillBorder};font-size:0.74rem;font-weight:700;color:${isLiveNow ? '#4ade80' : isOnline ? '#34d399' : '#94a3b8'};">
                                        <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};box-shadow:${isLiveNow ? '0 0 8px #22c55e' : 'none'};"></span>
                                        <span>${statusLabel}</span>
                                    </div>
                                    <div style="font-size:0.82rem;font-weight:600;color:#e2e8f0;">${formatRelativeTime(c.last_heartbeat_at)}</div>
                                    <div style="font-size:0.73rem;color:#94a3b8;direction:ltr;text-align:right;">${formatExactDateTime(c.last_heartbeat_at)}</div>
                                </div>
                            `;
                        })()}
                    </td>
                    <td>
                        ${renderStatusBadge(c)}
                        <div style="color:#94a3b8;font-size:0.76rem;margin-top:5px;">
                            ${c.computed_status === 'lifetime' ? 'بدون تاريخ انتهاء' : `ينتهي: ${formatDateShort(c.expires_at)}`}
                        </div>
                    </td>
                    <td>
                        ${renderFeatureSummaryButton(c)}
                    </td>
                    <td>
                        <button type="button" class="btn btn-purple btn-xs" data-action="android-users" data-license-id="${escapeHtml(c.id)}">
                            <i class="fab fa-android"></i>
                            <span>الحسابات (${androidCount})</span>
                        </button>
                    </td>
                    <td>
                        <div class="actions-wrap">
                            <button type="button" class="btn btn-primary btn-xs" data-action="manage-license" data-license-id="${escapeHtml(c.id)}">
                                <i class="fas fa-calendar-plus"></i> تجديد
                            </button>
                            <button type="button" class="btn ${isSuspended ? 'btn-success' : 'btn-danger'} btn-xs" data-action="toggle-suspend" data-license-id="${escapeHtml(c.id)}">
                                <i class="fas ${isSuspended ? 'fa-play' : 'fa-ban'}"></i> ${isSuspended ? 'تفعيل' : 'إيقاف'}
                            </button>
                            <button type="button" class="btn btn-ghost btn-xs" data-action="activation-code" data-license-id="${escapeHtml(c.id)}" title="توليد كود تفعيل للجهاز">
                                <i class="fas fa-key"></i> كود
                            </button>
                            <button type="button" class="btn btn-ghost btn-xs" data-action="client-backups" data-license-id="${escapeHtml(c.id)}" title="عرض وتحميل النسخ الاحتياطي السحابي للعميل">
                                <i class="fas fa-cloud-arrow-down" style="color:#38bdf8;"></i> النسخ
                            </button>
                            <button type="button" class="btn btn-ghost btn-xs" data-action="remote-command" data-license-id="${escapeHtml(c.id)}" title="إرسال رسالة خاصة أو أمر نسخة احتياطية عن بُعد">
                                <i class="fas fa-satellite-dish" style="color:#fbbf24;"></i> أمر
                            </button>
                            ${isBound
                                ? `<button type="button" class="btn btn-ghost btn-xs" data-action="reset-machine" data-license-id="${escapeHtml(c.id)}" title="فك ربط الجهاز (لنقل البرنامج لجهاز جديد)"><i class="fas fa-unlink"></i> فك جهاز</button>`
                                : (lastSeenMachineId
                                    ? `<button type="button" class="btn btn-success btn-xs" data-action="bind-machine" data-license-id="${escapeHtml(c.id)}" title="إعادة ربط الحساب بآخر جهاز (${escapeHtml(lastSeenMachineId)})"><i class="fas fa-link"></i> إعادة ربط</button>`
                                    : `<button type="button" class="btn btn-ghost btn-xs" disabled style="opacity:0.45;cursor:not-allowed;" title="لا يوجد جهاز سابق للربط"><i class="fas fa-unlink"></i> غير مربوط</button>`)
                            }
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function findClient(licenseId) {
        return state.clients.find((c) => String(c.id) === String(licenseId));
    }

    function updateGlobalConfigPreview() {
        const minV = ($('cfgMinVersion')?.value || '10.0.0').trim() || '10.0.0';
        const msg = ($('cfgForceUpdateMsg')?.value || 'يرجى تحديث البرنامج إلى أحدث إصدار للمتابعة وضمان استقرار بياناتك.').trim();
        const wa = ($('cfgSupportWhatsapp')?.value || '').trim();
        if ($('previewMinVersionBadge')) $('previewMinVersionBadge').textContent = `v${minV}+`;
        if ($('previewForceUpdateMsg')) $('previewForceUpdateMsg').textContent = msg;
        if ($('previewWhatsappText')) $('previewWhatsappText').textContent = wa || 'غير محدد';
    }

    function populateGlobalConfigForm() {
        const cfg = state.globalConfig || {};
        if ($('cfgMinVersion')) $('cfgMinVersion').value = cfg.min_supported_version || '10.0.0';
        if ($('cfgForceUpdateMsg')) $('cfgForceUpdateMsg').value = cfg.force_update_message || '';
        if ($('cfgSupportWhatsapp')) $('cfgSupportWhatsapp').value = cfg.support_whatsapp || '';
        if ($('cfgTelegramBotToken')) $('cfgTelegramBotToken').value = cfg.telegram_bot_token || '';
        if ($('cfgTelegramChatId')) $('cfgTelegramChatId').value = cfg.telegram_chat_id || '';
        if ($('cfgTelegramEnabled')) $('cfgTelegramEnabled').checked = Boolean(cfg.telegram_alerts_enabled);
        if ($('cfgAnnouncementMsg')) $('cfgAnnouncementMsg').value = cfg.announcement_message || '';
        if ($('cfgAnnouncementActive')) $('cfgAnnouncementActive').checked = Boolean(cfg.announcement_active);
        updateGlobalConfigPreview();
    }

    function openConfirmModal({ title, message, details = '', confirmText = 'تأكيد', confirmClass = 'btn-danger', icon = 'fa-triangle-exclamation', onConfirm }) {
        openModal(title, `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div style="display:flex;align-items:flex-start;gap:12px;background:rgba(15,23,42,0.65);border:1px solid var(--border);border-radius:12px;padding:14px;">
                    <div style="width:40px;height:40px;border-radius:10px;background:rgba(245,158,11,0.16);color:#fbbf24;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem;">
                        <i class="fas ${escapeHtml(icon)}"></i>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <div style="font-size:0.95rem;font-weight:700;color:#f8fafc;line-height:1.5;">${escapeHtml(message)}</div>
                        ${details ? `<div style="font-size:0.82rem;color:#94a3b8;line-height:1.5;">${escapeHtml(details)}</div>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button type="button" id="confirmModalCancelBtn" class="btn btn-ghost">إلغاء</button>
                    <button type="button" id="confirmModalOkBtn" class="btn ${escapeHtml(confirmClass)}">
                        <i class="fas ${escapeHtml(icon)}"></i> ${escapeHtml(confirmText)}
                    </button>
                </div>
            </div>
        `);

        $('confirmModalCancelBtn').addEventListener('click', closeModal);
        $('confirmModalOkBtn').addEventListener('click', async () => {
            const btn = $('confirmModalOkBtn');
            btn.disabled = true;
            try {
                await onConfirm();
                closeModal();
            } catch (err) {
                showToast(err.message || 'حدث خطأ أثناء التنفيذ', 'error');
                btn.disabled = false;
            }
        });
    }

    function openAccountSettingsModal() {
        openModal('حساب الأدمن وتغيير كلمة المرور', `
            <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
                <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:4px;">البريد الإلكتروني المسجل (Super Admin):</div>
                <div style="font-size:1rem;font-weight:700;color:#38bdf8;direction:ltr;text-align:right;">${escapeHtml(state.adminEmail || '—')}</div>
            </div>
            <form id="changeAdminPasswordForm" class="modal-form">
                <div class="field">
                    <label for="adminNewPassword">كلمة المرور الجديدة (6 أحرف على الأقل)</label>
                    <input type="password" id="adminNewPassword" required minlength="6" placeholder="أدخل كلمة المرور الجديدة">
                </div>
                <div class="field">
                    <label for="adminConfirmPassword">تأكيد كلمة المرور الجديدة</label>
                    <input type="password" id="adminConfirmPassword" required minlength="6" placeholder="أعد كتابة كلمة المرور الجديدة">
                </div>
                <button type="submit" id="saveAdminPassBtn" class="btn btn-primary btn-block">
                    <i class="fas fa-key"></i> تحديث كلمة المرور الآن
                </button>
            </form>
        `);

        $('changeAdminPasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const p1 = $('adminNewPassword').value;
            const p2 = $('adminConfirmPassword').value;
            if (p1.length < 6) {
                showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'error');
                return;
            }
            if (p1 !== p2) {
                showToast('كلمتا المرور غير متطابقتين.', 'error');
                return;
            }
            const btn = $('saveAdminPassBtn');
            btn.disabled = true;
            try {
                await callAdminApi('change_my_password', { new_password: p1 });
                closeModal();
                showToast('تم تغيير كلمة المرور بنجاح! استخدمها في المرة القادمة.', 'success');
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });
    }

    function openFeaturesModal(client) {
        const renderList = (query = '') => {
            const q = query.trim().toLowerCase();
            const features = client.features || {};
            const filtered = FEATURE_CATALOG.filter((f) =>
                !q || f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q) || (f.desc || '').toLowerCase().includes(q) || (f.category || '').toLowerCase().includes(q)
            );
            const listEl = $('featuresModalList');
            if (!listEl) return;
            if (!filtered.length) {
                listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:16px;">لا توجد ميزات مطابقة للبحث.</div>`;
                return;
            }
            const disabledItems = filtered.filter((f) => !features[f.key]);
            const enabledItems = filtered.filter((f) => Boolean(features[f.key]));
            const buildCard = (feat, isOn) => {
                const checked = isOn ? 'checked' : '';
                const borderStyle = isOn ? '' : 'border-color:rgba(245,158,11,0.5);';
                return `
                    <div class="user-item-card" style="align-items:center;${borderStyle}">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:700;font-size:0.9rem;color:#f8fafc;">${escapeHtml(feat.label)} ${isOn ? '' : `<span style="font-size:0.7rem;color:#fbbf24;margin-right:4px;">(${escapeHtml(feat.category || 'مقفول')})</span>`}</div>
                            <div style="font-size:0.76rem;color:#94a3b8;margin-top:3px;">${escapeHtml(feat.desc || '')}</div>
                            <div style="font-family:Consolas,monospace;font-size:0.7rem;color:#64748b;margin-top:2px;direction:ltr;text-align:right;">${escapeHtml(feat.key)}</div>
                        </div>
                        <label class="switch">
                            <input type="checkbox" data-modal-feature-key="${escapeHtml(feat.key)}" ${checked}>
                            <span class="slider"></span>
                        </label>
                    </div>
                `;
            };

            const sections = [];
            if (disabledItems.length) {
                sections.push(`
                    <div style="grid-column:1/-1;margin-top:4px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;border-radius:8px;background:rgba(245,158,11,0.14);border-right:3px solid #f59e0b;margin-bottom:8px;">
                            <strong style="color:#fbbf24;font-size:0.9rem;"><i class="fas fa-lock"></i> الميزات المقفولة حالياً</strong>
                            <span style="font-size:0.76rem;color:#fbbf24;font-weight:700;">${disabledItems.length} ميزة مقفولة</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:10px;">
                            ${disabledItems.map((feat) => buildCard(feat, false)).join('')}
                        </div>
                    </div>
                `);
            }

            const enabledCategories = [...new Set(enabledItems.map((f) => f.category || 'عام'))];
            enabledCategories.forEach((cat) => {
                const catItems = enabledItems.filter((f) => (f.category || 'عام') === cat);
                sections.push(`
                    <div style="grid-column:1/-1;margin-top:6px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:8px;background:rgba(30,41,59,0.75);border-right:3px solid #38bdf8;margin-bottom:8px;">
                            <strong style="color:#38bdf8;font-size:0.88rem;">${escapeHtml(cat)}</strong>
                            <span style="font-size:0.74rem;color:#4ade80;">مفعّل (${catItems.length})</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:10px;">
                            ${catItems.map((feat) => buildCard(feat, true)).join('')}
                        </div>
                    </div>
                `);
            });
            listEl.innerHTML = sections.join('');
        };

        openModal(`الميزات المخصصة — ${client.company_name}`, `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <input type="text" id="featuresModalSearch" placeholder="ابحث داخل الميزات..." style="flex:1;min-width:180px;background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:9px;padding:8px 12px;color:#fff;font-size:0.86rem;outline:none;">
                <div style="display:flex;gap:6px;">
                    <button type="button" id="enableAllFeaturesBtn" class="btn btn-success btn-xs"><i class="fas fa-check-double"></i> تفعيل الكل</button>
                    <button type="button" id="disableAllFeaturesBtn" class="btn btn-danger btn-xs"><i class="fas fa-times"></i> إيقاف الكل</button>
                </div>
            </div>
            <div id="featuresModalList" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;max-height:56vh;overflow-y:auto;padding-left:4px;"></div>
        `, { wide: true });

        renderList('');

        $('featuresModalSearch').addEventListener('input', (e) => renderList(e.target.value));

        const saveAllFeatures = async (nextFeatures, toastMsg) => {
            try {
                await callAdminApi('update_features', { license_id: client.id, features: nextFeatures });
                client.features = nextFeatures;
                renderList($('featuresModalSearch')?.value || '');
                renderClientsTable();
                showToast(toastMsg, 'success');
            } catch (err) {
                showToast(err.message, 'error');
            }
        };

        $('enableAllFeaturesBtn').addEventListener('click', () => {
            const next = { ...(client.features || {}) };
            FEATURE_CATALOG.forEach((f) => { next[f.key] = true; });
            saveAllFeatures(next, 'تم تفعيل جميع الميزات بنجاح');
        });

        $('disableAllFeaturesBtn').addEventListener('click', () => {
            const next = { ...(client.features || {}) };
            FEATURE_CATALOG.forEach((f) => { next[f.key] = false; });
            saveAllFeatures(next, 'تم إيقاف جميع الميزات بنجاح');
        });

        $('featuresModalList').addEventListener('change', async (e) => {
            const toggle = e.target.closest('[data-modal-feature-key]');
            if (!toggle) return;
            const key = toggle.getAttribute('data-modal-feature-key');
            const nextFeatures = { ...(client.features || {}), [key]: Boolean(toggle.checked) };
            toggle.disabled = true;
            try {
                await callAdminApi('update_features', { license_id: client.id, features: nextFeatures });
                client.features = nextFeatures;
                renderClientsTable();
                showToast(`تم ${toggle.checked ? 'تفعيل' : 'إيقاف'} الميزة بنجاح`, 'success');
            } catch (err) {
                toggle.checked = !toggle.checked;
                showToast(err.message, 'error');
            } finally {
                toggle.disabled = false;
            }
        });
    }

    function openEditNameModal(client) {
        openModal(`تعديل اسم الشركة`, `
            <form id="editNameForm" class="modal-form">
                <div class="field">
                    <label>الاسم الجديد للشركة / المؤسسة</label>
                    <input type="text" id="newCompanyNameInput" value="${escapeHtml(client.company_name || '')}" required>
                </div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> حفظ الاسم الجديد</button>
            </form>
        `);

        $('editNameForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = $('newCompanyNameInput').value.trim();
            if (newName.length < 2) {
                showToast('يرجى إدخال اسم صالح (حرفين على الأقل).', 'error');
                return;
            }
            try {
                await callAdminApi('update_company_name', {
                    license_id: client.id,
                    company_id: client.company_id,
                    company_name: newName
                });
                closeModal();
                showToast('تم تحديث اسم الشركة بنجاح', 'success');
                await loadOverview();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    function openLicenseModal(client) {
        const currentExpInput = client.expires_at ? new Date(client.expires_at).toISOString().slice(0, 10) : '';
        openModal(`إدارة اشتراك: ${client.company_name}`, `
            <div style="font-size:0.88rem;color:#cbd5e1;">
                الحالة الحالية: ${renderStatusBadge(client)}
            </div>
            <div>
                <div style="font-size:0.85rem;color:#94a3b8;margin-bottom:8px;font-weight:600;">تجديد سريع:</div>
                <div class="quick-grid">
                    <button type="button" class="btn btn-success" data-lic-mode="extend_days" data-days="30"><i class="fas fa-plus"></i> تجديد شهر (+30 يوم)</button>
                    <button type="button" class="btn btn-success" data-lic-mode="extend_days" data-days="90"><i class="fas fa-plus"></i> تجديد 3 شهور (+90 يوم)</button>
                    <button type="button" class="btn btn-primary" data-lic-mode="extend_days" data-days="365"><i class="fas fa-plus"></i> تجديد سنة (+365 يوم)</button>
                    <button type="button" class="btn btn-warning" data-lic-mode="lifetime"><i class="fas fa-infinity"></i> تحويل لدائم (Lifetime)</button>
                </div>
            </div>
            <hr style="border:none;border-top:1px solid var(--border);">
            <form id="customExpiryForm" class="modal-form">
                <div class="field">
                    <label>أو تحديد تاريخ انتهاء مخصص:</label>
                    <input type="date" id="customExpiryDate" value="${escapeHtml(currentExpInput)}" required>
                </div>
                <button type="submit" class="btn btn-ghost btn-block"><i class="fas fa-calendar-check"></i> حفظ التاريخ المخصص</button>
            </form>
        `);

        $('modalBody').querySelectorAll('[data-lic-mode]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const mode = btn.getAttribute('data-lic-mode');
                const days = Number(btn.getAttribute('data-days') || 0);
                btn.disabled = true;
                try {
                    await callAdminApi('update_license', { license_id: client.id, mode, days });
                    closeModal();
                    showToast('تم تحديث الاشتراك بنجاح', 'success');
                    await loadOverview();
                } catch (err) {
                    btn.disabled = false;
                    showToast(err.message, 'error');
                }
            });
        });

        $('customExpiryForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const dateVal = $('customExpiryDate').value;
            if (!dateVal) return;
            try {
                await callAdminApi('update_license', {
                    license_id: client.id,
                    mode: 'set_expiry',
                    expires_at: `${dateVal}T23:59:59.000Z`
                });
                closeModal();
                showToast('تم تحديد تاريخ الانتهاء بنجاح', 'success');
                await loadOverview();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    function openAndroidUsersModal(client) {
        const users = client.android_users || [];
        const usersHtml = users.length
            ? users.map((u) => `
                <div class="user-item-card">
                    <div>
                        <div style="font-weight:700;direction:ltr;text-align:right;">${escapeHtml(u.email)}</div>
                        <div style="font-size:0.76rem;color:#94a3b8;margin-top:3px;">آخر دخول: ${formatRelativeTime(u.last_sign_in_at)}</div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button type="button" class="btn btn-ghost btn-xs" data-android-action="reset-pass" data-uid="${escapeHtml(u.id)}" data-email="${escapeHtml(u.email)}">
                            <i class="fas fa-key"></i> تغيير الباسورد
                        </button>
                        <button type="button" class="btn btn-danger btn-xs" data-android-action="delete-user" data-uid="${escapeHtml(u.id)}" data-email="${escapeHtml(u.email)}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('')
            : `<div style="color:#94a3b8;font-size:0.86rem;text-align:center;padding:12px;">لا يوجد حسابات أندرويد مسجلة لهذه الشركة بعد.</div>`;

        openModal(`حسابات الأندرويد — ${client.company_name}`, `
            <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="font-size:0.85rem;color:#94a3b8;font-weight:700;">الحسابات الحالية (${users.length}):</div>
                ${usersHtml}
            </div>
            <hr style="border:none;border-top:1px solid var(--border);">
            <form id="createAndroidUserForm" class="modal-form">
                <div style="font-size:0.9rem;font-weight:700;color:#38bdf8;"><i class="fas fa-user-plus"></i> إنشاء حساب أندرويد جديد وربطه تلقائياً</div>
                <div class="field">
                    <label>البريد الإلكتروني (Email)</label>
                    <input type="email" id="androidNewEmail" required placeholder="client@golden-accounting.com">
                </div>
                <div class="field">
                    <label>كلمة المرور (6 أحرف على الأقل)</label>
                    <input type="text" id="androidNewPassword" required minlength="6" placeholder="مثال: Golden@2026">
                </div>
                <button type="submit" id="createAndroidSubmitBtn" class="btn btn-purple btn-block">
                    <i class="fab fa-android"></i> إنشاء وربط الحساب فوراً
                </button>
            </form>
            <div id="createdAndroidCredentialsBox" style="display:none;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.4);border-radius:10px;padding:14px;"></div>
        `);

        $('createAndroidUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = $('androidNewEmail').value.trim();
            const password = $('androidNewPassword').value;
            const btn = $('createAndroidSubmitBtn');
            btn.disabled = true;
            try {
                await callAdminApi('create_android_user', {
                    company_id: client.company_id,
                    company_name: client.company_name,
                    email,
                    password
                });
                showToast('تم إنشاء حساب الأندرويد وربطه بالشركة بنجاح!', 'success');
                const whatsappMsg = `بيانات الدخول لتطبيق الأندرويد (${client.company_name}):\nالبريد الإلكتروني: ${email}\nكلمة المرور: ${password}`;
                const box = $('createdAndroidCredentialsBox');
                box.style.display = 'block';
                box.innerHTML = `
                    <div style="font-weight:700;color:#86efac;margin-bottom:8px;">تم الإنشاء والربط بنجاح!</div>
                    <div style="font-size:0.86rem;line-height:1.7;margin-bottom:10px;">
                        الإيميل: <strong style="direction:ltr;display:inline-block;">${escapeHtml(email)}</strong><br>
                        الباسورد: <strong style="direction:ltr;display:inline-block;">${escapeHtml(password)}</strong>
                    </div>
                    <button type="button" id="copyWhatsappCredsBtn" class="btn btn-success btn-sm">
                        <i class="fab fa-whatsapp"></i> نسخ رسالة جاهزة للواتساب
                    </button>
                `;
                $('copyWhatsappCredsBtn').addEventListener('click', () => copyToClipboard(whatsappMsg, 'تم نسخ رسالة الواتساب'));
                await loadOverview();
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });

        $('modalBody').querySelectorAll('[data-android-action]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const act = btn.getAttribute('data-android-action');
                const uid = btn.getAttribute('data-uid');
                const email = btn.getAttribute('data-email');
                if (act === 'reset-pass') {
                    const newPass = window.prompt(`أدخل كلمة المرور الجديدة للحساب (${email}) (6 أحرف على الأقل):`);
                    if (!newPass || newPass.length < 6) return;
                    try {
                        await callAdminApi('reset_android_password', { user_id: uid, password: newPass });
                        showToast('تم تغيير كلمة المرور بنجاح', 'success');
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                } else if (act === 'delete-user') {
                    openConfirmModal({
                        title: 'تأكيد حذف حساب الأندرويد',
                        message: `هل أنت متأكد من حذف حساب الأندرويد (${email}) نهائياً؟`,
                        details: 'لن يتمكن هذا الحساب من تسجيل الدخول لتطبيق الموبايل بعد الحذف.',
                        confirmText: 'حذف نهائي',
                        confirmClass: 'btn-danger',
                        icon: 'fa-trash',
                        onConfirm: async () => {
                            await callAdminApi('delete_android_user', { user_id: uid });
                            showToast('تم حذف الحساب بنجاح', 'success');
                            await loadOverview();
                        }
                    });
                }
            });
        });
    }

    async function openActivationCodeModal(client) {
        const machineId = client.bound_machine_id || client.last_seen_machine_id || client.machine_id || '';
        if (!machineId) {
            showToast('لا يوجد Machine ID مسجل لهذا العميل بعد.', 'error');
            return;
        }
        try {
            const res = await callAdminApi('generate_activation_code', { machine_id: machineId });
            openModal(`كود التفعيل — ${client.company_name}`, `
                <div style="font-size:0.88rem;color:#cbd5e1;">رقم الجهاز (Machine ID): <strong style="direction:ltr;display:inline-block;">${escapeHtml(machineId)}</strong></div>
                <div class="code-box">${escapeHtml(res.activation_code)}</div>
                <button type="button" id="copyActivationCodeBtn" class="btn btn-primary btn-block">
                    <i class="fas fa-copy"></i> نسخ كود التفعيل
                </button>
            `);
            $('copyActivationCodeBtn').addEventListener('click', () => copyToClipboard(res.activation_code, 'تم نسخ كود التفعيل'));
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    function translateModuleLabel(mod) {
        const key = String(mod || '').trim().toLowerCase();
        if (key === 'sync_dispatch') return 'إرسال المزامنة';
        if (key === 'sync_runtime') return 'تشغيل المزامنة';
        if (key === 'diagnostic_report') return 'تقرير تشخيصي';
        if (key === 'license') return 'التراخيص';
        return mod || 'النظام';
    }

    function diagnoseClientError(rawMsg) {
        const msg = String(rawMsg || '').trim();
        const lower = msg.toLowerCase();

        if (lower.includes('timestamp expired') || lower.includes('clock out of sync')) {
            return {
                title: 'ساعة جهاز العميل غير مضبوطة',
                reason: 'يوجد فرق توقيت كبير بين ساعة ويندوز لدى العميل وتوقيت الخادم، مما أدى لرفض التوقيع الأمني للمزامنة.',
                clientImpact: 'شغل العميل على الديسكتوب مستمر طبيعياً دون توقف، لكن المزامنة للموبايل متوقفة مؤقتاً وتظهر له علامة تعثر في بادج المزامنة.',
                solution: 'اطلب من العميل تفعيل الضبط التلقائي للوقت والتاريخ في إعدادات ويندوز (Set time automatically) ثم إعادة المحاولة.'
            };
        }
        if (lower.includes('is not unique') || lower.includes('apply_delta_sync_batch')) {
            return {
                title: 'تعارض في دالة المزامنة السحابية',
                reason: 'العميل يستخدم إصداراً قديماً أو يوجد تداخل في توقيع دالة تطبيق الدفعات بقاعدة البيانات السحابية.',
                clientImpact: 'البرنامج يعمل محلياً بشكل طبيعي، لكن الدفعات السحابية للموبايل تبقى معلّقة لحين التحديث.',
                solution: 'حدّث برنامج العميل إلى أحدث إصدار وتأكد من عدم وجود نسختين متداخلتين للدالة في Supabase.'
            };
        }
        if (lower.includes('unauthorized_device') || lower.includes('invalid signature') || lower.includes('invalid_signature')) {
            return {
                title: 'عدم تطابق هوية أو توقيع الجهاز',
                reason: 'الحساب مربوط بجهاز كمبيوتر آخر أو تم نقل قاعدة البيانات لجهاز جديد دون فك الربط.',
                clientImpact: 'تظهر للعميل رسالة قفل الترخيص (الترخيص مربوط بجهاز آخر) ولا يمكنه المتابعة إلا بعد فك ربط الجهاز.',
                solution: 'اضغط "فك جهاز" من تبويب العملاء والتراخيص ليتمكن العميل من الربط بجهازه الجديد.'
            };
        }
        if (lower.includes('failed to fetch') || lower.includes('enotfound') || lower.includes('etimedout') || lower.includes('network') || lower.includes('fetch failed') || lower.includes('econnrefused')) {
            return {
                title: 'انقطاع الإنترنت أو تعذر الوصول للخادم',
                reason: 'جهاز العميل غير متصل بالإنترنت أو يوجد جدار حماية يمنع الوصول للسحابة.',
                clientImpact: 'يعمل العميل أوفلاين بشكل طبيعي تماماً ويتم حفظ حركاته محلياً حتى عودة الإنترنت.',
                solution: 'تأكد من اتصال الإنترنت لدى العميل؛ سيحاول البرنامج إعادة الرفع تلقائياً فور عودة الاتصال.'
            };
        }
        if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('jwt')) {
            return {
                title: 'رفض صلاحية الاتصال أو انتهاء الجلسة',
                reason: 'حالة الترخيص موقوفة أو توكن المصادقة غير صالح.',
                clientImpact: 'قد تظهر للعميل شاشة إيقاف الحساب أو تتوقف المزامنة السحابية لحين إعادة التفعيل.',
                solution: 'تأكد من أن حالة اشتراك العميل "نشط" واطلب منه إعادة تشغيل البرنامج.'
            };
        }
        if (lower.includes('500') || lower.includes('internal server error')) {
            return {
                title: 'خطأ داخلي مؤقت في الخادم السحابي',
                reason: 'تعذر الخادم عن معالجة الطلب بشكل مؤقت.',
                clientImpact: 'عمل العميل على الديسكتوب مستمر بدون أي تأثير، وتُعاد المحاولة السحابية تلقائياً.',
                solution: 'أعد المحاولة بعد دقائق، وإذا استمر الخطأ راجع سجلات Supabase Edge Functions.'
            };
        }
        return {
            title: 'خطأ تقني أثناء التشغيل',
            reason: 'حدث خطأ غير متوقع أثناء تنفيذ عملية المزامنة أو التشغيل لدى العميل.',
            clientImpact: 'عمل العميل المحلي مستمر غالباً مع تأخر مؤقت في المزامنة السحابية.',
            solution: 'تأكد من تحديث العميل لأحدث إصدار وراجع التفاصيل التقنية أدناه.'
        };
    }

    function formatFileSize(bytes) {
        const n = Number(bytes) || 0;
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    }

    async function openClientBackupsModal(client) {
        openModal(`النسخ الاحتياطي السحابي — ${client.company_name}`, `
            <div style="text-align:center;padding:18px;color:#94a3b8;">
                <i class="fas fa-spinner fa-spin"></i> جاري جلب قائمة النسخ السحابية...
            </div>
        `);
        try {
            const res = await callAdminApi('list_client_backups', { company_id: client.company_id });
            const files = res.files || [];
            if (!files.length) {
                openModal(`النسخ الاحتياطي السحابي — ${client.company_name}`, `
                    <div style="text-align:center;padding:24px;color:#94a3b8;">
                        <i class="fas fa-cloud-slash" style="font-size:2rem;margin-bottom:10px;display:block;color:#64748b;"></i>
                        لا توجد نسخ احتياطية سحابية مرفوعة لهذا العميل حتى الآن.
                    </div>
                `);
                return;
            }
            const rowsHtml = files.map((f) => `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(15,23,42,0.7);border:1px solid var(--border);border-radius:10px;padding:10px 12px;">
                    <div style="min-width:0;flex:1;">
                        <div style="font-weight:700;color:#f8fafc;font-size:0.84rem;direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(f.name)}</div>
                        <div style="font-size:0.75rem;color:#94a3b8;margin-top:3px;">
                            ${formatFileSize(f.size)} • ${formatExactDateTime(f.created_at)}
                        </div>
                    </div>
                    <button type="button" class="btn btn-primary btn-xs download-backup-btn" data-path="${escapeHtml(f.path)}">
                        <i class="fas fa-download"></i> تحميل
                    </button>
                </div>
            `).join('');
            openModal(`النسخ الاحتياطي السحابي — ${client.company_name} (${files.length})`, `
                <div style="display:flex;flex-direction:column;gap:8px;max-height:380px;overflow-y:auto;">
                    ${rowsHtml}
                </div>
            `);
            document.querySelectorAll('.download-backup-btn').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    try {
                        const dl = await callAdminApi('download_client_backup', {
                            company_id: client.company_id,
                            company_name: client.company_name,
                            path: btn.dataset.path
                        });
                        if (dl.signed_url) {
                            window.open(dl.signed_url, '_blank');
                            showToast('تم تجهيز رابط التحميل الآمن بنجاح', 'success');
                        }
                    } catch (err) {
                        showToast(err.message, 'error');
                    } finally {
                        btn.disabled = false;
                    }
                });
            });
        } catch (err) {
            openModal(`النسخ الاحتياطي السحابي — ${client.company_name}`, `
                <div style="color:#fca5a5;padding:14px;">${escapeHtml(err.message)}</div>
            `);
        }
    }

    function translateAuditAction(actionType) {
        const map = {
            license_extend_days: 'تمديد اشتراك',
            license_set_expiry: 'تعديل تاريخ الانتهاء',
            license_lifetime: 'تفعيل ترخيص دائم',
            license_suspend: 'إيقاف حساب',
            license_resume: 'إعادة تفعيل حساب',
            license_reset_machine: 'فك ربط جهاز',
            license_bind_machine: 'إعادة ربط جهاز',
            license_update_notes: 'تحديث ملاحظات',
            update_features: 'تعديل الميزات المخصصة',
            update_company_name: 'تعديل اسم الشركة',
            download_client_backup: 'تحميل نسخة احتياطية سحابية',
            remote_set_notice: 'إرسال رسالة خاصة لعميل',
            remote_clear_notice: 'إزالة رسالة خاصة لعميل',
            remote_force_backup: 'أمر نسخة احتياطية فورية عن بُعد',
            remote_reset_desktop_password: 'تغيير كلمة سر الديسكتوب للعميل',
            update_global_config: 'تحديث الإعدادات العامة'
        };
        return map[actionType] || actionType || 'إجراء إداري';
    }

    function formatAuditDetailsArabic(actionType, details) {
        const d = (details && typeof details === 'object') ? details : {};
        if (actionType === 'update_features') {
            const count = Number(d.enabled_count ?? (Array.isArray(d.enabled_keys) ? d.enabled_keys.length : 0));
            return `تم تحديث الميزات — المفعّل حالياً: <strong>${count}</strong> من ${FEATURE_CATALOG.length} ميزة`;
        }
        if (actionType === 'license_extend_days') {
            return `تم تمديد الاشتراك لمدة <strong>${escapeHtml(d.days || 30)} يوم</strong>`;
        }
        if (actionType === 'license_lifetime') {
            return 'تم تحويل الاشتراك إلى ترخيص دائم بدون تاريخ انتهاء';
        }
        if (actionType === 'license_suspend') {
            return 'تم إيقاف اشتراك العميل مؤقتاً';
        }
        if (actionType === 'license_resume') {
            return 'تم إعادة تفعيل اشتراك العميل';
        }
        if (actionType === 'license_reset_machine') {
            return 'تم فك ربط الجهاز — الحساب جاهز للنقل لجهاز جديد';
        }
        if (actionType === 'license_bind_machine') {
            return `تم إعادة ربط الحساب بالجهاز: <code style="direction:ltr;display:inline-block;">${escapeHtml(d.machine_id || '—')}</code>`;
        }
        if (actionType === 'update_company_name') {
            return `الاسم الجديد للشركة: <strong>${escapeHtml(d.new_name || '—')}</strong>`;
        }
        if (actionType === 'download_client_backup') {
            const fileName = String(d.path || '').split('/').pop() || 'نسخة احتياطية';
            return `تم تحميل ملف النسخة: <code style="direction:ltr;display:inline-block;">${escapeHtml(fileName)}</code>`;
        }
        if (actionType === 'update_global_config') {
            const ver = d.min_supported_version ? `أقل إصدار: v${escapeHtml(d.min_supported_version)}` : '';
            const tg = d.telegram_alerts_enabled === true ? 'تليجرام: مفعّل' : d.telegram_alerts_enabled === false ? 'تليجرام: موقوف' : '';
            return [ver, tg].filter(Boolean).join(' • ') || 'تم تحديث الإعدادات العامة للنظام';
        }
        if (actionType === 'remote_set_notice') {
            return `رسالة خاصة للعميل: «${escapeHtml(d.custom_notice || '')}»`;
        }
        if (actionType === 'remote_clear_notice') {
            return 'تم مسح الرسالة الخاصة للعميل';
        }
        if (actionType === 'remote_force_backup') {
            return 'تم إرسال أمر أخذ نسخة احتياطية سحابية فورية لجهاز العميل';
        }
        if (actionType === 'remote_reset_desktop_password') {
            return 'تم إرسال أمر تعيين كلمة سر جديدة لبرنامج الديسكتوب';
        }
        return 'تم تنفيذ الإجراء بنجاح';
    }

    function renderPaginationBar(containerId, page, totalPages, total, onPageChange) {
        const bar = $(containerId);
        if (!bar) return;
        bar.innerHTML = `
            <span style="font-size:0.82rem;color:#94a3b8;">صفحة <strong style="color:#f8fafc;">${page}</strong> من <strong style="color:#f8fafc;">${totalPages}</strong> (الإجمالي: ${total})</span>
            <div style="display:flex;gap:8px;">
                <button type="button" class="btn btn-ghost btn-xs" data-pg-prev="1" ${page <= 1 ? 'disabled style="opacity:0.45;"' : ''}>
                    <i class="fas fa-chevron-right"></i> السابق
                </button>
                <button type="button" class="btn btn-ghost btn-xs" data-pg-next="1" ${page >= totalPages ? 'disabled style="opacity:0.45;"' : ''}>
                    التالي <i class="fas fa-chevron-left"></i>
                </button>
            </div>
        `;
        bar.querySelector('[data-pg-prev]')?.addEventListener('click', () => {
            if (page > 1) onPageChange(page - 1);
        });
        bar.querySelector('[data-pg-next]')?.addEventListener('click', () => {
            if (page < totalPages) onPageChange(page + 1);
        });
    }

    async function loadAuditLogs(page = state.auditPage || 1) {
        const tbody = $('auditTableBody');
        if (!tbody) return;
        state.auditPage = Math.max(1, Number(page) || 1);
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">جاري تحميل سجل نشاط الإدارة...</td></tr>`;
        try {
            const data = await callAdminApi('get_audit_logs', { page: state.auditPage, per_page: 15 });
            const logs = data.logs || [];
            state.auditTotal = Number(data.total || logs.length);
            state.auditTotalPages = Math.max(1, Number(data.total_pages || 1));
            renderPaginationBar('auditPaginationBar', state.auditPage, state.auditTotalPages, state.auditTotal, (nextPg) => loadAuditLogs(nextPg));
            if (!logs.length) {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">لا توجد حركات مسجلة بعد.</td></tr>`;
                return;
            }
            tbody.innerHTML = logs.map((l) => `
                <tr>
                    <td style="white-space:nowrap;">
                        <div style="font-weight:600;color:#e2e8f0;">${formatRelativeTime(l.created_at)}</div>
                        <div style="font-size:0.73rem;color:#94a3b8;direction:ltr;text-align:right;">${formatExactDateTime(l.created_at)}</div>
                    </td>
                    <td style="direction:ltr;text-align:right;font-size:0.8rem;color:#38bdf8;">${escapeHtml(l.admin_email)}</td>
                    <td><span class="badge badge-active">${escapeHtml(translateAuditAction(l.action_type))}</span></td>
                    <td><strong>${escapeHtml(l.target_company_name || 'إعدادات عامة')}</strong></td>
                    <td style="font-size:0.82rem;color:#e2e8f0;line-height:1.5;max-width:440px;white-space:normal;">${formatAuditDetailsArabic(l.action_type, l.details)}</td>
                </tr>
            `).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    async function loadErrorLogs(page = state.errorsPage || 1) {
        const tbody = $('errorsTableBody');
        state.errorsPage = Math.max(1, Number(page) || 1);
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">جاري تحميل سجل الأخطاء...</td></tr>`;
        try {
            const data = await callAdminApi('get_error_logs', { page: state.errorsPage, per_page: 15 });
            state.errorLogs = data.logs || [];
            state.errorsLoaded = true;
            state.errorsTotal = Number(data.total || state.errorLogs.length);
            state.errorsTotalPages = Math.max(1, Number(data.total_pages || 1));
            renderPaginationBar('errorsPaginationBar', state.errorsPage, state.errorsTotalPages, state.errorsTotal, (nextPg) => loadErrorLogs(nextPg));
            if (!state.errorLogs.length) {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">لا توجد أخطاء مسجلة — النظام يعمل بسلاسة.</td></tr>`;
                return;
            }
            tbody.innerHTML = state.errorLogs.map((log) => {
                const diag = diagnoseClientError(log.error_message);
                const moduleLabel = translateModuleLabel(log.module);
                return `
                    <tr>
                        <td style="white-space:nowrap;">${formatRelativeTime(log.created_at)}</td>
                        <td><strong>${escapeHtml(log.company_name || '—')}</strong></td>
                        <td>v${escapeHtml(log.desktop_version || '—')}</td>
                        <td><span class="badge badge-trial" title="${escapeHtml(log.module || 'sync')}">${escapeHtml(moduleLabel)}</span></td>
                        <td style="max-width:520px;word-break:break-word;">
                            <div style="font-weight:800;color:#fca5a5;font-size:0.9rem;margin-bottom:4px;">
                                <i class="fas fa-circle-exclamation"></i> ${escapeHtml(diag.title)}
                            </div>
                            <div style="font-size:0.8rem;color:#cbd5e1;line-height:1.5;margin-bottom:4px;">
                                <strong style="color:#fbbf24;">السبب:</strong> ${escapeHtml(diag.reason)}
                            </div>
                            <div style="font-size:0.8rem;color:#93c5fd;line-height:1.5;margin-bottom:4px;">
                                <strong style="color:#38bdf8;"><i class="fas fa-desktop"></i> ما يراه العميل:</strong> ${escapeHtml(diag.clientImpact)}
                            </div>
                            <div style="font-size:0.8rem;color:#86efac;line-height:1.5;margin-bottom:6px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:6px 9px;">
                                <strong style="color:#4ade80;"><i class="fas fa-lightbulb"></i> الحل المقترح:</strong> ${escapeHtml(diag.solution)}
                            </div>
                            <div style="font-family:Consolas,monospace;font-size:0.72rem;color:#64748b;direction:ltr;text-align:left;background:rgba(15,23,42,0.55);padding:4px 8px;border-radius:6px;">
                                ${escapeHtml(log.error_message || '')}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    function bindEvents() {
        $('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = $('loginEmail').value.trim();
            const password = $('loginPassword').value;
            const btn = $('loginBtn');
            const errEl = $('loginError');
            errEl.style.display = 'none';
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';

            try {
                const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                    method: 'POST',
                    headers: {
                        apikey: SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (!res.ok || !data.access_token) {
                    throw new Error(data.error_description || data.msg || 'بيانات الدخول غير صحيحة.');
                }
                state.accessToken = data.access_token;
                state.refreshToken = data.refresh_token || '';
                state.adminEmail = data.user?.email || email;
                saveSession();
                await loadOverview();
            } catch (err) {
                clearSession();
                errEl.textContent = err.message || 'تعذر تسجيل الدخول.';
                errEl.style.display = 'block';
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>تسجيل الدخول</span>';
            }
        });

        $('logoutBtn').addEventListener('click', () => {
            clearSession();
            showLoginScreen();
        });

        $('accountSettingsBtn').addEventListener('click', openAccountSettingsModal);

        $('forgotPasswordBtn').addEventListener('click', async () => {
            const email = $('loginEmail').value.trim();
            const errEl = $('loginError');
            if (!email || !email.includes('@')) {
                errEl.textContent = 'اكتب بريدك الإلكتروني أولاً في خانة البريد بالأعلى ثم اضغط نسيت كلمة المرور.';
                errEl.style.display = 'block';
                $('loginEmail').focus();
                return;
            }
            const btn = $('forgotPasswordBtn');
            btn.disabled = true;
            try {
                const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
                    method: 'POST',
                    headers: {
                        apikey: SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.msg || errData.error_description || 'تعذر إرسال رابط الاستعادة.');
                }
                showToast('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني!', 'success');
                errEl.style.display = 'none';
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });

        $('globalConfigForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = $('saveGlobalConfigBtn');
            btn.disabled = true;
            try {
                await callAdminApi('update_global_config', {
                    min_supported_version: $('cfgMinVersion').value.trim() || '10.0.0',
                    force_update_message: $('cfgForceUpdateMsg').value.trim(),
                    support_whatsapp: $('cfgSupportWhatsapp').value.trim(),
                    telegram_bot_token: $('cfgTelegramBotToken') ? $('cfgTelegramBotToken').value.trim() : '',
                    telegram_chat_id: $('cfgTelegramChatId') ? $('cfgTelegramChatId').value.trim() : '',
                    telegram_alerts_enabled: $('cfgTelegramEnabled') ? Boolean($('cfgTelegramEnabled').checked) : false,
                    announcement_message: $('cfgAnnouncementMsg') ? $('cfgAnnouncementMsg').value.trim() : '',
                    announcement_active: $('cfgAnnouncementActive') ? Boolean($('cfgAnnouncementActive').checked) : false
                });
                showToast('تم حفظ الإعدادات العامة بنجاح! ستُطبق على جميع العملاء تلقائياً.', 'success');
                await loadOverview();
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });

        $('detectTelegramChatBtn')?.addEventListener('click', async () => {
            const btn = $('detectTelegramChatBtn');
            btn.disabled = true;
            try {
                const res = await callAdminApi('detect_telegram_chat_id', {
                    telegram_bot_token: $('cfgTelegramBotToken')?.value.trim() || ''
                });
                if ($('cfgTelegramChatId')) $('cfgTelegramChatId').value = res.chat_id || '';
                showToast(`تم جلب Chat ID بنجاح (${res.chat_id}) — اضغط حفظ الإعدادات`, 'success');
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });

        $('testTelegramBtn')?.addEventListener('click', async () => {
            const btn = $('testTelegramBtn');
            btn.disabled = true;
            try {
                await callAdminApi('test_telegram_alert', {
                    telegram_bot_token: $('cfgTelegramBotToken')?.value.trim() || '',
                    telegram_chat_id: $('cfgTelegramChatId')?.value.trim() || ''
                });
                showToast('تم إرسال رسالة الاختبار إلى تليجرام بنجاح!', 'success');
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });

        $('sendExpiringSummaryBtn')?.addEventListener('click', async () => {
            const btn = $('sendExpiringSummaryBtn');
            btn.disabled = true;
            try {
                const res = await callAdminApi('send_expiring_summary');
                showToast(`تم إرسال تقرير الاشتراكات لتليجرام (${res.count || 0} اشتراك قريب من الانتهاء)`, 'success');
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });

        $('refreshAuditBtn')?.addEventListener('click', () => loadAuditLogs());

        $('refreshAllBtn').addEventListener('click', () => {
            loadOverview();
            if (state.errorsLoaded) loadErrorLogs();
        });

        $('refreshErrorsBtn').addEventListener('click', () => loadErrorLogs());
        $('modalCloseBtn').addEventListener('click', closeModal);
        $('modalBackdrop').addEventListener('click', (e) => {
            if (e.target === $('modalBackdrop')) closeModal();
        });

        document.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
                $('tabClients').classList.toggle('active', tab === 'clients');
                $('tabErrors').classList.toggle('active', tab === 'errors');
                $('tabAudit')?.classList.toggle('active', tab === 'audit');
                $('tabGlobalConfig').classList.toggle('active', tab === 'globalConfig');
                if (tab === 'errors' && !state.errorsLoaded) {
                    loadErrorLogs();
                }
                if (tab === 'audit') {
                    loadAuditLogs();
                }
            });
        });

        $('clientSearchInput').addEventListener('input', (e) => {
            state.search = e.target.value || '';
            renderClientsTable();
        });

        $('statusFilterPills').addEventListener('click', (e) => {
            const pill = e.target.closest('.pill');
            if (!pill) return;
            state.statusFilter = pill.getAttribute('data-filter') || 'all';
            document.querySelectorAll('#statusFilterPills .pill').forEach((p) => p.classList.toggle('active', p === pill));
            renderClientsTable();
        });

        $('clientsTableBody').addEventListener('change', async (e) => {
            const toggle = e.target.closest('[data-feature-toggle="1"]');
            if (!toggle) return;
            const licenseId = toggle.getAttribute('data-license-id');
            const featureKey = toggle.getAttribute('data-feature-key');
            const client = findClient(licenseId);
            if (!client) return;

            const updatedFeatures = { ...(client.features || {}), [featureKey]: Boolean(toggle.checked) };
            toggle.disabled = true;
            try {
                await callAdminApi('update_features', { license_id: licenseId, features: updatedFeatures });
                client.features = updatedFeatures;
                showToast(`تم ${toggle.checked ? 'تفعيل' : 'إيقاف'} الميزة بنجاح`, 'success');
            } catch (err) {
                toggle.checked = !toggle.checked;
                showToast(err.message, 'error');
            } finally {
                toggle.disabled = false;
            }
        });

        $('clientsTableBody').addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const client = findClient(btn.getAttribute('data-license-id'));
            if (!client) return;

            if (action === 'edit-name') {
                openEditNameModal(client);
            } else if (action === 'manage-features') {
                openFeaturesModal(client);
            } else if (action === 'manage-license') {
                openLicenseModal(client);
            } else if (action === 'android-users') {
                openAndroidUsersModal(client);
            } else if (action === 'activation-code') {
                openActivationCodeModal(client);
            } else if (action === 'client-backups') {
                openClientBackupsModal(client);
            } else if (action === 'remote-command') {
                openModal(`تحكم عن بُعد — ${client.company_name}`, `
                    <div style="display:flex;flex-direction:column;gap:14px;">
                        <div class="field">
                            <label for="remoteCustomNoticeInput">رسالة تنبيه خاصة تظهر لهذا العميل فقط داخل برنامجه</label>
                            <textarea id="remoteCustomNoticeInput" rows="3" placeholder="اكتب رسالة خاصة للعميل (اتركها فارغة لإلغاء الرسالة)...">${escapeHtml(client.custom_notice || '')}</textarea>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button type="button" id="saveCustomNoticeBtn" class="btn btn-primary" style="flex:1;">
                                <i class="fas fa-paper-plane"></i> حفظ وإرسال الرسالة
                            </button>
                            <button type="button" id="clearCustomNoticeBtn" class="btn btn-ghost">
                                مسح الرسالة
                            </button>
                        </div>
                        <hr style="border-color:var(--border);margin:4px 0;">
                        <div style="background:rgba(15,23,42,0.7);border:1px solid rgba(56,189,248,0.3);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;">
                            <strong style="color:#38bdf8;font-size:0.88rem;"><i class="fas fa-cloud-arrow-up"></i> أمر أخذ نسخة احتياطية سحابية فورية</strong>
                            <div style="font-size:0.78rem;color:#94a3b8;">سيتم إرسال أمر لجهاز العميل لرفع نسخة احتياطية سحابية تلقائياً فور اتصاله القادم.</div>
                            <button type="button" id="sendForceBackupBtn" class="btn btn-success btn-block">
                                <i class="fas fa-bolt"></i> إرسال أمر النسخ الاحتياطي الآن
                            </button>
                        </div>
                        <hr style="border-color:var(--border);margin:4px 0;">
                        <div class="field" style="background:rgba(15,23,42,0.7);border:1px solid rgba(245,158,11,0.35);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;">
                            <strong style="color:#fbbf24;font-size:0.88rem;"><i class="fas fa-key"></i> تغيير كلمة سر الديسكتوب للعميل (عند النسيان)</strong>
                            <input type="text" id="remoteDesktopNewPassInput" placeholder="أدخل كلمة السر الجديدة للعميل (4 أحرف على الأقل)..." dir="ltr" style="background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:9px;padding:9px 12px;color:#f8fafc;">
                            <button type="button" id="sendResetDesktopPassBtn" class="btn btn-primary btn-block">
                                <i class="fas fa-unlock-keyhole"></i> إرسال كلمة السر الجديدة للجهاز
                            </button>
                        </div>
                    </div>
                `);
                $('saveCustomNoticeBtn').addEventListener('click', async () => {
                    const txt = $('remoteCustomNoticeInput').value.trim();
                    try {
                        await callAdminApi('send_client_command', {
                            license_id: client.id,
                            command_type: txt ? 'set_notice' : 'clear_notice',
                            custom_notice: txt
                        });
                        closeModal();
                        showToast(txt ? 'تم إرسال الرسالة الخاصة للعميل بنجاح' : 'تم مسح الرسالة الخاصة', 'success');
                        await loadOverview();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                });
                $('clearCustomNoticeBtn').addEventListener('click', async () => {
                    try {
                        await callAdminApi('send_client_command', { license_id: client.id, command_type: 'clear_notice' });
                        closeModal();
                        showToast('تم مسح الرسالة الخاصة للعميل', 'success');
                        await loadOverview();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                });
                $('sendForceBackupBtn').addEventListener('click', async () => {
                    try {
                        await callAdminApi('send_client_command', { license_id: client.id, command_type: 'force_backup' });
                        closeModal();
                        showToast('تم إرسال أمر النسخ الاحتياطي السحابي عن بُعد بنجاح!', 'success');
                        await loadOverview();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                });
                $('sendResetDesktopPassBtn').addEventListener('click', async () => {
                    const newPass = ($('remoteDesktopNewPassInput')?.value || '').trim();
                    if (newPass.length < 4) {
                        showToast('يرجى إدخال كلمة سر من 4 أحرف على الأقل.', 'error');
                        return;
                    }
                    try {
                        await callAdminApi('send_client_command', {
                            license_id: client.id,
                            command_type: 'reset_desktop_password',
                            new_password: newPass
                        });
                        closeModal();
                        showToast('تم إرسال أمر تغيير كلمة سر الديسكتوب بنجاح!', 'success');
                        await loadOverview();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                });
            } else if (action === 'toggle-suspend') {
                const isSuspended = client.computed_status === 'suspended';
                openConfirmModal({
                    title: isSuspended ? 'تأكيد إعادة التفعيل' : 'تأكيد إيقاف الحساب',
                    message: isSuspended
                        ? `هل تريد إعادة تفعيل حساب (${client.company_name})؟`
                        : `هل أنت متأكد من إيقاف حساب (${client.company_name}) مؤقتاً؟`,
                    details: isSuspended
                        ? 'سيتمكن العميل من استخدام البرنامج فور إعادة التفعيل.'
                        : 'سيتوقف البرنامج لدى العميل عن العمل لحين إعادة تفعيله من لوحة الإدارة.',
                    confirmText: isSuspended ? 'إعادة التفعيل' : 'إيقاف الحساب',
                    confirmClass: isSuspended ? 'btn-success' : 'btn-danger',
                    icon: isSuspended ? 'fa-play' : 'fa-ban',
                    onConfirm: async () => {
                        await callAdminApi('update_license', {
                            license_id: client.id,
                            mode: isSuspended ? 'resume' : 'suspend'
                        });
                        showToast(isSuspended ? 'تم إعادة تفعيل العميل' : 'تم إيقاف العميل مؤقتاً', 'success');
                        await loadOverview();
                    }
                });
            } else if (action === 'reset-machine') {
                const boundId = String(client.bound_machine_id || '').trim();
                if (!boundId) {
                    showToast('هذا الحساب غير مربوط بجهاز حالياً وجاهز للنقل.', 'info');
                    return;
                }
                openConfirmModal({
                    title: 'تأكيد فك ربط الجهاز',
                    message: `هل تريد فك ربط الجهاز لـ (${client.company_name}) حتى يتمكن من تشغيل البرنامج على جهاز جديد؟`,
                    details: `الجهاز المربوط حالياً: ${boundId} — بعد التأكيد سيتحول الحساب إلى "غير مربوط" وسيرتبط تلقائياً بأول جهاز جديد يفتح عليه العميل.`,
                    confirmText: 'تأكيد فك الجهاز',
                    confirmClass: 'btn-primary',
                    icon: 'fa-unlink',
                    onConfirm: async () => {
                        await callAdminApi('update_license', { license_id: client.id, mode: 'reset_machine' });
                        showToast('تم فك ربط الجهاز بنجاح — الحساب جاهز الآن للنقل لجهاز جديد', 'success');
                        await loadOverview();
                    }
                });
            } else if (action === 'bind-machine') {
                const targetId = String(client.last_seen_machine_id || client.machine_id || '').trim();
                if (!targetId) {
                    showToast('لا يوجد رقم جهاز سابق لإعادة الربط به.', 'error');
                    return;
                }
                openConfirmModal({
                    title: 'تأكيد إعادة ربط الجهاز',
                    message: `هل تريد إعادة ربط حساب (${client.company_name}) بآخر جهاز مسجل؟`,
                    details: `الجهاز المستهدف: ${targetId} — لن يتمكن أي جهاز آخر من فتح الحساب بعد إعادة الربط.`,
                    confirmText: 'تأكيد إعادة الربط',
                    confirmClass: 'btn-success',
                    icon: 'fa-link',
                    onConfirm: async () => {
                        await callAdminApi('update_license', {
                            license_id: client.id,
                            mode: 'bind_machine',
                            machine_id: targetId
                        });
                        showToast('تم إعادة ربط الجهاز بنجاح', 'success');
                        await loadOverview();
                    }
                });
            }
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bindEvents();
        ['cfgMinVersion', 'cfgForceUpdateMsg', 'cfgSupportWhatsapp'].forEach((id) => {
            $(id)?.addEventListener('input', updateGlobalConfigPreview);
        });
        setInterval(() => {
            if (state.clients.length) {
                renderClientsTable();
            }
        }, 30000);
        if (loadSavedSession()) {
            await loadOverview();
        } else {
            showLoginScreen();
        }
    });
})();
