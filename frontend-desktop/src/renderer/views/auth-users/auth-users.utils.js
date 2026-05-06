(function () {
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function getAuthSessionToken(authSessionKey) {
        try {
            if (window.electronAPI && typeof window.electronAPI.getAuthSessionToken === 'function') {
                const tokenFromMain = await window.electronAPI.getAuthSessionToken();
                if (tokenFromMain) {
                    return tokenFromMain;
                }
            }
        } catch (_) {
        }

        try {
            return localStorage.getItem(authSessionKey) || '';
        } catch (_) {
            return '';
        }
    }

    function setNotice({ el, message, type = 'info' }) {
        if (!el) return;
        el.textContent = message || '';
        el.classList.remove('notice-info', 'notice-success', 'notice-warning', 'notice-error');
        el.classList.add(`notice-${type}`);
    }

    function setStatus({ el, message, type = 'info' }) {
        if (!el) return;
        el.textContent = message || '';
        el.classList.remove('status-info', 'status-success', 'status-error');

        if (!message) return;
        if (type === 'error') {
            el.classList.add('status-error');
            return;
        }
        if (type === 'success') {
            el.classList.add('status-success');
            return;
        }
        el.classList.add('status-info');
    }

    function updateUsersStats({ users, totalEl, activeEl, inactiveEl, tableMetaEl, t }) {
        const safeUsers = Array.isArray(users) ? users : [];
        const total = safeUsers.length;
        const active = safeUsers.filter((user) => Boolean(user?.isActive)).length;
        const inactive = total - active;

        if (totalEl) totalEl.textContent = total.toString();
        if (activeEl) activeEl.textContent = active.toString();
        if (inactiveEl) inactiveEl.textContent = inactive.toString();
        if (tableMetaEl) {
            tableMetaEl.textContent = t('authUsers.tableMeta', 'يتم عرض {count} مستخدم').replace('{count}', total);
        }
    }

    window.authUsersPageUtils = {
        escapeHtml,
        getAuthSessionToken,
        setNotice,
        setStatus,
        updateUsersStats
    };
})();
