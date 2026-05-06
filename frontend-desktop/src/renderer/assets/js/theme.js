// Theme Management (without navbar injection)
(function bridgeElectronApiFromShell() {
    try {
        if (!window.electronAPI && window.top && window.top !== window && window.top.electronAPI) {
            window.electronAPI = window.top.electronAPI;
        }
    } catch (_err) {
        // Ignore cross-context access errors and keep local runtime behavior.
    }
})();

function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light';
}

function setTheme(theme) {
    const safeTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', safeTheme);
    localStorage.setItem('theme', safeTheme);

    try {
        if (window.top && window.top !== window && typeof window.top.__syncThemeFromChild === 'function') {
            window.top.__syncThemeFromChild(safeTheme);
        }
    } catch (_err) {
        // Ignore parent sync bridge errors and keep local theme applied.
    }

    syncThemeToggleButtons();
}

function toggleTheme() {
    const newTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function syncThemeToggleButtons() {
    const isDark = getCurrentTheme() === 'dark';
    const icon = isDark ? 'fa-sun' : 'fa-moon';
    const label = isDark ? 'الوضع الفاتح' : 'الوضع المظلم';

    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        btn.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
        btn.setAttribute('aria-label', `تغيير المظهر إلى ${label}`);
        btn.title = `تغيير المظهر إلى ${label}`;
    });
}

function bindThemeToggleButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        if (btn.dataset.themeBound === '1') return;
        btn.dataset.themeBound = '1';
        btn.addEventListener('click', toggleTheme);
    });
    syncThemeToggleButtons();
}

function isTextEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    const editableEl = target.closest('input, textarea, [contenteditable]');
    if (!editableEl) return false;

    if (editableEl.tagName === 'INPUT') {
        const inputType = (editableEl.getAttribute('type') || 'text').toLowerCase();
        const nonTextTypes = new Set([
            'button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden',
            'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week'
        ]);
        return !nonTextTypes.has(inputType);
    }

    return true;
}

function preventProblematicDragAndDrop() {
    document.addEventListener('dragstart', (event) => {
        if (isTextEditableTarget(event.target)) return;
        event.preventDefault();
    }, true);

    document.addEventListener('drop', (event) => {
        if (!isTextEditableTarget(event.target)) return;
        const uriList = event.dataTransfer?.getData('text/uri-list') || '';
        const text = event.dataTransfer?.getData('text/plain') || '';
        const carriesUrl = uriList.trim() !== '' || /^(file|https?):\/\//i.test(text.trim());
        if (carriesUrl) {
            event.preventDefault();
        }
    }, true);
}

// Apply theme immediately to prevent flash
(function applyThemeImmediately() {
    setTheme(localStorage.getItem('theme') || 'light');
})();

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        // Force a strict reload when returning from bfcache to prevent frozen/disabled states
        window.location.reload();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    bindThemeToggleButtons();
    preventProblematicDragAndDrop();

    // Fix Electron/Chromium focus bug where inputs become frozen after navigation
    setTimeout(() => {
        document.body.style.pointerEvents = 'auto'; // Force unlock pointer events
        document.documentElement.style.pointerEvents = 'auto'; // Double certainty

        // Remove any invisible overlay that might have been leftover
        const strayOverlays = document.querySelectorAll('.toast-container, .modal-backdrop, .overlay, .loading');
        strayOverlays.forEach(ol => {
            if (window.getComputedStyle(ol).display !== 'none' && !ol.hasChildNodes()) {
                 ol.style.display = 'none';
            }
        });

        // Do NOT force window.focus() or body.focus() to avoid interrupting user interactions immediately after load
    }, 50);

    // Failsafe: force clear any stuck mousedown state on mouse movement
    document.addEventListener('mousemove', (e) => {
        // If no buttons are pressed but Chromium thinks we're dragging, we can detect mismatched state
        if (e.buttons === 0) {
            document.body.classList.remove('mouse-drag-stuck');
        }
    }, { once: true });
});

window.toggleTheme = toggleTheme;
window.setTheme = setTheme;
window.getCurrentTheme = getCurrentTheme;
window.syncThemeToggleButtons = syncThemeToggleButtons;
window.bindThemeToggleButtons = bindThemeToggleButtons;
