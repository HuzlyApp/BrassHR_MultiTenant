-- Human-readable reverse-geocoded addresses for attendance locations.

ALTER TABLE public.applicant_attendance_logs
  ADD COLUMN IF NOT EXISTS clock_in_address text,
  ADD COLUMN IF NOT EXISTS clock_out_address text;
