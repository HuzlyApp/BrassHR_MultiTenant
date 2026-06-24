-- Per-tenant Firma.dev workspace isolation

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS firma_workspace_id text;

COMMENT ON COLUMN public.tenants.firma_workspace_id IS
  'Optional Firma.dev workspace ID for this tenant. Falls back to server FIRMA_WORKSPACE_ID when null.';

ALTER TABLE public.recruiter_templates
  ADD COLUMN IF NOT EXISTS firma_workspace_id text;

COMMENT ON COLUMN public.recruiter_templates.firma_workspace_id IS
  'Firma workspace used when this template was created/published. Detects stale templates after workspace changes.';

ALTER TABLE public.worker_firma_signing_sessions
  ADD COLUMN IF NOT EXISTS firma_workspace_id text;

COMMENT ON COLUMN public.worker_firma_signing_sessions.firma_workspace_id IS
  'Firma workspace used when this signing session was created. Detects stale sessions after workspace changes.';

CREATE INDEX IF NOT EXISTS recruiter_templates_firma_workspace_idx
  ON public.recruiter_templates (tenant_id, firma_workspace_id)
  WHERE firma_workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS worker_firma_signing_sessions_firma_workspace_idx
  ON public.worker_firma_signing_sessions (tenant_id, firma_workspace_id)
  WHERE firma_workspace_id IS NOT NULL;
