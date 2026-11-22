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
    initRecoveryFlow();

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

    if (loginResult.requiresPasswordChange) {
        authUi.applyMode(authState, 'setup', t);
        authState.dom.titleText.textContent = 'تعيين كلمة مرور المدير';
        authState.dom.subtitleText.textContent = 'أول تسجيل دخول: يرجى كتابة كلمة مرور جديدة خاصة بك وتأكيدها.';
        authState.dom.submitBtn.textContent = 'حفظ وتأمين الحساب';
        authState.dom.usernameInput.value = loginResult.username;
        authState.dom.usernameInput.disabled = true;
        authUi.setStatus(authState, 'يرجى إدخال كلمة المرور الجديدة وتأكيدها لحساب المدير.', 'info');
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

function initRecoveryFlow() {
    const forgotBtn = document.getElementById('forgotPasswordBtn');
    const recoveryModal = document.getElementById('recoveryModal');
    const closeRecoveryBtn = document.getElementById('closeRecoveryBtn');
    const closeRecoveryIconBtn = document.getElementById('closeRecoveryIconBtn');
    const copyChallengeBtn = document.getElementById('copyChallengeBtn');
    const verifyRecoveryCodeBtn = document.getElementById('verifyRecoveryCodeBtn');
    const recoveryPasswordGroup = document.getElementById('recoveryPasswordGroup');
    const submitRecoveryBtn = document.getElementById('submitRecoveryBtn');
    const challengeText = document.getElementById('recoveryChallengeText');
    const recoveryCodeInput = document.getElementById('recoveryCodeInput');
    const newPasswordInput = document.getElementById('recoveryNewPasswordInput');
    const recoveryStatus = document.getElementById('recoveryStatus');

    if (!forgotBtn || !recoveryModal) return;

    let isCodeVerified = false;

    const resetFlow = () => {
        isCodeVerified = false;
        recoveryStatus.textContent = '';
        recoveryCodeInput.value = '';
        recoveryCodeInput.disabled = false;
        newPasswordInput.value = '';
        newPasswordInput.disabled = true;
        newPasswordInput.placeholder = 'يجب التحقق من كود فك القفل أولاً';
        if (recoveryPasswordGroup) {
            recoveryPasswordGroup.classList.remove('unlocked');
            recoveryPasswordGroup.classList.add('locked');
        }
        if (verifyRecoveryCodeBtn) {
            verifyRecoveryCodeBtn.disabled = false;
            verifyRecoveryCodeBtn.textContent = 'تحقق';
            verifyRecoveryCodeBtn.classList.remove('verified');
        }
        if (submitRecoveryBtn) {
            submitRecoveryBtn.disabled = true;
        }
    };

    const closeModal = () => {
        recoveryModal.style.display = 'none';
        resetFlow();
    };

    forgotBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        resetFlow();
        challengeText.textContent = 'جاري استخراج الرمز...';
        recoveryModal.style.display = 'flex';

        try {
            const res = await authApi.getRecoveryChallenge();
            if (res && res.success) {
                challengeText.textContent = res.challenge;
            } else {
                challengeText.textContent = 'تعذر استخراج رمز الاسترداد';
            }
        } catch (_) {
            challengeText.textContent = 'خطأ في الاتصال';
        }
    });

    if (closeRecoveryBtn) {
        closeRecoveryBtn.addEventListener('click', closeModal);
    }
    if (closeRecoveryIconBtn) {
        closeRecoveryIconBtn.addEventListener('click', closeModal);
    }
    recoveryModal.addEventListener('click', (e) => {
        if (e.target === recoveryModal) {
            closeModal();
        }
    });

    if (copyChallengeBtn) {
        copyChallengeBtn.addEventListener('click', async () => {
            const text = challengeText.textContent.trim();
            if (!text || text.includes('...')) return;
            try {
                await navigator.clipboard.writeText(text);
                const prev = copyChallengeBtn.textContent;
                copyChallengeBtn.textContent = '✓ تم النسخ';
                setTimeout(() => {
                    copyChallengeBtn.textContent = prev;
                }, 1500);
            } catch (_) {}
        });
    }

    const verifyCodeAction = async () => {
        const code = recoveryCodeInput.value.trim().toUpperCase();
        if (!code) {
            recoveryStatus.textContent = 'يرجى إدخال كود فك القفل أولاً.';
            recoveryStatus.style.color = '#ef4444';
            return;
        }

        verifyRecoveryCodeBtn.disabled = true;
        recoveryStatus.textContent = 'جاري التحقق من الكود...';
        recoveryStatus.style.color = '#94a3b8';

        try {
            const res = await authApi.verifyRecoveryCode({ code });
            if (res && res.success) {
                isCodeVerified = true;
                recoveryCodeInput.disabled = true;
                verifyRecoveryCodeBtn.textContent = '✓ تم التحقق';
                verifyRecoveryCodeBtn.classList.add('verified');
                verifyRecoveryCodeBtn.disabled = true;

                if (recoveryPasswordGroup) {
                    recoveryPasswordGroup.classList.remove('locked');
                    recoveryPasswordGroup.classList.add('unlocked');
                }
                newPasswordInput.disabled = false;
                newPasswordInput.placeholder = 'أدخل كلمة المرور الجديدة (6 أحرف أو أكثر)';
                newPasswordInput.focus();

                submitRecoveryBtn.disabled = false;
                recoveryStatus.textContent = 'الكود صحيح. يرجى إدخال كلمة المرور الجديدة.';
                recoveryStatus.style.color = '#34d399';
            } else {
                recoveryStatus.textContent = res.error || 'كود الاسترداد غير صحيح.';
                recoveryStatus.style.color = '#ef4444';
                verifyRecoveryCodeBtn.disabled = false;
            }
        } catch (_) {
            recoveryStatus.textContent = 'حدث خطأ أثناء فحص الكود.';
            recoveryStatus.style.color = '#ef4444';
            verifyRecoveryCodeBtn.disabled = false;
        }
    };

    if (verifyRecoveryCodeBtn) {
        verifyRecoveryCodeBtn.addEventListener('click', verifyCodeAction);
    }

    recoveryCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!isCodeVerified) {
                verifyCodeAction();
            }
        }
    });

    if (submitRecoveryBtn) {
        submitRecoveryBtn.addEventListener('click', async () => {
            if (!isCodeVerified) {
                recoveryStatus.textContent = 'يرجى التحقق من كود فك القفل أولاً.';
                recoveryStatus.style.color = '#ef4444';
                return;
            }

            const code = recoveryCodeInput.value.trim().toUpperCase();
            const newPassword = newPasswordInput.value;

            if (!newPassword) {
                recoveryStatus.textContent = 'يرجى إدخال كلمة المرور الجديدة.';
                recoveryStatus.style.color = '#ef4444';
                return;
            }
            if (newPassword.length < 6) {
                recoveryStatus.textContent = 'كلمة المرور يجب ألا تقل عن 6 أحرف/أرقام.';
                recoveryStatus.style.color = '#ef4444';
                return;
            }

            submitRecoveryBtn.disabled = true;
            recoveryStatus.textContent = 'جاري حفظ كلمة المرور...';
            recoveryStatus.style.color = '#94a3b8';

            try {
                const res = await authApi.verifyRecoveryCode({ code, newPassword });
                if (res && res.success) {
                    recoveryStatus.textContent = res.message || 'تم تعيين كلمة المرور بنجاح!';
                    recoveryStatus.style.color = '#34d399';
                    setTimeout(() => {
                        closeModal();
                        if (authState.dom.usernameInput && res.username) {
                            authState.dom.usernameInput.value = res.username;
                        }
                        if (authState.dom.passwordInput) {
                            authState.dom.passwordInput.value = newPassword;
                        }
                        authUi.setStatus(authState, 'تم تعيين كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.', 'success');
                    }, 1200);
                } else {
                    recoveryStatus.textContent = res.error || 'كود الاسترداد غير صحيح.';
                    recoveryStatus.style.color = '#ef4444';
                    submitRecoveryBtn.disabled = false;
                }
            } catch (_) {
                recoveryStatus.textContent = 'حدث خطأ أثناء معالجة الطلب.';
                recoveryStatus.style.color = '#ef4444';
                submitRecoveryBtn.disabled = false;
            }
        });
    }
}
