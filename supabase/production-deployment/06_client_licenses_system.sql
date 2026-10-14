-- ============================================================================
-- Golden Accounting System - Production Client Licenses & Subscriptions
-- Target: Supabase Production SQL Editor
-- Path: supabase/production-deployment/06_client_licenses_system.sql
-- ============================================================================

-- 1. جدول تراخيص العملاء والاشتراكات المركزية
CREATE TABLE IF NOT EXISTS public.client_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE,
    company_name TEXT,
    machine_id TEXT NOT NULL,
    license_status TEXT NOT NULL DEFAULT 'trial' 
        CHECK (license_status IN ('trial', 'active', 'suspended', 'lifetime')),
    trial_starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    trial_ends_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    renew_count INTEGER NOT NULL DEFAULT 0,
    last_heartbeat_at TIMESTAMPTZ,
    desktop_version TEXT,
    bound_machine_id TEXT,
    last_seen_machine_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهارس البحث السريع
CREATE INDEX IF NOT EXISTS idx_client_licenses_company_id ON public.client_licenses(company_id);
CREATE INDEX IF NOT EXISTS idx_client_licenses_machine_id ON public.client_licenses(machine_id);
CREATE INDEX IF NOT EXISTS idx_client_licenses_status ON public.client_licenses(license_status);

-- تريجر تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.handle_client_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_licenses_updated_at ON public.client_licenses;
CREATE TRIGGER trg_client_licenses_updated_at
BEFORE UPDATE ON public.client_licenses
FOR EACH ROW
EXECUTE FUNCTION public.handle_client_licenses_updated_at();

-- 2. تثبيت ترخيص العميل الحالي الأول (ترخيص دائم مدى الحياة دون أي توقف)
INSERT INTO public.client_licenses (
    company_id,
    company_name,
    machine_id,
    license_status,
    trial_starts_at,
    trial_ends_at,
    expires_at,
    renew_count,
    last_heartbeat_at,
    desktop_version,
    notes
)
VALUES (
    '715526d2-f05a-458f-8cf7-179ee172a7a1'::uuid,
    'شركة المحاسب الذهبي - الإنتاج',
    'LEGACY-PERPETUAL-HOST',
    'lifetime',
    '2026-01-01 00:00:00Z',
    '2099-12-31 23:59:59Z',
    '2099-12-31 23:59:59Z',
    999,
    now(),
    '9.2.15',
    'العميل الأساسي القائم - ترخيص دائم مدى الحياة (Perpetual Lifetime)'
)
ON CONFLICT (company_id) DO UPDATE SET
    license_status = 'lifetime',
    expires_at = '2099-12-31 23:59:59Z',
    updated_at = now();

