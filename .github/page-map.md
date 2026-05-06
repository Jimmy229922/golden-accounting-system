# Page Map — خريطة الصفحات الفعلية (نسخة تشغيلية)

> **الغرض:** مرجع عملي سريع يربط كل صفحة بملفاتها الفعلية وواجهات `electronAPI` والـ handlers المسؤولة.
> **آخر تحديث:** 2026-04-21
> **مصدر الحقيقة:** الملفات داخل `frontend-desktop/src/main` و `frontend-desktop/src/renderer/views`.

---

## 1) تدفق فتح التطبيق (فعليًا من الكود)

1. نقطة البداية: `frontend-desktop/src/main/main.js`.
2. يتم استدعاء `openAppFlow()` من `frontend-desktop/src/main/windowManager.js`.
3. التسلسل:
   - فحص التفعيل `isInviteValid()`.
   - عند الحاجة: فتح `views/invite/index.html`.
   - ثم دائمًا: فتح `views/auth/index.html`.
   - بعد نجاح الدخول: فتح `views/shell/index.html`.
4. داخل `shell` يتم تحميل صفحات النظام في `iframe` (`#shellFrame`) بدل فتح نافذة جديدة.

---

## 2) مصدر التوجيه الحقيقي داخل الواجهة

- التوجيه الأساسي داخل Shell يعتمد على:
  - `frontend-desktop/src/renderer/assets/js/shared/navManager.js` (الدالة `buildTopNavItems`)
  - `frontend-desktop/src/renderer/views/shell/shell.js`
- المسار الافتراضي داخل Shell: `../dashboard/index.html`.
- `navigation.json` موجود، لكنه ليس المصدر الرئيسي لشريط التنقل العلوي في وضع Shell (يُستخدم فقط عبر `renderNavigation` في السياقات القديمة).

---

## 3) خريطة الصلاحيات (Shell/Auth)

### مفاتيح الصلاحيات المعتمدة

`dashboard`, `customers`, `items`, `sales`, `purchases`, `sales-returns`, `purchase-returns`, `treasury`, `reports`, `customer-reports`, `inventory`, `opening-balance`, `settings`, `finance`

### ربط Route -> Permission (من `shell.js`)

| Pattern داخل الرابط | Permission Key |
|---|---|
| `auth-users/` | `__admin_only__` |
| `dashboard/` | `dashboard` |
| `items/items` + `items/units` | `items` |
| `customers/` | `customers` |
| `sales/` | `sales` |
| `sales-returns/` | `sales-returns` |
| `purchases/` | `purchases` |
| `purchase-returns/` | `purchase-returns` |
| `opening-balance/` | `opening-balance` |
| `inventory/` | `inventory` |
| `finance/` | `finance` |
| `payments/payment` + `payments/receipt` | `treasury` |
| `reports/` + `reports/debtor-creditor` | `reports` |
| `customer-reports/` | `customer-reports` |
| `settings/` | `settings` |

---

## 4) خريطة صفحات Shell (Route + ملفات + API + Handler)

