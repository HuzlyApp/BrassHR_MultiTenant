-- MSP jobs may be published without Profession / Specialty.
-- Allow null profession_id on job_requisitions (Internal jobs still require it in app validation).

ALTER TABLE public.job_requisitions
  ALTER COLUMN profession_id DROP NOT NULL;

COMMENT ON COLUMN public.job_requisitions.profession_id IS
  'Optional for MSP jobs; required for Internal jobs at publish time.';
