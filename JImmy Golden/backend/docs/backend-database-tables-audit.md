# حصر الجداول المستخدمة في الباك إند

## نطاق الفحص

- تم الفحص على كود الباك إند داخل `backend/src`.
- تم الاعتماد على تعريفات `CREATE TABLE IF NOT EXISTS` والاستعلامات الفعلية داخل الـhandlers.
- مصادر تعريف الجداول الأساسية:
  - `src/desktop-compat/db.js`
  - `src/desktop-compat/generated/handlers/auth.js`

## الملخص

- إجمالي الجداول المكتشفة فعليًا في الباك إند: `31` جدولًا.
- جميع الجداول التالية ظهرت في الكود بشكل صريح سواء في التعريف أو في الاستخدام الفعلي.

## 1. الجداول الأساسية والمرجعية

| الجدول | الغرض | مكان التعريف | الاستخدام الفعلي |
| --- | --- | --- | --- |
| `units` | جدول الوحدات | `src/desktop-compat/db.js:128` | `invoices`, `items`, `reports`, `units` |
| `items` | جدول الأصناف | `src/desktop-compat/db.js:136` | `auth`, `invoices`, `items`, `openingBalances`, `purchaseReturns`, `purchases`, `reports`, `sales`, `salesReturns`, `settings`, `warehouses` |
| `customers` | جدول العملاء والحسابات التي تُستخدم أيضًا كموردين حسب النوع | `src/desktop-compat/db.js:165` | `auth`, `customers`, `invoices`, `items`, `localSales`, `purchaseReturns`, `purchases`, `reports`, `sales`, `salesReturns`, `settings`, `treasury` |
| `suppliers` | جدول الموردين | `src/desktop-compat/db.js:205` | `suppliers` |
| `settings` | جدول الإعدادات العامة | `src/desktop-compat/db.js:495` | `auth`, `backup`, `settings` |
| `warehouses` | جدول المخازن | `src/desktop-compat/db.js:504` | `items`, `openingBalances`, `utils`, `warehouses` |

## 2. جداول المبيعات والمشتريات

| الجدول | الغرض | مكان التعريف | الاستخدام الفعلي |
| --- | --- | --- | --- |
| `sales_invoices` | جدول فواتير المبيعات | `src/desktop-compat/db.js:262` | `customers`, `invoices`, `items`, `reports`, `sales`, `salesReturns`, `settings`, `treasury` |
| `sales_invoice_details` | جدول تفاصيل فواتير المبيعات | `src/desktop-compat/db.js:290` | `invoices`, `items`, `reports`, `sales`, `settings` |
| `purchase_invoices` | جدول فواتير المشتريات | `src/desktop-compat/db.js:216` | `customers`, `invoices`, `items`, `purchaseReturns`, `purchases`, `reports`, `settings`, `treasury` |
| `purchase_invoice_details` | جدول تفاصيل فواتير المشتريات | `src/desktop-compat/db.js:244` | `invoices`, `items`, `purchases`, `reports` |
| `sales_returns` | جدول مردودات المبيعات | `src/desktop-compat/db.js:541` | `invoices`, `items`, `reports`, `salesReturns`, `settings` |
| `sales_return_details` | جدول تفاصيل مردودات المبيعات | `src/desktop-compat/db.js:557` | `invoices`, `items`, `reports`, `salesReturns`, `settings` |
| `purchase_returns` | جدول مردودات المشتريات | `src/desktop-compat/db.js:571` | `invoices`, `items`, `purchaseReturns`, `reports`, `settings` |
| `purchase_return_details` | جدول تفاصيل مردودات المشتريات | `src/desktop-compat/db.js:587` | `invoices`, `items`, `purchaseReturns`, `reports` |
| `local_sales` | جدول المبيعات المحلية | `src/desktop-compat/db.js:449` | `localSales` |
| `sales_shift_closings` | جدول إقفالات ورديات/شِفتات المبيعات | `src/desktop-compat/db.js:465` | `sales` |

## 3. جداول الخزينة والمصروفات

