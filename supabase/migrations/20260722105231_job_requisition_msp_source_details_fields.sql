-- MSP "Job Source Details" fields used when source_type = MSP.
-- Staging already has most of these; IF NOT EXISTS keeps this safe for staging + future production.

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS msp_name text,
  ADD COLUMN IF NOT EXISTS msp_client_name text,
  ADD COLUMN IF NOT EXISTS source_job_title text,
  ADD COLUMN IF NOT EXISTS source_job_url text,
  ADD COLUMN IF NOT EXISTS source_job_details text,
  ADD COLUMN IF NOT EXISTS special_requirements text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS required_credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bill_rate numeric(12, 2),
  ADD COLUMN IF NOT EXISTS pay_rate numeric(12, 2),
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS target_start_date date,
  ADD COLUMN IF NOT EXISTS facility text,
  ADD COLUMN IF NOT EXISTS external_requisition_id text,
  ADD COLUMN IF NOT EXISTS msp_client text;

COMMENT ON COLUMN public.job_requisitions.msp_name IS
  'Figma MSP step: MSP (Job Source) name';
COMMENT ON COLUMN public.job_requisitions.msp_client_name IS
  'Legacy MSP client display name; app also writes msp_client';
COMMENT ON COLUMN public.job_requisitions.source_job_title IS
  'Figma MSP step: Source Job Title';
COMMENT ON COLUMN public.job_requisitions.source_job_url IS
  'Figma MSP step: Source Job URL';
COMMENT ON COLUMN public.job_requisitions.source_job_details IS
  'Figma MSP step: Job Details';
COMMENT ON COLUMN public.job_requisitions.special_requirements IS
  'Figma MSP step: Special Requirement / Restrictions';
COMMENT ON COLUMN public.job_requisitions.internal_notes IS
  'Figma MSP step: Internal Notes';
COMMENT ON COLUMN public.job_requisitions.required_credentials IS
  'Figma MSP step: Required Credentials / Certifications';
COMMENT ON COLUMN public.job_requisitions.pay_rate IS
  'Figma MSP step: Suggested Pay Rate (internal); public range uses pay_rate_min/max';
