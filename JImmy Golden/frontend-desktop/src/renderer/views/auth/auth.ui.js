(function () {
    function setStatus(state, message, type) {
        state.dom.statusEl.textContent = message || '';
        state.dom.statusEl.classList.remove('error', 'success');
        if (type === 'error') {
            state.dom.statusEl.classList.add('error');
        }
        if (type === 'success') {
            state.dom.statusEl.classList.add('success');
        }
    }

    function showLoadingOverlay(t) {
        const overlay = document.createElement('div');
        overlay.className = 'auth-loading-overlay';
        overlay.innerHTML = `
            <div class="auth-loading-spinner"></div>
            <div class="auth-loading-text">${t('auth.loading', 'جاري تحميل النظام...')}</div>
        `;
        document.body.appendChild(overlay);
    }

    function applyMode(state, nextMode, t) {
        state.mode = nextMode;

        if (state.mode === 'setup') {
            state.dom.titleText.textContent = t('auth.setupTitle', 'تفعيل حساب النظام');
            state.dom.subtitleText.textContent = t('auth.setupSubtitle', 'هذه أول مرة تشغيل. أنشئ اسم مستخدم وكلمة مرور للحماية.');
            state.dom.submitBtn.textContent = t('auth.setupBtn', 'تفعيل الحساب');
            state.dom.confirmGroup.hidden = false;
            state.dom.passwordInput.setAttribute('autocomplete', 'new-password');
            state.dom.confirmPasswordInput.required = true;
            return;
        }

        state.dom.titleText.textContent = t('auth.loginTitle', 'تسجيل الدخول');
        state.dom.subtitleText.textContent = t('auth.loginSubtitle', 'ادخل اسم المستخدم وكلمة المرور للمتابعة.');
        state.dom.submitBtn.textContent = t('auth.loginBtn', 'دخول');
        state.dom.confirmGroup.hidden = true;
        state.dom.passwordInput.setAttribute('autocomplete', 'current-password');
        state.dom.confirmPasswordInput.required = false;
        state.dom.confirmPasswordInput.value = '';
    }

    window.authPageUi = {
        setStatus,
        showLoadingOverlay,
        applyMode
    };
})();