| الصفحة | Route | ملفات الصفحة الأساسية | APIs مستخدمة في الصفحة | Main Handlers | Permission |
|---|---|---|---|---|---|
| Dashboard | `../dashboard/index.html` | `dashboard/index.html`, `dashboard.css`, `dashboard.js`, `dashboard.render.js` | `getDashboardStats` | `handlers/settings.js` | `dashboard` |
| Items | `../items/items.html` | `items/items.html`, `items.css`, `items.js`, `items.crud.js` | `getItems`, `getUnits`, `addItem`, `updateItem`, `deleteItem`, `addUnit`, `updateUnit`, `deleteUnit` | `handlers/items.js`, `handlers/units.js` | `items` |
| Units | `../items/units.html` | `items/units.html`, `units.css`, `units.js` | `getUnits`, `addUnit`, `updateUnit`, `deleteUnit` | `handlers/units.js` | `items` |
| Customers | `../customers/index.html` | `customers/index.html`, `customers.css`, `customers.js`, `customers.bootstrap.js` | `getCustomers`, `addCustomer`, `updateCustomer`, `deleteCustomer` | `handlers/customers.js` | `customers` |
| Sales | `../sales/index.html` | `sales/index.html`, `sales.css`, `sales.js`, `sales.api.js`, `sales.bootstrap.js`, `sales.events.js`, `sales.render.js`, `sales.state.js` | `getNextInvoiceNumber`, `getInvoiceWithDetails`, `getCustomers`, `getItems`, `getSalesInvoices`, `saveSalesInvoice`, `updateSalesInvoice`, `getSalesShiftClosePreview`, `createSalesShiftClosing`, `getSalesShiftClosings`, `updateSalesShiftClosing`, `deleteSalesShiftClosing` | `handlers/sales.js`, `handlers/invoices.js` | `sales` |
| Sales Returns | `../sales-returns/index.html` | `sales-returns/index.html`, `sales-returns.css`, `sales-returns.js`, `sales-returns.api.js`, `sales-returns.bootstrap.js`, `sales-returns.events.js`, `sales-returns.render.js`, `sales-returns.state.js` | `getNextInvoiceNumber`, `getCustomers`, `getCustomerSalesInvoices`, `getInvoiceItemsForReturn`, `saveSalesReturn`, `updateSalesReturn`, `getSalesReturns`, `getSalesReturnDetails`, `deleteSalesReturn` | `handlers/salesReturns.js`, `handlers/invoices.js` | `sales-returns` |
| Purchases | `../purchases/index.html` | `purchases/index.html`, `purchases.css`, `purchases.js`, `purchases.api.js`, `purchases.events.js`, `purchases.render.js`, `purchases.state.js` | `getNextInvoiceNumber`, `getInvoiceWithDetails`, `getCustomers`, `getItems`, `getPurchaseInvoices`, `savePurchaseInvoice`, `updatePurchaseInvoice` | `handlers/purchases.js`, `handlers/invoices.js` | `purchases` |
| Purchase Returns | `../purchase-returns/index.html` | `purchase-returns/index.html`, `purchase-returns.css`, `purchase-returns.js`, `purchase-returns.api.js`, `purchase-returns.bootstrap.js`, `purchase-returns.events.js`, `purchase-returns.render.js`, `purchase-returns.state.js` | `getNextInvoiceNumber`, `getCustomers`, `getSupplierPurchaseInvoices`, `getInvoiceItemsForReturn`, `savePurchaseReturn`, `updatePurchaseReturn`, `getPurchaseReturns`, `getPurchaseReturnDetails`, `deletePurchaseReturn` | `handlers/purchaseReturns.js`, `handlers/invoices.js` | `purchase-returns` |
| Opening Balance | `../opening-balance/index.html` | `opening-balance/index.html`, `opening-balance.css`, `opening-balance.js`, `opening-balance.bootstrap.js`, `opening-balance.render.js`, `opening-balance.utils.js` | `getWarehouses`, `getItems`, `getOpeningBalances`, `addOpeningBalanceGroup`, `updateOpeningBalance`, `deleteOpeningBalance`, `addWarehouse`, `updateWarehouse`, `deleteWarehouse` | `handlers/openingBalances.js`, `handlers/warehouses.js`, `handlers/items.js` | `opening-balance` |
| Inventory | `../inventory/index.html` | `inventory/index.html`, `inventory.css`, `inventory.js` | `getItems`, `getItemMovements`, `getWarehouses`, `getDamagedStockEntries`, `addDamagedStockEntry`, `updateDamagedStockEntry`, `deleteDamagedStockEntry`, `getMyPermissions` | `handlers/items.js`, `handlers/warehouses.js`, `handlers/auth.js` | `inventory` |
| Finance | `../finance/index.html` | `finance/index.html`, `finance.css`, `finance.js` | `getTreasuryBalance`, `getTreasuryTransactions`, `addTreasuryTransaction`, `updateTreasuryTransaction`, `deleteTreasuryTransaction` | `handlers/treasury.js` | `finance` |
| Receipt | `../payments/receipt.html` | `payments/receipt.html`, `payments.css`, `receipt.js`, `treasury-page.shared.js`, `treasury-page.renderer.js` | `getCustomers`, `getTreasuryTransactions`, `getNextTreasuryVoucherNumber`, `addTreasuryTransaction`, `searchTreasuryByVoucher` | `handlers/treasury.js`, `handlers/customers.js` | `treasury` |
| Payment | `../payments/payment.html` | `payments/payment.html`, `payments.css`, `payment.js`, `treasury-page.shared.js`, `treasury-page.renderer.js` | `getCustomers`, `getTreasuryTransactions`, `getNextTreasuryVoucherNumber`, `addTreasuryTransaction`, `searchTreasuryByVoucher` | `handlers/treasury.js`, `handlers/customers.js` | `treasury` |
| Reports | `../reports/index.html` | `reports/index.html`, `reports.css`, `reports.js`, `reports.bootstrap.js`, `reports.render.js`, `reports.voucher.js` | `getAllReports`, `getCustomers`, `deleteInvoice`, `getTreasuryTransactions` | `handlers/reports.js`, `handlers/invoices.js`, `handlers/treasury.js` | `reports` |
| Debtor/Creditor | `../reports/debtor-creditor/index.html` | `reports/debtor-creditor/index.html`, `debtor-creditor.css`, `debtor-creditor.js` | `getDebtorCreditorReport` | `handlers/customers.js` | `reports` |
| Customer Reports | `../customer-reports/index.html` | `customer-reports/index.html`, `customer-reports.css`, `customer-reports.js`, `customer-reports.bootstrap.js`, `customer-reports.render.js`, `customer-reports.utils.js` | `getCustomers`, `getCustomerDetailedStatement`, `getStatementItemDetails`, `deleteTreasuryTransaction`, `deleteInvoice`, `deleteSalesReturn`, `deletePurchaseReturn`, `saveCustomerReportPdf`, `getSettings` | `handlers/reports.js`, `handlers/treasury.js`, `handlers/invoices.js`, `handlers/salesReturns.js`, `handlers/purchaseReturns.js`, `handlers/settings.js` | `customer-reports` |
| Settings | `../settings/index.html` | `settings/index.html`, `settings.css`, `settings.js` | `getSettings`, `saveSettings`, `backupDatabase`, `backupDatabaseToCloud`, `listCloudBackups`, `restoreDatabase`, `restoreDatabaseFromCloud`, `restartApp` | `handlers/settings.js`, `handlers/backup.js` | `settings` |
| Auth Users | `../auth-users/index.html` | `auth-users/index.html`, `auth-users.css`, `auth-users.js`, `auth-users.bootstrap.js`, `auth-users.render.js`, `auth-users.utils.js` | `getAuthSessionToken`, `getAuthUsers`, `createAuthUser`, `setAuthUserActive`, `resetAuthUserPassword`, `getUserPermissions`, `updateUserPermissions` | `handlers/auth.js` | `__admin_only__` |
| Search | `../search/index.html` | `search/index.html`, `search.css`, `search.js` | لا يوجد استهلاك مباشر لـ `electronAPI` في الملف الحالي | يعتمد على `globalSearch.js` | غير مربوط في `SHELL_HREF_TO_PERMISSION` |

