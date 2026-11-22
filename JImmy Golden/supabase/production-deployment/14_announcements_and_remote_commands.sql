ALTER TABLE public.app_global_config
    ADD COLUMN IF NOT EXISTS announcement_message text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS announcement_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.client_licenses
    ADD COLUMN IF NOT EXISTS custom_notice text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS remote_command text,
    ADD COLUMN IF NOT EXISTS remote_command_at timestamptz;
