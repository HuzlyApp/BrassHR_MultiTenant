-- Aggregate worker pipeline/employment status counts per tenant (dashboard analytics).

CREATE INDEX IF NOT EXISTS worker_tenant_worker_status_idx
  ON public.worker (tenant_id, worker_status);

CREATE OR REPLACE FUNCTION public.worker_status_metrics(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH normalized AS (
    SELECT
      lower(
        COALESCE(
          NULLIF(trim(status), ''),
          NULLIF(trim(worker_status::text), '')
        )
      ) AS display_status
    FROM public.worker
    WHERE tenant_id = p_tenant_id
  )
  SELECT jsonb_build_object(
    'total', count(*),
    'active', count(*) FILTER (
      WHERE display_status IN ('approved', 'active')
    ),
    'on_leave', count(*) FILTER (
      WHERE display_status IN ('new', 'pending')
    ),
    'inactive', count(*) FILTER (
      WHERE display_status IN ('inactive', 'cancelled')
    ),
    'terminated', count(*) FILTER (
      WHERE display_status IN ('disapproved', 'banned', 'rejected')
    ),
    'applications', count(*) FILTER (
      WHERE display_status IN ('new', 'pending')
    ),
    'offer_extended', count(*) FILTER (
      WHERE display_status = 'approved'
    ),
    'hires', count(*) FILTER (
      WHERE display_status IN ('approved', 'active')
    ),
    'pending_workers', count(*) FILTER (
      WHERE display_status = 'pending'
    )
  )
  FROM normalized;
$$;

COMMENT ON FUNCTION public.worker_status_metrics(uuid) IS
  'Tenant-scoped worker status aggregates for admin dashboard analytics (read-only).';
