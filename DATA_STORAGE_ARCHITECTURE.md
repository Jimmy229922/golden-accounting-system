# دليل تخزين البيانات الكامل

## الهدف من هذا الملف
هذا الملف يشرح طريقة تخزين البيانات في النظام بالكامل، من أول واجهة المستخدم لحد الحفظ الفعلي على القرص، سواء في وضع Electron المحلي أو وضع Backend RPC.

---

## 1) خريطة التخزين الفعلية

### 1.1 قاعدة البيانات الأساسية
- المحرك المستخدم: `better-sqlite3`.
- اسم الملف: `accounting.db`.

#### في تطبيق Electron (الواجهة المكتبية)
- مسار قاعدة البيانات يتم تحديده في:
  - `frontend-desktop/src/main/db.js`
- الكود يفتح القاعدة من:
  - `path.join(app.getPath('userData'), 'accounting.db')`

#### في وضع الإنتاج (Portable داخل APP_JS)
- قبل تحميل `db.js` يتم إعادة توجيه `userData` في:
  - `frontend-desktop/src/main/main.js`
- إلى:
  - `.../برنامج الحسابات/DATA/userData`
- النتيجة: القاعدة تكون في:
  - `.../برنامج الحسابات/DATA/userData/accounting.db`

#### في Backend RPC
- المسار يتم تحديده في:
  - `backend/src/desktop-compat/db.js`
- يعتمد على:
  - `BACKEND_DATA_DIR` لو موجود
  - وإلا `./data`
- النتيجة الافتراضية:
  - `backend/data/accounting.db`

### 1.2 ملفات إضافية غير SQLite

#### النسخ الاحتياطي التلقائي
- الملف:
  - `accounting-auto-backup.db`
- المسار الأساسي:
  - `.../برنامج الحسابات/DATA/`
- الملف المسؤول:
  - `frontend-desktop/src/main/autoBackup.js`

#### النسخ الاحتياطي اليدوي
- الملف الافتراضي:
  - `accounting-manual-backup.db`
- المجلد الافتراضي:
  - `.../برنامج الحسابات/PIC/`
- الملف المسؤول:
  - `frontend-desktop/src/main/handlers/backup.js`

#### ملفات PDF الناتجة من التقارير
- يتم حفظها عبر نافذة اختيار المسار (`Save Dialog`).
- المعالجة في:
  - `frontend-desktop/src/main/handlers/reports.js`
- الكتابة تتم بـ `fs.writeFileSync` بعد توليد PDF.

#### تخزين في المتصفح (Renderer)
- `localStorage`:
  - `theme` (الثيم)
  - `auth_session_token` (نسخة من توكن الجلسة)
- `sessionStorage`:
  - `user_permissions_cache` (كاش الصلاحيات)
- الملفات الأساسية:
  - `frontend-desktop/src/renderer/assets/js/theme.js`
  - `frontend-desktop/src/renderer/assets/js/permissionManager.js`
  - `frontend-desktop/src/renderer/views/auth/auth.api.js`
  - `frontend-desktop/src/renderer/views/shell/shell.js`

---

## 2) تدفق البيانات من الواجهة للحفظ

## 2.1 الوضع المحلي (Electron IPC)
1. صفحة Renderer تستدعي `window.electronAPI.*`
2. `preload.js` يعمل bridge عبر `contextBridge`
3. يتم `ipcRenderer.invoke(channel, args...)`
4. `ipcMain.handle(channel, handler)` في Main Process
5. الـ handler ينفذ SQL على SQLite
6. التغييرات تُكتب في `accounting.db` (وملفات WAL المصاحبة)

ملفات مرجعية:
- `frontend-desktop/src/main/preload.js`
- `frontend-desktop/src/main/handlers/index.js`
- `frontend-desktop/src/main/handlers/*.js`

## 2.2 الوضع البعيد (Remote Backend RPC)
1. إذا `USE_REMOTE_BACKEND=true` في `preload.js`
2. الاستدعاء يروح HTTP إلى:
   - `POST /api/rpc/{channel}`
3. السيرفر في:
   - `backend/src/app.js`
4. Runtime التوافقي يشغل نفس قنوات Electron handlers عبر mock:
   - `backend/src/compat/runtime.js`
5. الحفظ يتم في قاعدة backend:
   - `backend/src/desktop-compat/db.js`

ملحوظة مهمة:
- طبقة backend تحاكي `electron` (mock) أثناء التشغيل التوافقي، لذلك بعض قنوات معتمدة على UI dialogs قد لا تعمل بنفس سلوك الديسكتوب (مثل backup/restore التفاعلي عبر نافذة اختيار ملف).

---

## 3) الجداول الرئيسية في قاعدة البيانات

الجداول التي يتم إنشاؤها في `db.js`:
- `units`
- `items`
- `customers`
- `suppliers`
- `purchase_invoices`
- `purchase_invoice_details`
- `sales_invoices`
- `sales_invoice_details`
- `treasury_transactions`
- `settings`
- `warehouses`
- `opening_balances`
- `opening_balance_groups`
- `sales_returns`
- `sales_return_details`
- `purchase_returns`
- `purchase_return_details`
- `user_permissions`

