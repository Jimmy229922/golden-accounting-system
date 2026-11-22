let shellDictionary = {};
const helpers = window.i18n?.createPageHelpers?.(() => shellDictionary) || { t: (_k, fallback = '') => fallback };
const t = helpers.t;

const SHELL_ITEMS = (window.navManager && typeof window.navManager.getTopNavItems === 'function')
    ? window.navManager.getTopNavItems('../')
    : [];

const DEFAULT_ROUTE = '../dashboard/index.html';
const AUTH_SESSION_KEY = 'auth_session_token';
const SHELL_HREF_TO_PERMISSION = [
    { pattern: 'auth-users/', page: '__admin_only__' },
    { pattern: 'dashboard/', page: 'dashboard' },
    { pattern: 'items/items', page: 'items' },
    { pattern: 'items/units', page: 'items' },
    { pattern: 'customers/', page: 'customers' },
    { pattern: 'sales/', page: 'sales' },
    { pattern: 'purchases/', page: 'purchases' },
    { pattern: 'opening-balance/', page: 'opening-balance' },
    { pattern: 'inventory/', page: 'inventory' },
    { pattern: 'finance/', page: 'finance' },
    { pattern: 'under-collection/', page: 'finance' },
    { pattern: 'remaining-under-collection/', page: 'finance' },
    { pattern: 'export-revenues/', page: 'finance' },
    { pattern: 'local-sales/', page: 'finance' },
    { pattern: 'payments/receipt', page: 'treasury' },
    { pattern: 'payments/payment', page: 'treasury' },
    { pattern: 'reports/debtor-creditor', page: 'reports' },
    { pattern: 'reports/', page: 'reports' },
    { pattern: 'customer-reports/', page: 'customer-reports' },
    { pattern: 'settings/', page: 'settings' }
];

const shellState = {
    currentHref: '',
    isNavigating: false,
    visibleItems: SHELL_ITEMS,
    clientFeatures: {},
    runtimeMeta: null
};
const NAVIGATION_WATCHDOG_MS = 1800;
let navigationWatchdogTimer = null;

function normalizePath(value) {
    return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function isShiftCloseHref(href) {
    if (!href) return false;
    try {
        const url = new URL(href, window.location.href);
        return url.searchParams.get('openShiftClose') === '1';
    } catch (_e) {
        return false;
    }
}

function toUrl(rawTarget) {
    return new URL(rawTarget, window.location.href);
}

function sameLocation(urlA, urlB) {
    return normalizePath(urlA.pathname) === normalizePath(urlB.pathname)
        && urlA.search === urlB.search
        && urlA.hash === urlB.hash;
}

function isViewsUrl(urlObj) {
    return normalizePath(urlObj.pathname).includes('/views/');
}

function clearNavigationWatchdog() {
    if (!navigationWatchdogTimer) return;
    clearTimeout(navigationWatchdogTimer);
    navigationWatchdogTimer = null;
}

function armNavigationWatchdog(frame) {
    clearNavigationWatchdog();
    navigationWatchdogTimer = setTimeout(() => {
        if (!shellState.isNavigating) return;

        shellState.isNavigating = false;
        try {
            const actualHref = frame?.contentWindow?.location?.href;
            if (actualHref) {
                shellState.currentHref = actualHref;
            }
        } catch (_error) {
            // Ignore inaccessible frame states.
        }
        renderTopNav();
    }, NAVIGATION_WATCHDOG_MS);
}

function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light';
}

function applyThemeToFrame(frameDoc) {
    if (!frameDoc) return;
    frameDoc.documentElement.setAttribute('data-theme', getCurrentTheme());
    frameDoc.documentElement.classList.toggle('flex-layout-enabled', Boolean(shellState.clientFeatures?.flex_full_layout));
}

function routeToHash(routeHref) {
    return `#route=${encodeURIComponent(routeHref)}`;
}

function parseRouteFromHash() {
    const hash = window.location.hash || '';
    const marker = '#route=';
    if (!hash.startsWith(marker)) return null;

    const encoded = hash.slice(marker.length);
    if (!encoded) return null;

    try {
        return decodeURIComponent(encoded);
    } catch (_e) {
        return null;
    }
}

