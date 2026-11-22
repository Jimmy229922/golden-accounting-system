ALTER TABLE public.client_licenses
  ADD COLUMN IF NOT EXISTS read_only_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_desktop_users INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_android_users INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS force_update_target BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.client_licenses
  DROP CONSTRAINT IF EXISTS client_licenses_license_status_check;

ALTER TABLE public.client_licenses
  ADD CONSTRAINT client_licenses_license_status_check
  CHECK (license_status IN ('trial', 'active', 'lifetime', 'suspended', 'expired', 'read_only'));

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  company_name TEXT,
  desktop_version TEXT,
  machine_id TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  recent_errors TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  admin_reply TEXT,
  replied_by TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_company_created
  ON public.support_tickets (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created
  ON public.support_tickets (status, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
