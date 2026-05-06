# خطة إنهاء P1 و P2 بالكامل (100%)

## الملخص
- النطاق: `frontend-desktop` فقط.
- الهدف: إغلاق جميع فجوات P1 و P2 بنسبة 100% بدون تغيير سلوك المستخدم النهائي.
- قاعدة التنفيذ: أي تعديل يكون تدريجي، قابل للرجوع، ومع تحقق تكافؤ وظيفي قبل/بعد.
- خارج النطاق: P3 (سيتم إعداد ملف منفصل له بعد اكتمال P1 و P2).

## خط الأساس الحالي (من الكود الفعلي)
| المؤشر | الحالة الحالية | هدف الإغلاق |
|---|---:|---:|
| تعريفات `getNavHTML` داخل `views` | 16 ملف | 0 |
| تعريفات `t/fmt` المحلية داخل `views` | 18 ملف | <= 2 (مصدر موحد) |
| ملفات JS أكبر من 300 سطر داخل `frontend-desktop/src` | 25 | <= 12 |
| ملفات JS أكبر من 500 سطر داخل `frontend-desktop/src` | 6 | <= 4 |
| Inline handlers (`onclick/onchange/oninput`) داخل `renderer` | 16 (في ملفين) | <= 10 |
| تعريض globals على `window` داخل `renderer` | 40 | <= 8 |
| نمط تهيئة `DOMContentLoaded` | 21 | موحد بنمط واحد |

## تعريف "100%" لإنهاء P1 و P2
1. لا يوجد أي تعريف محلي `getNavHTML` داخل صفحات `renderer/views`.
2. لا يوجد تكرار helpers `t/fmt` إلا عبر مصدر/مصدرين موحدين كحد أقصى.
3. اكتمال استخدام `navManager` كمصدر التنقل الوحيد في كل الصفحات الأساسية.
4. تفكيك الملفات الثقيلة بحيث تحقق أرقام الأحجام المستهدفة (>300 و>500).
5. تقليل inline handlers إلى الحد الهدف بدون كسر السلوك.
6. تقليل globals على `window` إلى الحد الهدف مع إبقاء الضروري فقط.
7. نجاح سيناريوهات القبول الوظيفية الأساسية (Sales/Purchases/Returns/Reports/Auth).

---

## خطة P1 (إزالة التكرار البنيوي)

### P1-A توحيد Navigation بالكامل
**الهدف:** `navigation.json + navManager.js` يصبحان المصدر الوحيد للتنقل.

**الملفات المتبقية التي تحتوي `getNavHTML`:**
- `src/renderer/views/customer-reports/customer-reports.js`
- `src/renderer/views/customers/customers.js`
- `src/renderer/views/dashboard/dashboard.js`
- `src/renderer/views/finance/finance.js`
- `src/renderer/views/inventory/inventory.js`
- `src/renderer/views/items/items.js`
- `src/renderer/views/items/units.js`
- `src/renderer/views/opening-balance/opening-balance.js`
- `src/renderer/views/payments/treasury-page.renderer.js`
- `src/renderer/views/purchase-returns/purchase-returns.js`
- `src/renderer/views/purchases/purchases.js`
- `src/renderer/views/reports/debtor-creditor/debtor-creditor.js`
- `src/renderer/views/reports/reports.render.js`
- `src/renderer/views/sales/sales.js`
- `src/renderer/views/sales-returns/sales-returns.js`
- `src/renderer/views/settings/settings.js`

**خطوات التنفيذ:**
1. تثبيت Contract موحد لاستدعاء التنقل من `window.navManager.getTopNavHTML(...)`.
2. إزالة أي fallback HTML محلي للتنقل من كل صفحة.
3. منع أي بناء nav داخل render/template خارج `navManager`.
4. توحيد active state والبحث/placeholder من `navigation.json` فقط.
5. مراجعة شاملة لكل صفحة أساسية بعد التبديل.

**معيار القبول:**
- عداد تعريفات `getNavHTML` = 0 داخل `views`.
- لا اختلاف بصري/وظيفي في التنقل بين الصفحات.

### P1-B توحيد Helpers الترجمة/التنسيق
**الهدف:** إزالة التكرار المحلي `t/fmt` في الصفحات.

