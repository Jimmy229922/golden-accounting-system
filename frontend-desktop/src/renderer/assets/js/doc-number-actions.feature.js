function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function decodeDocNumber(value) {
    if (!value) return '';
    try {
        return decodeURIComponent(value);
    } catch (_) {
        return String(value || '');
    }
}

function normalizeClassName(value) {
    return String(value || '')
        .replace(/[^a-zA-Z0-9_\-\s]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function renderDocNumberCell(docNumber, options = {}) {
    const value = String(docNumber ?? '').trim();
    const emptyText = String(options.emptyText ?? '—');
    const numberTag = options.numberTag === 'span' ? 'span' : 'strong';
    const numberClassName = normalizeClassName(options.numberClassName || '');
    const wrapperClassName = normalizeClassName(options.wrapperClassName || '');
    const disableActions = options.disableActions === true;

    if (!value || value === '-' || value === '—') {
        return escapeHtml(emptyText);
    }

    const safeValue = escapeHtml(value);
    const encodedValue = encodeURIComponent(value);
    const numberClassHtml = numberClassName ? ` ${numberClassName}` : '';
    const wrapperClassHtml = wrapperClassName ? ` ${wrapperClassName}` : '';
    const toolbarHtml = disableActions
        ? ''
        : `
            <span class="doc-number-actions">
                <button type="button" class="doc-number-btn doc-number-btn-copy" data-doc-action="copy" data-doc-number="${encodedValue}" title="نسخ الرقم">
                    <i class="fas fa-copy"></i>
                </button>
                <button type="button" class="doc-number-btn doc-number-btn-search" data-doc-action="search" data-doc-number="${encodedValue}" title="بحث بهذا الرقم">
                    <i class="fas fa-search"></i>
                </button>
            </span>
        `;

    return `
        <span class="doc-number-cell${wrapperClassHtml}">
            <${numberTag} class="doc-number-text${numberClassHtml}">${safeValue}</${numberTag}>
            ${toolbarHtml}
        </span>
    `;
}

function resolveGlobalSearchInstance() {
    if (window.globalSearch) return window.globalSearch;
    if (typeof globalSearch !== 'undefined') return globalSearch;
    return null;
}

function triggerGlobalSearchInputWithValue(value, retry = 0) {
    const inputEl = document.querySelector('.gsearch-input');
    if (!inputEl) {
        if (retry < 12) {
            setTimeout(() => triggerGlobalSearchInputWithValue(value, retry + 1), 25);
        }
        return;
    }

    inputEl.value = value;
    inputEl.focus();
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
}

function openGlobalSearchWithDocNumber(docNumber) {
    const value = String(docNumber || '').trim();
    if (!value) return;

    const searchInstance = resolveGlobalSearchInstance();
    if (searchInstance && typeof searchInstance.open === 'function') {
        searchInstance.open();
    } else {
        const searchBtn = document.querySelector('.nav-search-btn');
        if (searchBtn) {
            searchBtn.click();
        }
    }

    triggerGlobalSearchInputWithValue(value);
}

function showToastMessage(message, type = 'success') {
    if (window.showToast && typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }

    if (window.toast && typeof window.toast[type] === 'function') {
        window.toast[type](message);
    }
}

async function copyDocNumberToClipboard(docNumber) {
    const value = String(docNumber || '').trim();
    if (!value) return;

    let copied = false;
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(value);
            copied = true;
        }
    } catch (_) {
    }

    if (!copied) {
        const tmp = document.createElement('textarea');
        tmp.value = value;
        tmp.setAttribute('readonly', '');
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        tmp.style.pointerEvents = 'none';
        document.body.appendChild(tmp);
        tmp.select();
        copied = document.execCommand('copy');
        document.body.removeChild(tmp);
    }

    if (copied) {
        showToastMessage('تم نسخ الرقم', 'success');
    }
}

function injectDocNumberStyles() {
    if (document.getElementById('doc-number-actions-style')) return;

    const style = document.createElement('style');
    style.id = 'doc-number-actions-style';
    style.textContent = `
        .doc-number-cell {
            position: relative !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            vertical-align: middle;
        }

        .doc-number-cell::before {
            content: '' !important;
            position: absolute !important;
            left: 50% !important;
            bottom: 100% !important;
            transform: translateX(-50%) !important;
            width: 160px !important;
            height: 14px !important;
            pointer-events: auto !important;
        }

        .doc-number-text {
            line-height: 1.15;
        }

        .doc-number-actions {
            position: absolute !important;
            left: 50% !important;
            bottom: 100% !important;
            transform: translate(-50%, 4px) !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            padding: 4px !important;
            border-radius: 8px !important;
            background: rgba(15, 23, 42, 0.96) !important;
            border: 1px solid rgba(148, 163, 184, 0.4) !important;
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.34) !important;
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: 40 !important;
            transition: opacity 0.14s ease, transform 0.14s ease !important;
        }

        .doc-number-cell:hover > .doc-number-actions,
        .doc-number-cell:focus-within > .doc-number-actions,
        .doc-number-actions:hover {
            opacity: 1 !important;
            pointer-events: auto !important;
            transform: translate(-50%, 0) !important;
        }

        .doc-number-btn {
            width: 28px !important;
            height: 28px !important;
            border: 1px solid rgba(148, 163, 184, 0.38) !important;
            border-radius: 7px !important;
            background: rgba(15, 23, 42, 0.85) !important;
            color: #dbeafe !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            line-height: 1 !important;
            transition: filter 0.15s ease, transform 0.15s ease, background-color 0.15s ease !important;
        }

        .doc-number-btn:hover {
            filter: brightness(1.08) !important;
            transform: translateY(-1px) !important;
        }

        .doc-number-btn-search,
        .doc-number-btn[data-doc-action="search"] {
            background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
            border-color: rgba(96, 165, 250, 0.7) !important;
            color: #fff !important;
        }

        @media print {
            .doc-number-actions {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
}

function bindDocNumberActions() {
    if (document.documentElement.dataset.docNumberActionsBound === '1') return;
    document.documentElement.dataset.docNumberActionsBound = '1';

    document.addEventListener('click', (event) => {
        const actionBtn = event.target.closest('[data-doc-action]');
        if (!actionBtn) return;

        event.preventDefault();
        event.stopPropagation();

        const action = actionBtn.getAttribute('data-doc-action');
        const docNumber = decodeDocNumber(actionBtn.getAttribute('data-doc-number') || '').trim();
        if (!docNumber) return;

        if (action === 'copy') {
            copyDocNumberToClipboard(docNumber);
            if (typeof actionBtn.blur === 'function') actionBtn.blur();
            return;
        }

        if (action === 'search') {
            openGlobalSearchWithDocNumber(docNumber);
            if (typeof actionBtn.blur === 'function') actionBtn.blur();
        }
    });
}

function initializeDocNumberActionsFeature() {
    injectDocNumberStyles();
    bindDocNumberActions();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDocNumberActionsFeature);
} else {
    initializeDocNumberActionsFeature();
}

window.renderDocNumberCell = renderDocNumberCell;
window.openGlobalSearchWithDocNumber = openGlobalSearchWithDocNumber;
