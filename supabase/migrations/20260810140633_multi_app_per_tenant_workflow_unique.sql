-- Multi-app per tenant: allow multiple workflow instances per worker;
-- strengthen job_applications duplicate protection for active applications.

-- 1) Drop hard blocker: one workflow instance per worker
DROP INDEX IF EXISTS public.applicant_workflow_instances_worker_uidx;

CREATE INDEX IF NOT EXISTS applicant_workflow_instances_worker_idx
  ON public.applicant_workflow_instances (worker_id);

-- Keep / ensure one workflow instance per application
CREATE UNIQUE INDEX IF NOT EXISTS applicant_workflow_instances_application_id_uidx
  ON public.applicant_workflow_instances (application_id)
  WHERE application_id IS NOT NULL;

-- 2) Rebuild job application uniqueness to exclude rejected + withdrawn
--    (product remapped withdrawn → undecided; rejected should allow re-apply)
DROP INDEX IF EXISTS public.job_applications_job_profile_uidx;
CREATE UNIQUE INDEX job_applications_job_profile_uidx
  ON public.job_applications (tenant_id, job_requisition_id, applicant_profile_id)
  WHERE applicant_profile_id IS NOT NULL
    AND status NOT IN ('rejected', 'withdrawn');

DROP INDEX IF EXISTS public.job_applications_job_auth_uidx;
CREATE UNIQUE INDEX job_applications_job_auth_uidx
  ON public.job_applications (tenant_id, job_requisition_id, applicant_auth_user_id)
  WHERE applicant_auth_user_id IS NOT NULL
    AND status NOT IN ('rejected', 'withdrawn');

-- 3) Duplicate protection by worker + job (when worker_id is set)
CREATE UNIQUE INDEX IF NOT EXISTS job_applications_worker_job_uidx
  ON public.job_applications (tenant_id, worker_id, job_requisition_id)
  WHERE worker_id IS NOT NULL
    AND status NOT IN ('rejected', 'withdrawn');

COMMENT ON INDEX public.job_applications_worker_job_uidx IS
  'One active application per worker per job; rejected/withdrawn may re-apply.';
