# تقرير الفحص البرمجي والمعماري الشامل — نظام المحاسبة (الكود الفعلي: v10.1.0)

> [!CAUTION]
> **الحكم النهائي: النظام غير جاهز للإطلاق التجاري بنسبة 100%.**
> الجاهزية التقديرية الحالية **≈ 55%**. فيه **9 ثغرات حرجة (P0)** منها ثغرات تسمح بكسر الترخيص في دقائق من غير أي أدوات، وثغرات في السحابة ممكن تخلّي حد يقرأ أو يكتب في بيانات شركة تانية.

> [!NOTE]
> - الإصدار المكتوب في الكود هو `10.1.0` ([package.json](file:///d:/JImmy%20Golden/frontend-desktop/package.json#L3))، مش `10.0.0`.
> - الفحص كان على الكود الموجود في المستودع بس. **ما اتعملش أي اختبار على سيرفر الإنتاج** (لا صلاحيات Storage ولا الـ GRANTs اللي متطبقة فعلاً). استعلامات التأكد موجودة في القسم 9.

---

## ملخص تنفيذي (لوحة الحالة)

| # | المحور | الحالة | الخلاصة |
|---|---|---|---|
| 1 | محرك المزامنة السحابية | ⚠️ / ❌ | التشفير وقفل المعاملات سليمين. لكن **ممكن بيانات تضيع من غير ما حد يحس** في حالات حقيقية، وتسجيل الأجهزة مفتوح لأي حد |
| 2 | التسجيل التلقائي للعميل | ⚠️ | شغال من غير تدخل يدوي، بس دالة `register_client_device` **مكشوفة للعامة** وممكن تتستخدم لخطف الأجهزة |
| 3 | التراخيص وقفل الجهاز | ❌ | ممكن تكسرها بمتغير بيئة، أو بمفتاح سري مكتوب في الكود، أو بكود مدى الحياة ثابت. والقفل برقم الجهاز مش بيتفحص وقت التشغيل |
| 4 | العمليات المحاسبية | ⚠️ | الـ Triggers سليمة في أغلبها. فيه **خطأ مؤكد في سندات الخزينة لما الطرف يتغير**، وحذف العميل بيمسح كل حركاته المالية |
| 5 | النسخ الاحتياطي وعدم الفقد | ⚠️ / ❌ | **نسخة واحدة بتتكتب فوقها** على نفس القرص. `synchronous=NORMAL`. و`outbox_queue` **مش** سجل للحركات المالية |
| 6 | اكتمال ربط IPC | ✅ | كل القنوات الـ 179 اللي في `preload.js` ليها Handlers (ومنها القنوات اللي بتتعمل ديناميكياً). مفيش دوال ناقصة |
| + | الحماية العامة وضد الاختراق | ❌ | كلمة مرور طوارئ مخفية (Backdoor)، و`admin/admin` افتراضي، وDevTools مفتوحة في نسخة الإنتاج، والكود من غير توقيع ولا تشويش |

---

## 1. محرك المزامنة السحابية (Sync Engine + Edge Function)

### ✅ الحاجات السليمة فعلاً
- **توقيع Ed25519 صحيح:** الرسالة الموقّعة شكلها `timestamp.nonce.company_id.body` ([secureKeyStore.js](file:///d:/JImmy%20Golden/frontend-desktop/src/main/sync/secureKeyStore.js#L114-L132))، والتحقق منها بيتم على السيرفر بـ WebCrypto ([index.ts](file:///d:/JImmy%20Golden/supabase/functions/sync-ingest/index.ts#L198-L217)).
- **عزل الشركات عند الكتابة:** السيرفر بيجيب `company_id` من سجل الجهاز في `mobile_devices`، وما بياخدوش من العميل ([index.ts:L182](file:///d:/JImmy%20Golden/supabase/functions/sync-ingest/index.ts#L182)). ده تصميم صحيح.
- **قفل المعاملات:** `pg_advisory_xact_lock(hashtext(company_id))` ومعاه `FOR UPDATE` على `mobile_sync_meta` ([01_schema.sql](file:///d:/JImmy%20Golden/supabase/production-deployment/01_production_schema_and_security.sql#L339-L346)). النتيجة إن دفعات الشركة الواحدة بتتنفذ ورا بعض، والشركات المختلفة بتشتغل بالتوازي.
- **منع إعادة الإرسال:** فيه Nonce فريد، ونافذة وقت 5 دقائق، وحد أقصى 5MB للطلب و500 حدث للدفعة.
- **المفتاح المركّب `(company_id, id)`** بيمنع أي تصادم في المعرّفات بين الشركات.
- **الحمل من 50 لـ 100 عميل:** خفيف. كل عميل بيبعت طلب لما يكون فيه تغيير (الفحص كل 30 ثانية) ونبضة كل 60 ثانية، يعني تقريباً 2 طلب في الثانية. القفل الاستشاري ما بيعطلش شركة بسبب شركة تانية.

### ❌ مشاكل حرجة
| ID | المشكلة | الدليل |
|---|---|---|
| **C9** | **بيانات بتضيع في السحابة من غير أي تنبيه.** لو رقم التسلسل عند العميل أقل من أو يساوي آخر رقم عند السيرفر، السيرفر بيرجّع `success` بحالة `already_applied` **من غير ما ينفّذ حاجة**. العميل بيعتبرها نجحت ويحدّث جدول الظل، فالتغييرات دي **مش هتتبعت تاني أبداً**. ده بيحصل فعلاً لما: تعيد تثبيت البرنامج، أو يتمسح `sync_state.db`، أو تستعيد نسخة احتياطية، أو تنقل البرنامج لجهاز جديد | [01_schema.sql:L348-356](file:///d:/JImmy%20Golden/supabase/production-deployment/01_production_schema_and_security.sql#L348-L356) + [syncEngine.js:L718-735](file:///d:/JImmy%20Golden/frontend-desktop/src/main/sync/syncEngine.js#L718-L735) |
| **C6** | **ممكن أي حد يخطف جهاز أو يدخل على شركة تانية.** دالة `register_client_device` شغالة بصلاحية `SECURITY DEFINER` ومسموحة لـ `anon`، وفيها `ON CONFLICT (id) DO UPDATE SET company_id, public_key`. يعني أي حد معاه مفتاح anon (وهو مكتوب جوه البرنامج) يقدر يربط مفتاحه العام بأي `company_id`، وبعدها يكتب أو يمسح كشوف حسابات الشركة دي في السحابة | [07_telemetry.sql:L71-127](file:///d:/JImmy%20Golden/supabase/production-deployment/07_telemetry_and_auto_registration.sql#L71-L127) |
| **C6b** | **قائمة كل العملاء مكشوفة.** سياسة RLS على `client_licenses` فيها `FOR SELECT TO anon USING (true)`، فأي حد يقدر يقرا كل الـ `company_id` وأسماء الشركات وأرقام الأجهزة. ودي بالظبط المعلومة اللي محتاجها عشان ينفّذ C6 | [06_licenses.sql:L225-230](file:///d:/JImmy%20Golden/supabase/production-deployment/06_client_licenses_system.sql#L225-L230) |
| C3b | **أكتر من عميل بيتسجلوا تحت نفس `company_id`.** أي قاعدة بيانات فيها فواتير وما فيهاش `company_id` (نسخة قديمة اتعملها استعادة مثلاً) بتاخد المعرّف الثابت `715526d2-...`، وده معرّف العميل الأصلي. النتيجة إن بيانات أكتر من عميل بتتخلط في شركة واحدة | [main.js:L499-507](file:///d:/JImmy%20Golden/frontend-desktop/src/main/main.js#L499-L507)، [licenseService.js:L42-49](file:///d:/JImmy%20Golden/frontend-desktop/src/main/licenseService.js#L42-L49) |

### ⚠️ مشاكل متوسطة
- **جدول `mobile_sync_nonces` بيكبر من غير حد:** مفيش أي تنظيف دوري. مع 100 عميل بيوصل لحوالي 144 ألف صف في اليوم من النبضات لوحدها.
- **تبعيات Edge Function مثبتة على نسخ قديمة** (`std@0.177.0`). ولازم تتأكد إن `SUPABASE_DB_URL` بيستخدم **Pooler على المنفذ 6543**، مش اتصال مباشر.
- **أي خطأ في إدخال الـ Nonce بيتعامل على إنه "هجوم إعادة إرسال"**، حتى لو السبب حاجة تانية (FK مثلاً).
- **أنواع الحركات اللي مش معروفة بتتحول لـ `opening_balance`** في السحابة ([syncEngine.js:L287-294](file:///d:/JImmy%20Golden/frontend-desktop/src/main/sync/syncEngine.js#L287-L294)).
- **مفيش مطابقة دورية** (Checksum للأرصدة) بين المحلي والسحابة في وضع Delta. وضع Bootstrap فيه تحقق، لكن البرنامج ما بيستخدموش.

---

## 2. التسجيل التلقائي للعميل الجديد (Onboarding)

- ✅ أول تشغيل بيعمل `company_id` عشوائي ومفتاح Ed25519 جديد، وبيستدعي `register_client_device` **عند إكمال المعالج وكمان مع كل تشغيل** ([main.js:L587-621](file:///d:/JImmy%20Golden/frontend-desktop/src/main/main.js#L587-L621)، [L679-685](file:///d:/JImmy%20Golden/frontend-desktop/src/main/main.js#L679-L685)). يعني فعلاً **مفيش تدخل يدوي**.
- ⚠️ **الشاشة ما بتعرضش الفشل:** `showOnboardingWizardModal` بتقفل حتى لو الـ Handler رجّع `{success:false}` ([dashboard.js:L772-780](file:///d:/JImmy%20Golden/frontend-desktop/src/renderer/views/dashboard/dashboard.js#L772-L780)).
- ⚠️ **سباق في التوقيت:** التسجيل بيتعمل من غير انتظار (fire-and-forget)، وأول إرسال للمزامنة بيحصل قبل ما يخلص، فبيترفض بـ 403 وينجح بعد 30 ثانية ([main.js:L679-687](file:///d:/JImmy%20Golden/frontend-desktop/src/main/main.js#L679-L687)).
- ⚠️ **كود الشركة = أول 8 حروف من الـ UUID وعليه `UNIQUE`.** لو حصل تصادم (نادر)، تسجيل العميل ده هيفشل على طول من غير أي رسالة ([07:L86-93](file:///d:/JImmy%20Golden/supabase/production-deployment/07_telemetry_and_auto_registration.sql#L86-L93)).
- ❌ **المفتاح الخاص للجهاز محمي بشكل ضعيف:** `loadOrCreateDeviceIdentity(storageDir)` بتتنادى **من غير `safeStorage`** ([main.js:L606](file:///d:/JImmy%20Golden/frontend-desktop/src/main/main.js#L606)، [L651](file:///d:/JImmy%20Golden/frontend-desktop/src/main/main.js#L651)). فمفتاح التشفير بيبقى `SHA256(COMPUTERNAME)` ([secureKeyStore.js:L30](file:///d:/JImmy%20Golden/frontend-desktop/src/main/sync/secureKeyStore.js#L30))، وده عملياً زي إنه نص مكشوف. كمان **لو اسم الجهاز اتغير، فك التشفير بيفشل والمزامنة بتقف على طول** ([L72-75](file:///d:/JImmy%20Golden/frontend-desktop/src/main/sync/secureKeyStore.js#L72-L75)).

---

## 3. نظام التراخيص وقفل الجهاز

> [!WARNING]
> نظام الترخيص الحالي **ممكن يتكسر في أقل من دقيقة**، ومن غير ما تحتاج أي أداة اختراق.

| ID | طريقة الكسر | الدليل |
|---|---|---|
| **C2** | **متغير البيئة `INVITE_DURATION_DAYS=36500`** قبل أول تشغيل بيدي تجربة 100 سنة محلياً، **وبيتبعت كمان للسحابة** في `p_trial_days`، والسحابة بتقبله زي ما هو | [inviteConfig.js:L7](file:///d:/JImmy%20Golden/frontend-desktop/src/main/inviteConfig.js#L7)، [licenseService.js:L100](file:///d:/JImmy%20Golden/frontend-desktop/src/main/licenseService.js#L100)، [06:L124](file:///d:/JImmy%20Golden/supabase/production-deployment/06_client_licenses_system.sql#L124) |
| **C1** | **المفتاح الرئيسي لتوليد أكواد التفعيل مكتوب في الكود بـ Base64**، وكمان ممكن يتبدل بمتغير البيئة `INVITE_MASTER_KEY`. يعني أي حد يقدر يعمل برنامج يولّد أكواد (Keygen) | [inviteConfig.js:L8-9](file:///d:/JImmy%20Golden/frontend-desktop/src/main/inviteConfig.js#L8-L9)، [generate-invite-code.js:L15](file:///d:/JImmy%20Golden/scripts/generate-invite-code.js#L15) |
| **C1b** | **كود مدى الحياة ثابت:** `GOLDEN-PRO-2026-LIFETIME` | [licenseService.js:L284](file:///d:/JImmy%20Golden/frontend-desktop/src/main/licenseService.js#L284) |
| **C3** | **مسح صف `license_status` من جدول `settings`** (وقاعدة البيانات فيها فواتير) بيحوّل الترخيص لـ **مدى الحياة** | [licenseService.js:L28-37](file:///d:/JImmy%20Golden/frontend-desktop/src/main/licenseService.js#L28-L37) |
| **C4** | **القفل برقم الجهاز مش متطبق وقت التشغيل:** `isLicenseCurrentlyValid` ما بتفحصش `machineId` خالص. لو نسخت فولدر `DATA` لأي جهاز تاني هيشتغل عادي. ولو منعت دومين Supabase، البرنامج بيعتمد على إعدادات محلية مش مشفرة | [licenseService.js:L250-270](file:///d:/JImmy%20Golden/frontend-desktop/src/main/licenseService.js#L250-L270) |
| **C5** | **أي حد يقدر يجدد أي ترخيص:** `renew_client_license` ما فيهاش `REVOKE` لـ PUBLIC/anon، والبرنامج نفسه بيناديها بمفتاح anon. يعني أي حد يقدر يمدد ترخيص أي شركة بلا حدود | [06:L178-233](file:///d:/JImmy%20Golden/supabase/production-deployment/06_client_licenses_system.sql#L178-L233)، [licenseService.js:L115-135](file:///d:/JImmy%20Golden/frontend-desktop/src/main/licenseService.js#L115-L135) |
| C4b | **إعادة التجربة من الأول:** امسح `company_id` → يتعمل UUID جديد → السحابة تدّي تجربة جديدة | [licenseService.js:L42-49](file:///d:/JImmy%20Golden/frontend-desktop/src/main/licenseService.js#L42-L49) |
| H4b | **`save-settings` بيكتب أي مفتاح** ومنها `license_status` و`invite_expiry` و`company_id` | [settings.js:L478-493](file:///d:/JImmy%20Golden/frontend-desktop/src/main/handlers/settings.js#L478-L493) |

### أخطاء وظيفية في الترخيص (بتأذي العميل اللي دفع)
- **H6:** لو اتفعّل كود **مدى الحياة**، السحابة بتسجّله `active` لمدة 30 يوم بس، ومع أول اتصال **قيمة السحابة بتغلب** والعميل بيرجع لـ 30 يوم ([licenseService.js:L150-203](file:///d:/JImmy%20Golden/frontend-desktop/src/main/licenseService.js#L150-L203)، [L316](file:///d:/JImmy%20Golden/frontend-desktop/src/main/licenseService.js#L316)).
- **H6b:** لو العميل فعّل وهو **من غير نت**، التجديد ما بيوصلش للسحابة. وأول ما يتصل، السحابة بترجّع "منتهي" و**العميل اللي دفع بيتقفل عليه البرنامج**.
- ✅ حساب الأيام المتبقية (`Math.ceil`) سليم، ومدة التجربة 15 يوم.
- ⚠️ **كشف التلاعب في الساعة ضعيف:** بيكشف بس لو الساعة رجعت لقبل تاريخ بداية التجربة. وكمان الترخيص **بيتفحص مرة واحدة عند التشغيل** ([licenseService.js:L219-232](file:///d:/JImmy%20Golden/frontend-desktop/src/main/licenseService.js#L219-L232)).

---

## 4. العمليات المحاسبية ودفتر الأستاذ `party_ledger`

### ✅ السليم
- Triggers الفواتير (بيع وشراء) شغالة جوه نفس معاملة SQLite، يعني تحديث الرصيد ذري ([db.js:L1084-1181](file:///d:/JImmy%20Golden/frontend-desktop/src/main/db.js#L1084-L1181)).
- دفعات الفواتير المرتبطة ما بتسجلش `customer_id`، فمفيش خصم مكرر.
- رصيد السحابة = `SUM(party_ledger)` المحسوب محلياً، فهو **مطابق للمحلي طول ما المزامنة شغالة صح**.

### ❌ مشاكل
| ID | المشكلة | الدليل |
|---|---|---|
| **H1** | **خطأ مؤكد في سندات الخزينة.** Trigger التعديل `AFTER UPDATE OF amount, type, transaction_date` **ما بيحدّثش `party_id`**، مع إن التعديل بيغيّر `customer_id`. النتيجة: (A→B) السند يفضل على A. (فاضي→B) السند ما يظهرش في كشف B. (A→فاضي) يفضل سطر قديم عند A. **كشوف الحسابات بتطلع غلط، والسحابة بتنسخ نفس الغلط** | [db.js:L1202-1214](file:///d:/JImmy%20Golden/frontend-desktop/src/main/db.js#L1202-L1214) + [treasury.js:L250-258](file:///d:/JImmy%20Golden/frontend-desktop/src/main/handlers/treasury.js#L250-L258) |
| **H2** | **حذف العميل بيمسح كل فواتيره وسنداته ومبيعاته المحلية نهائياً (Hard Delete)**، ومفيش أي سجل تدقيق. ده بيتعارض مباشرة مع مبدأ "استحالة فقد أي حركة مالية" | [customers.js:L209-248](file:///d:/JImmy%20Golden/frontend-desktop/src/main/handlers/customers.js#L209-L248) |
| M | **عدم اتساق في الصيغ:** Trigger إدخال المشتريات بيستخدم `-(remaining_amount)`، والترحيل الأولي بيستخدم `-(total - paid)`. وده بيفرق في النتيجة لو القيمتين مش متساويتين | [db.js:L1155](file:///d:/JImmy%20Golden/frontend-desktop/src/main/db.js#L1155) مقابل [L1281](file:///d:/JImmy%20Golden/frontend-desktop/src/main/db.js#L1281) |

> **التطابق 100% بين المحلي والسحابة مش مضمون حالياً** بسبب C9 وC6 وH1.

---

## 5. أمان البيانات والنسخ الاحتياطي

> [!IMPORTANT]
> **`outbox_queue` مش سجل للحركات المالية.** دي طابور مزامنة لنسخة مشتقة من البيانات. **المصدر الوحيد للحقيقة هو `accounting.db`**، فحماية الحركات المالية معتمدة بالكامل على SQLite والنسخ الاحتياطي.

| ID | المشكلة | الدليل |
|---|---|---|
| **H3** | **نسخة احتياطية واحدة بتتكتب فوقها** مع كل تشغيل وكل إغلاق. لو حصل حذف بالغلط وبعده إعادة تشغيل، النسخة الاحتياطية **بتتبدل بالحالة البايظة** | [autoBackup.js:L223-258](file:///d:/JImmy%20Golden/frontend-desktop/src/main/autoBackup.js#L223-L258) |
| H3b | **النسخ القديمة اللي عليها تاريخ بتتمسح بشكل مقصود** | [autoBackup.js:L138-158](file:///d:/JImmy%20Golden/frontend-desktop/src/main/autoBackup.js#L138-L158) |
| H3c | **النسخ على نفس القرص ونفس الفولدر** (`APP_JS\DATA` و`DATA\userData`). مفيش نسخة تلقائية خارجية | [autoBackup.js:L43-49](file:///d:/JImmy%20Golden/frontend-desktop/src/main/autoBackup.js#L43-L49) |
| H3d | **`synchronous = NORMAL` مع WAL:** ما بيحصلش تلف، لكن **لو الكهرباء قطعت ممكن آخر معاملات تضيع** | [db.js:L213](file:///d:/JImmy%20Golden/frontend-desktop/src/main/db.js#L213) |
| ✅ | `quick_check` عند التشغيل، واستعادة تلقائية، واستخدام `db.backup()` اللي بيدّي نسخة متسقة | [autoBackup.js:L264-293](file:///d:/JImmy%20Golden/frontend-desktop/src/main/autoBackup.js#L264-L293) |
| ⚠️ | **قاعدة البيانات مش مشفرة.** أي حد يوصل للملف يقرا كل البيانات | — |

---

## 6. اكتمال ربط الشاشات والـ Handlers

- ✅ **القنوات المكشوفة في [preload.js](file:///d:/JImmy%20Golden/frontend-desktop/src/main/preload.js): 179 قناة، وكلها ليها Handler.** قنوات المصروفات (`petty`, `bags`, `inspection`, `shipping-clearance`, `operation`, `factory-petty`) بتتسجل بشكل ديناميكي بـ Template Strings، واتأكدت منها يدوياً.
- ✅ مفيش Handlers يتيمة تأثر على الشغل.
- ❌ **التحقق من الصلاحيات في Main Process ناقص:** حوالي **24 Handler بس من أصل حوالي 140** بيستدعوا `requirePermission`. الباقي ما فيهوش أي فحص: النسخ والاستعادة، والتقارير، والمصروفات، والعمال، والمبيعات المحلية، وإيرادات التصدير، وتحت التحصيل. الصلاحيات في الأماكن دي بتتطبق في الواجهة بس.

---

## 7. الحماية العامة ومحاولات الاختراق

| ID | الثغرة | الدليل |
|---|---|---|
| **C8** | **كلمة مرور طوارئ مخفية (Backdoor):** عبارة عن SHA-256 من غير Salt، وبتدخل **بأي اسم مستخدم في كل نسخ العملاء** | [auth.js:L531-534](file:///d:/JImmy%20Golden/frontend-desktop/src/main/handlers/auth.js#L531-L534) |
| **C8b** | **حساب `admin/admin` افتراضي** | [auth.js:L68-69](file:///d:/JImmy%20Golden/frontend-desktop/src/main/handlers/auth.js#L68-L69) |
| **C7** | **النسخ الاحتياطي السحابي شغال بمفتاح anon** مع `prefix` و`objectPath` بيتحددوا من الواجهة، ومعاه `x-upsert`. لو صلاحيات الـ Bucket سامحة (ولازم تكون سامحة عشان الميزة تشتغل أصلاً)، يبقى **أي حد يقدر يشوف قائمة نسخ كل العملاء وينزّلها أو يكتب فوقها**، والنسخ دي ملفات DB كاملة ومش مشفرة. **محتاج تتأكد منه على السيرفر** | [backup.js:L237-239](file:///d:/JImmy%20Golden/frontend-desktop/src/main/handlers/backup.js#L237-L239)، [L381-530](file:///d:/JImmy%20Golden/frontend-desktop/src/main/handlers/backup.js#L381-L530) |
| H4 | **DevTools بتتفتح في نسخة الإنتاج بـ `Ctrl+Shift+I`**، ومنها تقدر توصل لكل `electronAPI` | [windowManager.js:L267-279](file:///d:/JImmy%20Golden/frontend-desktop/src/main/windowManager.js#L267-L279) |
| H4c | **رسالة `invite-unlocked` من الواجهة بتتصدق من غير أي تحقق** من الترخيص في Main | [windowManager.js:L152-160](file:///d:/JImmy%20Golden/frontend-desktop/src/main/windowManager.js#L152-L160) |
| H7 | **مفيش توقيع للكود، ولا تشويش، والـ asar سهل تفكه، ومفيش Electron Fuses.** وكمان `electron: "latest"` فالبناء مش ممكن يتكرر بنفس النتيجة | [package.json:L14-50](file:///d:/JImmy%20Golden/frontend-desktop/package.json#L14-L50) |
| M | **`quit-and-install-app-update` بيفتح أي مسار جاي من الواجهة** بـ `shell.openPath` | [settings.js:L855-866](file:///d:/JImmy%20Golden/frontend-desktop/src/main/handlers/settings.js#L855-L866) |
| M | **سجلات الأخطاء `client_error_logs` ممكن يقراها أي مستخدم موبايل من أي شركة**، و`report_client_error` مفتوحة لـ anon (ممكن تتغرق بطلبات وهمية) | [07:L22-25](file:///d:/JImmy%20Golden/supabase/production-deployment/07_telemetry_and_auto_registration.sql#L22-L25) |

### البيانات الحساسة في الكود ومجلد العمل
- ✅ **مفيش `service_role key` مكتوب في الكود.** المفتاح الموجود هو `anon`، وده عام بطبيعته. لكن خلي بالك إن ملف `SUPABASE_LOCAL_CREDENTIALS.md` مسميه `SECRET_KEY` بالغلط.
- ❌ **أسرار مكتوبة في الكود:** المفتاح الرئيسي للتفعيل، وكود مدى الحياة، وهاش كلمة مرور الطوارئ، ومعرّف الشركة الأصلية.
- ⚠️ **ملفات حساسة موجودة في مجلد العمل:** قواعد بيانات حقيقية في `APP_JS/DATA` و`data/` و`backend/data` و`APP_JS/PIC/*-cloud.db`، وكمان `APP_JS/DATA/device_sync_identity.json`. وملف [حالة_البرنامج_والحماية.md](file:///d:/JImmy%20Golden/%D8%AD%D8%A7%D9%84%D8%A9_%D8%A7%D9%84%D8%A8%D8%B1%D9%86%D8%A7%D9%85%D8%AC_%D9%88%D8%A7%D9%84%D8%AD%D9%85%D8%A7%D9%8A%D8%A9.md) فيه أكواد قديمة.
- ⚠️ **لو المستودع `golden-accounting-system` عام على GitHub** (وهو نفس مصدر التحديثات)، يبقى **كل الأسرار اللي فوق متاحة لأي حد**.

### هل فك أو اختراق التطبيق مستحيل؟
**لأ.** مفيش برنامج Electron ومحفوظ عند العميل يستحيل فكه. الهدف الواقعي إن **تكلفة الكسر تبقى أعلى من سعر الاشتراك**. الوضع الحالي إن الكسر ممكن **من غير أي أدوات** (متغير بيئة واحد).

---

## 8. خطة الإصلاح بالأولوية

### المرحلة P0 (قبل أي بيع)
1. **ترخيص يصدره السيرفر وموقّع:** السيرفر يوقّع Token فيه (`company_id`, `machine_id`, `expires_at`, `status`) بمفتاح Ed25519 خاص بيه، والبرنامج يتحقق منه بالمفتاح العام المضمّن، **ويفحص `machineId` مع كل تشغيل وكل ساعة**. وتشيل `_MK` و`GOLDEN-PRO-2026-LIFETIME` ومنطق Legacy ومتغيرات البيئة `INVITE_*`.
2. **`REVOKE EXECUTE ... FROM PUBLIC, anon`** على `renew_client_license`، ويتنقل للوحة إدارة بـ `service_role`. وتشيل `p_trial_days` من العميل (السيرفر هو اللي يحدد المدة).
3. **تأمين `register_client_device`:** ما ينفعش يغيّر `company_id` أو `public_key` لجهاز موجود. والأحسن إن التسجيل يتعمل من Edge Function بإثبات امتلاك المفتاح (يوقّع Challenge)، وتقفل `client_licenses` قدام anon.
4. **إصلاح C9:** لما يكون `p_batch_seq_no <= last`، السيرفر يرجّع `status: already_applied` والعميل **ما يحدّثش جدول الظل**، أو تعمل Resync كامل (Bootstrap) لما الرقم يرجع لورا. وتربط تيار التسلسل بالـ `device_id`.
5. **تشيل كلمة مرور الطوارئ** وتجبر المستخدم يغيّر `admin/admin` قبل أي استخدام.
6. **النسخ السحابي:** يتعمل عبر Edge Function موقّعة، والمسار يتحدد على السيرفر حسب `company_id` المتحقق منه، وتلغي صلاحيات anon على الـ Bucket، وتشفّر النسخة قبل الرفع.

### المرحلة P1
7. Trigger الخزينة يتعامل مع `customer_id` (حذف وإعادة إدراج سطر الدفتر).
8. حذف العميل يبقى Soft-Delete، ويتمنع لو عليه حركات.
9. نسخ احتياطي **متعدد الإصدارات** (مثلاً آخر 7 أيام + آخر 4 أسابيع) في مسار خارجي، و`synchronous = FULL`.
10. `safeStorage` (DPAPI) للمفتاح الخاص، وتوليد هوية جديدة لما فك التشفير يفشل.
11. `requirePermission` على كل Handlers الكتابة والحذف والاستعادة، وتقفل DevTools في `app.isPackaged`.
12. توقيع الكود (Code Signing)، وElectron Fuses (`RunAsNode=false`, `EnableEmbeddedAsarIntegrityValidation=true`)، وتثبيت نسخة Electron.

### المرحلة P2
13. `pg_cron` ينظّف `mobile_sync_nonces` (أقدم من يوم).
14. مطابقة دورية لمجموع الأرصدة بين المحلي والسحابة.
15. تقفل `client_error_logs` حسب الشركة.

---

## 9. استعلامات التحقق على سيرفر الإنتاج (للتنفيذ منك)

```sql
-- هل anon يقدر يجدد أي ترخيص؟ (المتوقع بعد الإصلاح: false)
SELECT has_function_privilege('anon', 'public.renew_client_license(uuid,integer,text)', 'EXECUTE');

-- سياسات الـ Storage على bucket النسخ الاحتياطي
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'storage';

-- السياسات المكشوفة لـ anon
SELECT tablename, policyname, roles, qual FROM pg_policies WHERE 'anon' = ANY(roles);

-- حجم جدول الـ Nonces
SELECT count(*) FROM public.mobile_sync_nonces;
```
