-- Profile detail fields used on admin recruiter candidate details.

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10, 2),
  ADD COLUMN IF NOT EXISTS ssn_last_four text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'worker_ssn_last_four_check'
  ) THEN
    ALTER TABLE public.worker
      ADD CONSTRAINT worker_ssn_last_four_check
      CHECK (ssn_last_four IS NULL OR ssn_last_four ~ '^\d{4}$');
  END IF;
END $$;

COMMENT ON COLUMN public.worker.date_of_birth IS 'Candidate date of birth (admin/applicant profile).';
COMMENT ON COLUMN public.worker.hourly_rate IS 'Hourly pay rate for staffing assignments.';
COMMENT ON COLUMN public.worker.ssn_last_four IS 'Last four digits of SSN (display only, not full SSN).';