**الملفات المتبقية التي تعرف `t/fmt` محليًا (18 ملف):**
- `src/renderer/views/auth/auth.js`
- `src/renderer/views/auth-users/auth-users.js`
- `src/renderer/views/customer-reports/customer-reports.js`
- `src/renderer/views/customers/customers.js`
- `src/renderer/views/dashboard/dashboard.js`
- `src/renderer/views/finance/finance.js`
- `src/renderer/views/inventory/inventory.js`
- `src/renderer/views/items/items.js`
- `src/renderer/views/items/units.js`
- `src/renderer/views/opening-balance/opening-balance.js`
- `src/renderer/views/payments/treasury-page.shared.js`
- `src/renderer/views/purchase-returns/purchase-returns.js`
- `src/renderer/views/purchases/purchases.js`
- `src/renderer/views/reports/debtor-creditor/debtor-creditor.js`
- `src/renderer/views/reports/reports.js`
- `src/renderer/views/sales/sales.js`
- `src/renderer/views/sales-returns/sales-returns.js`
- `src/renderer/views/settings/settings.js`

**خطوات التنفيذ:**
1. اعتماد helper موحد على مستوى الصفحة (factory) من `i18n.js`.
2. إزالة التعريفات المحلية `function t` و`function fmt` أو `const t/fmt`.
3. توحيد fallback strategy بنفس سلوك الحالي.
4. مراجعة كل الرسائل الديناميكية (`fmt`) لضمان عدم كسر placeholders.

**معيار القبول:**
- تعريفات `t/fmt` المحلية <= 2 عبر المشروع.
- عدم ظهور نصوص fallback خاطئة أو مفاتيح ترجمة خام في الواجهة.

### P1-C توحيد Bootstrap Pattern
**الهدف:** نمط تهيئة واحد بدلا من اختلافات `DOMContentLoaded` المتكررة.

**خطوات التنفيذ:**
1. تثبيت نمط bootstrap موحد لكل صفحة: تحميل قاموس -> render -> bind events -> initial data.
2. إزالة التباينات غير الضرورية في ترتيب التهيئة بين الصفحات.
3. توحيد إدارة الأخطاء أثناء التهيئة (toast/alert/status).

**معيار القبول:**
- كل الصفحات الأساسية تتبع نفس تسلسل bootstrap.
- عدم وجود اختلافات سلوكية عند فتح الصفحة لأول مرة.

---

## خطة P2 (تفكيك الملفات الثقيلة وتقليل التشابك)

### P2-A تفكيك الملفات الأعلى خطورة حسب الأولوية
| الأولوية | الملف | الحجم الحالي | الهدف بعد التفكيك |
|---|---|---:|---:|
| 1 | `src/renderer/assets/js/globalSearch.js` | 1181 | <= 350 |
| 2 | `src/renderer/assets/js/globalSearch.details.js` | 723 | <= 250 |
| 3 | `src/renderer/views/purchase-returns/purchase-returns.js` | 609 | <= 300 |
| 4 | `src/renderer/views/sales-returns/sales-returns.js` | 570 | <= 300 |
| 5 | `src/renderer/views/customers/customers.js` | 512 | <= 300 |
| 6 | `src/renderer/views/sales/sales.js` | 496 | <= 300 |
| 7 | `src/renderer/views/opening-balance/opening-balance.js` | 494 | <= 320 |
| 8 | `src/renderer/views/auth-users/auth-users.js` | 488 | <= 280 |
| 9 | `src/renderer/views/customer-reports/customer-reports.js` | 478 | <= 300 |
| 10 | `src/renderer/views/reports/reports.js` | 469 | <= 320 |

**مبدأ التفكيك الثابت لكل صفحة ثقيلة:**
1. `state`
2. `services/api`
3. `renderers`
4. `events/actions`
5. `page-bootstrap` (ملف orchestration خفيف)

**معيار القبول:**
- بلوغ مؤشري الحجم المستهدفين: >300 <= 12 و >500 <= 4.
- ملف الصفحة الرئيسي يصبح orchestration فقط.

### P2-B إزالة Inline Handlers من القوالب
**الملفات الحالية المتأثرة:**
- `src/renderer/assets/js/globalSearch.js`
- `src/renderer/assets/js/globalSearch.details.js`

**خطوات التنفيذ:**
1. استبدال `onclick/onchange/oninput` داخل HTML templates بـ event delegation.
2. ربط handlers من root container مع `data-action`.
3. إزالة أي اعتماد على global function invocation من الـ template.

**معيار القبول:**
- inline handlers <= 10 عبر `renderer`.
- نفس السلوك الحالي للبحث والتنقل داخل مودال البحث.

### P2-C تقليل Globals على `window`
**الوضع الحالي:** 40 تعيين مباشر على `window`.

**خطوات التنفيذ:**
1. تصنيف globals إلى:
- ضروري (public bridge/UI API)
- قابل للعزل داخل module scope
2. تقليل exports العامة إلى نقاط دخول محدودة.
3. منع globals الجديدة أثناء التنفيذ.

**معيار القبول:**
- إجمالي globals على `window` <= 8.
- عدم كسر أي صفحة تعتمد على الـ bridge الحالي.

