const authState = window.authPageState.createInitialState();
const authApi = window.authPageApi;
const authUi = window.authPageUi;
const { t } = window.i18n?.createPageHelpers?.(() => authState.ar) || { t: (k, f = '') => f };

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        authState.ar = await window.i18n.loadArabicDictionary();
    }

    window.authPageState.initializeDomRefs(authState);

    authState.dom.form.addEventListener('submit', handleSubmit);
    if (authState.dom.passwordToggleBtn) {
        authState.dom.passwordToggleBtn.addEventListener('click', togglePasswordVisibility);
    }

    await initAuthMode();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

async function initAuthMode() {
    try {
        const authStatus = await authApi.getAuthStatus();
        if (authStatus.requiresSetup) {
            authUi.applyMode(authState, 'setup', t);
            setPasswordVisibility(false);
        } else {
            authUi.applyMode(authState, 'login', t);
            setPasswordVisibility(false);
            if (authStatus.username) {
                authState.dom.usernameInput.value = authStatus.username;
                authState.dom.usernameInput.select();
            }
        }
    } catch (_) {
        authUi.applyMode(authState, 'setup', t);
        authUi.setStatus(authState, t('auth.errors.authCheckFailed', 'تعذر قراءة حالة الحساب. أنشئ حساب جديد للمتابعة.'), 'error');
    }
}

function setPasswordVisibility(isVisible) {
    const shouldShow = Boolean(isVisible);
    authState.dom.passwordInput.type = shouldShow ? 'text' : 'password';

    if (!authState.dom.passwordToggleBtn) {
        return;
    }

    const label = shouldShow ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور';
    const icon = shouldShow ? '🙈' : '🐵';
    const iconEl = authState.dom.passwordToggleBtn.querySelector('.password-toggle-icon');

    authState.dom.passwordToggleBtn.setAttribute('aria-label', label);
    authState.dom.passwordToggleBtn.setAttribute('title', label);
    authState.dom.passwordToggleBtn.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
    if (iconEl) {
        iconEl.textContent = icon;
    }
}

function togglePasswordVisibility() {
    setPasswordVisibility(authState.dom.passwordInput.type === 'password');
}

async function handleSubmit(event) {
    event.preventDefault();
    authUi.setStatus(authState, '', 'info');

    const username = authState.dom.usernameInput.value.trim();
    const password = authState.dom.passwordInput.value;
    const confirmPassword = authState.dom.confirmPasswordInput.value;

    if (!username || !password) {
        authUi.setStatus(authState, t('auth.errors.usernamePasswordRequired', 'يرجى إدخال اسم المستخدم وكلمة المرور.'), 'error');
        return;
    }

    if (authState.mode === 'setup' && password !== confirmPassword) {
        authUi.setStatus(authState, t('auth.errors.passwordMismatch', 'كلمة المرور وتأكيدها غير متطابقين.'), 'error');
        return;
    }

    authState.dom.submitBtn.disabled = true;

    try {
        if (authState.mode === 'setup') {
            await submitSetup({ username, password });
        } else {
            await submitLogin({ username, password });
        }
    } catch (_) {
        authUi.setStatus(authState, t('auth.errors.loginError', 'حدث خطأ أثناء التحقق من بيانات الدخول.'), 'error');
    } finally {
        authState.dom.submitBtn.disabled = false;
        authState.dom.passwordInput.value = '';
        setPasswordVisibility(false);
        authState.dom.confirmPasswordInput.value = '';
    }
}

async function submitSetup({ username, password }) {
    const setupResult = await authApi.setupAuthAccount({ username, password });

    if (!setupResult.success) {
        authUi.setStatus(authState, setupResult.error || t('auth.errors.setupFailed', 'فشل تفعيل الحساب.'), 'error');
        return;
    }

    authApi.storeSessionToken(authState.authSessionKey, setupResult.sessionToken);
    try {
        sessionStorage.removeItem('user_permissions_cache');
    } catch (_) {
    }

    authUi.setStatus(authState, t('auth.success.setupDone', 'تم تفعيل الحساب بنجاح. جاري الدخول...'), 'success');
    authUi.showLoadingOverlay(t);
    authApi.notifyAuthUnlockedWithDelay(600);
}

async function submitLogin({ username, password }) {
    const loginResult = await authApi.loginAuthAccount({ username, password });

    if (!loginResult.success) {
        authUi.setStatus(authState, loginResult.error || t('auth.errors.loginFailed', 'بيانات الدخول غير صحيحة.'), 'error');
        return;
    }

    authApi.storeSessionToken(authState.authSessionKey, loginResult.sessionToken);
    try {
        sessionStorage.removeItem('user_permissions_cache');
    } catch (_) {
    }

    authUi.setStatus(authState, t('auth.success.loginDone', 'تم تسجيل الدخول بنجاح.'), 'success');
    authUi.showLoadingOverlay(t);
    authApi.notifyAuthUnlockedWithDelay(600);
}
