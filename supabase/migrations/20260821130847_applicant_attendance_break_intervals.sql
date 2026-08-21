-- Persist break start/end intervals for timesheet timeline rendering.

ALTER TABLE public.applicant_attendance_logs
  ADD COLUMN IF NOT EXISTS break_intervals jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.applicant_attendance_logs.break_intervals IS
  'Completed break intervals as [{started_at, ended_at}, ...] ISO timestamps.';
