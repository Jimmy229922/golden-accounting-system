-- ============================================================================
-- Golden Accounting - Client Profile Fields, Cloud Backup Flag & Global Config
-- Target: Supabase Production SQL Editor
-- ============================================================================

-- 1. إضافة أعمدة رقم الهاتف والنشاط التجاري في جدول التراخيص (اختيارية)
ALTER TABLE public.client_licenses
ADD COLUMN IF NOT EXISTS company_phone TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS company_activity TEXT DEFAULT '';

-- 2. إضافة ميزات cloud_backup و flex_full_layout بقيمة false لجميع العملاء الحاليين والجداد دون مساس بالمفعّل
ALTER TABLE public.client_licenses
ALTER COLUMN features SET DEFAULT '{"external_work": false, "treasury_attachments": false, "cloud_backup": false, "flex_full_layout": false}'::jsonb;

UPDATE public.client_licenses
SET features = '{"external_work": false, "treasury_attachments": false, "cloud_backup": false, "flex_full_layout": false}'::jsonb || COALESCE(features, '{}'::jsonb);

-- 3. جدول الإعدادات العامة للنظام (أقل إصدار مسموح + رقم واتساب الدعم الفني)
CREATE TABLE IF NOT EXISTS public.app_global_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    min_supported_version TEXT NOT NULL DEFAULT '10.0.0',
    support_whatsapp TEXT NOT NULL DEFAULT '',
    force_update_message TEXT NOT NULL DEFAULT 'يرجى تحديث البرنامج إلى أحدث إصدار للمتابعة وضمان استقرار بياناتك.',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_global_config (id, min_supported_version, support_whatsapp)
VALUES (1, '10.0.0', '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_global_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_block_public_app_global_config" ON public.app_global_config;
CREATE POLICY "rls_block_public_app_global_config" ON public.app_global_config
FOR ALL TO anon, authenticated
USING (false)
WITH CHECK (false);