function isItemActive(href) {
    if (isShiftCloseHref(href)) return false;
    if (!shellState.currentHref) return false;

    try {
        const current = toUrl(shellState.currentHref);
        const target = toUrl(href);
        return normalizePath(current.pathname) === normalizePath(target.pathname);
    } catch (_e) {
        return false;
    }
}

async function getSessionToken() {
    try {
        if (window.electronAPI && typeof window.electronAPI.getAuthSessionToken === 'function') {
            const token = await window.electronAPI.getAuthSessionToken();
            if (token) return token;
        }
    } catch (_err) {
        // Fallback to localStorage if preload helper is unavailable.
    }

    try {
        return localStorage.getItem(AUTH_SESSION_KEY) || '';
    } catch (_err) {
        return '';
    }
}

function getPermissionPageForHref(href = '') {
    for (const entry of SHELL_HREF_TO_PERMISSION) {
        if (href.includes(entry.pattern)) {
            return entry.page;
        }
    }
    return null;
}

function canViewPermissionPage(permissions = [], isAdmin = false, page = null) {
    if (!page) return true;
    if (page === '__admin_only__') return Boolean(isAdmin);
    if (isAdmin) return true;
    const perm = permissions.find((item) => item.page === page);
    return Boolean(perm && perm.can_view);
}

function filterShellItemsByPermissions(items, permissions = [], isAdmin = false) {
    return items.reduce((acc, item) => {
        if (Array.isArray(item.children)) {
            const allowedChildren = item.children.filter((child) => {
                const page = getPermissionPageForHref(child.href);
                return canViewPermissionPage(permissions, isAdmin, page);
            });

            if (allowedChildren.length > 0) {
                acc.push({ ...item, children: allowedChildren });
            }
            return acc;
        }

        const page = getPermissionPageForHref(item.href);
        if (canViewPermissionPage(permissions, isAdmin, page)) {
            acc.push(item);
        }
        return acc;
    }, []);
}

async function loadShellVisibleItems() {
    let clientFeatures = {};
    if (window.electronAPI && typeof window.electronAPI.getClientFeatures === 'function') {
        try {
            const featRes = await window.electronAPI.getClientFeatures();
            if (featRes && featRes.success && featRes.features && typeof featRes.features === 'object') {
                clientFeatures = featRes.features;
            }
        } catch (error) {
            console.error('[shell] failed to load client features:', error);
        }
    }
    shellState.clientFeatures = clientFeatures;
    document.documentElement.classList.toggle('flex-layout-enabled', Boolean(clientFeatures?.flex_full_layout));
    const featureFilteredItems = SHELL_ITEMS.reduce((acc, item) => {
        if (item.featureFlag && !clientFeatures[item.featureFlag]) return acc;
        if (Array.isArray(item.children)) {
            const allowedChildren = item.children.filter((child) => !child.featureFlag || Boolean(clientFeatures[child.featureFlag]));
            if (allowedChildren.length > 0) acc.push({ ...item, children: allowedChildren });
            return acc;
        }
        acc.push(item);
        return acc;
    }, []);
    shellState.visibleItems = featureFilteredItems;

    const api = window.electronAPI;
    if (!api || typeof api.getMyPermissions !== 'function') {
        return;
    }

    const sessionToken = await getSessionToken();
    if (!sessionToken) {
        return;
    }

    try {
        const result = await api.getMyPermissions({ sessionToken });
        if (!result || !result.success || !Array.isArray(result.permissions)) {
            return;
        }

        shellState.visibleItems = filterShellItemsByPermissions(
            featureFilteredItems,
            result.permissions,
            result.isAdmin
        );
    } catch (error) {
        console.error('[shell] failed to load permissions:', error);
    }
}

function buildTopNavLink(item) {
    const activeClass = isItemActive(item.href) ? ' class="active"' : '';
    return `<li><a href="${item.href}" data-shell-href="${item.href}"${activeClass}>${t(item.key, item.fallback)}</a></li>`;
}

