-- ============================================================================
-- Golden Accounting Mobile - Production Android Operator Setup
-- Target: Supabase Production SQL Editor
-- Path: supabase/production-deployment/04_production_android_operator_setup.sql
-- ============================================================================

-- خطوات إعداد مستخدم Android الإنتاجي:
-- 1. أنشئ المستخدم من لوحة Supabase Dashboard -> Authentication -> Users
--    مثال: prod_reader@golden-accounting.com
-- 2. انسخ الـ User UID الخاص به وضعه بدلاً من <ANDROID_OPERATOR_USER_UUID> أدناه.
-- 3. ضع معرّف الشركة الإنتاجية المعتمدة بدلاً من <PRODUCTION_COMPANY_ID>.
-- 4. نفّذ هذا السكريبت لربط المستخدم بالشركة عبر app_metadata المعتمدة في سياسات RLS.

DO $$
DECLARE
    v_user_id UUID := '<ANDROID_OPERATOR_USER_UUID>'::uuid;
    v_company_id UUID := '<PRODUCTION_COMPANY_ID>'::uuid;
    v_user_email TEXT;
BEGIN
    -- التحقق من وجود المستخدم في جدول المصادقة auth.users
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'User % not found in auth.users. Please create user first in Supabase Auth.', v_user_id;
    END IF;

    -- التحقق من وجود الشركة في جدول mobile_companies
    IF NOT EXISTS (SELECT 1 FROM public.mobile_companies WHERE id = v_company_id) THEN
        RAISE EXCEPTION 'Company % not found in mobile_companies. Please run device/company registration first.', v_company_id;
    END IF;

    -- ربط المستخدم بالشركة عبر raw_app_meta_data
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'company_id', v_company_id::text,
        'role', 'mobile_reader'
    )
    WHERE id = v_user_id;

    RAISE NOTICE 'User % (%) successfully linked to Production Company %', v_user_email, v_user_id, v_company_id;
END $$;
