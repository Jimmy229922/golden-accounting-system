let companyNameInput, companyAddressInput, companyPhoneInput, invoiceFooterInput, settingsForm;
let backupBtn, restoreBtn, updateBtn, backupStatusEl, restoreStatusEl, updateStatusEl, themeToggleBtn;
let updateProgressWrapEl, updateProgressBarEl, updateProgressMetaEl;
let profileImageInput, profileImagePreview, removeImageBtn, saveBtn;
let changeLogLastModifiedEl, changeLogModifiedByEl, changeLogSummaryEl, appVersionValueEl;
let saveStateTimer = null;
let unsubscribeAppUpdateProgress = null;
let appUpdateProgressPollTimer = null;
let isAppUpdateDownloadRunning = false;
let initialFormSnapshot = '';
const SETTINGS_TRACKING_FIELDS = [
    { key: 'companyName', label: 'اسم المؤسسة' },
    { key: 'companyPhone', label: 'رقم الهاتف' },
    { key: 'companyAddress', label: 'العنوان' },
    { key: 'invoiceFooter', label: 'ملاحظة الفاتورة' },
    { key: 'profileImage', label: 'الشعار' }
];
let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }
    renderPage();
    initializeElements();
    await loadSettings();
    await loadAppVersion();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildTopNavHTML()}

        <main class="content">
            <!-- Page Hero -->
            <div class="page-hero">
                <div class="page-hero-right">
                    <div class="page-hero-icon"><i class="fas fa-cog"></i></div>
                    <div>
                        <h1>${t('settings.title', 'إعدادات النظام')}</h1>
                        <p>${t('settings.subtitle', 'إدارة بيانات المؤسسة والنسخ الاحتياطي ومظهر النظام')}</p>
                    </div>
                </div>
            </div>

            <!-- Company Information Section -->
            <div class="settings-card">
                <div class="section-header">
                    <div class="section-header-icon company"><i class="fas fa-building"></i></div>
                    <h2>${t('settings.companySection', 'بيانات المؤسسة')}<span>${t('settings.companySectionDesc', 'معلومات الشركة التي تظهر في الفواتير والتقارير')}</span></h2>
                </div>
                <form id="settingsForm">
                    <div class="settings-sections">
                        <section class="settings-subsection subsection-company">
                            <h3 class="subsection-title">
                                <span class="subsection-title-main"><i class="fas fa-building"></i> بيانات المؤسسة</span>
                                <span class="subsection-title-sub">الاسم ورقم الهاتف المعتمدان في الفواتير والتقارير.</span>
                            </h3>
                            <div class="subsection-grid">
                                <div class="form-group">
                                    <label><i class="fas fa-building"></i> اسم المؤسسة</label>
                                    <input type="text" id="companyName" class="form-control" placeholder="مثال: مؤسسة النور التجارية">
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-phone"></i> رقم الهاتف</label>
                                    <input type="text" id="companyPhone" class="form-control" placeholder="مثال: 01012345678">
                                </div>
                            </div>
                        </section>

                        <section class="settings-subsection subsection-logo">
                            <h3 class="subsection-title">
                                <span class="subsection-title-main"><i class="fas fa-image"></i> الشعار</span>
                                <span class="subsection-title-sub">الصورة الرسمية التي تظهر في المستندات المطبوعة.</span>
                            </h3>
                            <div class="form-group">
                                <label><i class="fas fa-image"></i> صورة الشعار</label>
                                <div class="profile-image-section">
                                    <div class="profile-image-preview" id="profileImagePreview">
                                        <i class="fas fa-user-circle profile-placeholder-icon"></i>
                                    </div>
                                    <div class="profile-image-actions">
                                        <label class="btn-upload" for="profileImageInput">
                                            <i class="fas fa-upload"></i> ${t('settings.uploadImage', 'اختر صورة')}
                                        </label>
                                        <span class="btn-upload-meta">الصيغ المسموحة: PNG / JPG / WEBP - حتى 2MB</span>
                                        <input type="file" id="profileImageInput" accept="image/png,image/jpeg,image/webp" style="display:none;">
                                        <button type="button" id="removeImageBtn" class="btn-remove-image" style="display:none;">
                                            <i class="fas fa-trash"></i> ${t('settings.removeImage', 'إزالة الصورة')}
                                        </button>
                                        <span class="profile-image-hint">${t('settings.profileImageDesc', 'صورة تظهر في التقارير وملفات PDF')}</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section class="settings-subsection subsection-address">
                            <h3 class="subsection-title">
                                <span class="subsection-title-main"><i class="fas fa-map-marker-alt"></i> العنوان</span>
                                <span class="subsection-title-sub">العنوان الذي يظهر في رأس الفاتورة والتقارير.</span>
                            </h3>
                            <div class="form-group">
                                <label><i class="fas fa-map-marker-alt"></i> العنوان</label>
                                <input type="text" id="companyAddress" class="form-control" placeholder="مثال: القاهرة - مدينة نصر">
                            </div>
                        </section>

                        <section class="settings-subsection subsection-footer">
                            <h3 class="subsection-title">
                                <span class="subsection-title-main"><i class="fas fa-file-alt"></i> ملاحظات الفاتورة</span>
                                <span class="subsection-title-sub">نص مختصر يظهر أسفل جميع فواتير الطباعة.</span>
                            </h3>
                            <div class="form-group">
                                <label><i class="fas fa-file-alt"></i> ملاحظة الفاتورة</label>
                                <textarea id="invoiceFooter" class="form-control" rows="3" placeholder="مثال: شكرا لتعاملكم معنا"></textarea>
                            </div>
                        </section>
                    </div>
                    <div class="settings-save-bar">
                        <button type="submit" class="btn-save" data-save-state="idle">
                            <i class="fas fa-save"></i>
                            <span class="btn-save-text">${t('settings.saveSettings', 'حفظ الإعدادات')}</span>
                        </button>
                    </div>
                </form>
            </div>

            <div class="settings-card audit-card">
                <div class="section-header">
                    <div class="section-header-icon audit"><i class="fas fa-history"></i></div>
                    <h2>سجل التغييرات<span>آخر تعديل، من عدل، وماذا تم تغييره.</span></h2>
                </div>
                <div class="change-log-grid">
                    <div class="change-log-row">
                        <div class="change-log-label">آخر تعديل</div>
                        <div class="change-log-value" id="settingsAuditLastModified">لا يوجد تعديل مسجل بعد</div>
                    </div>
                    <div class="change-log-row">
                        <div class="change-log-label">من عدّل</div>
                        <div class="change-log-value" id="settingsAuditModifiedBy">-</div>
                    </div>
                    <div class="change-log-row">
                        <div class="change-log-label">ماذا تم تغييره</div>
                        <div class="change-log-value" id="settingsAuditSummary">-</div>
                    </div>
                </div>
            </div>

            <!-- Appearance & Backup Section -->
            <div class="settings-card">
                <div class="section-header">
                    <div class="section-header-icon appearance"><i class="fas fa-sliders-h"></i></div>
                    <h2>${t('settings.toolsSection', 'الأدوات والمظهر')}<span>${t('settings.toolsSectionDesc', 'تغيير المظهر والنسخ الاحتياطي واستعادة البيانات')}</span></h2>
                </div>
                <div class="action-cards-grid">
                    <!-- Theme Card -->
                    <div class="action-card theme-card">
                        <div class="action-card-header">
                            <div class="action-card-icon theme"><i class="fas fa-palette"></i></div>
                            <h3>${t('settings.appearanceTitle', 'مظهر النظام')}</h3>
                        </div>
                        <p class="action-card-desc">${t('settings.appearanceDesc', 'تغيير وضع العرض بين المظلم والفاتح من هنا.')}</p>
                        <button id="themeToggleBtn" class="btn-action theme-btn" data-theme-toggle><i class="fas fa-moon"></i> ${t('settings.toggleTheme', 'تبديل المظهر')}</button>
                    </div>
                    <!-- Backup Card -->
                    <div class="action-card backup-card">
                        <div class="action-card-header">
                            <div class="action-card-icon backup"><i class="fas fa-cloud-upload-alt"></i></div>
                            <h3>${t('settings.backupTitle', 'إنشاء نسخة احتياطية')}</h3>
                        </div>
                        <p class="action-card-desc">${t('settings.backupDesc', 'احفظ نسخة احتياطية من بياناتك في أي مكان تختاره على جهازك.')}</p>
                        <button id="backupBtn" class="btn-action backup-btn"><i class="fas fa-download"></i> ${t('settings.backupNow', 'إنشاء نسخة احتياطية الآن')}</button>
                        <small id="backupStatus" class="status-text"></small>
                    </div>
                    <!-- Update Card -->
                    <div class="action-card update-card">
                        <div class="action-card-header">
                            <div class="action-card-icon update"><i class="fas fa-sync-alt"></i></div>
                            <h3>${t('settings.updateTitle', 'تحديث البرنامج')}</h3>
                        </div>
                        <p class="action-card-desc">${t('settings.updateDesc', 'تحقق من آخر إصدار من GitHub Releases ونزل ملف التحديث على جهاز العميل.')}</p>
                        <button id="updateBtn" class="btn-action update-btn"><i class="fas fa-cloud-download-alt"></i> <span class="update-btn-text">${t('settings.updateNow', 'فحص وتنزيل التحديث')}</span></button>
                        <div id="updateProgressWrap" class="update-progress" hidden>
                            <div class="update-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                                <div id="updateProgressBar" class="update-progress-fill"></div>
                            </div>
                            <div id="updateProgressMeta" class="update-progress-meta">0%</div>
                        </div>
                        <small id="updateStatus" class="status-text"></small>
                    </div>
                    <!-- Restore Card -->
                    <div class="action-card restore-card">
                        <div class="action-card-header">
                            <div class="action-card-icon restore"><i class="fas fa-upload"></i></div>
                            <h3>${t('settings.restoreTitle', 'إعادة توجيه البيانات من نسخة')}</h3>
                        </div>
                        <p class="action-card-desc">${t('settings.restoreDesc', 'استبدل قاعدة البيانات الحالية بملف نسخة احتياطية محفوظ لديك، ثم سيعاد تشغيل النظام.')}</p>
                        <button id="restoreBtn" class="btn-action restore-btn"><i class="fas fa-undo-alt"></i> ${t('settings.restoreNow', 'استعادة من نسخة احتياطية')}</button>
                        <small id="restoreStatus" class="status-text"></small>
                    </div>
                </div>
            </div>

            <!-- System Info Section -->
            <div class="settings-card">
                <div class="section-header">
                    <div class="section-header-icon system"><i class="fas fa-info-circle"></i></div>
                    <h2>${t('settings.systemInfoSection', 'معلومات النظام')}<span>${t('settings.systemInfoDesc', 'تفاصيل إصدار التطبيق وحالة قاعدة البيانات')}</span></h2>
                </div>
                <div class="system-info-grid">
                    <div class="info-item">
                        <div class="info-item-icon"><i class="fas fa-code-branch"></i></div>
                        <div>
                            <div class="info-item-label">${t('settings.version', 'إصدار التطبيق')}</div>
                            <div class="info-item-value" id="appVersionValue">-</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-item-icon"><i class="fas fa-check-circle"></i></div>
                        <div>
                            <div class="info-item-label">${t('settings.connectionStatus', 'حالة الاتصال')}</div>
                            <div class="info-item-value" style="color: #10b981;">${t('settings.connected', 'متصل')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    `;
}

function initializeElements() {
    companyNameInput = document.getElementById('companyName');
    companyAddressInput = document.getElementById('companyAddress');
    companyPhoneInput = document.getElementById('companyPhone');
    invoiceFooterInput = document.getElementById('invoiceFooter');
    settingsForm = document.getElementById('settingsForm');
    backupBtn = document.getElementById('backupBtn');
    restoreBtn = document.getElementById('restoreBtn');
    updateBtn = document.getElementById('updateBtn');
    backupStatusEl = document.getElementById('backupStatus');
    restoreStatusEl = document.getElementById('restoreStatus');
    updateStatusEl = document.getElementById('updateStatus');
    updateProgressWrapEl = document.getElementById('updateProgressWrap');
    updateProgressBarEl = document.getElementById('updateProgressBar');
    updateProgressMetaEl = document.getElementById('updateProgressMeta');
    themeToggleBtn = document.getElementById('themeToggleBtn');
    profileImageInput = document.getElementById('profileImageInput');
    profileImagePreview = document.getElementById('profileImagePreview');
    removeImageBtn = document.getElementById('removeImageBtn');
    saveBtn = settingsForm?.querySelector('.btn-save');
    changeLogLastModifiedEl = document.getElementById('settingsAuditLastModified');
    changeLogModifiedByEl = document.getElementById('settingsAuditModifiedBy');
    changeLogSummaryEl = document.getElementById('settingsAuditSummary');
    appVersionValueEl = document.getElementById('appVersionValue');

    settingsForm.addEventListener('submit', saveSettings);
    backupBtn.addEventListener('click', handleBackup);
    restoreBtn.addEventListener('click', handleRestore);
    if (updateBtn) {
        updateBtn.addEventListener('click', handleAppUpdate);
    }
    bindAppUpdateProgress();
    syncAppUpdateProgressState();

    profileImageInput.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', handleImageRemove);

    if (themeToggleBtn && typeof window.bindThemeToggleButtons === 'function') {
        window.bindThemeToggleButtons();
    }

    setSaveButtonState('idle');

    window.addEventListener('beforeunload', () => {
        if (unsubscribeAppUpdateProgress) {
            unsubscribeAppUpdateProgress();
            unsubscribeAppUpdateProgress = null;
        }
        stopAppUpdateProgressPolling();
    });
}

async function loadSettings() {
    const settings = await window.electronAPI.getSettings();
    if (settings) {
        companyNameInput.value = settings.companyName || '';
        companyAddressInput.value = settings.companyAddress || '';
        companyPhoneInput.value = settings.companyPhone || '';
        invoiceFooterInput.value = settings.invoiceFooter || '';
        if (settings.profileImage) {
            showProfileImage(settings.profileImage);
        }
        renderChangeLog({
            lastModifiedAt: settings.settings_last_modified_at,
            modifiedBy: settings.settings_modified_by,
            changeSummary: settings.settings_change_summary
        });
    }
    resetDirtyTracking();
}

async function loadAppVersion() {
    if (!appVersionValueEl || !window.electronAPI || typeof window.electronAPI.getAppVersion !== 'function') {
        return;
    }

    try {
        const result = await window.electronAPI.getAppVersion();
        if (result && result.success && result.version) {
            appVersionValueEl.textContent = result.version;
        }
    } catch (_) {
    }
}

function showProfileImage(dataUrl) {
    profileImagePreview.innerHTML = `<img src="${dataUrl}" alt="profile">`;
    removeImageBtn.style.display = '';
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        if (window.showToast) window.showToast(t('settings.imageError', 'حدث خطأ أثناء رفع الصورة'), 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(ev) {
        const dataUrl = ev.target.result;
        showProfileImage(dataUrl);
        if (window.showToast) window.showToast(t('settings.imageUploaded', 'تم رفع الصورة بنجاح'), 'success');
    };
    reader.readAsDataURL(file);
}

function handleImageRemove() {
    profileImagePreview.innerHTML = '<i class="fas fa-user-circle profile-placeholder-icon"></i>';
    removeImageBtn.style.display = 'none';
    profileImageInput.value = '';
    if (window.showToast) window.showToast(t('settings.imageRemoved', 'تم إزالة الصورة'), 'info');
}

async function saveSettings(e) {
    e.preventDefault();
    setSaveButtonState('saving');
    const settingsPayload = getCurrentSettingsPayload();
    const currentSnapshot = buildSettingsSnapshot(settingsPayload);
    const previousSnapshotObj = parseSettingsSnapshot(initialFormSnapshot);
    const currentSnapshotObj = parseSettingsSnapshot(currentSnapshot);
    const changedFields = getChangedFields(previousSnapshotObj, currentSnapshotObj);
    const modifiedAtIso = new Date().toISOString();
    const modifiedBy = await resolveModifiedBy();
    const changeSummary = changedFields.length
        ? `تم تعديل: ${changedFields.join('، ')}`
        : 'تم الضغط على حفظ بدون تغيير حقول.';
    const settings = {
        ...settingsPayload,
        settings_last_modified_at: modifiedAtIso,
        settings_modified_by: modifiedBy,
        settings_change_summary: changeSummary
    };

    try {
        const result = await window.electronAPI.saveSettings(settings);
        if (result.success) {
            setSaveButtonState('success');
            renderChangeLog({
                lastModifiedAt: modifiedAtIso,
                modifiedBy,
                changeSummary
            });
            initialFormSnapshot = currentSnapshot;
            if (window.showToast) window.showToast(t('settings.alerts.saveSuccess', 'تم حفظ الإعدادات بنجاح'), 'success');
            saveStateTimer = setTimeout(() => setSaveButtonState('idle'), 1800);
        } else {
            setSaveButtonState('error');
            if (window.showToast) window.showToast(t('settings.alerts.saveError', 'حدث خطأ أثناء الحفظ'), 'error');
            saveStateTimer = setTimeout(() => setSaveButtonState('idle'), 2200);
        }
    } catch (error) {
        setSaveButtonState('error');
        if (window.showToast) window.showToast(t('settings.alerts.saveError', 'حدث خطأ أثناء الحفظ'), 'error');
        saveStateTimer = setTimeout(() => setSaveButtonState('idle'), 2200);
    }
}

function setSaveButtonState(state) {
    if (!saveBtn) return;
    const iconEl = saveBtn.querySelector('i');
    const textEl = saveBtn.querySelector('.btn-save-text');

    if (saveStateTimer) {
        clearTimeout(saveStateTimer);
        saveStateTimer = null;
    }

    saveBtn.classList.remove('is-saving', 'is-success', 'is-error');
    saveBtn.disabled = false;
    saveBtn.dataset.saveState = state;

    if (state === 'saving') {
        saveBtn.classList.add('is-saving');
        saveBtn.disabled = true;
        if (iconEl) iconEl.className = 'fas fa-spinner fa-spin';
        if (textEl) textEl.textContent = 'جاري الحفظ...';
        return;
    }

    if (state === 'success') {
        saveBtn.classList.add('is-success');
        if (iconEl) iconEl.className = 'fas fa-check';
        if (textEl) textEl.textContent = 'تم الحفظ';
        return;
    }

    if (state === 'error') {
        saveBtn.classList.add('is-error');
        if (iconEl) iconEl.className = 'fas fa-exclamation-triangle';
        if (textEl) textEl.textContent = 'فشل الحفظ';
        return;
    }

    if (iconEl) iconEl.className = 'fas fa-save';
    if (textEl) textEl.textContent = t('settings.saveSettings', 'حفظ الإعدادات');
}

function getCurrentSettingsPayload() {
    const imgEl = profileImagePreview.querySelector('img');
    return {
        companyName: companyNameInput.value,
        companyAddress: companyAddressInput.value,
        companyPhone: companyPhoneInput.value,
        invoiceFooter: invoiceFooterInput.value,
        profileImage: imgEl ? imgEl.src : ''
    };
}

function buildSettingsSnapshot(payload) {
    const normalized = {};
    SETTINGS_TRACKING_FIELDS.forEach(({ key }) => {
        normalized[key] = String(payload[key] || '').trim();
    });
    return JSON.stringify(normalized);
}

function parseSettingsSnapshot(snapshot) {
    try {
        return JSON.parse(snapshot || '{}');
    } catch (error) {
        return {};
    }
}

function getChangedFields(previousSnapshot, currentSnapshot) {
    const changed = [];
    SETTINGS_TRACKING_FIELDS.forEach(({ key, label }) => {
        if ((previousSnapshot[key] || '') !== (currentSnapshot[key] || '')) {
            changed.push(label);
        }
    });
    return changed;
}

function resetDirtyTracking() {
    initialFormSnapshot = buildSettingsSnapshot(getCurrentSettingsPayload());
}

function renderChangeLog({ lastModifiedAt, modifiedBy, changeSummary }) {
    if (changeLogLastModifiedEl) {
        changeLogLastModifiedEl.textContent = formatAuditDate(lastModifiedAt) || 'لا يوجد تعديل مسجل بعد';
    }
    if (changeLogModifiedByEl) {
        changeLogModifiedByEl.textContent = modifiedBy || '-';
    }
    if (changeLogSummaryEl) {
        changeLogSummaryEl.textContent = changeSummary || '-';
    }
}

function formatAuditDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function resolveModifiedBy() {
    try {
        if (window.electronAPI && typeof window.electronAPI.getActiveAuthUser === 'function') {
            let activeUser = null;
            if (typeof window.electronAPI.getAuthSessionToken === 'function') {
                const sessionToken = await window.electronAPI.getAuthSessionToken();
                activeUser = await window.electronAPI.getActiveAuthUser({ sessionToken });
            } else {
                activeUser = await window.electronAPI.getActiveAuthUser({});
            }
            if (activeUser && activeUser.username) {
                return activeUser.username;
            }
        }
    } catch (error) {
        // Ignore and fallback.
    }

    return 'مستخدم غير محدد';
}

function setStatus(element, message, isError = false) {
    if (!element) return;
    element.textContent = message || '';
    element.style.color = isError ? '#b91c1c' : '#111827';
}

function setUpdateButtonState(state, buttonText = '') {
    if (!updateBtn) return;

    const iconEl = updateBtn.querySelector('i');
    const textEl = updateBtn.querySelector('.update-btn-text');

    updateBtn.disabled = state === 'loading';

    if (state === 'loading') {
        if (iconEl) iconEl.className = 'fas fa-spinner fa-spin';
        if (textEl) textEl.textContent = buttonText || 'جاري الفحص...';
        return;
    }

    if (iconEl) iconEl.className = 'fas fa-cloud-download-alt';
    if (textEl) textEl.textContent = buttonText || t('settings.updateNow', 'فحص وتنزيل التحديث');
}

function bindAppUpdateProgress() {
    if (unsubscribeAppUpdateProgress) {
        unsubscribeAppUpdateProgress();
        unsubscribeAppUpdateProgress = null;
    }

    if (!window.electronAPI || typeof window.electronAPI.onAppUpdateProgress !== 'function') {
        return;
    }

    unsubscribeAppUpdateProgress = window.electronAPI.onAppUpdateProgress(handleAppUpdateProgress);
}

function stopAppUpdateProgressPolling() {
    if (!appUpdateProgressPollTimer) {
        return;
    }

    clearTimeout(appUpdateProgressPollTimer);
    appUpdateProgressPollTimer = null;
}

function scheduleAppUpdateProgressPolling() {
    if (appUpdateProgressPollTimer) {
        return;
    }

    appUpdateProgressPollTimer = setTimeout(async () => {
        appUpdateProgressPollTimer = null;
        await syncAppUpdateProgressState();
    }, 1000);
}

function setUpdateProgressVisibility(visible) {
    if (!updateProgressWrapEl) return;
    updateProgressWrapEl.hidden = !visible;
}

function setUpdateProgress(percent = 0, metaText = '') {
    if (updateProgressBarEl) {
        const safePercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
        updateProgressBarEl.style.width = `${safePercent}%`;
        const progressTrack = updateProgressBarEl.parentElement;
        if (progressTrack) {
            progressTrack.setAttribute('aria-valuenow', String(safePercent));
        }
    }

    if (updateProgressMetaEl) {
        updateProgressMetaEl.textContent = metaText || '';
    }
}

function resetUpdateProgress() {
    setUpdateProgressVisibility(false);
    setUpdateProgress(0, '0%');
}

function formatUpdateBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value >= 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (value >= 1024) {
        return `${Math.round(value / 1024)} KB`;
    }
    return `${value} B`;
}

function buildUpdateProgressMeta(progressPayload) {
    const percentValue = Number(progressPayload?.percent);
    const hasPercent = Number.isFinite(percentValue);
    const downloadedBytes = Number(progressPayload?.downloadedBytes) || 0;
    const totalBytes = Number(progressPayload?.totalBytes) || 0;

    if (hasPercent && totalBytes > 0) {
        return `${percentValue}% - ${formatUpdateBytes(downloadedBytes)} / ${formatUpdateBytes(totalBytes)}`;
    }

    if (hasPercent) {
        return `${percentValue}%`;
    }

    if (downloadedBytes > 0) {
        return `${formatUpdateBytes(downloadedBytes)} تم تنزيلها`;
    }

    return '0%';
}

function handleAppUpdateProgress(progressPayload = {}) {
    const progressStatus = String(progressPayload.status || '');
    if (!isAppUpdateDownloadRunning && progressStatus !== 'completed' && progressStatus !== 'error') {
        return;
    }

    const percentValue = Number(progressPayload.percent);
    const safePercent = Number.isFinite(percentValue)
        ? Math.max(0, Math.min(100, percentValue))
        : 0;

    setUpdateProgressVisibility(true);
    setUpdateProgress(safePercent, buildUpdateProgressMeta(progressPayload));

    if (progressPayload.status === 'downloading' || progressPayload.status === 'starting') {
        isAppUpdateDownloadRunning = true;
        const statusText = safePercent > 0
            ? `جاري تنزيل التحديث... ${safePercent}%`
            : 'جاري تنزيل التحديث...';
        setStatus(updateStatusEl, statusText);
        setUpdateButtonState('loading', 'جاري تنزيل التحديث...');
        scheduleAppUpdateProgressPolling();
        return;
    }

    if (progressStatus === 'error') {
        isAppUpdateDownloadRunning = false;
        setUpdateButtonState('idle');
        setStatus(updateStatusEl, progressPayload.error || 'تعذر تنزيل ملف التحديث.', true);
        stopAppUpdateProgressPolling();
        return;
    }

    if (progressStatus === 'completed') {
        isAppUpdateDownloadRunning = false;
        setUpdateButtonState('idle');
        stopAppUpdateProgressPolling();
    }
}

async function syncAppUpdateProgressState() {
    if (!window.electronAPI || typeof window.electronAPI.getAppUpdateProgressState !== 'function') {
        return;
    }

    try {
        const result = await window.electronAPI.getAppUpdateProgressState();
        if (!result || !result.success || !result.progress) {
            stopAppUpdateProgressPolling();
            return;
        }

        const progressState = result.progress;
        const progressStatus = String(progressState.status || 'idle');

        if (progressStatus === 'starting' || progressStatus === 'downloading') {
            isAppUpdateDownloadRunning = true;
            handleAppUpdateProgress(progressState);
            scheduleAppUpdateProgressPolling();
            return;
        }

        if (progressStatus === 'completed') {
            isAppUpdateDownloadRunning = false;
            setUpdateProgressVisibility(true);
            setUpdateProgress(100, buildUpdateProgressMeta({
                ...progressState,
                percent: 100
            }));
            setUpdateButtonState('idle');
            stopAppUpdateProgressPolling();
            return;
        }

        if (progressStatus === 'error') {
            isAppUpdateDownloadRunning = false;
            setUpdateButtonState('idle');
            setStatus(updateStatusEl, progressState.error || 'تعذر تنزيل ملف التحديث.', true);
            stopAppUpdateProgressPolling();
            return;
        }

        isAppUpdateDownloadRunning = false;
        stopAppUpdateProgressPolling();
    } catch (_) {
        stopAppUpdateProgressPolling();
    }
}

async function handleBackup() {
    setStatus(backupStatusEl, t('settings.status.creatingBackup'));
    const result = await window.electronAPI.backupDatabase();

    if (result.success) {
        const localBackupMessage = fmt(t('settings.status.backupSavedAt'), { path: result.path });
        const cloudSuccess = Boolean(result.cloud && result.cloud.success === true);

        if (cloudSuccess) {
            setStatus(backupStatusEl, `${localBackupMessage} (تم الرفع السحابي بنجاح)`);
            if (window.showToast && typeof window.showToast === 'function') {
                window.showToast('تم الحفظ محليًا وعلى السحابة بنجاح.', 'success');
            } else if (window.toast && typeof window.toast.success === 'function') {
                window.toast.success('تم الحفظ محليًا وعلى السحابة بنجاح.');
            }
            return;
        }

        const cloudError = result.cloud && result.cloud.error
            ? result.cloud.error
            : 'تعذر رفع النسخة للسحابة.';
        setStatus(backupStatusEl, `${localBackupMessage} (فشل الحفظ السحابي)`);
        if (window.showToast && typeof window.showToast === 'function') {
            window.showToast(`تم الحفظ المحلي بنجاح، لكن فشل الحفظ السحابي: ${cloudError}`, 'warning');
        } else if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(`تم الحفظ المحلي بنجاح، لكن فشل الحفظ السحابي: ${cloudError}`);
        }
    } else if (result.canceled) {
        setStatus(backupStatusEl, t('settings.status.operationCanceled'));
    } else {
        setStatus(
            backupStatusEl,
            fmt(t('settings.status.backupFailed'), { error: result.error || 'Unknown error' }),
            true
        );
    }
}

async function handleRestore() {
    const confirmRestore = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('settings.alerts.restoreConfirm'))
        : false;
    if (!confirmRestore) return;

    setStatus(restoreStatusEl, t('settings.status.restoring'));
    const result = await window.electronAPI.restoreDatabase();

    if (result.success) {
        setStatus(restoreStatusEl, t('settings.status.restoreSuccessRestart'));
        await window.electronAPI.restartApp();
    } else if (result.canceled) {
        setStatus(restoreStatusEl, t('settings.status.operationCanceled'));
    } else {
        setStatus(
            restoreStatusEl,
            fmt(t('settings.status.restoreFailed'), { error: result.error || 'Unknown error' }),
            true
        );

        if (result.needsRestart) {
            const restartErrorMessage = t('settings.alerts.restoreRestartError');
            setStatus(restoreStatusEl, restartErrorMessage, true);
            if (window.toast && typeof window.toast.error === 'function') {
                window.toast.error(restartErrorMessage);
            }
            await window.electronAPI.restartApp();
        }
    }
}

async function handleAppUpdate() {
    if (!window.electronAPI || typeof window.electronAPI.checkAppUpdate !== 'function') {
        setStatus(updateStatusEl, 'ميزة التحديث غير متاحة في هذا الإصدار.', true);
        return;
    }

    try {
        isAppUpdateDownloadRunning = false;
        resetUpdateProgress();
        setUpdateButtonState('loading', 'جاري فحص التحديث...');
        setStatus(updateStatusEl, 'جاري فحص آخر إصدار من GitHub Releases...');

        const checkResult = await window.electronAPI.checkAppUpdate();
        if (!checkResult || !checkResult.success) {
            setStatus(updateStatusEl, checkResult?.error || 'تعذر فحص التحديث.', true);
            return;
        }

        if (!checkResult.updateAvailable) {
            const latestMessage = checkResult.currentVersion
                ? `أنت تستخدم أحدث إصدار (${checkResult.currentVersion}).`
                : 'أنت تستخدم أحدث إصدار.';
            resetUpdateProgress();
            setStatus(updateStatusEl, latestMessage);
            if (window.showToast) window.showToast(latestMessage, 'success');
            return;
        }

        isAppUpdateDownloadRunning = true;
        setUpdateButtonState('loading', 'جاري تنزيل التحديث...');
        setUpdateProgressVisibility(true);
        setUpdateProgress(0, '0%');
        setStatus(updateStatusEl, `تم العثور على الإصدار ${checkResult.latestVersion}. جاري تنزيل ملف التحديث...`);

        const downloadResult = await window.electronAPI.downloadAppUpdate();
        if (downloadResult && downloadResult.success) {
            isAppUpdateDownloadRunning = false;
            setUpdateProgressVisibility(true);
            setUpdateProgress(100, '100%');
            const successMessage = `تم تنزيل التحديث ${downloadResult.latestVersion || ''} بنجاح. سيتم الآن إغلاق البرنامج وبدء التثبيت: ${downloadResult.path}`.trim();
            setStatus(updateStatusEl, successMessage);
            if (window.showToast) window.showToast('تم تنزيل التحديث. سيتم الآن إغلاق البرنامج وبدء التثبيت.', 'success');
            if (downloadResult.closeForInstall && typeof window.electronAPI.quitAndInstallAppUpdate === 'function') {
                await window.electronAPI.quitAndInstallAppUpdate(downloadResult.path);
            }
            return;
        }

        isAppUpdateDownloadRunning = false;
        const errorMessage = downloadResult?.error || 'تعذر تنزيل ملف التحديث.';
        setStatus(updateStatusEl, errorMessage, true);
        if (downloadResult?.releaseUrl && typeof window.electronAPI.openAppReleasePage === 'function') {
            await window.electronAPI.openAppReleasePage();
        }
        if (window.showToast) window.showToast(errorMessage, 'error');
    } catch (error) {
        isAppUpdateDownloadRunning = false;
        const fallbackMessage = error.message || 'حدث خطأ أثناء التحديث.';
        setStatus(updateStatusEl, fallbackMessage, true);
        if (window.showToast) window.showToast(fallbackMessage, 'error');
    } finally {
        isAppUpdateDownloadRunning = false;
        setUpdateButtonState('idle');
    }
}

