-- Worker portal profile photo (storage path in worker_required_files bucket)

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS profile_photo text;

COMMENT ON COLUMN public.worker.profile_photo IS
  'Storage path or URL for the worker profile photo shown in the applicant portal.';