### Dashboard Date Filters (2026-05-02)

- تمت إضافة فلتر فترة (من/إلى) داخل لوحة التحكم لتطبيقه على بطاقات: إجمالي المبيعات، إجمالي المشتريات، صافي الربح التقديري فقط.
- قناة `getDashboardStats` أصبحت تقبل وسيط اختياري `{ startDate, endDate }` لتطبيق المدى الزمني.
- عناصر الواجهة الجديدة داخل `views/dashboard`:
   - IDs: `dashboardFromDate`, `dashboardToDate`, `dashboardApplyBtn`, `dashboardClearBtn`, `dashboardPeriod`.
   - Classes: `filters-panel`, `filters-grid`, `form-group`, `form-control`, `filters-actions`, `btn-primary`, `btn-secondary`.

> ملاحظة: `search/search.js` فارغ حاليًا.

> ملاحظة Inventory (2026-04-12): إدارة التالف داخل صفحة `inventory` تعمل كمودال داخلي يفتح بزر من شريط التحكم (`data-action="open-damaged-manager"`) وتغلق بزر الإغلاق أو النقر خارج المودال.

### Opening Balance Batch Save (2026-04-27)

- في `views/opening-balance`: شاشة `تسجيل رصيد أول المدة` أصبحت بنمط فاتورة (إضافة أصناف كسطور متتالية داخل نفس النموذج).
- تمت إضافة بيانات رأس المستند داخل نفس الكارت:
   - `رقم مستند أول المدة` (تلقائي من `opening_balance_groups`).
   - `تاريخ المستند`.
   - `إجمالي الفاتورة` (يُحسب من سطور الأصناف قبل الحفظ).
- الإجراءات الحالية داخل نفس الكارت:
   - اختيار `حقل الصنف` في السطر الحالي يضيف سطرًا جديدًا تلقائيًا داخل جدول الأصناف (مثل الفواتير).
   - `حفظ رصيد أول المدة` (زر نهائي واحد للحفظ الدفعي).
   - `مسح القائمة` + حذف صف منفرد قبل الحفظ.
- الحفظ الدفعي يتم عبر IPC `addOpeningBalanceGroup` في `handlers/openingBalances.js`.
- CSS Classes المضافة في `opening-balance.css`:
   - `.pending-items-box`
   - `.pending-row-remove`

### Opening Balance UI Polish (2026-04-30)

- في `views/opening-balance` داخل بطاقة `تسجيل رصيد أول المدة`:
   - `رقم مستند أول المدة` أصبح بصيغة فريدة ثابتة: `OB-000001` (Prefix + رقم تسلسلي مبني على `opening_balance_groups.id`).
   - `تاريخ المستند` أصبح بصيغة إنجليزية عبر `toLocaleDateString('en-GB')`.