| الجدول | الغرض | مكان التعريف | الاستخدام الفعلي |
| --- | --- | --- | --- |
| `treasury_transactions` | جدول حركات الخزينة | `src/desktop-compat/db.js:304` | `customers`, `invoices`, `pettyBags`, `pettyExpenses`, `pettyInspection`, `pettyOperation`, `pettyShippingClearance`, `purchaseReturns`, `reports`, `sales`, `salesReturns`, `settings`, `treasury` |
| `petty_expenses` | جدول مصروفات نثرية عامة | `src/desktop-compat/db.js:326` | `pettyExpenses` |
| `petty_expenses_bags` | جدول مصروفات الأجولة/الشنط | `src/desktop-compat/db.js:340` | `pettyBags` |
| `petty_expenses_inspection` | جدول مصروفات الفحص | `src/desktop-compat/db.js:354` | `pettyInspection` |
| `petty_expenses_shipping_clearance` | جدول مصروفات التخليص والشحن | `src/desktop-compat/db.js:368` | `pettyShippingClearance` |
| `petty_expenses_operation` | جدول مصروفات التشغيل | `src/desktop-compat/db.js:382` | `pettyOperation` |

## 4. جداول المخزون والأرصدة

| الجدول | الغرض | مكان التعريف | الاستخدام الفعلي |
| --- | --- | --- | --- |
| `opening_balances` | جدول أرصدة أول المدة للأصناف داخل المخازن | `src/desktop-compat/db.js:512` | `items`, `openingBalances`, `warehouses` |
| `opening_balance_groups` | جدول تجميع أرصدة أول المدة | `src/desktop-compat/db.js:526` | `openingBalances` |
| `damaged_stock_logs` | جدول التالف وحركات خصم التالف من المخزون | `src/desktop-compat/db.js:615` | `items` |

## 5. جداول التحصيل والإيرادات

| الجدول | الغرض | مكان التعريف | الاستخدام الفعلي |
| --- | --- | --- | --- |
| `under_collection_records` | جدول أوراق/مبالغ تحت التحصيل | `src/desktop-compat/db.js:396` | `underCollection` |
| `remaining_under_collection_records` | جدول المتبقي من تحت التحصيل | `src/desktop-compat/db.js:420` | `remainingUnderCollection` |
| `export_revenues` | جدول إيرادات التصدير | `src/desktop-compat/db.js:435` | `exportRevenues` |

## 6. جداول الصلاحيات والمصادقة

| الجدول | الغرض | مكان التعريف | الاستخدام الفعلي |
| --- | --- | --- | --- |
| `auth_users` | جدول مستخدمي تسجيل الدخول | `src/desktop-compat/generated/handlers/auth.js:75` | `auth` |
| `auth_sessions` | جدول جلسات المستخدمين | `src/desktop-compat/generated/handlers/auth.js:301` | `auth` |
| `user_permissions` | جدول صلاحيات المستخدمين على الصفحات | `src/desktop-compat/db.js:601` | `auth` |

## ملاحظات مهمة من الفحص الفعلي

- `purchase_invoices.supplier_id` مرتبط بـ `customers(id)` وليس `suppliers(id)` حسب التعريف في `src/desktop-compat/db.js:230`.
- `purchase_returns.supplier_id` مرتبط أيضًا بـ `customers(id)` وليس `suppliers(id)` حسب التعريف في `src/desktop-compat/db.js:581`.
- جدول `suppliers` موجود فعليًا، لكن الاستخدام الأوسع داخل دورة الشراء والتقارير يعتمد كثيرًا على جدول `customers` مع حقل `type`.
- جدول `treasury_transactions` هو أكثر جدول مالي مركزيًا في المشروع، لأنه مرتبط بالمبيعات والمشتريات والمردودات والمصروفات النثرية والتقارير.
- جدولا `auth_users` و`auth_sessions` لا يتم تعريفهما في `db.js`، بل داخل `src/desktop-compat/generated/handlers/auth.js`.

## الخلاصة

هذا الحصر مبني على الكود الفعلي الموجود حاليًا في الباك إند، ويغطي الجداول التي تم تعريفها أو استخدامها بشكل صريح داخل المشروع وقت الفحص.
