-- Track who uploaded each resume (worker auth user or recruiter staff user).

ALTER TABLE public.worker_resumes
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.worker_resumes.uploaded_by_user_id IS
  'Auth user who uploaded this resume (worker or recruiter staff).';

CREATE INDEX IF NOT EXISTS worker_resumes_uploaded_by_user_idx
  ON public.worker_resumes (uploaded_by_user_id);
