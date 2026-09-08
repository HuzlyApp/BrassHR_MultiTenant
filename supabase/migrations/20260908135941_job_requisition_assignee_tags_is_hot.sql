-- Job Details : assignee, tags, is_hot on job_requisitions.

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS assigned_recruiter_user_id uuid
    REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS is_hot boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS job_requisitions_tenant_assignee_idx
  ON public.job_requisitions (tenant_id, assigned_recruiter_user_id)
  WHERE assigned_recruiter_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_requisitions_tenant_is_hot_idx
  ON public.job_requisitions (tenant_id, is_hot)
  WHERE is_hot = true;

CREATE INDEX IF NOT EXISTS job_requisitions_tags_gin_idx
  ON public.job_requisitions USING gin (tags);

COMMENT ON COLUMN public.job_requisitions.assigned_recruiter_user_id IS
  'Job-level assigned recruiter (FSD assignee). Distinct from created_by.';
COMMENT ON COLUMN public.job_requisitions.tags IS
  'Free-form job tags for Job Details overflow Tags action.';
COMMENT ON COLUMN public.job_requisitions.is_hot IS
  'Hot job flag for Jobs list Hot tab (replaces client-only stars).';
