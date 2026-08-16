-- Allow admin bulk-delete of job requisitions: cascade to job applications and workflow data.
-- job_applications -> applicant_workflow_instances (ON DELETE CASCADE via application_id)
-- applicant_workflow_instances -> applicant_workflow_step_records (ON DELETE CASCADE)

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_job_requisition_id_fkey;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_job_requisition_id_fkey
  FOREIGN KEY (job_requisition_id)
  REFERENCES public.job_requisitions (id)
  ON DELETE CASCADE;
