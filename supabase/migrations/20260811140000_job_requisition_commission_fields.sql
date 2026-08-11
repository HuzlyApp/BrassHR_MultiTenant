-- MSP Recruit & Release commission fee fields on job_requisitions.
-- Percentage and/or fixed USD amount the tenant earns per placement.

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS commission_percent numeric(5, 2),
  ADD COLUMN IF NOT EXISTS commission_fixed_amount numeric(10, 2);

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_commission_percent_chk;
ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_commission_percent_chk
  CHECK (
    commission_percent IS NULL
    OR (commission_percent >= 0 AND commission_percent <= 100)
  );

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_commission_fixed_amount_chk;
ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_commission_fixed_amount_chk
  CHECK (
    commission_fixed_amount IS NULL
    OR commission_fixed_amount >= 0
  );

COMMENT ON COLUMN public.job_requisitions.commission_percent IS
  'MSP Recruit & Release: tenant commission as a percentage of bill/placement (0–100).';
COMMENT ON COLUMN public.job_requisitions.commission_fixed_amount IS
  'MSP Recruit & Release: fixed USD commission fee per placement.';
