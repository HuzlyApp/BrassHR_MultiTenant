-- Recruiter mail compose drafts (auto-save + manual save).

CREATE TABLE IF NOT EXISTS public.mail_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  body_html text,
  template_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mail_drafts_author_worker_unique UNIQUE (author_user_id, worker_id)
);

CREATE INDEX IF NOT EXISTS mail_drafts_tenant_author_updated_idx
  ON public.mail_drafts (tenant_id, author_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS mail_drafts_worker_idx
  ON public.mail_drafts (worker_id);

COMMENT ON TABLE public.mail_drafts IS
  'Unsent recruiter email drafts for the admin mail compose screen.';

ALTER TABLE public.mail_drafts ENABLE ROW LEVEL SECURITY;
