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
    { pattern: 'sales-returns/', page: 'sales-returns' },
    { pattern: 'sales/', page: 'sales' },
    { pattern: 'purchase-returns/', page: 'purchase-returns' },
    { pattern: 'purchases/', page: 'purchases' },
    { pattern: 'opening-balance/', page: 'opening-balance' },
    { pattern: 'inventory/', page: 'inventory' },
    { pattern: 'finance/', page: 'finance' },
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
    visibleItems: SHELL_ITEMS
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
    shellState.visibleItems = SHELL_ITEMS;

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
            SHELL_ITEMS,
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

    navHost.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const dropdownGroupLink = event.target.closest('a[href="#"]');
        if (dropdownGroupLink && navHost.contains(dropdownGroupLink)) {
            event.preventDefault();
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
    } catch (error) {
        console.error('[shell] initialization failed:', error);
    }
});