- في قسم `الأصناف الجاهزة للحفظ` تم تحسين الشكل البصري (إطار/عمق/هيدر أوضح/فاصل إجراءات) داخل نفس الصفحة بدون أي تغيير في منطق الحفظ.
- تم توحيد بلوك `تسجيل رصيد أول المدة` بصريًا داخل قسم واحد مدمج (العنوان + زر إضافة صنف + بيانات المستند + جدول الأصناف + زر الحفظ) مع تقليل المسافات والفواصل الداخلية لتقليل الارتفاع المستهلك.
- إصلاح حقل `الصنف` داخل جدول الأصناف الجاهزة للحفظ:
   - تم توحيد سلوك قائمة `Autocomplete` مع نمط صفحة `views/sales` (داخل الجدول نفسه) لتفادي انحراف موضع القائمة.
   - تم إلغاء `autocomplete cache key` في صفوف أول المدة لأن الصف الأول يُرسم قبل تحميل الأصناف؛ وهذا كان يثبت قائمة فارغة ويمنع ظهور الخيارات.
   - تم تفعيل `autocomplete-show-all-on-click` مع `item-select` في حقل الصنف ليفتح من أول ضغطة وتظهر القائمة كاملة بدون قص.
   - تم رفع طبقات العرض (`z-index`) وفتح `overflow` داخل خلايا جدول القسم لضمان ظهور القائمة كاملة.
   - CSS Classes المضافة:
      - `.opening-balance-doc-meta`
      - `.pending-items-table-wrap`
      - `.pending-items-actions`

### Settings UI Structure (2026-04-12)

- الصفحة `settings/index.html` (عبر `settings.js`) أصبحت مقسمة بصريًا داخل الفورم إلى 4 أقسام واضحة:
   - بيانات المؤسسة
   - الشعار
   - العنوان
   - ملاحظات الفاتورة
- CSS Classes المضافة في `settings.css`:
   - `.settings-sections`
   - `.settings-subsection`
   - `.subsection-title`
   - `.subsection-title-main`
   - `.subsection-title-sub`
   - `.subsection-grid`
   - `.btn-upload-meta`
   - `.settings-save-bar`
   - `.btn-save.is-saving`
   - `.btn-save.is-success`
   - `.btn-save.is-error`
   - `.change-log-grid`
   - `.change-log-row`
   - `.change-log-label`
   - `.change-log-value`
   - `.btn-save.has-unsaved`
- سلوك إضافي في `settings.js`:
   - سجل تغييرات مستقل يعرض:
      - آخر تعديل
      - من عدّل
      - ماذا تم تغييره
   - تخزين السجل داخل مفاتيح `settings`:
      - `settings_last_modified_at`
      - `settings_modified_by`
      - `settings_change_summary`
   - تحذير عند مغادرة الصفحة إذا كانت هناك تغييرات غير محفوظة (`beforeunload` + تأكيد عند النقر على روابط التنقل) مع bypass مؤقت بعد الموافقة لتجنب قفل التنقل.

---

## 5) صفحات خارج Shell

| الصفحة | المسار | الملفات | APIs أساسية | Handler |
|---|---|---|---|---|
| Invite Gate | `views/invite/index.html` | `invite.css`, `invite.js` | `checkInviteStatus`, `getMachineId`, `submitInviteCode`, `notifyInviteUnlocked` | `handlers/auth.js` |
| Auth Gate | `views/auth/index.html` | `auth.css`, `auth.js`, `auth.api.js`, `auth.state.js`, `auth.ui.js` | `getAuthStatus`, `setupAuthAccount`, `loginAuthAccount`, `setAuthSessionToken`, `notifyAuthUnlocked` | `handlers/auth.js` |
| Shell Router | `views/shell/index.html` | `shell.css`, `shell.js` | `getAuthSessionToken`, `getMyPermissions` | `handlers/auth.js` + `ipcMain.handle('get-auth-session-token')` في `main.js` |

---

## 6) الملفات المشتركة الحرجة

- `frontend-desktop/src/renderer/assets/styles/main.css` (الثيم العام + قواعد RTL/LTR العامة)
- `frontend-desktop/src/renderer/css/navbar.css` (شريط التنقل)
- `frontend-desktop/src/renderer/assets/js/theme.js`
- `frontend-desktop/src/renderer/assets/js/i18n.js`
- `frontend-desktop/src/renderer/assets/js/toast.js`
- `frontend-desktop/src/renderer/assets/js/autocomplete.js`
- `frontend-desktop/src/renderer/assets/js/globalSearch.js`
- `frontend-desktop/src/renderer/assets/js/globalSearch.bootstrap.js`
- `frontend-desktop/src/renderer/assets/js/globalSearch.details.js`
- `frontend-desktop/src/renderer/assets/js/shared/navManager.js`
- `frontend-desktop/src/renderer/assets/js/permissionManager.js`

