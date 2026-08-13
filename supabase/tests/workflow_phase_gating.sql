-- Phase-gated staffing workflow: function and constraint presence.
-- Live JWT attacks are covered by the RLS suite; this file checks schema invariants.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.activate_post_hire(uuid, uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'activate_post_hire is missing';
  END IF;
  IF to_regprocedure('public.applicant_may_write_onboarding_step(uuid, uuid, uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'applicant_may_write_onboarding_step is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_applications'
      AND column_name = 'workflow_phase'
  ) THEN
    RAISE EXCEPTION 'job_applications.workflow_phase is missing';
  END IF;
END $$;

ROLLBACK;
