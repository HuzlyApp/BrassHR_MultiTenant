-- Allow workers to add/remove their own profile skills (recruiters already have full access).

COMMENT ON TABLE public.worker_profile_skills IS
  'Profile skills added by workers or recruiters. Skill assessments remain in skill_assessments.';

DROP POLICY IF EXISTS worker_profile_skills_worker_write ON public.worker_profile_skills;
CREATE POLICY worker_profile_skills_worker_write
  ON public.worker_profile_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (public.worker_belongs_to_auth(worker_id));

DROP POLICY IF EXISTS worker_profile_skills_worker_delete ON public.worker_profile_skills;
CREATE POLICY worker_profile_skills_worker_delete
  ON public.worker_profile_skills
  FOR DELETE
  TO authenticated
  USING (public.worker_belongs_to_auth(worker_id));
