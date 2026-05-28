-- Recruiter → candidate email/SMS history (provider sends happen in API routes).

CREATE TABLE IF NOT EXISTS public.candidate_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  sent_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient text NOT NULL,
  subject text,
  body text NOT NULL,
  provider_message_id text,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_communications_worker_created_idx
  ON public.candidate_communications (worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS candidate_communications_tenant_idx
  ON public.candidate_communications (tenant_id);

COMMENT ON TABLE public.candidate_communications IS
  'Audit trail for recruiter-initiated email/SMS to candidates via Resend/Twilio.';

ALTER TABLE public.candidate_communications ENABLE ROW LEVEL SECURITY;
