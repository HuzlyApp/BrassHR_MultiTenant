-- Allow multiple resume uploads per worker (history preserved; soft delete supported).

DROP INDEX IF EXISTS public.worker_resumes_worker_uidx;

ALTER TABLE public.worker_resumes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.worker_resumes.deleted_at IS
  'When set, resume is hidden from worker/admin lists but retained for audit.';

CREATE INDEX IF NOT EXISTS worker_resumes_worker_active_uploaded_idx
  ON public.worker_resumes (worker_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;
