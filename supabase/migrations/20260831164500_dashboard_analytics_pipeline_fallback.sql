-- Dashboard analytics: pipeline workforce fallback + richer recruitment counts.

CREATE OR REPLACE FUNCTION public.worker_status_metrics(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH pipeline AS (
    SELECT
      lower(
        COALESCE(
          NULLIF(trim(status), ''),
          NULLIF(trim(worker_status::text), '')
        )
      ) AS display_status
    FROM public.worker
    WHERE tenant_id = p_tenant_id
  ),
  employment AS (
    SELECT lower(COALESCE(NULLIF(trim(status), ''), 'active')) AS display_status
    FROM public.workers
    WHERE tenant_id = p_tenant_id
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM pipeline),
    'employment_total', (SELECT count(*) FROM employment),
    'active', (SELECT count(*) FROM employment WHERE display_status = 'active'),
    'employment_new', (SELECT count(*) FROM employment WHERE display_status = 'new'),
    'on_leave', 0,
    'inactive', (SELECT count(*) FROM employment WHERE display_status = 'inactive'),
    'terminated', (SELECT count(*) FROM employment WHERE display_status = 'terminated'),
    'pipeline_total', (SELECT count(*) FROM pipeline),
    'pipeline_active', (
      SELECT count(*) FROM pipeline
      WHERE display_status IN ('approved', 'active', 'converted', 'for_approval')
    ),
    'pipeline_new', (
      SELECT count(*) FROM pipeline
      WHERE display_status IN ('new', 'pending', 'under_review')
        OR display_status IS NULL
        OR display_status = ''
    ),
    'pipeline_inactive', (
      SELECT count(*) FROM pipeline
      WHERE display_status IN ('inactive', 'cancelled')
    ),
    'pipeline_terminated', (
      SELECT count(*) FROM pipeline
      WHERE display_status IN ('disapproved', 'banned', 'rejected')
    ),
    'applications', (
      SELECT count(*) FROM pipeline
      WHERE display_status IN ('new', 'pending', 'under_review')
        OR display_status IS NULL
        OR display_status = ''
    ),
    'offer_extended', (
      SELECT count(*) FROM pipeline
      WHERE display_status IN ('approved', 'for_approval')
    ),
    'hires', (
      (SELECT count(*) FROM employment WHERE display_status IN ('active', 'new'))
      + (SELECT count(*) FROM pipeline WHERE display_status = 'converted')
    ),
    'pending_workers', (
      SELECT count(*) FROM pipeline WHERE display_status = 'pending'
    )
  );
$$;

COMMENT ON FUNCTION public.worker_status_metrics(uuid) IS
  'Tenant-scoped recruitment (worker) and employment (workers) aggregates for admin dashboard analytics.';
