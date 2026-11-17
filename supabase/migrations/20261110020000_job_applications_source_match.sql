-- Allow Candidate Match (import existing candidates onto a job) as a source channel.
ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_source_chk;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_source_chk
  CHECK (source IS NULL OR source IN ('applicant', 'admin', 'api', 'match'));

COMMENT ON COLUMN public.job_applications.source IS
  'How the application was created: applicant (onboarding), admin (manual resume upload), api (inbound Integration API), or match (Candidate Match import onto a job).';
