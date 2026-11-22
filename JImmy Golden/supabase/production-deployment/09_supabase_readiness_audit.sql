-- ============================================================================
-- Golden Accounting - Supabase Production Diagnostic & Readiness Audit
-- Target: Supabase SQL Editor
-- Path: supabase/production-deployment/09_supabase_readiness_audit.sql
-- Purpose: Complete automated health check for 20-30+ concurrent client readiness
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS _audit_results (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    check_name TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT NOT NULL
);
TRUNCATE TABLE _audit_results;

DO $audit$
DECLARE
    v_cnt INT;
    v_func_cnt INT;
    v_anon_read_lic BOOLEAN;
    v_anon_exec_renew BOOLEAN;
    v_private_usage BOOLEAN;
    v_rls_ok BOOLEAN;
BEGIN
    -- 1. فحص وجود الجداول الأساسية
    SELECT count(*) INTO v_cnt 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN (
        'mobile_companies', 'mobile_devices', 'mobile_sync_meta',
        'mobile_sync_nonces', 'mobile_parties', 'mobile_party_ledger',
        'client_licenses', 'client_error_logs'
      );
    
    IF v_cnt >= 8 THEN
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('1. الجداول والهيكل', 'Core Public Tables', '✅ PASS', format('تم العثور على %s جداول أساسية بنجاح', v_cnt));
    ELSE
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('1. الجداول والهيكل', 'Core Public Tables', '❌ FAIL', format('ناقص جداول: وجد فقط %s من 8', v_cnt));
    END IF;

    -- 2. فحص عمود stream_id في جدول mobile_sync_meta
    SELECT count(*) INTO v_cnt 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'mobile_sync_meta' AND column_name = 'stream_id';

    IF v_cnt = 1 THEN
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('1. الجداول والهيكل', 'stream_id Column', '✅ PASS', 'عمود stream_id موجود ومفعل لمنع ضياع الحركات');
    ELSE
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('1. الجداول والهيكل', 'stream_id Column', '❌ FAIL', 'عمود stream_id غير موجود في mobile_sync_meta');
    END IF;

    -- 3. فحص دالة المزامنة السحابية وعدم وجود تعارض (Ambiguity / Overloading)
    SELECT count(*) INTO v_func_cnt
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'private' AND p.proname = 'apply_delta_sync_batch';

    IF v_func_cnt = 1 THEN
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('2. محرك المزامنة', 'apply_delta_sync_batch Unique Overload', '✅ PASS', 'توجد نسخة واحدة دقيقة من الدالة ولا يوجد أي تعارض');
    ELSIF v_func_cnt = 0 THEN
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('2. محرك المزامنة', 'apply_delta_sync_batch Existence', '❌ FAIL', 'الدالة غير موجودة في private schema');
    ELSE
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('2. محرك المزامنة', 'apply_delta_sync_batch Collision', '❌ FAIL', format('توجد %s نسخ متعارضة من الدالة (is not unique)', v_func_cnt));
    END IF;

    -- 4. فحص عزل private schema عن anon
    SELECT has_schema_privilege('anon', 'private', 'USAGE') INTO v_private_usage;
    IF NOT v_private_usage THEN
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('3. الأمان والحماية', 'Private Schema Isolation', '✅ PASS', 'المخطط private معزول تماماً ومحمي من وصول anon');
    ELSE
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('3. الأمان والحماية', 'Private Schema Isolation', '❌ FAIL', 'صلاحية USAGE مفتوحة لـ anon على private schema!');
    END IF;

    -- 5. فحص حظر قراءة جدول client_licenses من anon
    SELECT has_table_privilege('anon', 'public.client_licenses', 'SELECT') INTO v_anon_read_lic;
    IF NOT v_anon_read_lic THEN
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('3. الأمان والحماية', 'client_licenses Anon Shield', '✅ PASS', 'جدول التراخيص محجوب ومحمي من قراءة anon');
    ELSE
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('3. الأمان والحماية', 'client_licenses Anon Shield', '⚠️ WARN', 'جدول التراخيص يمكن قراءته من قبل anon');
    END IF;

    -- 6. فحص حظر تجديد الترخيص من anon
    SELECT has_function_privilege('anon', 'public.renew_client_license(uuid,integer,text)', 'EXECUTE') INTO v_anon_exec_renew;
    IF NOT v_anon_exec_renew THEN
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('3. الأمان والحماية', 'renew_client_license Guard', '✅ PASS', 'دالة التجديد محجوبة عن anon ومقتصرة على الإدارة');
    ELSE
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('3. الأمان والحماية', 'renew_client_license Guard', '⚠️ WARN', 'anon يمتلك صلاحية تجديد التراخيص');
    END IF;

    -- 7. فحص تفعيل RLS على جداول الموبايل
    SELECT bool_and(rowsecurity) INTO v_rls_ok
    FROM pg_tables
    WHERE schemaname = 'public' 
      AND tablename IN ('mobile_companies', 'mobile_devices', 'mobile_parties', 'mobile_party_ledger', 'client_licenses');

    IF v_rls_ok THEN
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('3. الأمان والحماية', 'Row Level Security (RLS)', '✅ PASS', 'نظام RLS مفعل على كافة جداول النظام');
    ELSE
        INSERT INTO _audit_results (category, check_name, status, details)
        VALUES ('3. الأمان والحماية', 'Row Level Security (RLS)', '❌ FAIL', 'توجد جداول غير مفعل عليها RLS');
    END IF;

    -- 8. إحصائيات البيانات الحالية في السحابة
    SELECT count(*) INTO v_cnt FROM public.mobile_companies;
    INSERT INTO _audit_results (category, check_name, status, details)
    VALUES ('4. إحصائيات السحابة', 'Active Companies', 'ℹ️ INFO', format('عدد الشركات المسجلة: %s', v_cnt));

    SELECT count(*) INTO v_cnt FROM public.mobile_devices;
    INSERT INTO _audit_results (category, check_name, status, details)
    VALUES ('4. إحصائيات السحابة', 'Registered Devices', 'ℹ️ INFO', format('عدد الأجهزة المسجلة: %s', v_cnt));

    SELECT count(*) INTO v_cnt FROM public.mobile_parties;
    INSERT INTO _audit_results (category, check_name, status, details)
    VALUES ('4. إحصائيات السحابة', 'Total Synced Parties', 'ℹ️ INFO', format('إجمالي الأطراف المتزامنة: %s', v_cnt));

    SELECT count(*) INTO v_cnt FROM public.mobile_party_ledger;
    INSERT INTO _audit_results (category, check_name, status, details)
    VALUES ('4. إحصائيات السحابة', 'Total Ledger Entries', 'ℹ️ INFO', format('إجمالي أسطر دفتر الأستاذ: %s', v_cnt));

    SELECT count(*) INTO v_cnt FROM public.mobile_sync_nonces;
    INSERT INTO _audit_results (category, check_name, status, details)
    VALUES ('4. إحصائيات السحابة', 'Total Nonces', 'ℹ️ INFO', format('عدد سجلات الـ Nonces الحالية: %s', v_cnt));

END $audit$;

-- 9. عرض التقرير التشخيصي الفوري
SELECT category AS "المحور", check_name AS "اسم الفحص", status AS "الحالة", details AS "التفاصيل"
FROM _audit_results
ORDER BY id ASC;
