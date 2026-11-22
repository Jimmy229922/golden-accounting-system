CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email text NOT NULL,
    action_type text NOT NULL,
    target_company_id text,
    target_company_name text,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
    ON public.admin_audit_logs (created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_global_config
    ADD COLUMN IF NOT EXISTS telegram_bot_token text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS telegram_chat_id text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS telegram_alerts_enabled boolean NOT NULL DEFAULT false;

COMMENT ON TABLE public.admin_audit_logs IS 'Audit trail of all super_admin actions performed from web or mobile admin panels';
