-- Ensure candidate_kpi_metrics exists for /api/workers/metrics.
-- Production was missing this RPC (cards showed 0); CREATE OR REPLACE is idempotent.

CREATE OR REPLACE FUNCTION public.candidate_kpi_metrics(
  p_tenant_id uuid,
  p_pipeline_status text DEFAULT NULL,
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      p_now AS now_ts,
      p_now - interval '30 days' AS current_start,
      p_now - interval '60 days' AS previous_start
  ),
  base AS (
    SELECT
      w.id,
      w.created_at,
      lower(trim(coalesce(w.status, ''))) AS status_norm
    FROM public.worker w
    WHERE w.tenant_id = p_tenant_id
      AND (
        p_pipeline_status IS NULL
        OR lower(trim(coalesce(w.status, ''))) = lower(trim(p_pipeline_status))
        OR (
          lower(trim(p_pipeline_status)) = 'pending'
          AND lower(trim(coalesce(w.status, ''))) IN ('pending', 'under_review')
        )
        OR (
          lower(trim(p_pipeline_status)) = 'new'
          AND (w.status IS NULL OR lower(trim(w.status)) = 'new')
        )
      )
      AND (
        p_pipeline_status IS NOT NULL
        OR w.status IS NULL
        OR lower(trim(w.status)) IN (
          'new', 'pending', 'under_review', 'for_approval', 'approved', 'disapproved'
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.workers emp
        WHERE emp.candidate_id = w.id
      )
      AND lower(trim(coalesce(w.status, ''))) <> 'converted'
  ),
  analyzed_workers AS (
    SELECT
      b.id AS worker_id,
      max(ja.ai_analyzed_at) AS analyzed_at
    FROM base b
    INNER JOIN public.job_applications ja
      ON ja.worker_id = b.id
     AND ja.tenant_id = p_tenant_id
    WHERE ja.ai_match_status = 'ANALYZED'
      AND lower(coalesce(ja.status, '')) NOT IN ('rejected', 'withdrawn')
    GROUP BY b.id
  ),
  hired AS (
    SELECT emp.id, emp.created_at
    FROM public.workers emp
    WHERE emp.tenant_id = p_tenant_id
      AND emp.candidate_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'newCandidates', jsonb_build_object(
      'value', (
        SELECT count(*)::int FROM base b, bounds bd
        WHERE b.created_at >= bd.current_start AND b.created_at < bd.now_ts
      ),
      'previous', (
        SELECT count(*)::int FROM base b, bounds bd
        WHERE b.created_at >= bd.previous_start AND b.created_at < bd.current_start
      )
    ),
    'activeCandidates', jsonb_build_object(
      'value', (
        SELECT count(*)::int FROM base b
        WHERE b.status_norm NOT IN ('disapproved', 'rejected')
      ),
      'currentWindow', (
        SELECT count(*)::int FROM base b, bounds bd
        WHERE b.status_norm NOT IN ('disapproved', 'rejected')
          AND b.created_at >= bd.current_start AND b.created_at < bd.now_ts
      ),
      'previousWindow', (
        SELECT count(*)::int FROM base b, bounds bd
        WHERE b.status_norm NOT IN ('disapproved', 'rejected')
          AND b.created_at >= bd.previous_start AND b.created_at < bd.current_start
      )
    ),
    'analyzed', jsonb_build_object(
      'value', (SELECT count(*)::int FROM analyzed_workers),
      'currentWindow', (
        SELECT count(*)::int FROM analyzed_workers aw, bounds bd
        WHERE aw.analyzed_at IS NOT NULL
          AND aw.analyzed_at >= bd.current_start AND aw.analyzed_at < bd.now_ts
      ),
      'previousWindow', (
        SELECT count(*)::int FROM analyzed_workers aw, bounds bd
        WHERE aw.analyzed_at IS NOT NULL
          AND aw.analyzed_at >= bd.previous_start AND aw.analyzed_at < bd.current_start
      )
    ),
    'hired', jsonb_build_object(
      'value', (SELECT count(*)::int FROM hired),
      'currentWindow', (
        SELECT count(*)::int FROM hired h, bounds bd
        WHERE h.created_at >= bd.current_start AND h.created_at < bd.now_ts
      ),
      'previousWindow', (
        SELECT count(*)::int FROM hired h, bounds bd
        WHERE h.created_at >= bd.previous_start AND h.created_at < bd.current_start
      )
    ),
    'totalCandidates', (SELECT count(*)::int FROM base)
  )
  FROM bounds
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.candidate_kpi_metrics(uuid, text, timestamptz) IS
  'Tenant-scoped Candidates KPI aggregates (New/Active/Analyzed/Hired). SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.candidate_kpi_metrics(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.candidate_kpi_metrics(uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.candidate_kpi_metrics(uuid, text, timestamptz) TO anon;

NOTIFY pgrst, 'reload schema';
