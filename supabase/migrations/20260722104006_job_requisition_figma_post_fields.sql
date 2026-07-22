-- Figma "Create a job post" fields for job_requisitions.
-- Safe to re-run: uses IF NOT EXISTS.
-- Applied to staging first; keep this file for a future production run.

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS positions_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS years_of_experience text,
  ADD COLUMN IF NOT EXISTS years_experience_required integer,
  ADD COLUMN IF NOT EXISTS additional_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS show_in_multiple_areas boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_type text,
  ADD COLUMN IF NOT EXISTS is_employer_on_record boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS compensation_type text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS show_pay_by text,
  ADD COLUMN IF NOT EXISTS pay_rate_period text,
  ADD COLUMN IF NOT EXISTS rate_unit text;

-- Allow Figma location type values (including combined "Remote, Hybrid").
ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_location_type_check;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_location_type_check
  CHECK (
    location_type IS NULL
    OR location_type = ANY (
      ARRAY[
        'On-site'::text,
        'Remote'::text,
        'Hybrid'::text,
        'Remote, Hybrid'::text
      ]
    )
  );

-- Staging may already have NOT NULL currency DEFAULT 'USD'; normalize only when blank/nullable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_requisitions'
      AND column_name = 'currency'
      AND is_nullable = 'YES'
  ) THEN
    UPDATE public.job_requisitions
    SET currency = COALESCE(NULLIF(trim(currency), ''), 'USD')
    WHERE currency IS NULL OR trim(currency) = '';
  END IF;
END $$;

-- Prefer pay_rate_period; backfill from legacy rate_unit when present.
UPDATE public.job_requisitions
SET pay_rate_period = rate_unit
WHERE (pay_rate_period IS NULL OR trim(pay_rate_period) = '')
  AND rate_unit IS NOT NULL
  AND trim(rate_unit) <> '';

COMMENT ON COLUMN public.job_requisitions.positions_count IS
  'Figma: Number of Positions';
COMMENT ON COLUMN public.job_requisitions.years_of_experience IS
  'Figma: Years of Experience display value (e.g. 5 yrs)';
COMMENT ON COLUMN public.job_requisitions.additional_locations IS
  'Figma: Additional job locations (json array of strings)';
COMMENT ON COLUMN public.job_requisitions.show_in_multiple_areas IS
  'Figma: I want to show my job in multiple areas';
COMMENT ON COLUMN public.job_requisitions.location_type IS
  'Figma: Job Location Type (Remote, Hybrid, On-site, Remote, Hybrid)';
COMMENT ON COLUMN public.job_requisitions.is_employer_on_record IS
  'Figma: Are you the employer on Record (Yes/No)';
COMMENT ON COLUMN public.job_requisitions.compensation_type IS
  'Figma: Compensation period type (Annually, Hourly)';
COMMENT ON COLUMN public.job_requisitions.show_pay_by IS
  'Figma: Show pay by (Range, Starting amount, Exact amount)';
COMMENT ON COLUMN public.job_requisitions.pay_rate_period IS
  'Figma: Pay rate period (Per month, Per hour, Per year)';
