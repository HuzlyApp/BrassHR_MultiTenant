-- Track when admin/recruiter claims a completed attendance record for payroll review.

ALTER TABLE public.applicant_attendance_logs
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS applicant_attendance_unclaimed_idx
  ON public.applicant_attendance_logs (tenant_id, attendance_date DESC)
  WHERE status = 'clocked_out' AND claimed_at IS NULL;

CREATE INDEX IF NOT EXISTS applicant_attendance_completed_idx
  ON public.applicant_attendance_logs (tenant_id, attendance_date DESC)
  WHERE status = 'clocked_out' AND claimed_at IS NOT NULL;

COMMENT ON COLUMN public.applicant_attendance_logs.claimed_at IS
  'When staff claimed this completed attendance record.';
COMMENT ON COLUMN public.applicant_attendance_logs.claimed_by IS
  'Staff user who claimed this attendance record.';