جداول المصادقة (تُنشأ عبر Auth handler):
- `auth_users`
- `auth_sessions`

ملفات مرجعية:
- `frontend-desktop/src/main/db.js`
- `backend/src/desktop-compat/db.js`
- `frontend-desktop/src/main/handlers/auth.js`

---

## 4) قواعد الاتساق وسلامة البيانات

## 4.1 إعدادات SQLite المهمة
- `PRAGMA foreign_keys = ON`
- `PRAGMA journal_mode = WAL`
- `PRAGMA busy_timeout = 5000`
- `PRAGMA cache_size = -16000`
- `PRAGMA synchronous = NORMAL`

الملف:
- `frontend-desktop/src/main/db.js`

## 4.2 Migrations
- النمط المستخدم: `ALTER TABLE ...` داخل `try/catch` لتفادي كسر قواعد بيانات قديمة.
- يوجد helper أيضًا لإضافة أعمدة بأمان:
  - `runAddColumnMigration(...)`

أمثلة أعمدة تمت إضافتها بآلية migration:
- `items.is_deleted`
- `customers.type`
- `customers.code`
- `customers.opening_balance`
- `purchase_invoices.discount_*`, `paid_amount`, `remaining_amount`
- `sales_invoices.discount_*`, `paid_amount`, `remaining_amount`
- `treasury_transactions.voucher_number`

## 4.3 Unique + Trigger للـ Treasury Voucher
- يوجد migration لترقيم السندات بنمط:
  - `RCV-0001`, `PAY-0001`
- يوجد unique index على `voucher_number` (للحركات income/expense).
- يوجد trigger للتوليد التلقائي لو السند فارغ.

الملف:
- `frontend-desktop/src/main/db.js`

## 4.4 المعاملات (Transactions)
- العمليات الحساسة (حفظ/تعديل/حذف فواتير ومردودات وخزينة...) تتم داخل `db.transaction`.
- الهدف: ضمان atomicity بحيث كل التأثيرات (الرصيد + المخزون + الخزينة + التفاصيل) تتم معًا أو تتراجع معًا.

أمثلة ملفات:
- `frontend-desktop/src/main/handlers/sales.js`
- `frontend-desktop/src/main/handlers/purchases.js`
- `frontend-desktop/src/main/handlers/treasury.js`
- `frontend-desktop/src/main/handlers/salesReturns.js`
- `frontend-desktop/src/main/handlers/purchaseReturns.js`
- `frontend-desktop/src/main/handlers/invoices.js`
- `frontend-desktop/src/main/handlers/openingBalances.js`

---

## 5) كيف تتحرك البيانات عند أهم العمليات

## 5.1 حفظ فاتورة بيع
يتم داخل Transaction واحدة:
1. Insert header في `sales_invoices`
2. Insert details في `sales_invoice_details`
3. خصم المخزون من `items.stock_quantity`
4. إضافة حركة خزينة (`income`) لو في مدفوع
5. تعديل رصيد العميل (`customers.balance`) حسب المتبقي

الملف:
- `frontend-desktop/src/main/handlers/sales.js`

## 5.2 حفظ فاتورة شراء
داخل Transaction:
1. Insert header في `purchase_invoices`
2. Insert details في `purchase_invoice_details`
3. زيادة المخزون وتحديث تكلفة الصنف
4. إضافة حركة خزينة (`expense`) لو في مدفوع
5. تعديل رصيد المورد/الطرف في `customers.balance`

الملف:
- `frontend-desktop/src/main/handlers/purchases.js`

## 5.3 مردودات البيع/الشراء
- يتم عكس التأثيرات (مخزون/خزينة/رصيد) حسب نوع الفاتورة الأصلية (`cash` أو `credit`).
- الحفظ والتعديل والحذف كلها داخل معاملات.

الملفات:
- `frontend-desktop/src/main/handlers/salesReturns.js`
- `frontend-desktop/src/main/handlers/purchaseReturns.js`

## 5.4 الخزينة المباشرة (تحصيل/سداد)
- insert في `treasury_transactions` مع `voucher_number`.
- تعديل رصيد العميل/المورد المرتبط.
- عند الحذف يتم عكس التأثير.

الملف:
- `frontend-desktop/src/main/handlers/treasury.js`

## 5.5 أرصدة أول المدة
- حفظ وتجميع entries + تحديث مخزون الأصناف.
- إدارة مجموعات الأرصدة (`opening_balance_groups`) مع عكس/إعادة تطبيق عند التعديل.

الملف:
- `frontend-desktop/src/main/handlers/openingBalances.js`

---

## 6) النسخ الاحتياطي والاسترجاع

## 6.1 تلقائيًا عند بدء التشغيل
- `runStartupChecks()` يعمل:
  1. تنظيف النسخ القديمة
  2. `integrity_check`
  3. لو سليمة: إنشاء backup جديد
  4. لو تالفة: محاولة auto-restore

