# حالة الباك إند الحالية بالنسبة لفكرة النسخ الاحتياطي الأونلاين

تاريخ التوثيق: 2026-04-21

هدف هذا الملف: توثيق الوضع الحالي فقط كما هو في الكود الآن، بدون اقتراح تنفيذ أو ترحيل.

## 1) خريطة النظام الحالية

- النظام يعمل بطبقتين متزامنتين:
- طبقة Electron محلية في frontend-desktop/src/main.
- طبقة Backend RPC توافقية في backend/src/desktop-compat.
- مصدر الوصول من الواجهة: window.electronAPI عبر preload.js.
- عند تفعيل USE_REMOTE_BACKEND=true: نفس القنوات تتحول إلى POST /api/rpc/{channel} بدل IPC المحلي.

## 2) التخزين الفعلي الآن

- محرك البيانات: SQLite عبر better-sqlite3.
- ملف القاعدة: accounting.db.
- مسار القاعدة في Electron: app.getPath('userData')/accounting.db.
- في الوضع المحمول (Packaged): userData يتم تحويله إلى برنامج الحسابات/DATA/userData.
- مسار القاعدة في Backend RPC: BACKEND_DATA_DIR/accounting.db أو افتراضيا ./data/accounting.db.

## 3) تهيئة القاعدة والمخطط

- تهيئة القاعدة تتم في:
- frontend-desktop/src/main/db.js
- backend/src/desktop-compat/db.js
- الملفان متطابقان في البنية والمنطق.
- إعدادات SQLite الحالية:
- PRAGMA foreign_keys = ON
- PRAGMA journal_mode = WAL
- PRAGMA busy_timeout = 5000
- PRAGMA cache_size = -16000
- PRAGMA synchronous = NORMAL
- أسلوب التحديثات: ALTER TABLE داخل try/catch أو عبر runAddColumnMigration لتفادي كسر قواعد قديمة.

## 4) الجداول الحالية

### جداول الأعمال الأساسية (20)

- units
- items
- customers
- suppliers
- purchase_invoices
- purchase_invoice_details
- sales_invoices
- sales_invoice_details
- treasury_transactions
- sales_shift_closings
- settings
- warehouses
- opening_balances
- opening_balance_groups
- sales_returns
- sales_return_details
- purchase_returns
- purchase_return_details
- user_permissions
- damaged_stock_logs

### جداول الهوية والجلسات (2)

- auth_users
- auth_sessions

## 5) سلامة البيانات الحالية

- قيود FK مفعلة.
- يوجد فهارس أداء متعددة على الجداول الأساسية.
- يوجد Trigger لتوليد أرقام سندات الخزينة تلقائيا (RCV/PAY).
- يوجد Guard Rails في DB لمنع:
- مخزون سالب في items.
- كميات تالف <= 0.
- تكرار أرقام فواتير البيع والشراء والمردودات.

## 6) القنوات وحدود النقل

- عقد القنوات العامة (RPC/Public) حاليا: 98 قناة في backend/src/contracts/public-channels.json.
- القنوات المحلية فقط (غير RPC) حاليا: 4 قنوات في backend/src/contracts/local-electron-only-channels.json.
- القنوات المحلية فقط هي:
- auth-session-token
- auth-unlocked
- get-auth-session-token
- invite-unlocked

## 7) النسخ الاحتياطي والاسترجاع الآن

### تلقائي

- عند بدء التطبيق: runStartupChecks في frontend-desktop/src/main/autoBackup.js.
- يفحص integrity_check.
- عند سلامة القاعدة: ينشئ accounting-auto-backup.db داخل DATA.
- عند تلف القاعدة: يحاول استرجاع تلقائي من آخر نسخة متاحة (DATA أو بجانب القاعدة)، ويحفظ النسخة التالفة باسم .corrupted-{timestamp}.
- عند الإغلاق: before-quit في frontend-desktop/src/main/main.js ينفذ handleQuitBackup.
- عند فشل backup API: يستخدم handleQuitBackupFallback بنسخ مباشر للملف.

### يدوي

- القناة backup-database (frontend-desktop/src/main/handlers/backup.js):
- تستخدم dialog.showSaveDialog لاختيار المسار.
- تحفظ افتراضيا في برنامج الحسابات/PIC باسم accounting-manual-backup.db.
- القناة restore-database:
- تستخدم dialog.showOpenDialog لاختيار ملف النسخة.
- تنشئ safety backup باسم pre-restore-{timestamp}.db.
- تستبدل القاعدة الحالية وتعيد needsRestart=true.
- القناة restart-app تنفذ relaunch + quit.

## 8) ما يتم تحميله في Backend التوافقي فعليا

- backend/src/desktop-compat/handlers/*.js هي Wrappers.
- كل Wrapper يحمل نسخة مولدة من handlers الواجهة عبر _loadFrontendHandler.js.
- النسخ المولدة موجودة في backend/src/desktop-compat/generated/handlers.
- مزامنة هذه النسخ وعقود القنوات تتم عبر scripts/sync-backend-channel-contract.js.

## 9) الاعتماد على filesystem حاليا

- مجلد DATA يستخدم لتخزين النسخ التلقائية.
- مجلد PIC يستخدم كمسار افتراضي للنسخ اليدوية.
- في وضع Packaged يتم إنشاء اختصار تشغيل داخل المسار المحمول وعلى سطح المكتب.
- تصدير PDF في reports.js يعتمد على showSaveDialog ثم fs.writeFileSync.
- لا يوجد Object Storage خارجي أو رفع سحابي مدمج حاليا.

## 10) الهوية والجلسات في الوضع الحالي

- المصادقة محلية بجدولي auth_users و auth_sessions داخل نفس SQLite.
- مدة صلاحية الجلسة الحالية: 14 يوم.
- التوكن يتم حفظه في localStorage بالمفتاح auth_session_token مع نسخة في main process.
- كاش الصلاحيات في sessionStorage بالمفتاح user_permissions_cache (TTL دقيقة).
- نظام الدعوات/التفعيل مرتبط بمعرف الجهاز (Machine ID) وتجديدات renew_count داخل settings.

## 11) ملاحظة واقعية مهمة بالنسبة للنسخ الأونلاين

- backup/restore في الحالة الحالية مرتبطان بسلوك Electron Dialog المحلي.
- في Backend RPC يوجد Mock لـ dialog يعيد canceled=true.
- معنى ذلك: نفس تدفق النسخ اليدوي الحالي غير قابل للاستخدام بنفس الشكل عبر API بعيد بدون إعادة تصميم للتدفق.

## 12) خلاصة الحالة الحالية

- التخزين الآن SQLite محلي بالكامل.
- النسخ الاحتياطي الآن محلي بالكامل (تلقائي + يدوي).
- لا يوجد تخزين سحابي أو مزامنة متعددة الأجهزة في التصميم الحالي.
- أي تعديل مستقبلي في DB schema أو IPC يلزم تطبيقه على المسارين المتوازيين:
- frontend-desktop/src/main
- backend/src/desktop-compat