function buildTopNavDropdown(item) {
    const hasActiveChild = item.children.some((child) => isItemActive(child.href));
    const activeClass = hasActiveChild ? ' class="active"' : '';

    const childrenHtml = item.children
        .map((child) => {
            if (child.divider) {
                return '<span class="dropdown-separator" aria-hidden="true"></span>';
            }

            const childActive = isItemActive(child.href) ? ' class="active"' : '';
            return `<a href="${child.href}" data-shell-href="${child.href}"${childActive}>${t(child.key, child.fallback)}</a>`;
        })
        .join('');

    return `
        <li class="dropdown">
            <a href="#"${activeClass}>${t(item.key, item.fallback)}</a>
            <div class="dropdown-content">
                ${childrenHtml}
            </div>
        </li>
    `;
}

function renderTopNav() {
    const host = document.getElementById('shellNav');
    if (!host) return;

    const visibleItems = Array.isArray(shellState.visibleItems) ? shellState.visibleItems : SHELL_ITEMS;
    const linksHtml = visibleItems
        .map((item) => (item.children ? buildTopNavDropdown(item) : buildTopNavLink(item)))
        .join('');

    host.innerHTML = `
        <nav class="top-nav shell-top-nav">
            <div class="nav-brand">${t('common.nav.brand', 'برنامج المحاسبة المتكامل')}</div>
            <ul class="nav-links">
                ${linksHtml}
                <li class="nav-search-item">
                    <button class="nav-search-btn" type="button" title="${t('globalSearch.searchBtn', 'بحث')}">
                        <span class="nav-search-icon" aria-hidden="true">🔍</span> ${t('globalSearch.searchBtn', 'بحث')}
                    </button>
                </li>
                <li class="nav-support-item">
                    <button class="nav-support-btn" type="button" title="الدعم الفني وتجديد الاشتراك" style="background:rgba(34,197,94,0.16);border:1px solid rgba(34,197,94,0.45);color:#86efac;border-radius:8px;padding:6px 11px;font-size:0.84rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                        <span aria-hidden="true">💬</span> الدعم الفني
                    </button>
                </li>
            </ul>
        </nav>
    `;
}

function openSearchInCurrentFrame() {
    const frame = document.getElementById('shellFrame');
    const frameWindow = frame?.contentWindow;
    if (!frameWindow) return;

    try {
        if (frameWindow.globalSearch && typeof frameWindow.globalSearch.open === 'function') {
            frameWindow.globalSearch.open();
            return;
        }
    } catch (_err) {
        // Ignore and fallback to shortcut dispatch.
    }

    try {
        frameWindow.focus();
        const event = new KeyboardEvent('keydown', {
            key: 'k',
            code: 'KeyK',
            ctrlKey: true,
            bubbles: true
        });
        frameWindow.document.dispatchEvent(event);
    } catch (_err) {
        // ignore
    }
}

function bindFrameBridge(frameDoc, frameWindow) {
    if (!frameDoc || !frameWindow) return;

    frameDoc.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const link = event.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('javascript:')) return;

        const targetUrl = new URL(link.href, frameWindow.location.href);
        if (!isViewsUrl(targetUrl)) return;

        event.preventDefault();
        navigateTo(targetUrl.href, { pushHistory: true });
    }, true);

    frameWindow.__requestShellNavigation = (targetHref) => {
        navigateTo(targetHref, { pushHistory: true });
        return true;
    };
}

function onFrameLoaded() {
    const frame = document.getElementById('shellFrame');
    if (!frame) return;
    clearNavigationWatchdog();

    try {
        const frameDoc = frame.contentDocument;
        const frameWin = frame.contentWindow;

        if (frameDoc && frameWin) {
            if (frameWin.location && frameWin.location.href) {
                shellState.currentHref = frameWin.location.href;
                renderTopNav();
                setHistoryRoute(shellState.currentHref, true);
            }

            applyThemeToFrame(frameDoc);
            bindFrameBridge(frameDoc, frameWin);
        }
    } catch (error) {
        console.error('[shell] frame bridge failed:', error);
    }

    shellState.isNavigating = false;
}

function setHistoryRoute(routeHref, replace = false) {
    const hash = routeToHash(routeHref);
    if (replace) {
        history.replaceState({ routeHref }, '', hash);
    } else {
        history.pushState({ routeHref }, '', hash);
    }
}