## 6.2 تلقائيًا عند الإغلاق
- `before-quit` يشغّل `handleQuitBackup()`.
- fallback: نسخ مباشر للملف لو backup API فشل.

## 6.3 استرجاع تلقائي عند التلف
- يبحث عن backup في `DATA` أو بجانب ملف القاعدة في userData.
- يحفظ النسخة التالفة باسم `*.corrupted-{timestamp}` ثم يستعيد.

الملفات:
- `frontend-desktop/src/main/main.js`
- `frontend-desktop/src/main/autoBackup.js`

## 6.4 النسخ/الاسترجاع اليدوي من الإعدادات
- `backup-database` عبر `db.backup(chosenPath)`
- `restore-database`:
  1. يأخذ Safety Backup أولًا
  2. يستبدل القاعدة
  3. يطلب إعادة تشغيل

الملفات:
- `frontend-desktop/src/main/handlers/backup.js`
- `frontend-desktop/src/renderer/views/settings/settings.js`

---

## 7) تخزين الإعدادات والهوية والجلسات

## 7.1 جدول settings
- عبارة عن Key-Value store عام.
- أمثلة بيانات محفوظة:
  - بيانات الشركة
  - `profileImage` (Base64 Data URL)
  - إعدادات الدعوة/الترخيص (`invite_code`, `invite_expiry`, `renew_count`)
  - flags داخلية مثل `treasury_voucher_scheme_v2`
  - snapshot auth legacy (`auth_username`, `auth_password_hash`, ...)

ملفات:
- `frontend-desktop/src/main/handlers/settings.js`
- `frontend-desktop/src/main/main.js`
- `frontend-desktop/src/main/handlers/auth.js`

## 7.2 جلسات المصادقة
- جدول `auth_sessions` يحفظ:
  - `token`
  - `user_id`
  - `created_at`
  - `last_seen_at`
  - `expires_at`
- صلاحية الجلسة: 14 يوم.
- يوجد نسخة in-memory في Main Process:
  - `authSessionToken` داخل `main.js`
- ويوجد نسخة في `localStorage` داخل renderer (`auth_session_token`).

ملفات:
- `frontend-desktop/src/main/handlers/auth.js`
- `frontend-desktop/src/main/main.js`
- `frontend-desktop/src/renderer/views/auth/auth.api.js`
- `frontend-desktop/src/renderer/views/shell/shell.js`

## 7.3 كاش الصلاحيات
- `sessionStorage` key: `user_permissions_cache`
- TTL الحالي: دقيقة واحدة.

الملف:
- `frontend-desktop/src/renderer/assets/js/permissionManager.js`

---

## 8) نقاط مهمة قبل أي تعديل مستقبلي

1. أي تعديل على schema أو IPC لازم يتطبق في النسختين:
   - `frontend-desktop/src/main/*`
   - `backend/src/desktop-compat/*`
2. لازم الحفاظ على منطق المعاملات لتفادي عدم اتساق الرصيد/المخزون.
3. `suppliers` و`customers` مستخدمين معًا حاليًا؛ في أجزاء النظام المورد يُحفظ داخل `customers` بنوع `supplier`.
4. ملف `settings` يعمل كمخزن عام لعدة أنواع بيانات، فلازم الحذر من تضارب المفاتيح.
5. وجود توكن في `localStorage` عمليًا سهل، لكن أمنيًا أقل صلابة من تخزين مشفر.

---

## 9) قائمة مراجع سريعة

- قاعدة البيانات (Electron):
  - `frontend-desktop/src/main/db.js`
- قاعدة البيانات (Backend compat):
  - `backend/src/desktop-compat/db.js`
- تهيئة التطبيق ومسار userData:
  - `frontend-desktop/src/main/main.js`
- النسخ الاحتياطي التلقائي:
  - `frontend-desktop/src/main/autoBackup.js`
- النسخ/الاسترجاع اليدوي:
  - `frontend-desktop/src/main/handlers/backup.js`
- bridge بين renderer وmain:
  - `frontend-desktop/src/main/preload.js`
- تسجيل كل قنوات IPC:
  - `frontend-desktop/src/main/handlers/index.js`
- runtime التوافقي للـ backend:
  - `backend/src/compat/runtime.js`
  - `backend/src/app.js`

---

## 10) ملخص تنفيذي سريع

- التخزين الأساسي: SQLite (`accounting.db`) مع WAL ومعاملات قوية.
- التخزين المساعد: backup DB files + PDF exports + local/session storage.
- تدفق البيانات واضح: Renderer -> Preload -> IPC/RPC -> Handlers -> DB.
- النظام يحاول الحفاظ على الاتساق عبر transactions وعكس التأثيرات عند التعديل/الحذف.
- النسخة الخلفية التوافقية تستخدم نفس منطق القنوات تقريبًا لكن عبر طبقة mock Electron.