### UI Consistency Layer (2026-04-12)

- تم تطبيق طبقة توحيد UI مشتركة بدون أي تعديل في منطق الأعمال على الملفات التالية:
   - `frontend-desktop/src/renderer/assets/styles/main.css`
   - `frontend-desktop/src/renderer/assets/styles/themes/light.css`
   - `frontend-desktop/src/renderer/assets/styles/themes/dark.css`
   - `frontend-desktop/src/renderer/css/navbar.css`
   - `frontend-desktop/src/renderer/views/shell/shell.css`
- وتم تعزيز الاتساق البصري داخل الصفحات التشغيلية الأساسية بإضافة نفس الطبقة في:
   - `views/sales/sales.css`
   - `views/purchases/purchases.css`
   - `views/sales-returns/sales-returns.css`
   - `views/purchase-returns/purchase-returns.css`
   - `views/payments/payments.css`
   - `views/reports/reports.css`
   - `views/settings/settings.css`
   - `views/dashboard/dashboard.css`
- وتم استكمال التغطية لباقي صفحات `views` بنفس طبقة الاتساق في:
   - `views/customers/customers.css`
   - `views/items/items.css`
   - `views/items/units.css`
   - `views/inventory/inventory.css`
   - `views/opening-balance/opening-balance.css`
   - `views/finance/finance.css`
   - `views/customer-reports/customer-reports.css`
   - `views/reports/debtor-creditor/debtor-creditor.css`
   - `views/search/search.css`
   - `views/auth/auth.css`
   - `views/auth-users/auth-users.css`
   - `views/invite/invite.css`
   - `views/shell/shell.css`
- نطاق التغيير: تحسينات CSS فقط (focus states, controls, buttons, cards, tables, responsive spacing)، بدون تعديل IPC أو DB أو صلاحيات.

### Payments Balance Preview (2026-04-15)

- تم إضافة تلوين ديناميكي لمعاينة الرصيد داخل `views/payments` (الحالي/بعد العملية) لتمييز الحالات بصريًا:
   - `.preview-value.positive`
   - `.preview-value.negative`
   - `.preview-value.zero`
- التلوين يُطبّق من `treasury-page.shared.js` عبر تبديل الكلاسات على `#previewCurrentBalance` و `#previewAfterBalance` حسب إشارة الرصيد.

### Inventory Damaged Item Autocomplete (2026-04-30)

- في `views/inventory` شاشة `إدارة التالف`:
   - حقل `الصنف` (إضافة + تعديل) أصبح يدعم البحث بالكتابة والاختيار من قائمة `Autocomplete` بدل الاكتفاء بقائمة select التقليدية.
   - تم التفعيل عبر `item-select` + `autocomplete-show-all-on-click` مع `refresh()` عند تحديث خيارات الأصناف.

### Invoice/Return Previous-Next Navigation (2026-04-16)

- تم إضافة زرين `السابق` و`التالي` داخل نموذج المستند في الصفحات:
   - `views/sales`
   - `views/purchases`
   - `views/sales-returns`
   - `views/purchase-returns`
- السلوك يعتمد على البيانات الحالية بدون أي IPC جديد:
   - المبيعات: `getSalesInvoices`
   - المشتريات: `getPurchaseInvoices`
   - مردودات المبيعات: `getSalesReturns`
   - مردودات المشتريات: `getPurchaseReturns`
- عند الوصول لأول/آخر مستند، يتم تعطيل الزر المناسب وإظهار تنبيه واضح عند محاولة تجاوز الحدود.
- حالات التعطيل أصبحت واضحة بصريًا داخل نفس الزر (opacity + cursor + title) لإظهار أن الضغط غير متاح عند عدم وجود سابق/تالي.
- في صفحة `views/sales` فقط: عند فتح آخر فاتورة محفوظة ثم الضغط على `التالي` يتم فتح نموذج فاتورة بيع جديد فارغ (نفس حالة الدخول لأول مرة).
- في `views/sales`: موضع زرّي `السابق/التالي` داخل `form-title-row` بجوار نص `تسجيل فاتورة بيع جديدة` للحفاظ على شكل شبكة بيانات الفاتورة.
- في `views/purchases` و`views/sales-returns` و`views/purchase-returns`: تم توحيد نفس الموضع داخل `form-title-row` بجوار عنوان التسجيل.
- تم توحيد سلوك التنقل مع المبيعات في الصفحات الثلاث (`views/purchases`, `views/sales-returns`, `views/purchase-returns`): عند فتح آخر مستند محفوظ ثم الضغط على `التالي` يتم فتح نموذج جديد فارغ.
- في `views/sales-returns` و`views/purchase-returns`: تم توحيد سلوك قائمة اختيار العميل/المورد مع صفحة `views/sales` داخل حقول أعلى النموذج (ارتفاع قائمة ثابت 350px مع تمرير داخلي مستقل للقائمة).
- في نفس القائمتين (`views/sales-returns` و`views/purchase-returns`): تم تثبيت اتجاه الفتح لأسفل (`autocomplete-force-down`) للحقل العلوي حتى لا تظهر القائمة مقلوبة لأعلى عند اختلاف ارتفاع الشاشة.

