-- Worker user settings (portal Profile / Account screens).

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS portal_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.worker.preferred_name IS
  'Optional preferred / display first name shown in the worker portal.';

COMMENT ON COLUMN public.worker.portal_preferences IS
  'Worker portal account preferences (language, timezone, date/time formats).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'worker_portal_preferences_object_check'
  ) THEN
    ALTER TABLE public.worker
      ADD CONSTRAINT worker_portal_preferences_object_check
      CHECK (jsonb_typeof(portal_preferences) = 'object');
  END IF;
END $$;
