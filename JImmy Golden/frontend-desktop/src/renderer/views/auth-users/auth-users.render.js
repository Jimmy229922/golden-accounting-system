(function () {
    function isRunningInsideShellFrame() {
        try {
            return Boolean(window.top && window.top !== window && typeof window.top.__shellNavigate === 'function');
        } catch (_err) {
            return false;
        }
    }

    function renderPage({ t }) {
        const app = document.getElementById('app');
        app.innerHTML = `
        ${isRunningInsideShellFrame() ? '' : `
        <nav class="top-nav">
            <div class="nav-brand">${t('common.nav.brand')}</div>
            <ul class="nav-links">
                <li><a href="../dashboard/index.html">${t('common.nav.dashboard')}</a></li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.masterData')}</a>
                    <div class="dropdown-content">
                        <a href="../items/units.html">${t('common.nav.units')}</a>
                        <a href="../items/items.html">${t('common.nav.items')}</a>
                        <a href="../customers/index.html">${t('common.nav.customersSuppliers')}</a>
                        <a href="../auth-users/index.html" class="active">${t('common.nav.userManagement', 'إدارة المستخدمين')}</a>
                    </div>
                </li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.sales')}</a>
                    <div class="dropdown-content">
                        <a href="../sales/index.html">${t('common.nav.salesInvoice')}</a>
                    </div>
                </li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.purchases')}</a>
                    <div class="dropdown-content">
                        <a href="../purchases/index.html">${t('common.nav.purchaseInvoice')}</a>
                    </div>
                </li>
                <li><a href="../inventory/index.html">${t('common.nav.inventory')}</a></li>
                <li class="dropdown">
                    <a href="#">التعاملات المالية</a>
                    <div class="dropdown-content">
                        <a href="../finance/index.html">${t('common.nav.finance')}</a>
                        <a href="../petty-expenses/index.html">نثريات الشركة</a>
                        <a href="../petty-bags/index.html">الشكاير</a>
                        <a href="../petty-inspection/index.html">الفحص</a>
                        <a href="../petty-shipping-clearance/index.html">الشحن و التخليص</a>
                        <a href="../petty-operation/index.html">التشغيل</a>
                        <span class="dropdown-separator" aria-hidden="true"></span>
                        <a href="../under-collection/index.html">تحت التحصيل</a>
                        <a href="../remaining-under-collection/index.html">بيان المتبقي من تحت التحصيل</a>
                    </div>
                </li>
                <li><a href="../payments/receipt.html">${t('common.nav.receipt')}</a></li>
                <li><a href="../payments/payment.html">${t('common.nav.payment')}</a></li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.reports')}</a>
                    <div class="dropdown-content">
                        <a href="../reports/index.html">${t('common.nav.generalReports')}</a>
                        <a href="../customer-reports/index.html">${t('common.nav.customerStatement')}</a>
                        <a href="../reports/debtor-creditor/index.html">${t('common.nav.debtorCreditor')}</a>
                    </div>
                </li>
                <li><a href="../settings/index.html">${t('common.nav.settings')}</a></li>
            </ul>
        </nav>
        `}

        <main class="content">
            <div class="users-page">
                <section class="users-hero">
                    <div class="users-hero-main">
                        <div class="users-hero-icon" aria-hidden="true"><i class="fas fa-user-shield"></i></div>
                        <div>
                            <h1>${t('authUsers.title', 'إدارة المستخدمين')}</h1>
                            <p class="users-subtitle">${t('authUsers.subtitle', 'إدارة حسابات الموظفين (إضافة، تفعيل/تعطيل، وتغيير كلمة المرور).')}</p>
                        </div>
                    </div>
                    <div class="users-hero-stats">
                        <div class="users-stat-card">
                            <span>${t('authUsers.stats.total', 'إجمالي الحسابات')}</span>
                            <strong id="authUsersTotalStat">0</strong>
                        </div>
                        <div class="users-stat-card stat-active">
                            <span>${t('authUsers.stats.active', 'الحسابات المفعلة')}</span>
                            <strong id="authUsersActiveStat">0</strong>
                        </div>
                        <div class="users-stat-card stat-inactive">
                            <span>${t('authUsers.stats.inactive', 'الحسابات غير المفعلة')}</span>
                            <strong id="authUsersInactiveStat">0</strong>
                        </div>
                    </div>
                </section>

                <div id="authUsersNotice" class="users-notice notice-info">${t('authUsers.loadingPermissions', 'جارٍ تحميل صلاحيات الحساب...')}</div>

                <div id="authUsersAdminPanel" hidden>
                    <section class="users-card">
                        <div class="users-card-head">
                            <h2>${t('authUsers.addUser', 'إضافة مستخدم')}</h2>
                            <span class="users-card-hint">${t('authUsers.formHint', 'املأ البيانات ثم اضغط إضافة.')}</span>
                        </div>

                        <form id="authUsersForm" class="users-form">
                            <div class="form-group">
                                <label for="authUsername">${t('authUsers.username', 'اسم المستخدم')}</label>
                                <input id="authUsername" type="text" class="form-control" autocomplete="off" required>
                            </div>
                            <div class="form-group">
                                <label for="authPassword">${t('authUsers.password', 'كلمة المرور')}</label>
                                <input id="authPassword" type="password" class="form-control" autocomplete="new-password" required>
                            </div>
                            <div class="form-group">
                                <label for="authConfirmPassword">${t('authUsers.confirmPassword', 'تأكيد كلمة المرور')}</label>
                                <input id="authConfirmPassword" type="password" class="form-control" autocomplete="new-password" required>
                            </div>
                            <div class="users-form-actions">
                                <label class="form-check-line" for="authActivateNow">
                                    <input id="authActivateNow" type="checkbox" checked>
                                    ${t('authUsers.activateNow', 'تفعيل الحساب مباشرة بعد الإنشاء')}
                                </label>
                                <button type="submit" class="btn-secondary users-submit-btn">
                                    <i class="fas fa-user-plus" aria-hidden="true"></i>
                                    <span>${t('authUsers.addUser', 'إضافة مستخدم')}</span>
                                </button>
                            </div>
                        </form>
                    </section>

                    <small id="authUsersStatus" class="status-text"></small>

                    <section class="users-card users-list-card">
                        <div class="users-card-head">
                            <h2>${t('authUsers.listTitle', 'قائمة المستخدمين')}</h2>
                            <span id="authUsersTableMeta" class="users-table-meta">${t('authUsers.tableMeta', 'يتم عرض 0 مستخدم')}</span>
                        </div>
                        <div id="authUsersTableWrap" class="users-table-wrap"></div>
                    </section>
                </div>
            </div>

            <div id="resetPasswordModal" class="rp-modal-overlay">
                <div class="rp-modal">
                    <div class="rp-modal-header">
                        <h3><i class="fas fa-user-edit"></i> ${t('authUsers.permissions.edit', 'تعديل')}</h3>
                        <button type="button" class="rp-modal-close" id="rpModalClose">&times;</button>
                    </div>
                    <form id="resetPasswordForm" class="rp-modal-body">
                        <input type="hidden" id="rpUserId" value="">
                        <input type="hidden" id="rpCurrentUsername" value="">
                        <div class="form-group">
                            <label for="rpUsername">${t('authUsers.username', 'اسم المستخدم')}</label>
                            <input id="rpUsername" type="text" class="form-control" autocomplete="username" required>
                        </div>
                        <div class="form-group">
                            <label for="rpNewPassword">${t('authUsers.newPassword', 'كلمة المرور الجديدة')} (اختياري)</label>
                            <input id="rpNewPassword" type="password" class="form-control" autocomplete="new-password" minlength="6">
                        </div>
                        <div class="form-group">
                            <label for="rpConfirmPassword">${t('authUsers.confirmNewPassword', 'تأكيد كلمة المرور الجديدة')} (اختياري)</label>
                            <input id="rpConfirmPassword" type="password" class="form-control" autocomplete="new-password" minlength="6">
                        </div>
                        <div class="rp-modal-actions">
                            <button type="submit" class="btn-secondary users-submit-btn">
                                <i class="fas fa-check"></i> ${t('authUsers.permissions.edit', 'تعديل')}
                            </button>
                            <button type="button" class="btn-cancel" id="rpModalCancel">${t('common.cancel', 'إلغاء')}</button>
                        </div>
                    </form>
                </div>
            </div>

            <div id="permissionsModal" class="rp-modal-overlay">
                <div class="rp-modal perm-modal perm-modal-pro">
                    <div class="rp-modal-header perm-header-pro">
                        <div class="perm-header-title-wrap">
                            <div class="perm-header-icon"><i class="fas fa-shield-alt"></i></div>
                            <div>
                                <h3>${t('authUsers.permissions.manage', 'إدارة الصلاحيات')} — <span id="permUserName"></span></h3>
                                <div class="perm-header-sub">تحكم دقيق في صلاحيات العرض والإضافة والتعديل والحذف لكل شاشة</div>
                            </div>
                        </div>
                        <div class="perm-header-right">
                            <span id="permActiveCounter" class="perm-counter-pill">0 / 0 مفعّل</span>
                            <button type="button" class="rp-modal-close" id="permModalClose">&times;</button>
                        </div>
                    </div>
                    <div class="rp-modal-body perm-modal-body">
                        <input type="hidden" id="permUserId" value="">
                        <div id="permAdminNote" class="perm-admin-note" style="display:none;">
                            <i class="fas fa-info-circle"></i> ${t('authUsers.permissions.adminNote', 'حسابات الأدمن تمتلك جميع الصلاحيات تلقائياً.')}
                        </div>
                        <div class="perm-toolbar-pro">
                            <div class="perm-presets-row">
                                <button type="button" class="perm-preset-btn preset-full" id="permSelectAll">
                                    <i class="fas fa-check-double"></i> صلاحيات كاملة
                                </button>
                                <button type="button" class="perm-preset-btn preset-cashier" id="permPresetCashier">
                                    <i class="fas fa-cash-register"></i> كاشير / مبيعات
                                </button>
                                <button type="button" class="perm-preset-btn preset-viewer" id="permPresetViewer">
                                    <i class="fas fa-eye"></i> مشاهدة فقط
                                </button>
                                <button type="button" class="perm-preset-btn preset-clear" id="permDeselectAll">
                                    <i class="fas fa-times"></i> إلغاء الكل
                                </button>
                            </div>
                            <div class="perm-search-wrap">
                                <i class="fas fa-search"></i>
                                <input type="text" id="permSearchInput" class="perm-search-input" placeholder="ابحث باسم الصفحة...">
                            </div>
                        </div>
                        <div class="perm-table-wrap perm-table-wrap-pro">
                            <table class="perm-table perm-table-pro">
                                <thead>
                                    <tr>
                                        <th>${t('authUsers.permissions.page', 'الصفحة')}</th>
                                        <th><button type="button" class="perm-col-toggle col-view" data-col="can_view" title="تحديد/إلغاء عمود العرض بالكامل"><i class="fas fa-eye"></i> ${t('authUsers.permissions.view', 'عرض')}</button></th>
                                        <th><button type="button" class="perm-col-toggle col-add" data-col="can_add" title="تحديد/إلغاء عمود الإضافة بالكامل"><i class="fas fa-plus-circle"></i> ${t('authUsers.permissions.add', 'إضافة')}</button></th>
                                        <th><button type="button" class="perm-col-toggle col-edit" data-col="can_edit" title="تحديد/إلغاء عمود التعديل بالكامل"><i class="fas fa-pen"></i> ${t('authUsers.permissions.edit', 'تعديل')}</button></th>
                                        <th><button type="button" class="perm-col-toggle col-delete" data-col="can_delete" title="تحديد/إلغاء عمود الحذف بالكامل"><i class="fas fa-trash"></i> ${t('authUsers.permissions.delete', 'حذف')}</button></th>
                                    </tr>
                                </thead>
                                <tbody id="permTableBody"></tbody>
                            </table>
                        </div>
                        <div class="rp-modal-actions perm-footer-pro">
                            <button type="button" class="btn-secondary users-submit-btn" id="permSaveBtn">
                                <i class="fas fa-save"></i> ${t('authUsers.permissions.save', 'حفظ الصلاحيات')}
                            </button>
                            <button type="button" class="btn-cancel" id="permModalCancel">${t('common.cancel', 'إلغاء')}</button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    `;
    }

    window.authUsersPageRender = {
        renderPage
    };
})();
