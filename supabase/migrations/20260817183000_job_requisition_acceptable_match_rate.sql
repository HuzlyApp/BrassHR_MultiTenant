-- Acceptable Match Rate on job create (Internal + MSP). Stored as the selected label.

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS acceptable_match_rate text;

COMMENT ON COLUMN public.job_requisitions.acceptable_match_rate IS
  'Minimum AI match threshold for this job: 100%, > 90%, > 75%, > 50%, or > 25%.';

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_acceptable_match_rate_check;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_acceptable_match_rate_check
  CHECK (
    acceptable_match_rate IS NULL
    OR acceptable_match_rate IN ('100%', '> 90%', '> 75%', '> 50%', '> 25%')
  );
