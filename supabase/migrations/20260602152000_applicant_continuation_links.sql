-- Secure applicant continuation links for resumable onboarding/application flows.

CREATE TABLE IF NOT EXISTS public.applicant_continuation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  applicant_user_id uuid,
  token_hash text NOT NULL UNIQUE,
  target_path text NOT NULL,
  target_step_key text,
  target_step_type text,
  reason text NOT NULL DEFAULT 'onboarding_reminder',
  generated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_opened_ip inet,
  last_opened_user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT applicant_continuation_links_target_path_chk CHECK (target_path ~ '^/application/'),
  CONSTRAINT applicant_continuation_links_reason_chk CHECK (reason ~ '^[a-z][a-z0-9_-]{0,63}$')
);

CREATE INDEX IF NOT EXISTS applicant_continuation_links_worker_created_idx
  ON public.applicant_continuation_links (worker_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS applicant_continuation_links_tenant_created_idx
  ON public.applicant_continuation_links (tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS applicant_continuation_links_expires_idx
  ON public.applicant_continuation_links (expires_at)
  WHERE revoked_at IS NULL AND completed_at IS NULL;

COMMENT ON TABLE public.applicant_continuation_links IS
  'Hashed, expiring applicant-specific continuation links for resuming unfinished onboarding.';

ALTER TABLE public.applicant_continuation_links ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.applicant_continuation_links TO service_role;

UPDATE public.email_templates
SET
  body_html = replace(
    body_html,
    '{{applicationStatusUrl}}',
    '{{applicantContinuationLink}}'
  ),
  body_text = replace(
    body_text,
    '{{applicationStatusUrl}}',
    '{{applicantContinuationLink}}'
  ),
  variables = (
    SELECT jsonb_agg(
      CASE
        WHEN item->>'key' = 'applicationStatusUrl'
          THEN jsonb_set(item, '{required}', 'false'::jsonb, true)
        ELSE item
      END
    )
    FROM jsonb_array_elements(variables) AS item
  ) || '[{"key":"applicantContinuationLink","required":true}]'::jsonb,
  updated_at = now()
WHERE template_key IN ('application_status', 'welcome')
  AND status = 'active'
  AND is_active_version = true
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(variables) AS item
    WHERE item->>'key' = 'applicantContinuationLink'
  );
