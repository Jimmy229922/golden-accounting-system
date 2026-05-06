/**
 * Permission Manager — إدارة الصلاحيات على مستوى الصفحات
 * يُحمّل في كل صفحة لإخفاء عناصر التنقل والأزرار بناءً على صلاحيات المستخدم
 */
(function () {
    'use strict';

    const AUTH_SESSION_KEY = 'auth_session_token';
    const PERM_CACHE_KEY = 'user_permissions_cache';
    const PERM_CACHE_TTL = 60000; // 1 minute

    // Map URL path segments to permission page keys
    const PATH_TO_PERM = {
        'dashboard': 'dashboard',
        'items': 'items',
        'customers': 'customers',
        'sales': 'sales',
        'sales-returns': 'sales-returns',
        'purchases': 'purchases',
        'purchase-returns': 'purchase-returns',
        'opening-balance': 'opening-balance',
        'inventory': 'inventory',
        'finance': 'finance',
        'payments': 'treasury',
        'reports': 'reports',
        'debtor-creditor': 'reports',
        'customer-reports': 'customer-reports',
        'settings': 'settings',
        'auth-users': '__admin_only__',
        'auth': null,
        'invite': null,
        'search': null
    };

    // Map nav link href patterns to permission page keys
    const NAV_HREF_TO_PERM = {
        'dashboard/': 'dashboard',
        'items/items': 'items',
        'items/units': 'items',
        'customers/': 'customers',
        'sales/': 'sales',
        'sales-returns/': 'sales-returns',
        'purchases/': 'purchases',
        'purchase-returns/': 'purchase-returns',
        'opening-balance/': 'opening-balance',
        'inventory/': 'inventory',
        'finance/': 'finance',
        'payments/payment': 'treasury',
        'payments/receipt': 'treasury',
        'reports/debtor-creditor': 'reports',
        'reports/': 'reports',
        'customer-reports/': 'customer-reports',
        'settings/': 'settings'
    };

    let cachedPermissions = null;
    let cachedIsAdmin = false;

    async function getSessionToken() {
        try {
            if (window.electronAPI && typeof window.electronAPI.getAuthSessionToken === 'function') {
                const token = await window.electronAPI.getAuthSessionToken();
                if (token) return token;
            }
        } catch (e) { /* fallback */ }
        try {
            return localStorage.getItem(AUTH_SESSION_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function getCachedPermissions() {
        try {
            const raw = sessionStorage.getItem(PERM_CACHE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (Date.now() - data.ts > PERM_CACHE_TTL) {
                sessionStorage.removeItem(PERM_CACHE_KEY);
                return null;
            }
            return data;
        } catch (e) {
            return null;
        }
    }

    function setCachedPermissions(permissions, isAdmin) {
        try {
            sessionStorage.setItem(PERM_CACHE_KEY, JSON.stringify({
                permissions,
                isAdmin,
                ts: Date.now()
            }));
        } catch (e) { /* ignore */ }
    }

    async function loadPermissions() {
        // Check cache first
        const cached = getCachedPermissions();
        if (cached) {
            cachedPermissions = cached.permissions;
            cachedIsAdmin = cached.isAdmin;
            return { permissions: cached.permissions, isAdmin: cached.isAdmin };
        }

        const api = window.electronAPI;
        if (!api || typeof api.getMyPermissions !== 'function') {
            return { permissions: [], isAdmin: false };
        }

        const sessionToken = await getSessionToken();
        if (!sessionToken) {
            return { permissions: [], isAdmin: false };
        }

        try {
            const result = await api.getMyPermissions({ sessionToken });
            if (!result.success) {
                return { permissions: [], isAdmin: false };
            }

            cachedPermissions = result.permissions;
            cachedIsAdmin = result.isAdmin;
            setCachedPermissions(result.permissions, result.isAdmin);
            return { permissions: result.permissions, isAdmin: result.isAdmin };
        } catch (e) {
            console.error('[permissionManager] Error loading permissions:', e);
            return { permissions: [], isAdmin: false };
        }
    }

    function detectCurrentPage() {
        const path = window.location.pathname.replace(/\\/g, '/');
        const segments = path.split('/').filter(Boolean);

        // Check from the end of path segments
        for (let i = segments.length - 1; i >= 0; i--) {
            const seg = segments[i].replace(/\.html$/, '');
            if (PATH_TO_PERM.hasOwnProperty(seg)) {
                return PATH_TO_PERM[seg];
            }
        }
        return null;
    }

    function getPermForPage(page) {
        if (!cachedPermissions || !page) return null;
        return cachedPermissions.find((p) => p.page === page) || null;
    }

    function canView(page) {
        if (cachedIsAdmin) return true;
        const perm = getPermForPage(page);
        return perm ? perm.can_view : false;
    }

    function canAdd(page) {
        if (cachedIsAdmin) return true;
        const perm = getPermForPage(page);
        return perm ? perm.can_add : false;
    }

    function canEdit(page) {
        if (cachedIsAdmin) return true;
        const perm = getPermForPage(page);
        return perm ? perm.can_edit : false;
    }

    function canDelete(page) {
        if (cachedIsAdmin) return true;
        const perm = getPermForPage(page);
        return perm ? perm.can_delete : false;
    }

    function hideNavLinks() {
        // Hide nav links for pages the user can't view
        const allLinks = document.querySelectorAll('a[href]');
        allLinks.forEach((link) => {
            const href = link.getAttribute('href') || '';

            // Auth-users page is admin-only — always hidden for non-admins
            if (href.includes('auth-users/') && !cachedIsAdmin) {
                link.style.display = 'none';
                return;
            }

            for (const pattern in NAV_HREF_TO_PERM) {
                if (href.includes(pattern)) {
                    const permPage = NAV_HREF_TO_PERM[pattern];
                    if (!canView(permPage)) {
                        link.style.display = 'none';
                    }
                    break;
                }
            }
        });

        // Hide empty dropdown menus (all children hidden)
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach((dd) => {
            const content = dd.querySelector('.dropdown-content');
            if (!content) return;
            const visibleLinks = content.querySelectorAll('a[href]');
            const allHidden = Array.from(visibleLinks).every((a) => a.style.display === 'none');
            if (allHidden && visibleLinks.length > 0) {
                dd.style.display = 'none';
            }
        });
    }

    function hideActionButtons(page) {
        if (cachedIsAdmin || !page) return;

        const perm = getPermForPage(page);
        if (!perm) return;

        // Hide add buttons
        if (!perm.can_add) {
            // Hide buttons that open add modals or directly perform add actions
            document.querySelectorAll('.btn-add, [onclick*="openAdd"], [onclick*="showAdd"], [data-action="add"], .btn-primary:not(.btn-show-report):not(.filter-btn):not(.btn-refresh)').forEach((btn) => {
                if (btn.closest('.rp-modal-overlay') || btn.closest('#permissionsModal')) return;
                btn.style.display = 'none';
            });
            // Disable forms for adding
            document.querySelectorAll('form:not(#resetPasswordForm):not(#permissionsForm)').forEach((form) => {
                if (!form.closest('.rp-modal') && !form.closest('#permissionsModal') && !form.closest('.filters')) {
                    const submitBtn = form.querySelector('button[type="submit"], fieldset button.btn-success');
                    if (submitBtn) submitBtn.style.display = 'none';
                }
            });
        }

        // Hide edit buttons
        if (!perm.can_edit) {
            document.querySelectorAll('.btn-edit, [onclick*="openEdit"], [onclick*="edit"], [data-action="edit"], button[data-action="toggle"]').forEach((btn) => {
                btn.style.display = 'none';
            });
        }

        // Hide delete buttons
        if (!perm.can_delete) {
            document.querySelectorAll('.btn-delete, [onclick*="delete"], [onclick*="Delete"], [data-action="delete"], .btn-danger').forEach((btn) => {
                if (btn.closest('.rp-modal-overlay') || btn.closest('#permissionsModal')) return;
                btn.style.display = 'none';
            });
        }

        // Periodically run this to catch dynamically added buttons (e.g., inside fetched tables)
        const observer = new MutationObserver(() => {
            if (!perm.can_add) {
                document.querySelectorAll('.btn-add, [onclick*="openAdd"], [onclick*="showAdd"], [data-action="add"], .btn-primary:not(.btn-show-report):not(.filter-btn):not(.btn-refresh)').forEach((btn) => {
                    if (btn.closest('.rp-modal-overlay') || btn.closest('#permissionsModal')) return;
                    btn.style.display = 'none';
                });
            }
            if (!perm.can_edit) {
                document.querySelectorAll('.btn-edit, [onclick*="openEdit"], [onclick*="edit"], [data-action="edit"], button[data-action="toggle"]').forEach((btn) => {
                    btn.style.display = 'none';
                });
            }
            if (!perm.can_delete) {
                document.querySelectorAll('.btn-delete, [onclick*="delete"], [onclick*="Delete"], [data-action="delete"], .btn-danger').forEach((btn) => {
                    if (btn.closest('.rp-modal-overlay') || btn.closest('#permissionsModal')) return;
                    btn.style.display = 'none';
                });
            }
        });
        
        const contentArea = document.querySelector('main') || document.body;
        observer.observe(contentArea, { childList: true, subtree: true });
    }

    function showNoAccessMessage() {
        const main = document.querySelector('main.content') || document.querySelector('main') || document.body;
        const msg = document.createElement('div');
        msg.className = 'perm-no-access';
        msg.innerHTML = `
            <div class="perm-no-access-card">
                <i class="fas fa-lock"></i>
                <h2>ليس لديك صلاحية للوصول لهذه الصفحة</h2>
                <a href="../dashboard/index.html" class="btn-secondary">العودة للوحة التحكم</a>
            </div>
        `;
        // Clear existing content
        const children = main.querySelectorAll(':scope > *:not(nav):not(.top-nav)');
        children.forEach((child) => { child.style.display = 'none'; });
        main.appendChild(msg);
    }

    async function init() {
        const currentPage = detectCurrentPage();

        // Skip for auth, invite, search pages
        if (currentPage === null) return;

        const { permissions, isAdmin } = await loadPermissions();

        // If no permissions loaded (no session), skip
        if (!permissions || permissions.length === 0) return;

        // Hide restricted nav links
        hideNavLinks();

        // Admin-only pages (e.g. auth-users) — block non-admins
        if (currentPage === '__admin_only__') {
            if (!isAdmin) {
                showNoAccessMessage();
            }
            return;
        }

        // Check current page access
        if (!isAdmin && !canView(currentPage)) {
            showNoAccessMessage();
            return;
        }

        // Hide action buttons based on permissions
        hideActionButtons(currentPage);
    }

    // Run after DOM is ready and other scripts have initialized
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Delay slightly to let page scripts render first
            setTimeout(init, 100);
        });
    } else {
        setTimeout(init, 100);
    }

    // Expose API
    window.permissionManager = {
        loadPermissions,
        canView,
        canAdd,
        canEdit,
        canDelete,
        detectCurrentPage,
        clearCache: function () {
            sessionStorage.removeItem(PERM_CACHE_KEY);
            cachedPermissions = null;
            cachedIsAdmin = false;
        }
    };
})();
