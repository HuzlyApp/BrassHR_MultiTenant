-- Phase-gated staffing workflow: function and constraint presence.
-- Live JWT attacks are covered by the RLS suite; this file checks schema invariants.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.activate_post_hire(uuid, uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'activate_post_hire is missing';
  END IF;
  IF to_regprocedure('public.worker_is_authoritatively_converted(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'worker_is_authoritatively_converted is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_applications'
      AND column_name = 'hired_at'
  ) THEN
    RAISE EXCEPTION 'job_applications.hired_at is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_flow_steps_phase_chk'
  ) THEN
    RAISE EXCEPTION 'onboarding_flow_steps_phase_chk is missing';
  END IF;
END $$;

ROLLBACK;
