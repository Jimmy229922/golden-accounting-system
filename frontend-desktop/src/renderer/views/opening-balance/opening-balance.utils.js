(function () {
    function applyI18nToDOM(t) {
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            const val = t(key);
            if (val) el.textContent = val;
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-i18n-placeholder');
            const val = t(key);
            if (val) el.placeholder = val;
        });
    }

    function normalizePossiblyMojibake(value) {
        if (typeof value !== 'string') return '';
        if (!/[\u00D8\u00D9]/.test(value)) return value;

        try {
            const bytes = Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xFF));
            const decoded = new TextDecoder('utf-8').decode(bytes);
            if (decoded && !decoded.includes('�') && /[\u0600-\u06FF]/.test(decoded)) {
                return decoded;
            }
        } catch (_) {
        }

        return value;
    }

    window.openingBalancePageUtils = {
        applyI18nToDOM,
        normalizePossiblyMojibake
    };
})();
