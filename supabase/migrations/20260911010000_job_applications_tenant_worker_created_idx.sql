-- Candidate profile loads every application for a worker ordered by created_at.
-- EXPLAIN ANALYZE showed job_applications_tenant_phase_idx (tenant_id, workflow_phase)
-- with a worker_id filter that discarded ~4,929 of 4,939 rows.
-- The existing unique (tenant_id, worker_id, job_requisition_id) index is partial
-- (excludes rejected/withdrawn) so it cannot serve the full profile listing.

CREATE INDEX IF NOT EXISTS job_applications_tenant_worker_created_idx
  ON public.job_applications (tenant_id, worker_id, created_at DESC)
  WHERE worker_id IS NOT NULL;

COMMENT ON INDEX public.job_applications_tenant_worker_created_idx IS
  'Candidate profile / worker application list: tenant + worker + recency, all statuses.';
