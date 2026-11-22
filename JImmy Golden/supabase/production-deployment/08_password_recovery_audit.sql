-- ============================================================================
-- Golden Accounting Mobile - Password Recovery Audit & Telemetry
-- Target: Supabase Production SQL Editor
-- Path: supabase/production-deployment/08_password_recovery_audit.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_recovery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    challenge TEXT NOT NULL,
    username TEXT NOT NULL DEFAULT 'admin',
    desktop_version TEXT DEFAULT '10.1.0',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_recovery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_admin_read_recovery_logs" ON public.client_recovery_logs;
CREATE POLICY "rls_admin_read_recovery_logs" ON public.client_recovery_logs
FOR SELECT TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.log_recovery_event(
    p_company_id UUID DEFAULT NULL,
    p_challenge TEXT DEFAULT '',
    p_username TEXT DEFAULT 'admin',
    p_desktop_version TEXT DEFAULT '10.1.0'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.client_recovery_logs (
        company_id,
        challenge,
        username,
        desktop_version,
        created_at
    ) VALUES (
        p_company_id,
        COALESCE(p_challenge, ''),
        COALESCE(p_username, 'admin'),
        COALESCE(p_desktop_version, '10.1.0'),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'logged_at', now()
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.log_recovery_event(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_recovery_event(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