-- 3. دالة فحص ومزامنة الترخيص السحابية (Sync & Auto-Register RPC)
CREATE OR REPLACE FUNCTION public.sync_client_license(
    p_company_id UUID,
    p_company_name TEXT DEFAULT NULL,
    p_machine_id TEXT DEFAULT '',
    p_desktop_version TEXT DEFAULT '9.2.15',
    p_trial_days INTEGER DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec RECORD;
    v_trial_days INTEGER := COALESCE(p_trial_days, 15);
    v_is_valid BOOLEAN;
    v_remaining_days INTEGER;
BEGIN
    IF p_company_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing company_id');
    END IF;

    -- فحص وجود السجل
    SELECT * INTO v_rec FROM public.client_licenses WHERE company_id = p_company_id;

    IF NOT FOUND THEN
        -- عميل جديد يسجل لأول مرة تلقائياً عند أول اتصال بالإنترنت
        INSERT INTO public.client_licenses (
            company_id,
            company_name,
            machine_id,
            license_status,
            trial_starts_at,
            trial_ends_at,
            expires_at,
            renew_count,
            last_heartbeat_at,
            desktop_version,
            notes
        )
        VALUES (
            p_company_id,
            COALESCE(NULLIF(TRIM(p_company_name), ''), 'مؤسسة جديدة'),
            COALESCE(NULLIF(TRIM(p_machine_id), ''), 'UNKNOWN-DEVICE'),
            'trial',
            now(),
            now() + (v_trial_days || ' days')::interval,
            now() + (v_trial_days || ' days')::interval,
            0,
            now(),
            p_desktop_version,
            'تسجيل تلقائي عند أول اتصال بالإنترنت - تجربة 15 يوماً'
        )
        RETURNING * INTO v_rec;
    ELSE
        -- تحديث وقت الظهور واسم المؤسسة والإصدار دون المساس بحالة الترخيص وتاريخ الانتهاء
        UPDATE public.client_licenses
        SET 
            last_heartbeat_at = now(),
            desktop_version = COALESCE(p_desktop_version, desktop_version),
            company_name = CASE 
                WHEN p_company_name IS NOT NULL AND TRIM(p_company_name) <> '' THEN TRIM(p_company_name)
                ELSE company_name
            END,
            machine_id = CASE 
                WHEN p_machine_id IS NOT NULL AND TRIM(p_machine_id) <> '' AND machine_id = 'UNKNOWN-DEVICE' THEN TRIM(p_machine_id)
                ELSE machine_id
            END
        WHERE company_id = p_company_id
        RETURNING * INTO v_rec;
    END IF;

    -- حساب الصلاحية والأيام المتبقية
    IF v_rec.license_status = 'suspended' THEN
        v_is_valid := false;
        v_remaining_days := 0;
    ELSIF v_rec.license_status = 'lifetime' THEN
        v_is_valid := true;
        v_remaining_days := 99999;
    ELSE
        v_remaining_days := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_rec.expires_at - now())) / 86400.0)::integer);
        v_is_valid := (v_rec.expires_at > now());
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'company_id', v_rec.company_id,
        'company_name', v_rec.company_name,
        'machine_id', v_rec.machine_id,
        'license_status', v_rec.license_status,
        'trial_ends_at', v_rec.trial_ends_at,
        'expires_at', v_rec.expires_at,
        'renew_count', v_rec.renew_count,
        'is_valid', v_is_valid,
        'remaining_days', v_remaining_days
    );
END;
$$;

-- 4. دالة التجديد السحابي المباشر (تستخدمها لوحة التحكم أو الإدارة)
CREATE OR REPLACE FUNCTION public.renew_client_license(
    p_company_id UUID,
    p_extend_days INTEGER DEFAULT 30,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec RECORD;
    v_days INTEGER := COALESCE(p_extend_days, 30);
    v_base_time TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_rec FROM public.client_licenses WHERE company_id = p_company_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Client license record not found');
    END IF;

    -- التمديد يبدأ من تاريخ الانتهاء الحالي إذا كان مستقبلياً، أو من الآن إذا كان منتهياً
    v_base_time := GREATEST(now(), v_rec.expires_at);

    UPDATE public.client_licenses
    SET 
        expires_at = v_base_time + (v_days || ' days')::interval,
        renew_count = renew_count + 1,
        license_status = 'active',
        notes = CASE 
            WHEN p_notes IS NOT NULL THEN p_notes 
            ELSE notes 
        END
    WHERE company_id = p_company_id
    RETURNING * INTO v_rec;

    RETURN jsonb_build_object(
        'success', true,
        'company_id', v_rec.company_id,
        'expires_at', v_rec.expires_at,
        'renew_count', v_rec.renew_count,
        'license_status', v_rec.license_status
    );
END;
$$;

-- 5. إعداد الصلاحيات والأمان (RLS)
ALTER TABLE public.client_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can check own license through RPC" ON public.client_licenses;
REVOKE ALL ON TABLE public.client_licenses FROM anon;
REVOKE ALL ON TABLE public.client_licenses FROM authenticated;

GRANT EXECUTE ON FUNCTION public.sync_client_license TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.renew_client_license TO authenticated, service_role;

COMMENT ON TABLE public.client_licenses IS 'جدول تراخيص العملاء والاشتراكات الشهرية لنظام المحاسبة الذهبي';