function navigateTo(rawTarget, options = {}) {
    const { pushHistory = true } = options;

    let targetUrl;
    try {
        targetUrl = toUrl(rawTarget || DEFAULT_ROUTE);
    } catch (_e) {
        return false;
    }

    if (normalizePath(targetUrl.pathname).includes('/views/external-work/') && !shellState.clientFeatures?.external_work) {
        targetUrl = toUrl(DEFAULT_ROUTE);
    }

    if (!isViewsUrl(targetUrl)) {
        return false;
    }

    if (shellState.isNavigating) {
        return true;
    }

    const frame = document.getElementById('shellFrame');
    if (!frame) return false;

    if (shellState.currentHref) {
        try {
            const currentUrl = toUrl(shellState.currentHref);
            if (sameLocation(currentUrl, targetUrl)) {
                return true;
            }
        } catch (_e) {
            // Ignore parse issue and continue navigation.
        }
    }

    shellState.isNavigating = true;
    shellState.currentHref = targetUrl.href;
    renderTopNav();

    frame.src = targetUrl.href;
    armNavigationWatchdog(frame);

    if (pushHistory) {
        setHistoryRoute(targetUrl.href, false);
    }

    return true;
}

async function confirmCurrentFrameNavigation(targetHref) {
    let targetUrl;
    try {
        targetUrl = toUrl(targetHref || DEFAULT_ROUTE);
    } catch (_e) {
        return true;
    }

    if (shellState.currentHref) {
        try {
            const currentUrl = toUrl(shellState.currentHref);
            if (sameLocation(currentUrl, targetUrl)) {
                return true;
            }
        } catch (_e) {
            // Ignore parse issue and continue confirmation.
        }
    }

    const frame = document.getElementById('shellFrame');
    const frameWindow = frame?.contentWindow;
    if (frameWindow && typeof frameWindow.__confirmLeavePage === 'function') {
        return await frameWindow.__confirmLeavePage(targetUrl.href);
    }

    return true;
}

window.__shellNavigate = (rawTarget) => navigateTo(rawTarget, { pushHistory: true });
window.__syncThemeFromChild = (theme) => {
    const safeTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', safeTheme);
    localStorage.setItem('theme', safeTheme);

    const frame = document.getElementById('shellFrame');
    if (frame && frame.contentDocument) {
        frame.contentDocument.documentElement.setAttribute('data-theme', safeTheme);
    }

    return true;
};

