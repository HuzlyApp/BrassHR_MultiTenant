-- Tracks Firma signing sessions for applicant onboarding steps.

CREATE TABLE IF NOT EXISTS public.worker_firma_signing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  onboarding_step_id uuid NOT NULL REFERENCES public.tenant_onboarding_steps (id) ON DELETE CASCADE,
  recruiter_template_id uuid REFERENCES public.recruiter_templates (id) ON DELETE SET NULL,
  firma_template_id text,
  signing_request_id text NOT NULL,
  signing_request_user_id text,
  firma_status text NOT NULL DEFAULT 'draft',
  iframe_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, onboarding_step_id)
);

CREATE INDEX IF NOT EXISTS worker_firma_signing_sessions_worker_idx
  ON public.worker_firma_signing_sessions (worker_id);

CREATE INDEX IF NOT EXISTS worker_firma_signing_sessions_signing_request_idx
  ON public.worker_firma_signing_sessions (signing_request_id);

ALTER TABLE public.worker_firma_signing_sessions ENABLE ROW LEVEL SECURITY;
