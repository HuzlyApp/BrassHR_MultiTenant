-- Link worker portal resume uploads to a specific job application.

ALTER TABLE public.worker_resumes
  ADD COLUMN IF NOT EXISTS job_application_id uuid REFERENCES public.job_applications(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.worker_resumes.job_application_id IS
  'Job application this resume was uploaded for (worker portal Documents tab).';

CREATE INDEX IF NOT EXISTS worker_resumes_job_application_idx
  ON public.worker_resumes (job_application_id)
  WHERE deleted_at IS NULL;
