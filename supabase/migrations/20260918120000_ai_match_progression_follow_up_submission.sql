-- Recruiter-unlocked AI match steps: follow_up and submission.
-- Quick Match / Deep Match still write quick|deep; recruiter Continue writes call_pack|follow_up|submission.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS ai_match_stage text;

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_ai_match_stage_chk;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_ai_match_stage_chk CHECK (
    ai_match_stage IS NULL
    OR ai_match_stage IN ('quick', 'call_pack', 'follow_up', 'deep', 'submission')
  );

COMMENT ON COLUMN public.job_applications.ai_match_stage IS
  'Recruiter AI progression: quick, call_pack (verifications), follow_up, deep (writes match %), submission.';