### Customer Reports PDF Cleanup (2026-04-17)

- في `views/customer-reports`: تم تعطيل بناء شريط التنقل العلوي الداخلي من `customer-reports.bootstrap.js` (الدالة `buildTopNavHTML` تعيد قيمة فارغة) لتفادي ظهور شريط التنقل وروابطه داخل ملفات PDF عند التصدير.
- في handlers الخاصة بالتصدير (`main/handlers/reports.js` و `backend/src/desktop-compat/generated/handlers/reports.js`): تمت إضافة خطوة pre-capture لحظية عند تصدير PDF من داخل Shell لإخفاء `shell-top-nav` وتوسيع `shellFrame` على ارتفاع المحتوى قبل `printToPDF` ثم استرجاع الحالة بعد انتهاء التصدير.
- في بناء ملخص الأصناف داخل `customer-reports.bootstrap.js`: يتم عرض الأربع مجموعات دائمًا في PDF؛ كل مجموعة تبدأ من أول صفحة مستقلة، والمجموعة الفارغة يظهر جدولها برسالة `لا توجد بيانات` بدون صف إجماليات، مع فاصل صفحة بين المجموعات.
- تم ضبط كسر الصفحات في مجموعات الملخص ليعتمد على بداية كل مجموعة (`page-break-before`) بدون حجز ارتفاع صفحة إجباري؛ لتفادي دمج أول مجموعة مع صفحة الملخص، وتفادي تموضع الجداول الفارغة في منتصف الصفحة، ومنع الصفحة الفارغة الزائدة في النهاية.

### Sales Shift Closing (2026-04-17)

- في قائمة `المبيعات` داخل `navManager.js` خيار `إقفال وردية` أصبح يفتح مودال عام فوق الصفحة الحالية مباشرة (بدون التنقل إلى `views/sales`).
- تم فصل منطق المودال العام لإقفال الوردية داخل `assets/js/shared/navManager.js` ليعمل من أي شاشة (داخل `shell` أو خارجه).
- في `views/shell/shell.js` تم اعتراض نفس الرابط (`openShiftClose=1`) لفتح المودال العام بدل تغيير مسار الـ iframe.
- في `views/sales` تمت إضافة مودال داخلي لإقفال الوردية يشمل:
   - معاينة إجمالي المقبوض من آخر إقفال حتى اللحظة.
   - إدخال اختياري للمبلغ الفعلي في الدرج + فرق تلقائي.
   - ملاحظة + اسم المستخدم.
   - سجل إقفالات مع بحث + تعديل + حذف.
- في سجل إقفالات الوردية (المودال العام + مودال `views/sales`) تمت إضافة شريط حالة لوني لكل صف:
   - أخضر عند تطابق `drawer_amount` مع `sales_paid_total`.
   - أحمر عند وجود فرق بين القيمتين.
   - لون ثالث (`#f59e0b`) عند ترك `drawer_amount` فارغًا.
- في `handlers/sales.js`:
   - إلغاء ترحيل المدفوع إلى `treasury_transactions` عند حفظ/تحديث فاتورة البيع.
   - إضافة IPC جديدة لإدارة إقفالات الوردية (`preview/create/list/update/delete`) مع ترحيل مجمع للمالية عند الإقفال.
- في `preload.js` تمت إضافة APIs العامة لنفس قنوات إقفال الوردية.

### Treasury Guard Rule (2026-04-18)

- في `handlers/treasury.js` (الواجهة + نسخة التوافق): تم إضافة حارس يمنع تسجيل أي حركة `expense` عندما يكون رصيد الخزينة الحالي `<= 0`، مع رسالة خطأ واضحة للمستخدم.
- نفس الحارس يطبق عند تعديل حركة مالية إلى نوع `expense` (مع احتساب تأثير السجل الحالي قبل التعديل).
- تمت إضافة حارس إضافي يمنع `expense` إذا كانت قيمة السحب أكبر من الرصيد المتاح فعليًا في الخزينة (في الإضافة والتعديل).
- في `views/finance/finance.js`: تم استبدال تنبيهات `alert` في مسارات حفظ/تعديل/حذف الحركة بإشعارات `toast` غير حاجبة لتفادي تهنيج واجهة الكتابة بعد ظهور رسالة الخطأ.

