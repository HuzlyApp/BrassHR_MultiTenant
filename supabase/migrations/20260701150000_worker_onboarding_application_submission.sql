-- Track application submission separately from per-step completion.
ALTER TABLE public.worker_onboarding_progress
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_with_incomplete_steps boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incomplete_step_keys jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_worker_onboarding_progress_submitted_at
  ON public.worker_onboarding_progress (submitted_at)
  WHERE submitted_at IS NOT NULL;

COMMENT ON COLUMN public.worker_onboarding_progress.submitted_at IS
  'When the applicant submitted their application from the review/summary step.';
COMMENT ON COLUMN public.worker_onboarding_progress.submitted_with_incomplete_steps IS
  'True when submission occurred before all onboarding steps were completed or skipped.';
COMMENT ON COLUMN public.worker_onboarding_progress.incomplete_step_keys IS
  'Step keys still pending/in_progress/failed at submission time.';