function bindShellNavEvents() {
    const navHost = document.getElementById('shellNav');
    if (!navHost) return;

    navHost.addEventListener('click', async (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const dropdownGroupLink = event.target.closest('a[href="#"]');
        if (dropdownGroupLink && navHost.contains(dropdownGroupLink)) {
            event.preventDefault();
            return;
        }

        const supportBtn = event.target.closest('.nav-support-btn');
        if (supportBtn) {
            event.preventDefault();
            openSupportModal();
            return;
        }

        const searchBtn = event.target.closest('.nav-search-btn');
        if (searchBtn) {
            event.preventDefault();
            openSearchInCurrentFrame();
            return;
        }

        const link = event.target.closest('[data-shell-href]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href || href === '#') return;

        if (isShiftCloseHref(href)) {
            event.preventDefault();
            if (window.navManager && typeof window.navManager.openSalesShiftCloseModal === 'function') {
                window.navManager.openSalesShiftCloseModal();
                return;
            }
        }

        event.preventDefault();
        const confirmed = await confirmCurrentFrameNavigation(href);
        if (!confirmed) return;

        navigateTo(href, { pushHistory: true });
    });
}

function bindHistoryEvents() {
    window.addEventListener('popstate', (event) => {
        const routeHref = event.state && event.state.routeHref;
        if (routeHref) {
            navigateTo(routeHref, { pushHistory: false });
            return;
        }

        const routeFromHash = parseRouteFromHash();
        navigateTo(routeFromHash || DEFAULT_ROUTE, { pushHistory: false });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        try {
            shellDictionary = await window.i18n.loadArabicDictionary();
        } catch (error) {
            console.error('[shell] dictionary load failed:', error);
        }
    }

    try {
        await loadShellVisibleItems();
    } catch (error) {
        console.error('[shell] permissions bootstrap failed:', error);
    }

    try {
        bindShellNavEvents();
        bindHistoryEvents();

        const frame = document.getElementById('shellFrame');
        if (frame) {
            frame.addEventListener('load', onFrameLoaded);
        }

        const initialRoute = parseRouteFromHash() || new URL(DEFAULT_ROUTE, window.location.href).href;
        renderTopNav();
        setHistoryRoute(initialRoute, true);
        navigateTo(initialRoute, { pushHistory: false });
        await initializeClientRuntimeMetaUI();
    } catch (error) {
        console.error('[shell] initialization failed:', error);
    }
});

function buildSupportWhatsappUrl(meta, customPrefix = '') {
    const phone = String(meta?.supportWhatsapp || '').replace(/[^0-9]/g, '');
    if (!phone) return '';
    const lines = [
        customPrefix || 'السلام عليكم، أحتاج مساعدة من الدعم الفني لنظام المحاسبة:',
        meta?.companyName ? `الشركة: ${meta.companyName}` : '',
        meta?.machineId ? `رقم الجهاز: ${meta.machineId}` : '',
        meta?.appVersion ? `الإصدار: v${meta.appVersion}` : ''
    ].filter(Boolean);
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function openExternalSupportUrl(url) {
    if (!url) return;
    if (window.electronAPI && typeof window.electronAPI.openExternalUrl === 'function') {
        window.electronAPI.openExternalUrl(url);
    } else {
        window.open(url, '_blank');
    }
}

function openSupportModal() {
    const meta = shellState.runtimeMeta || {};
    const existing = document.getElementById('shellSupportModal');
    if (existing) existing.remove();

    const waUrl = buildSupportWhatsappUrl(meta);
    const statusMap = { lifetime: 'دائم (Lifetime)', active: 'نشط', trial: 'فترة تجريبية', suspended: 'موقوف' };
    const statusLabel = statusMap[meta.licenseStatus] || 'نشط';
    const daysText = meta.licenseStatus === 'lifetime' ? 'بدون حد زمني' : `${Number(meta.remainingDays || 0)} يوم`;

    const modal = document.createElement('div');
    modal.id = 'shellSupportModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:999998;background:rgba(2,6,23,0.82);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;';
    modal.innerHTML = `
        <div style="width:min(460px,95vw);background:#0f172a;color:#f8fafc;border:1px solid rgba(56,189,248,0.35);border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.7);">
            <div style="padding:18px 20px;background:linear-gradient(135deg,#1e293b,#0f172a);border-bottom:1px solid rgba(148,163,184,0.2);display:flex;align-items:center;justify-content:space-between;">
                <div style="font-size:1.08rem;font-weight:700;">💬 الدعم الفني ومعلومات الاشتراك</div>
                <button type="button" id="closeSupportModalBtn" style="border:none;background:transparent;color:#94a3b8;font-size:20px;cursor:pointer;">&times;</button>
            </div>
            <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
                <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;font-size:0.9rem;">
                    <div><strong>الشركة:</strong> ${meta.companyName || '—'}</div>
                    <div><strong>إصدار البرنامج:</strong> <span dir="ltr">v${meta.appVersion || '—'}</span></div>
                    <div><strong>حالة الاشتراك:</strong> ${statusLabel} (${daysText})</div>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <span><strong>رقم الجهاز:</strong> <code style="color:#38bdf8;direction:ltr;display:inline-block;">${meta.machineId || '—'}</code></span>
                        <button type="button" id="copySupportMachineBtn" style="border:1px solid #475569;background:#0f172a;color:#e2e8f0;border-radius:7px;padding:4px 10px;font-size:0.8rem;cursor:pointer;">نسخ</button>
                    </div>
                </div>
                ${
                    waUrl
                        ? `<button type="button" id="openSupportWhatsappBtn" style="width:100%;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:12px;font-size:0.96rem;font-weight:700;cursor:pointer;">تواصل معنا الآن عبر واتساب الدعم الفني</button>`
                        : `<div style="font-size:0.84rem;color:#94a3b8;text-align:center;">للتواصل مع الدعم الفني أو التجديد يرجى مراسلة الإدارة برقم الجهاز أعلاه.</div>`
                }
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    modal.querySelector('#closeSupportModalBtn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#copySupportMachineBtn')?.addEventListener('click', () => {
        if (meta.machineId && navigator.clipboard) {
            navigator.clipboard.writeText(meta.machineId).then(() => {
                const b = modal.querySelector('#copySupportMachineBtn');
                if (b) { b.textContent = 'تم النسخ ✓'; setTimeout(() => { b.textContent = 'نسخ'; }, 1800); }
            }).catch(() => {});
        }
    });
    modal.querySelector('#openSupportWhatsappBtn')?.addEventListener('click', () => {
        openExternalSupportUrl(waUrl);
    });
}

function renderExpiryReminderBanner(meta) {
    const existing = document.getElementById('shellExpiryBanner');
    if (existing) existing.remove();
    if (!meta || !meta.showExpiryBanner) return;

    const waUrl = buildSupportWhatsappUrl(meta, `السلام عليكم، أرغب في تجديد اشتراك نظام المحاسبة (متبقي ${meta.remainingDays} يوم):`);
    const banner = document.createElement('div');
    banner.id = 'shellExpiryBanner';
    banner.style.cssText = 'background:linear-gradient(90deg,#b45309,#d97706);color:#ffffff;padding:8px 18px;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;font-size:0.9rem;font-weight:700;direction:rtl;z-index:30;border-bottom:1px solid rgba(255,255,255,0.2);';
    banner.innerHTML = `
        <span>⏳ تنبيه: متبقي ${meta.remainingDays} ${meta.remainingDays === 1 ? 'يوم واحد' : 'أيام'} فقط على انتهاء اشتراكك، يرجى التجديد لضمان استمرار العمل دون توقف.</span>
        ${waUrl ? `<button type="button" id="expiryRenewWaBtn" style="background:#ffffff;color:#92400e;border:none;border-radius:7px;padding:4px 12px;font-size:0.84rem;font-weight:700;cursor:pointer;">تجديد عبر الواتساب</button>` : ''}
    `;

    const navHost = document.getElementById('shellNav');
    if (navHost && navHost.parentNode) {
        navHost.parentNode.insertBefore(banner, navHost.nextSibling);
    } else {
        document.body.prepend(banner);
    }

    banner.querySelector('#expiryRenewWaBtn')?.addEventListener('click', () => {
        openExternalSupportUrl(waUrl);
    });
}

function renderForceUpdateOverlay(meta) {
    if (!meta || !meta.forceUpdateRequired) return;
    const existing = document.getElementById('shellForceUpdateOverlay');
    if (existing) existing.remove();

    const waUrl = buildSupportWhatsappUrl(meta, 'السلام عليكم، أحتاج مساعدة لتحديث نظام المحاسبة إلى أحدث إصدار:');
    const overlay = document.createElement('div');
    overlay.id = 'shellForceUpdateOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999999;background:rgba(2,6,23,0.95);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl;';
    overlay.innerHTML = `
        <div style="width:min(520px,95vw);background:#0f172a;color:#f8fafc;border:1.5px solid rgba(56,189,248,0.45);border-radius:16px;padding:28px;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.8);">
            <div style="width:64px;height:64px;margin:0 auto 16px;border-radius:16px;background:rgba(56,189,248,0.16);color:#38bdf8;display:flex;align-items:center;justify-content:center;font-size:28px;">⬆️</div>
            <h2 style="font-size:1.35rem;margin-bottom:10px;color:#ffffff;">مطلوب تحديث البرنامج للمتابعة</h2>
            <p style="font-size:0.95rem;color:#cbd5e1;line-height:1.7;margin-bottom:16px;">${meta.forceUpdateMessage || 'يرجى تحديث البرنامج إلى أحدث إصدار للمتابعة وضمان استقرار بياناتك.'}</p>
            <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;margin-bottom:20px;font-size:0.88rem;display:flex;justify-content:space-around;">
                <span>إصدارك الحالي: <strong style="color:#f87171;" dir="ltr">v${meta.appVersion}</strong></span>
                <span>أقل إصدار مطلوب: <strong style="color:#4ade80;" dir="ltr">v${meta.minSupportedVersion}</strong></span>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <button type="button" id="forceUpdateDownloadBtn" style="width:100%;background:linear-gradient(135deg,#0284c7,#2563eb);color:#fff;border:none;border-radius:10px;padding:13px;font-size:1rem;font-weight:700;cursor:pointer;">تنزيل وتثبيت التحديث الآن</button>
                ${waUrl ? `<button type="button" id="forceUpdateSupportBtn" style="width:100%;background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(34,197,94,0.4);border-radius:10px;padding:10px;font-size:0.88rem;font-weight:600;cursor:pointer;">تواصل مع الدعم الفني عبر الواتساب</button>` : ''}
            </div>
            <div id="forceUpdateProgressWrap" style="display:none;margin-top:14px;">
                <div style="width:100%;height:10px;background:#1e293b;border-radius:999px;overflow:hidden;border:1px solid #334155;">
                    <div id="forceUpdateProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,#38bdf8,#2563eb);transition:width 0.2s ease;"></div>
                </div>
                <div id="forceUpdateProgressPct" style="margin-top:6px;font-size:0.82rem;color:#94a3b8;font-weight:700;">0%</div>
            </div>
            <div id="forceUpdateStatusText" style="margin-top:12px;font-size:0.85rem;color:#38bdf8;"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    const statusEl = overlay.querySelector('#forceUpdateStatusText');
    const dlBtn = overlay.querySelector('#forceUpdateDownloadBtn');
    const progressWrap = overlay.querySelector('#forceUpdateProgressWrap');
    const progressBar = overlay.querySelector('#forceUpdateProgressBar');
    const progressPct = overlay.querySelector('#forceUpdateProgressPct');

    if (window.electronAPI && typeof window.electronAPI.onAppUpdateProgress === 'function') {
        window.electronAPI.onAppUpdateProgress((payload) => {
            if (!progressWrap || !progressBar || !progressPct) return;
            const pct = Math.max(0, Math.min(100, Math.round(Number(payload?.percent) || 0)));
            progressWrap.style.display = 'block';
            progressBar.style.width = `${pct}%`;
            progressPct.textContent = `${pct}%`;
            if (payload?.message && statusEl) {
                statusEl.textContent = payload.message;
            }
        });
    }

    dlBtn?.addEventListener('click', async () => {
        if (!window.electronAPI || typeof window.electronAPI.downloadAppUpdate !== 'function') {
            statusEl.textContent = 'تعذر بدء التحديث التلقائي، يرجى التواصل مع الدعم الفني.';
            return;
        }
        dlBtn.disabled = true;
        if (progressWrap) progressWrap.style.display = 'block';
        statusEl.textContent = 'جاري فحص وتنزيل التحديث الجديد داخل البرنامج، يرجى الانتظار...';
        try {
            const res = await window.electronAPI.downloadAppUpdate();
            if (res && res.success && res.installerPath && typeof window.electronAPI.quitAndInstallAppUpdate === 'function') {
                if (progressBar) progressBar.style.width = '100%';
                if (progressPct) progressPct.textContent = '100%';
                statusEl.textContent = 'تم التنزيل بنجاح! جاري تثبيت التحديث الآن...';
                await window.electronAPI.quitAndInstallAppUpdate(res.installerPath);
            } else {
                statusEl.textContent = res?.error || 'تعذر تنزيل التحديث حالياً، يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.';
                dlBtn.disabled = false;
            }
        } catch (_) {
            statusEl.textContent = 'تعذر تنزيل التحديث حالياً، يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.';
            dlBtn.disabled = false;
        }
    });

    overlay.querySelector('#forceUpdateSupportBtn')?.addEventListener('click', () => {
        openExternalSupportUrl(waUrl);
    });
}

async function initializeClientRuntimeMetaUI() {
    const api = window.electronAPI;
    if (!api || typeof api.getClientRuntimeMeta !== 'function') return;
    try {
        const res = await api.getClientRuntimeMeta();
        if (!res || !res.success || !res.meta) return;
        shellState.runtimeMeta = res.meta;
        if (res.meta.forceUpdateRequired) {
            renderForceUpdateOverlay(res.meta);
            return;
        }
        if (res.meta.showExpiryBanner) {
            renderExpiryReminderBanner(res.meta);
        }
    } catch (_) {}
}
