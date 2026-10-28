-- Make Fixed Commission Amount optional on job_requisitions.
-- Allows MSP Recruit & Release jobs to save/publish with a null amount.

ALTER TABLE public.job_requisitions
  ALTER COLUMN commission_fixed_amount DROP NOT NULL;

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_commission_fixed_amount_chk;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_commission_fixed_amount_chk
  CHECK (
    commission_fixed_amount IS NULL
    OR commission_fixed_amount >= 0
  );

COMMENT ON COLUMN public.job_requisitions.commission_fixed_amount IS
  'MSP Recruit & Release: optional fixed USD commission fee per placement. NULL when not set.';
