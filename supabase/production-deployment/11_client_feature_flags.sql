ALTER TABLE public.client_licenses
ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{"external_work": false, "treasury_attachments": false, "cloud_backup": false, "flex_full_layout": false, "sales_shift_close": false, "finance_treasury": false, "petty_expenses": false, "petty_bags": false, "petty_inspection": false, "petty_shipping_clearance": false, "petty_operation": false, "under_collection": false, "remaining_under_collection": false, "export_revenues": false, "local_sales": false, "purchase_round_fifty": false}'::jsonb;

ALTER TABLE public.client_licenses
ALTER COLUMN features SET DEFAULT '{"external_work": false, "treasury_attachments": false, "cloud_backup": false, "flex_full_layout": false, "sales_shift_close": false, "finance_treasury": false, "petty_expenses": false, "petty_bags": false, "petty_inspection": false, "petty_shipping_clearance": false, "petty_operation": false, "under_collection": false, "remaining_under_collection": false, "export_revenues": false, "local_sales": false, "purchase_round_fifty": false}'::jsonb;

UPDATE public.client_licenses
SET features = '{"external_work": false, "treasury_attachments": false, "cloud_backup": false, "flex_full_layout": false, "sales_shift_close": false, "finance_treasury": false, "petty_expenses": false, "petty_bags": false, "petty_inspection": false, "petty_shipping_clearance": false, "petty_operation": false, "under_collection": false, "remaining_under_collection": false, "export_revenues": false, "local_sales": false, "purchase_round_fifty": false}'::jsonb || COALESCE(features, '{}'::jsonb);

COMMENT ON COLUMN public.client_licenses.features IS 'Per-client feature flags JSON object';
