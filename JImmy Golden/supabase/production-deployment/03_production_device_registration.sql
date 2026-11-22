-- ============================================================================
-- Golden Accounting Mobile - Production Device Registration Template
-- Target: Supabase Production SQL Editor
-- Path: supabase/production-deployment/03_production_device_registration.sql
-- ============================================================================

-- ملاحظة: استبدل المعرّفات بالقيم الإنتاجية الحقيقية بعد توليد هوية الجهاز الرسمية.
-- يتم توليد المفتاح العام لجهاز Windows عبر دالة loadOrCreateDeviceIdentity(storageDir).

DO $$
DECLARE
    v_company_id UUID := '715526d2-f05a-458f-8cf7-179ee172a7a1'::uuid;
    v_company_code TEXT := 'GOLDEN_PROD';
    v_company_name TEXT := 'شركة المحاسب الذهبي - الإنتاج';
    v_device_id UUID := '697b46e5-5639-4e57-86e0-e905f0b7a62b'::uuid;
    v_device_name TEXT := 'Windows-Desktop-Production-POS';
    v_public_key_base64 TEXT := 'bL3xAQDgAhNcyf4kExV6TcrmL7SheSIPL+IiSDOZC48=';
BEGIN
    -- 1. تسجيل أو تحديث بيانات الشركة الإنتاجية
    INSERT INTO public.mobile_companies (id, code, name, currency_code, is_active)
    VALUES (v_company_id, v_company_code, v_company_name, 'EGP', true)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        is_active = true,
        updated_at = now();

    -- 2. تسجيل جهاز Windows الإنتاجي المعتمد
    INSERT INTO public.mobile_devices (id, company_id, device_name, public_key, is_active)
    VALUES (v_device_id, v_company_id, v_device_name, v_public_key_base64, true)
    ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        public_key = EXCLUDED.public_key,
        is_active = true;

    -- 3. تهيئة سجل المزامنة اللحظية للشركة
    INSERT INTO public.mobile_sync_meta (
        company_id, currency_code, last_heartbeat_at, last_financial_sync_at, last_applied_seq_no, desktop_app_version, sync_status
    )
    VALUES (
        v_company_id, 'EGP', NULL, NULL, 0, '9.2.2', 'pending_first_sync'
    )
    ON CONFLICT (company_id) DO NOTHING;

    RAISE NOTICE 'Production Device % registered successfully for Company %', v_device_id, v_company_id;
END $$;
