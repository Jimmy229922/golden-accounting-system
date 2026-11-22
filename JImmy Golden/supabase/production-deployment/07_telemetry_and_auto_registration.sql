-- ============================================================================
-- Golden Accounting Mobile - Telemetry & Auto-Registration
-- Target: Supabase Production SQL Editor
-- Path: supabase/production-deployment/07_telemetry_and_auto_registration.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    device_id UUID,
    company_name TEXT,
    desktop_version TEXT,
    severity TEXT DEFAULT 'error',
    module TEXT DEFAULT 'sync',
    error_message TEXT NOT NULL,
    error_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_admin_read_error_logs" ON public.client_error_logs;
CREATE POLICY "rls_admin_read_error_logs" ON public.client_error_logs
FOR SELECT TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.report_client_error(
    p_company_id UUID,
    p_device_id UUID,
    p_company_name TEXT DEFAULT NULL,
    p_desktop_version TEXT DEFAULT '10.0.0',
    p_severity TEXT DEFAULT 'error',
    p_module TEXT DEFAULT 'sync',
    p_error_message TEXT DEFAULT '',
    p_error_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.client_error_logs (
        company_id,
        device_id,
        company_name,
        desktop_version,
        severity,
        module,
        error_message,
        error_details,
        created_at
    )
    VALUES (
        p_company_id,
        p_device_id,
        COALESCE(NULLIF(TRIM(p_company_name), ''), 'مؤسسة غير مسماة'),
        COALESCE(NULLIF(TRIM(p_desktop_version), ''), '10.0.0'),
        COALESCE(NULLIF(TRIM(p_severity), ''), 'error'),
        COALESCE(NULLIF(TRIM(p_module), ''), 'sync'),
        COALESCE(NULLIF(TRIM(p_error_message), ''), 'Unknown error'),
        COALESCE(p_error_details, '{}'::jsonb),
        now()
    );

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_client_device(
    p_company_id UUID,
    p_company_name TEXT DEFAULT NULL,
    p_device_id UUID DEFAULT NULL,
    p_device_name TEXT DEFAULT NULL,
    p_public_key TEXT DEFAULT NULL,
    p_desktop_version TEXT DEFAULT '10.0.0'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_comp_name TEXT := COALESCE(NULLIF(TRIM(p_company_name), ''), 'مؤسسة جديدة');
    v_dev_name TEXT := COALESCE(NULLIF(TRIM(p_device_name), ''), 'Windows-Desktop-POS');
    v_code TEXT := SUBSTRING(REPLACE(p_company_id::text, '-', ''), 1, 8);
    v_existing_dev RECORD;
BEGIN
    IF p_company_id IS NULL OR p_device_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing company_id or device_id');
    END IF;

    INSERT INTO public.mobile_companies (id, code, name, currency_code, is_active)
    VALUES (p_company_id, v_code, v_comp_name, 'EGP', true)
    ON CONFLICT (id) DO UPDATE SET
        name = CASE WHEN EXCLUDED.name <> 'مؤسسة جديدة' THEN EXCLUDED.name ELSE mobile_companies.name END,
        is_active = true,
        updated_at = now();

    SELECT * INTO v_existing_dev FROM public.mobile_devices WHERE id = p_device_id;

    IF FOUND THEN
        IF v_existing_dev.company_id <> p_company_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'DEVICE_COMPANY_MISMATCH');
        END IF;

        IF p_public_key IS NOT NULL AND TRIM(p_public_key) <> '' 
           AND v_existing_dev.public_key IS NOT NULL 
           AND v_existing_dev.public_key <> TRIM(p_public_key) THEN
            RETURN jsonb_build_object('success', false, 'error', 'DEVICE_KEY_MISMATCH');
        END IF;

        UPDATE public.mobile_devices
        SET 
            device_name = COALESCE(v_dev_name, device_name),
            is_active = true,
            last_heartbeat_at = now()
        WHERE id = p_device_id;
    ELSE
        IF p_public_key IS NOT NULL AND TRIM(p_public_key) <> '' THEN
            INSERT INTO public.mobile_devices (id, company_id, device_name, public_key, is_active, last_heartbeat_at)
            VALUES (p_device_id, p_company_id, v_dev_name, TRIM(p_public_key), true, now());
        END IF;
    END IF;

    INSERT INTO public.mobile_sync_meta (company_id, currency_code, last_heartbeat_at, desktop_app_version, sync_status)
    VALUES (p_company_id, 'EGP', now(), p_desktop_version, 'pending_first_sync')
    ON CONFLICT (company_id) DO UPDATE SET
        last_heartbeat_at = now(),
        desktop_app_version = EXCLUDED.desktop_app_version;

    RETURN jsonb_build_object(
        'success', true,
        'company_id', p_company_id,
        'device_id', p_device_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_client_error TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_client_device TO anon, authenticated, service_role;
