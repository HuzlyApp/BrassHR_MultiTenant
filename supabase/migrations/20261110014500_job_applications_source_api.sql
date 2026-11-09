-- Allow inbound Integration API as a third application channel.
ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_source_chk;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_source_chk
  CHECK (source IS NULL OR source IN ('applicant', 'admin', 'api'));

COMMENT ON COLUMN public.job_applications.source IS
  'How the application was created: applicant (onboarding self-apply), admin (staff resume upload), or api (inbound Integration API).';
