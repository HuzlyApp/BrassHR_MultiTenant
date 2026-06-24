-- Firma workspace auto-provisioning status for tenant onboarding

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS firma_workspace_provisioning_status text NOT NULL DEFAULT 'manual_required',
  ADD COLUMN IF NOT EXISTS firma_workspace_provisioning_error text,
  ADD COLUMN IF NOT EXISTS firma_workspace_provisioned_at timestamptz;

COMMENT ON COLUMN public.tenants.firma_workspace_provisioning_status IS
  'Result of automatic Firma workspace provisioning during tenant signup (manual_required, created, failed, skipped, already_configured).';

COMMENT ON COLUMN public.tenants.firma_workspace_provisioning_error IS
  'Sanitized error message when Firma workspace auto-provisioning fails. Never stores API keys.';

COMMENT ON COLUMN public.tenants.firma_workspace_provisioned_at IS
  'Timestamp when a Firma workspace was successfully auto-provisioned for this tenant.';

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_firma_workspace_provisioning_status_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_firma_workspace_provisioning_status_check
  CHECK (
    firma_workspace_provisioning_status IN (
      'not_configured',
      'manual_required',
      'created',
      'failed',
      'skipped',
      'already_configured'
    )
  );