### P2-D استكمال النقاط غير المكتملة
**حالة معروفة:**
- `src/renderer/views/search/search.js` فارغ.

**خطوات التنفيذ:**
1. تحديد هل الصفحة مستخدمة فعليًا في navigation/route.
2. إن كانت مستخدمة: تنفيذ bootstrap + render + events بنفس النمط الموحد.
3. إن لم تكن مستخدمة: توثيق قرار واضح (keep/remove) بدون كسر المسارات.

**معيار القبول:**
- لا ملفات صفحات فارغة بدون قرار واضح.

---

## اختبارات القبول المطلوبة قبل اعتبار P1+P2 = 100%
1. فتح جميع الصفحات الأساسية بدون Console blocker errors.
2. رحلة مبيعات كاملة (إضافة/تعديل/حذف) مع تطابق النتائج قبل/بعد.
3. رحلة مشتريات كاملة مع تطابق الرصيد والمخزون.
4. رحلات المرتجعات (بيع/شراء) مع تطابق القيود والحركات.
5. اختبار الصلاحيات (admin/non-admin) على الصفحات الأساسية.
6. اختبار التنقل الكامل بعد إزالة أي nav templates محلية.
7. اختبار الترجمة لجميع النصوص الديناميكية بعد توحيد `t/fmt`.
8. اختبار البحث الشامل بعد إزالة inline handlers.

---

## أوامر التحقق الرقمي (PowerShell)
> تُستخدم كما هي لقياس الإغلاق الفعلي بالأرقام.

```powershell
# 1) عدد تعريفات getNavHTML في views (المطلوب = 0)
(Get-ChildItem "frontend-desktop/src/renderer/views" -Recurse -File -Filter "*.js" |
  Select-String -Pattern "function\s+getNavHTML\s*\(|const\s+getNavHTML\s*=|let\s+getNavHTML\s*=").Count

# 2) عدد تعريفات t/fmt المحلية في views (المطلوب <= 2)
(Get-ChildItem "frontend-desktop/src/renderer/views" -Recurse -File -Filter "*.js" |
  Select-String -Pattern "function\s+t\s*\(|const\s+t\s*=|let\s+t\s*=|function\s+fmt\s*\(|const\s+fmt\s*=|let\s+fmt\s*=").Count

# 3) عدد ملفات JS > 300 و > 500 داخل src
$stats = Get-ChildItem "frontend-desktop/src" -Recurse -File -Filter "*.js" |
  ForEach-Object { [PSCustomObject]@{ Path = $_.FullName; Lines = (Get-Content $_.FullName).Count } }
($stats | Where-Object { $_.Lines -gt 300 }).Count
($stats | Where-Object { $_.Lines -gt 500 }).Count

# 4) عدد inline handlers داخل renderer (js + html)
(Get-ChildItem "frontend-desktop/src/renderer" -Recurse -File |
  Where-Object { $_.Extension -in ".js", ".html" } |
  Select-String -Pattern "on(click|change|input)\s*=").Count

# 5) عدد تعيينات window.* داخل renderer js
(Get-ChildItem "frontend-desktop/src/renderer" -Recurse -File -Filter "*.js" |
  Select-String -Pattern "window\.[A-Za-z0-9_]+\s*=").Count
```

---

## ترتيب التنفيذ العملي (Waves)
### Wave 1 (إغلاق P1 بالكامل)
1. توحيد nav في كل الصفحات المتبقية.
2. توحيد t/fmt في كل الصفحات المتبقية.
3. تثبيت bootstrap موحد للتهيئة.
4. تشغيل اختبارات قبول P1 وتجميد baseline جديد.

### Wave 2 (P2 - تفكيك الملفات الحرجة)
1. `globalSearch.js` + `globalSearch.details.js`.
2. `purchase-returns.js` + `sales-returns.js`.
3. `customers.js` + `sales.js`.
4. إعادة قياس مؤشرات الحجم والتشابك.

### Wave 3 (P2 - إغلاق الأهداف الرقمية)
1. معالجة باقي الملفات القريبة من الحدود.
2. تقليل globals على `window` إلى الحد الهدف.
3. إغلاق ملف `search.js` الفارغ (تنفيذ أو قرار موثق).
4. إعادة اختبار الرحلات الأساسية كاملة.

---

## قرار الانتقال إلى P3
لا يتم إنشاء ملف P3 إلا بعد تحقق الشروط التالية كلها:
1. تحقيق أهداف P1 و P2 الرقمية بالكامل.
2. نجاح جميع اختبارات القبول الوظيفية.
3. توثيق نتائج القياس قبل/بعد داخل تقرير إغلاق نهائي.

> بعد تحقق البنود أعلاه بنسبة 100%، يتم إنشاء ملف منفصل لـ P3 مباشرة.
