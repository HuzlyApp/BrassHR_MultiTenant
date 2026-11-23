-- Candidate/worker pay rate period for profile Pay Rate (Hourly / Weekly / Monthly).

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS pay_rate_period text;

ALTER TABLE public.worker
  DROP CONSTRAINT IF EXISTS worker_pay_rate_period_check;

ALTER TABLE public.worker
  ADD CONSTRAINT worker_pay_rate_period_check
  CHECK (
    pay_rate_period IS NULL
    OR lower(btrim(pay_rate_period)) IN ('hourly', 'weekly', 'monthly')
  );

COMMENT ON COLUMN public.worker.pay_rate_period IS
  'Pay rate period for staffing assignments: Hourly, Weekly, or Monthly.';

-- Normalize any existing values to title case labels used by the admin UI.
UPDATE public.worker
SET pay_rate_period = CASE lower(btrim(pay_rate_period))
  WHEN 'hourly' THEN 'Hourly'
  WHEN 'weekly' THEN 'Weekly'
  WHEN 'monthly' THEN 'Monthly'
  ELSE pay_rate_period
END
WHERE pay_rate_period IS NOT NULL;
