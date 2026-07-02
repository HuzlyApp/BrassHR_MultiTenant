-- Persist the farthest onboarding step index an applicant has reached for back/forward navigation.
ALTER TABLE public.worker_onboarding_progress
  ADD COLUMN IF NOT EXISTS farthest_reached_step_index integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.worker_onboarding_progress.farthest_reached_step_index IS
  'Highest 1-based enabled onboarding step index the applicant has reached. Used to allow backward/forward navigation without jumping ahead of visited steps.';
