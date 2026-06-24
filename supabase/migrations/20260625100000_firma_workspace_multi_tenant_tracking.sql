-- Supplemental indexes for Firma workspace multi-tenant tracking.
-- Columns were added in tenant_firma_workspace; this migration is idempotent.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS firma_workspace_id text;

ALTER TABLE public.recruiter_templates
  ADD COLUMN IF NOT EXISTS firma_workspace_id text;

ALTER TABLE public.worker_firma_signing_sessions
  ADD COLUMN IF NOT EXISTS firma_workspace_id text;

CREATE INDEX IF NOT EXISTS idx_tenants_firma_workspace_id
  ON public.tenants (firma_workspace_id)
  WHERE firma_workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recruiter_templates_firma_workspace_id
  ON public.recruiter_templates (firma_workspace_id)
  WHERE firma_workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_worker_firma_signing_sessions_firma_workspace_id
  ON public.worker_firma_signing_sessions (firma_workspace_id)
  WHERE firma_workspace_id IS NOT NULL;
