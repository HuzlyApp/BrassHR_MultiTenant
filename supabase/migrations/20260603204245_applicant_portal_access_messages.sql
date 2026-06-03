-- Applicant portal password setup state and two-way application messages.

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS applicant_password_set_at timestamptz;

CREATE TABLE IF NOT EXISTS public.applicant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('applicant', 'recruiter')),
  sender_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applicant_messages_worker_created_idx
  ON public.applicant_messages (worker_id, created_at);

CREATE INDEX IF NOT EXISTS applicant_messages_tenant_created_idx
  ON public.applicant_messages (tenant_id, created_at DESC);

ALTER TABLE public.applicant_messages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.applicant_messages IS
  'Two-way applicant portal messages between applicants and tenant recruiters.';
