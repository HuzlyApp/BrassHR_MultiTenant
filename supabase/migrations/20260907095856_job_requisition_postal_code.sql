-- Store ZIP separately from job location (location stays "City, ST").
ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS postal_code text;

COMMENT ON COLUMN public.job_requisitions.postal_code IS
  'ZIP/postal code from job location search when available; not shown in location label.';
