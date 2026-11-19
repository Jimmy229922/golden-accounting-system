(function () {
    const SUPABASE_URL = 'https://ryoqhtsdhfbydmejmaby.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b3FodHNkaGZieWRtZWptYWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3Mjk2MzMsImV4cCI6MjEwNzMwNTYzM30.y0tjIyjZZlII6ge9xkFpzqhF5sZjSngpp4XOoVrrTs4';
    const SESSION_STORAGE_KEY = 'golden_admin_panel_session';

    const FEATURE_CATALOG = [
        { key: 'external_work', label: 'شغل خارجي', desc: 'إظهار قسم المشتريات والمبيعات الخارجية في الهيدر.' },
        { key: 'treasury_attachments', label: 'مرفقات السداد والتحصيل', desc: 'رفع صور مضغوطة وملفات PDF لسندات السداد والتحصيل مع شاشة المعاينة.' },
        { key: 'cloud_backup', label: 'النسخ الاحتياطي السحابي', desc: 'تفعيل الرفع والاستعادة من السحابة مع بقاء النسخ المحلي متاحاً دائماً.' },
        { key: 'flex_full_layout', label: 'تمدد المساحات المرن (Flex)', desc: 'نظام الأب والابن المرن لتمدد الصفحات ولوحة التحكم بالكامل.' }
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
        errorLogs: []
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
            const machineId = c.bound_machine_id || c.last_seen_machine_id || c.machine_id || '—';
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
                        <div style="font-family:Consolas,monospace;font-size:0.84rem;direction:ltr;display:inline-block;">${escapeHtml(machineId)}</div>
                        <div style="color:#94a3b8;font-size:0.78rem;margin-top:4px;">الإصدار: <strong>v${escapeHtml(c.desktop_version || '—')}</strong></div>
                    </td>
                    <td>
                        <div>
                            <span class="online-dot ${isOnline ? 'on' : 'off'}"></span>
                            <span>${formatRelativeTime(c.last_heartbeat_at)}</span>
                        </div>
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
                            <button type="button" class="btn btn-ghost btn-xs" data-action="reset-machine" data-license-id="${escapeHtml(c.id)}" title="فك ربط الجهاز (لنقل البرنامج لجهاز جديد)">
                                <i class="fas fa-unlink"></i> فك جهاز
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function findClient(licenseId) {
        return state.clients.find((c) => String(c.id) === String(licenseId));
    }

    function populateGlobalConfigForm() {
        const cfg = state.globalConfig || {};
        if ($('cfgMinVersion')) $('cfgMinVersion').value = cfg.min_supported_version || '10.0.0';
        if ($('cfgForceUpdateMsg')) $('cfgForceUpdateMsg').value = cfg.force_update_message || '';
        if ($('cfgSupportWhatsapp')) $('cfgSupportWhatsapp').value = cfg.support_whatsapp || '';
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
                !q || f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q) || (f.desc || '').toLowerCase().includes(q)
            );
            const listEl = $('featuresModalList');
            if (!listEl) return;
            if (!filtered.length) {
                listEl.innerHTML = `<div style="text-align:center;color:var(--text-secondary);padding:16px;">لا توجد ميزات مطابقة للبحث.</div>`;
                return;
            }
            listEl.innerHTML = filtered.map((feat) => {
                const checked = features[feat.key] ? 'checked' : '';
                return `
                    <div class="user-item-card" style="align-items:center;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:700;font-size:0.92rem;color:#f8fafc;">${escapeHtml(feat.label)}</div>
                            <div style="font-size:0.78rem;color:#94a3b8;margin-top:3px;">${escapeHtml(feat.desc || '')}</div>
                            <div style="font-family:Consolas,monospace;font-size:0.72rem;color:#64748b;margin-top:2px;direction:ltr;text-align:right;">${escapeHtml(feat.key)}</div>
                        </div>
                        <label class="switch">
                            <input type="checkbox" data-modal-feature-key="${escapeHtml(feat.key)}" ${checked}>
                            <span class="slider"></span>
                        </label>
                    </div>
                `;
            }).join('');
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
                    if (!window.confirm(`هل أنت متأكد من حذف حساب الأندرويد (${email}) نهائياً؟`)) return;
                    try {
                        await callAdminApi('delete_android_user', { user_id: uid });
                        showToast('تم حذف الحساب بنجاح', 'success');
                        closeModal();
                        await loadOverview();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
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

    async function loadErrorLogs() {
        const tbody = $('errorsTableBody');
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">جاري تحميل سجل الأخطاء...</td></tr>`;
        try {
            const data = await callAdminApi('get_error_logs');
            state.errorLogs = data.logs || [];
            state.errorsLoaded = true;
            if (!state.errorLogs.length) {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">لا توجد أخطاء مسجلة — النظام يعمل بسلاسة.</td></tr>`;
                return;
            }
            tbody.innerHTML = state.errorLogs.map((log) => `
                <tr>
                    <td style="white-space:nowrap;">${formatRelativeTime(log.created_at)}</td>
                    <td><strong>${escapeHtml(log.company_name || '—')}</strong></td>
                    <td>v${escapeHtml(log.desktop_version || '—')}</td>
                    <td><span class="badge badge-trial">${escapeHtml(log.module || 'sync')}</span></td>
                    <td style="color:#fca5a5;max-width:460px;word-break:break-word;">${escapeHtml(log.error_message)}</td>
                </tr>
            `).join('');
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
                    support_whatsapp: $('cfgSupportWhatsapp').value.trim()
                });
                showToast('تم حفظ الإعدادات العامة بنجاح! ستُطبق على جميع العملاء تلقائياً.', 'success');
                await loadOverview();
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });

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
                $('tabGlobalConfig').classList.toggle('active', tab === 'globalConfig');
                if (tab === 'errors' && !state.errorsLoaded) {
                    loadErrorLogs();
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
            } else if (action === 'toggle-suspend') {
                const isSuspended = client.computed_status === 'suspended';
                const confirmMsg = isSuspended
                    ? `هل تريد إعادة تفعيل حساب (${client.company_name})؟`
                    : `هل أنت متأكد من إيقاف حساب (${client.company_name}) مؤقتاً؟`;
                if (!window.confirm(confirmMsg)) return;
                try {
                    await callAdminApi('update_license', {
                        license_id: client.id,
                        mode: isSuspended ? 'resume' : 'suspend'
                    });
                    showToast(isSuspended ? 'تم إعادة تفعيل العميل' : 'تم إيقاف العميل مؤقتاً', 'success');
                    await loadOverview();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            } else if (action === 'reset-machine') {
                if (!window.confirm(`هل تريد فك ربط الجهاز لـ (${client.company_name}) حتى يتمكن من تشغيل البرنامج على جهاز جديد؟`)) return;
                try {
                    await callAdminApi('update_license', { license_id: client.id, mode: 'reset_machine' });
                    showToast('تم فك ربط الجهاز بنجاح', 'success');
                    await loadOverview();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bindEvents();
        if (loadSavedSession()) {
            await loadOverview();
        } else {
            showLoginScreen();
        }
    });
})();
