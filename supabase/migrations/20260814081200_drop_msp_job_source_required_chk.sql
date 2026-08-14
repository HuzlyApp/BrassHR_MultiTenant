-- MSP source fields (name, contract group, source job ID) are optional on create/publish.

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_msp_job_source_required_chk;

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_msp_required_chk;

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_valid_msp_info_check;

