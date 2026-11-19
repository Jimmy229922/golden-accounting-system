ALTER TABLE public.client_licenses
ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.client_licenses.features IS 'Per-client feature flags JSON object (e.g. {"custom_feature": true})';
