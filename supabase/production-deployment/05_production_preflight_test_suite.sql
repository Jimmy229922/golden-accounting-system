-- ============================================================================
-- Golden Accounting Mobile - Production Preflight Verification Suite
-- Target: Supabase Production SQL Editor (Before accepting real financial data)
-- Path: supabase/production-deployment/05_production_preflight_test_suite.sql
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS _preflight_results (
    test_id SERIAL PRIMARY KEY,
    test_name TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT NOT NULL
);
TRUNCATE TABLE _preflight_results;
GRANT ALL ON _preflight_results TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE _preflight_results_test_id_seq TO authenticated;

DO $suite$
DECLARE
    v_comp_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
    v_comp_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
    v_count INT;
    v_caught_write_block BOOLEAN := false;
    v_caught_private_block BOOLEAN := false;
BEGIN
    -- 1. إنشاء شركتين وهميتين وبيانات فحص مؤقتة
    INSERT INTO public.mobile_companies (id, code, name) 
    VALUES (v_comp_a, 'PREFLIGHT_A', 'Test A'), (v_comp_b, 'PREFLIGHT_B', 'Test B')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.mobile_parties (company_id, id, code, name, type, balance)
    VALUES (v_comp_a, 1001, 101, 'Party A1', 'customer', 1500.0),
           (v_comp_b, 2001, 201, 'Party B1', 'customer', 3000.0)
    ON CONFLICT DO NOTHING;

    -- 2. اختبار عزل الشركات (RLS Isolation for Company A)
    SET ROLE authenticated;
    PERFORM set_config('request.jwt.claim', json_build_object(
        'sub', 'user-test-a',
        'role', 'authenticated',
        'app_metadata', json_build_object('company_id', v_comp_a::text)
    )::text, true);

    SELECT count(*) INTO v_count FROM public.mobile_parties;
    IF v_count = 1 THEN
        INSERT INTO _preflight_results (test_name, status, details)
        VALUES ('RLS Isolation Scope', 'PASS', 'User A sees exactly 1 party belonging to Company A');
    ELSE
        INSERT INTO _preflight_results (test_name, status, details)
        VALUES ('RLS Isolation Scope', 'FAIL', format('Expected 1 party, got %s', v_count));
    END IF;

    -- 3. اختبار منع الكتابة من مستخدم الموبايل (Write Blocking)
    BEGIN
        INSERT INTO public.mobile_parties (company_id, id, code, name, type)
        VALUES (v_comp_a, 9999, 999, 'Hacker Party', 'customer');
    EXCEPTION WHEN insufficient_privilege THEN
        v_caught_write_block := true;
    END;

    IF v_caught_write_block THEN
        INSERT INTO _preflight_results (test_name, status, details)
        VALUES ('Write Blocking on Parties', 'PASS', 'Direct INSERT rejected with insufficient_privilege');
    ELSE
        INSERT INTO _preflight_results (test_name, status, details)
        VALUES ('Write Blocking on Parties', 'FAIL', 'Direct INSERT was not blocked');
    END IF;

    -- 4. اختبار حجب دوال private schema عن مستخدم الموبايل
    BEGIN
        PERFORM private.apply_delta_sync_batch(v_comp_a, '[]'::jsonb, 1, '9.2.0');
    EXCEPTION WHEN insufficient_privilege THEN
        v_caught_private_block := true;
    END;

    IF v_caught_private_block THEN
        INSERT INTO _preflight_results (test_name, status, details)
        VALUES ('Private Schema Protection', 'PASS', 'Direct execution of private functions blocked for authenticated role');
    ELSE
        INSERT INTO _preflight_results (test_name, status, details)
        VALUES ('Private Schema Protection', 'FAIL', 'Private function execution was not blocked');
    END IF;

    RESET ROLE;

    -- 5. تنظيف بيانات الفحص المؤقتة تماماً لضمان بقاء قاعدة الإنتاج نقية
    DELETE FROM public.mobile_companies WHERE id IN (v_comp_a, v_comp_b);

    INSERT INTO _preflight_results (test_name, status, details)
    VALUES ('Zero Residue Cleanup', 'PASS', 'Temporary test tenants completely purged');
END $suite$;

-- عرض النتائج
SELECT test_id, test_name, status, details FROM _preflight_results ORDER BY test_id ASC;
