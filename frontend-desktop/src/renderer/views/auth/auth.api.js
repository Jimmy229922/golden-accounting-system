(function () {
    async function getAuthStatus() {
        return window.electronAPI.getAuthStatus();
    }

    async function setupAuthAccount(payload) {
        return window.electronAPI.setupAuthAccount(payload);
    }

    async function loginAuthAccount(payload) {
        return window.electronAPI.loginAuthAccount(payload);
    }

    function storeSessionToken(key, token) {
        if (!token) return;
        try {
            if (window.electronAPI && typeof window.electronAPI.setAuthSessionToken === 'function') {
                window.electronAPI.setAuthSessionToken(token);
            }
            localStorage.setItem(key, token);
        } catch (_) {
        }
    }

    function notifyAuthUnlockedWithDelay(delayMs) {
        setTimeout(() => window.electronAPI.notifyAuthUnlocked(), delayMs);
    }

    window.authPageApi = {
        getAuthStatus,
        setupAuthAccount,
        loginAuthAccount,
        storeSessionToken,
        notifyAuthUnlockedWithDelay
    };
})();
