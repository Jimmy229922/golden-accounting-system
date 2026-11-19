ALTER TABLE public.client_licenses
ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{"external_work": false, "treasury_attachments": false, "cloud_backup": false, "flex_full_layout": false}'::jsonb;

ALTER TABLE public.client_licenses
ALTER COLUMN features SET DEFAULT '{"external_work": false, "treasury_attachments": false, "cloud_backup": false, "flex_full_layout": false}'::jsonb;

UPDATE public.client_licenses
SET features = '{"external_work": false, "treasury_attachments": false, "cloud_backup": false, "flex_full_layout": false}'::jsonb || COALESCE(features, '{}'::jsonb);

COMMENT ON COLUMN public.client_licenses.features IS 'Per-client feature flags JSON object (e.g. {"external_work": false, "treasury_attachments": false, "cloud_backup": false, "flex_full_layout": false})';
