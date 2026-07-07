-- Recruiter-added skills on candidate profile (separate from skill assessment quizzes).

CREATE TABLE IF NOT EXISTS public.worker_profile_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_profile_skills_name_not_empty CHECK (char_length(trim(skill_name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS worker_profile_skills_worker_name_unique_idx
  ON public.worker_profile_skills (worker_id, lower(trim(skill_name)));

CREATE INDEX IF NOT EXISTS worker_profile_skills_worker_created_idx
  ON public.worker_profile_skills (worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS worker_profile_skills_tenant_idx
  ON public.worker_profile_skills (tenant_id);

COMMENT ON TABLE public.worker_profile_skills IS
  'Skills added by recruiters on the candidate profile. Skill assessments remain in skill_assessments.';

CREATE OR REPLACE FUNCTION public.set_worker_profile_skills_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_profile_skills_updated_at ON public.worker_profile_skills;
CREATE TRIGGER trg_worker_profile_skills_updated_at
BEFORE UPDATE ON public.worker_profile_skills
FOR EACH ROW
EXECUTE FUNCTION public.set_worker_profile_skills_updated_at();

ALTER TABLE public.worker_profile_skills ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_profile_skills TO authenticated;
GRANT ALL ON public.worker_profile_skills TO service_role;

DROP POLICY IF EXISTS worker_profile_skills_staff ON public.worker_profile_skills;
CREATE POLICY worker_profile_skills_staff
  ON public.worker_profile_skills
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_profile_skills_worker_read ON public.worker_profile_skills;
CREATE POLICY worker_profile_skills_worker_read
  ON public.worker_profile_skills
  FOR SELECT
  TO authenticated
  USING (public.worker_belongs_to_auth(worker_id));