### Non-Blocking Notifications (2026-04-18)

- تم إلغاء الاعتماد على `alert` في صفحات الواجهة (`frontend-desktop/src/renderer/views/*`) واستبداله بإشعارات غير حاجبة (`toast`) مع fallback إلى `console` عند غياب نظام التنبيهات.
- الصفحات التي تم تحديثها ضمن هذا التغيير: `finance`, `inventory`, `settings`, `invite`, `reports/debtor-creditor`, `payments/treasury-page.shared`, `customer-reports`.
- تم أيضًا استبدال `confirm/window.confirm` في الواجهة بدالة تأكيد غير حاجبة (`window.showConfirmDialog`) داخل `assets/js/toast.js`، مع تحديث مسارات الحذف/التأكيد في: `shared/navManager.js`, `sales/sales.bootstrap.js`, `finance/finance.js`, `inventory/inventory.js`, `reports/reports.bootstrap.js`, `sales-returns/sales-returns.bootstrap.js`, `purchase-returns/purchase-returns.bootstrap.js`, `opening-balance/opening-balance.bootstrap.js`, `items/items.crud.js`, `settings/settings.js`, `customer-reports/customer-reports.bootstrap.js`.
- لضمان عمل التأكيد غير الحاجب داخل Shell/iframe: `views/shell/index.html` أصبح يحمّل `assets/js/toast.js`، وتم إضافة bridge في `assets/js/shared/navManager.js` لتمرير `showConfirmDialog` من نافذة Shell إلى الصفحات الداخلية التي لا تحمّل toast مباشرة.

### Field System Base (2026-04-18)

- تم تجهيز طبقة أساسية موحدة للحقول (بدون تعميم الصفحات بعد) في:
   - `frontend-desktop/src/renderer/assets/styles/field-system.css`
   - `frontend-desktop/src/renderer/assets/js/fieldSystem.js`
- `main.css` أصبح يستورد `field-system.css` لتجهيز المتغيرات والأنماط المشتركة.
- الطبقة الأساسية تدعم توحيد: الأحجام (`lg/sm`)، الحالات (`focus/error/disabled/readonly`)، وتغليف `select/autocomplete`.
- خطة التعميم التفصيلية صفحة-بصفحة موجودة في:
   - `frontend-desktop/docs/field-system-rollout-plan.md`
- بدء أول تعميم فعلي على `views/sales` مع تفعيل النظام من `sales.bootstrap.js` عبر `window.FieldSystem.enable(document, { watch: true })`.
- في `views/sales/index.html` تم تحميل `assets/js/fieldSystem.js` قبل ملفات Bootstrap الخاصة بالصفحة.
- في `views/sales/sales.render.js` تم تحديد حقول مدمجة بـ `data-fs-size="sm"` (حقول صف الأصناف + خصم/مدفوع + بحث سجل إقفالات الوردية).
- في `views/sales/sales.css` تم حصر بعض القواعد المحلية لتعمل فقط عند غياب `fs-control` لتفادي تعارض الأولوية بعد تفعيل النظام الموحّد.
- بدء تعميم صفحة `views/purchases` بنفس نمط `sales` مع تفعيل النظام من `purchases.js` عبر `window.FieldSystem.enable(document, { watch: true })`.
- في `views/purchases/index.html` تم تحميل `assets/js/fieldSystem.js` قبل ملفات Bootstrap الخاصة بالصفحة.
- في `views/purchases/purchases.render.js` تم تحديد حقول مدمجة بـ `data-fs-size="sm"` (حقول صف الأصناف + خصم/مدفوع).
- في `views/purchases/purchases.css` تم حصر بعض القواعد المحلية لتعمل فقط عند غياب `fs-control` لتفادي تعارض الأولوية بعد تفعيل النظام الموحّد.
- بدء تعميم صفحة `views/sales-returns` بنفس نمط `sales` و`purchases` مع تفعيل النظام من `sales-returns.bootstrap.js` عبر `window.FieldSystem.enable(document, { watch: true })`.
- في `views/sales-returns/index.html` تم تحميل `assets/js/fieldSystem.js` قبل ملفات Bootstrap الخاصة بالصفحة.
- في `views/sales-returns/sales-returns.render.js` تم تحديد حقول مدمجة بـ `data-fs-size="sm"` في صفوف أصناف المرتجع (`return-qty-input`, `return-price-input`).
- في `views/sales-returns/sales-returns.css` تم حصر بعض القواعد المحلية لتعمل فقط عند غياب `fs-control` لتفادي تعارض الأولوية بعد تفعيل النظام الموحّد.
- في `assets/js/fieldSystem.js` تمت إضافة:
   - وراثة حجم الحقل تلقائيًا لمدخل `autocomplete-input` من الحقل المصدر (مثل `select[data-fs-size]`).
   - التعامل المباشر مع العناصر الديناميكية `autocomplete-list` و`autocomplete-item` أثناء الـ `MutationObserver`.

