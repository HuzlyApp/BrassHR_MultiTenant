-- Worker attendance break tracking (pause timer while remaining clocked in).

ALTER TABLE public.applicant_attendance_logs
  ADD COLUMN IF NOT EXISTS break_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS break_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS break_intervals jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.applicant_attendance_logs
  DROP CONSTRAINT IF EXISTS applicant_attendance_break_seconds_chk;

ALTER TABLE public.applicant_attendance_logs
  ADD CONSTRAINT applicant_attendance_break_seconds_chk
  CHECK (break_seconds >= 0);

COMMENT ON COLUMN public.applicant_attendance_logs.break_started_at IS
  'When the current break started; null when not on break.';

COMMENT ON COLUMN public.applicant_attendance_logs.break_seconds IS
  'Accumulated completed break seconds for this attendance session.';

COMMENT ON COLUMN public.applicant_attendance_logs.break_intervals IS
  'Completed break intervals as [{started_at, ended_at}, ...] ISO timestamps.';
