# خطة التوافق 100% بين Frontend وBackend

آخر تحديث: 2026-04-11
النطاق: هذه الخطة مبنية على مراجعة ملفات frontend-desktop وbackend الحالية داخل نفس المستودع.

## الهدف
الوصول إلى توافق كامل بين واجهة frontend-desktop وبين backend RPC بحيث لا توجد قنوات ناقصة، ولا عقود قديمة، ولا نتائج توافق مضللة.

## خط الأساس الحالي
1. frontend-desktop يعرض 95 method في preload.
2. قنوات invokeChannel الفعلية في frontend = 91 قناة.
3. backend contract الحالي في backend/src/contracts/public-channels.json = 87 قناة.
4. backend يسجل فعليا 91 handler.
5. تقرير التوافق الحالي في backend قد يظهر متوافقا رغم وجود extraChannels.

## الفجوات الحالية المؤثرة

### فجوة 1 (حرجة): عقد القنوات في backend أقدم من frontend
القنوات الموجودة في frontend invokeChannel وغير الموجودة في backend contract:
- get-machine-id
- get-my-permissions
- get-user-permissions
- update-user-permissions

الأثر:
- أي استدعاء RPC لهذه القنوات من وضع USE_REMOTE_BACKEND=true سيفشل برسالة Channel is not public.
- هذا يعني أن بعض مسارات auth/invite/permissions لن تعمل بشكل موثوق في وضع backend البعيد.

الملفات المعنية:
- frontend-desktop/src/main/preload.js
- backend/src/contracts/public-channels.json
- scripts/sync-backend-channel-contract.js

### فجوة 2 (حرجة): معيار isFullyCompatible غير صارم
الوضع الحالي:
- backend/src/compat/runtime.js يعتبر isFullyCompatible=true إذا missingChannels فقط تساوي صفر.
- لا يعتبر extraChannels فشل توافق.

الأثر:
- قد تحصل حالة "متوافق" رغم وجود drift بين العقد والتنفيذ.

الملف المعني:
- backend/src/compat/runtime.js

### فجوة 3 (متوسطة): فحص compat:check لا يكسر عند extraChannels
الوضع الحالي:
- backend/scripts/compatibility-check.js يفشل فقط عند missingChannels.

الأثر:
- التوافق قد يمر في CI رغم وجود قنوات مسجلة خارج العقد.

الملف المعني:
- backend/scripts/compatibility-check.js

### فجوة 4 (متوسطة): توثيق backend لا يعكس الاعتماد الحقيقي
الوضع الحالي:
- backend/README.md يذكر أن backend لا يحمّل frontend-desktop وقت التشغيل.
- بينما backend/src/desktop-compat/handlers/_loadFrontendHandler.js يحمّل handlers من frontend-desktop فعليا.

الأثر:
- تضارب توثيقي يسبب قرارات نشر خاطئة وصعوبة تتبع المشاكل.

الملفات المعنية:
- backend/README.md
- backend/src/desktop-compat/handlers/_loadFrontendHandler.js

## ما يجب تنفيذه للوصول إلى توافق 100%

## المرحلة P0 (إلزامي قبل أي إصدار)
1. تحديث عقد القنوات backend ليطابق invokeChannel في frontend (91 قناة).
2. تعديل runtime.js بحيث يكون isFullyCompatible=true فقط إذا:
- missingChannels.length === 0
- extraChannels.length === 0
3. تعديل compatibility-check.js ليعتبر extraChannels فشل أيضا.
4. تشغيل فحص نهائي:
- sync العقد
- compat check
- smoke tests

## المرحلة P1 (رفع الجودة ومنع تكرار المشكلة)
1. إضافة خطوة ثابتة قبل build/release:
- npm run sync:contract
- npm run backend:check
2. إضافة gate في CI يمنع الدمج إذا public-channels.json غير متزامن.
3. توسيع smoke tests لتشمل قنوات auth/permissions/invite الحرجة.
4. تحديث backend/README.md لشرح الاعتماد الحالي بوضوح.

## المرحلة P2 (تحسين معماري مستقبلي)
1. تقليل الاعتماد المباشر على frontend-desktop handlers في backend runtime.
2. اعتماد آلية مزامنة/توليد رسمية لطبقة desktop-compat داخل backend.
3. فصل واضح بين:
- قنوات Remote RPC
- قنوات Local Electron فقط (مثل auth-session-token, auth-unlocked, invite-unlocked, get-auth-session-token)

## تعريف التوافق 100% (Definition of Done)
1. backend contract channels = frontend invokeChannel channels تماما.
2. لا missingChannels ولا extraChannels في تقرير التوافق.
3. كل قنوات auth/permissions/invite تعمل في وضع USE_REMOTE_BACKEND=true.
4. compat:check يفشل عند أي drift.
5. README يعكس السلوك الحقيقي للتشغيل.

## أوامر تنفيذ موصى بها
1. من جذر المشروع:
- npm run sync:contract
- npm run backend:check
2. مراجعة الفرق قبل commit:
- backend/src/contracts/public-channels.json
- backend/src/compat/runtime.js
- backend/scripts/compatibility-check.js
- backend/README.md

## ملاحظات مهمة
1. قنوات ipcRenderer.send وipcRenderer.invoke المحلية ليست قنوات RPC عامة تلقائيا.
2. العقد العام في backend يجب أن يمثل invokeChannel فقط.
3. أي إضافة method جديدة في preload عبر invokeChannel يجب أن تتبعها مزامنة فورية للعقد.