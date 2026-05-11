-- RBAC: map Supabase Auth users to application roles + immutable audit trail.
-- Apply in Supabase SQL editor or via supabase db push.

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('worker', 'recruiter', 'support', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'worker',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles (role);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON public.activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_log_actor_idx ON public.activity_log (actor_user_id);

COMMENT ON TABLE public.user_roles IS 'Application RBAC: one row per auth user.';
COMMENT ON TABLE public.activity_log IS 'Security audit log for privileged actions (API writes + sensitive reads).';
