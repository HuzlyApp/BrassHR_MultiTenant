-- Staff / recruiter / manager User Settings (Profile + Account).
-- Staging only unless explicitly approved for production.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS birthdate date,
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS work_location text;

COMMENT ON COLUMN public.users.preferred_name IS
  'Optional preferred / display first name for staff profile.';

COMMENT ON COLUMN public.users.birthdate IS
  'Staff birthdate shown on User Settings Profile.';

COMMENT ON COLUMN public.users.employee_id IS
  'Optional employee identifier shown on User Settings Profile.';

COMMENT ON COLUMN public.users.work_location IS
  'Staff work location label (e.g. city/office) on User Settings Profile.';

ALTER TABLE public.account_settings
  ADD COLUMN IF NOT EXISTS time_format text NOT NULL DEFAULT '12h';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_settings_time_format_check'
  ) THEN
    ALTER TABLE public.account_settings
      ADD CONSTRAINT account_settings_time_format_check
      CHECK (time_format IN ('12h', '24h'));
  END IF;
END $$;

COMMENT ON COLUMN public.account_settings.time_format IS
  'Preferred clock format for staff Account preferences: 12h or 24h.';
