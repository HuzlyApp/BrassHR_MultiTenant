-- Expand job_applications.status to recruiting pipeline values used in candidates UI.
-- Legacy values are remapped, then the check constraint is replaced.

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_chk;

UPDATE public.job_applications
SET status = CASE status
  WHEN 'submitted' THEN 'new'
  WHEN 'in_progress' THEN 'reviewing'
  WHEN 'withdrawn' THEN 'undecided'
  ELSE status
END
WHERE status IN ('submitted', 'in_progress', 'withdrawn');

ALTER TABLE public.job_applications
  ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_chk CHECK (
    status IN (
      'new',
      'reviewing',
      'interviewing',
      'rejected',
      'hired',
      'shortlisted',
      'undecided',
      -- legacy (kept for safety if any rows remain)
      'in_progress',
      'submitted',
      'withdrawn'
    )
  );
