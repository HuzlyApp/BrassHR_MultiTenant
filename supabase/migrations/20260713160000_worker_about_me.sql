-- Editable About Me text on worker profile (worker portal Overview).

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS about_me text;

COMMENT ON COLUMN public.worker.about_me IS
  'Worker-authored About Me bio shown on the applicant/worker profile Overview.';