---

## 7) جداول قاعدة البيانات (الحالي)

### جداول `db.js`

`units`, `items`, `customers`, `suppliers`, `purchase_invoices`, `purchase_invoice_details`, `sales_invoices`, `sales_invoice_details`, `treasury_transactions`, `sales_shift_closings`, `settings`, `warehouses`, `opening_balances`, `opening_balance_groups`, `sales_returns`, `sales_return_details`, `purchase_returns`, `purchase_return_details`, `damaged_stock_logs`, `user_permissions`

### جداول تُنشأ من `handlers/auth.js`

`auth_users`, `auth_sessions`

### Migrations فعالة يجب الانتباه لها

- `items`: إضافة `reorder_level`, `is_deleted`.
- `customers`: إضافة `type`, `code`, `opening_balance`.
- `sales_invoices` و `purchase_invoices`: حقول الخصم + `paid_amount` + `remaining_amount` + `payment_type`.
- `treasury_transactions`: `customer_id`, `supplier_id`, `voucher_number` + trigger لتوليد رقم السند.
- `sales_shift_closings`: جدول إقفال ورديات المبيعات (`period_start_at`, `period_end_at`, `sales_paid_total`, `drawer_amount`, `difference_amount`, `notes`, `created_by`, `treasury_transaction_id`, `updated_at`) مع فهارس على `period_end_at` و`created_at`.
- `opening_balances`: إضافة `group_id`.
- Data Safety Guard Rails (في `frontend-desktop/src/main/db.js` و `backend/src/desktop-compat/db.js`):
   - Triggers تمنع `stock_quantity` السالب في `items`.
   - جدول `damaged_stock_logs` لتسجيل التالف مع خصم/إرجاع المخزون عبر IPC في `handlers/items.js`.
   - Triggers تمنع إدخال/تعديل كمية تالف أقل من أو تساوي صفر.
   - Triggers تمنع تكرار أرقام المستندات: `sales_invoices.invoice_number`, `purchase_invoices.invoice_number`, `sales_returns.return_number`, `purchase_returns.return_number`.

---

## 8) خريطة IPC حسب الملف (مختصر سريع)

- `handlers/auth.js`: المصادقة + المستخدمين + الصلاحيات + invite.
- `handlers/units.js`: الوحدات.
- `handlers/items.js`: الأصناف وحركات المخزون + سجل التالف (إضافة/عرض/تعديل/حذف).
- `handlers/customers.js`: العملاء + تقرير مدين/دائن.
- `handlers/purchases.js`: فواتير الشراء.
- `handlers/sales.js`: فواتير البيع + إقفال الوردية + الترحيل المجمع للمالية.
- `handlers/salesReturns.js`: مرتجعات البيع.
- `handlers/purchaseReturns.js`: مرتجعات الشراء.
- `handlers/treasury.js`: الخزينة + السندات.
- `handlers/openingBalances.js`: أرصدة أول المدة.
- `handlers/warehouses.js`: المخازن.
- `handlers/reports.js`: التقارير العامة + كشف حساب العميل + PDF.
- `handlers/invoices.js`: تفاصيل الفواتير/المرتجعات + الترقيم + الحذف.
- `handlers/settings.js`: الإعدادات + إحصائيات الداشبورد.
- `handlers/backup.js`: النسخ الاحتياطي المحلي + النسخ السحابي (Supabase Storage) + عرض النسخ السحابية + الاسترجاع المحلي/السحابي + إعادة التشغيل.

---

## 9) Checklist إلزامي عند أي إضافة/تعديل صفحة

1. تحديث ملف الصفحة داخل `views/...` (HTML/CSS/JS).
2. إضافة/تعديل Route في `navManager.js` (`buildTopNavItems`) عند الحاجة.
3. إضافة/تعديل صلاحية المسار في `shell.js` (`SHELL_HREF_TO_PERMISSION`).
4. إضافة مفتاح الصلاحية في `handlers/auth.js` (`PERMISSION_PAGES`) إذا الصفحة محمية.
5. إضافة/تعديل API في `preload.js` + `ipcMain.handle` في handler المناسب.
6. إذا التعديل يمس قاعدة البيانات أو IPC:
   - طبق نفس التعديل في `backend/src/desktop-compat/` (نسخة التوافق).
7. تحديث هذا الملف مباشرة في نفس التغيير.
