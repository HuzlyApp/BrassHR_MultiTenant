-- Candidates list: support server-side pagination/filters and accurate KPI metrics.
-- Indexes only for query patterns used by list + metrics (tenant-scoped).

-- Pipeline status + recency (All Candidates default sort + status tabs).
CREATE INDEX IF NOT EXISTS worker_tenant_status_created_at_idx
  ON public.worker (tenant_id, status, created_at DESC);

-- Name / email search (ilike prefix and equality lookups).
CREATE INDEX IF NOT EXISTS worker_tenant_email_idx
  ON public.worker (tenant_id, lower(email));

CREATE INDEX IF NOT EXISTS worker_tenant_name_idx
  ON public.worker (tenant_id, lower(last_name), lower(first_name));

-- Job role / location filters.
CREATE INDEX IF NOT EXISTS worker_tenant_job_role_idx
  ON public.worker (tenant_id, job_role)
  WHERE job_role IS NOT NULL AND btrim(job_role) <> '';

CREATE INDEX IF NOT EXISTS worker_tenant_city_state_idx
  ON public.worker (tenant_id, lower(city), lower(state));

-- Match analysis lookups by worker (list enrichment + Analyzed KPI).
CREATE INDEX IF NOT EXISTS job_applications_tenant_worker_ai_match_idx
  ON public.job_applications (tenant_id, worker_id, ai_match_status, ai_match_score DESC NULLS LAST)
  WHERE worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_applications_tenant_ai_analyzed_at_idx
  ON public.job_applications (tenant_id, ai_analyzed_at DESC NULLS LAST)
  WHERE ai_analyzed_at IS NOT NULL;

-- Hired KPI: employment conversions linked back to candidates.
CREATE INDEX IF NOT EXISTS workers_tenant_candidate_created_idx
  ON public.workers (tenant_id, created_at DESC)
  WHERE candidate_id IS NOT NULL;

COMMENT ON INDEX public.worker_tenant_status_created_at_idx IS
  'Candidates list: tenant + pipeline status + created_at pagination/sort';
COMMENT ON INDEX public.job_applications_tenant_worker_ai_match_idx IS
  'Candidates list/metrics: best AI match per worker within tenant';

-- ---------------------------------------------------------------------------
-- KPI metrics (tenant-scoped). Counts each worker once.
-- ---------------------------------------------------------------------------
-- Metric definitions (see lib/workers/candidate-kpi-metrics.ts):
-- * New Candidates: worker rows in active pipeline (excl. converted/employment),
--   created in the last 30 days. Trend vs prior 30 days.
-- * Active Candidates: same base set excluding rejected/disapproved. Value = total
--   active; trend uses created_at windows.
-- * Analyzed: distinct base-set workers with at least one non-hidden application
--   where ai_match_status = 'ANALYZED' (duplicates/stale attempts ignored via DISTINCT).
--   Trend uses MAX(ai_analyzed_at) per worker in the window.
-- * Hired: employment rows in public.workers with candidate_id set (conversions).
--   Not limited to the active candidate list. Trend uses workers.created_at windows.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Paginated candidate IDs with conversion exclusion + common filters.
-- Returns one row per matching worker; total_count is the same on every row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_candidate_ids_page(
  p_tenant_id uuid,
  p_pipeline_status text DEFAULT NULL,
  p_exclude_converted boolean DEFAULT true,
  p_search text DEFAULT NULL,
  p_job_role text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_created_from timestamptz DEFAULT NULL,
  p_created_to timestamptz DEFAULT NULL,
  p_sort text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc',
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0,
  p_match_score_min numeric DEFAULT NULL,
  p_match_score_max numeric DEFAULT NULL,
  p_match_score_max_inclusive boolean DEFAULT true,
  p_progress_status_id uuid DEFAULT NULL,
  p_job_title text DEFAULT NULL
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH search AS (
    SELECT
      nullif(trim(p_search), '') AS q,
      nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '') AS digits
  ),
  ranked_match AS (
    SELECT DISTINCT ON (ja.worker_id)
      ja.worker_id,
      ja.ai_match_score,
      ja.ai_match_status,
      ja.status_id,
      ja.id AS application_id
    FROM public.job_applications ja
    WHERE ja.tenant_id = p_tenant_id
      AND ja.worker_id IS NOT NULL
      AND lower(coalesce(ja.status, '')) NOT IN ('rejected', 'withdrawn')
    ORDER BY
      ja.worker_id,
      CASE WHEN ja.ai_match_status = 'ANALYZED' THEN 0 ELSE 1 END,
      ja.ai_match_score DESC NULLS LAST,
      ja.created_at DESC
  ),
  job_title_workers AS (
    SELECT DISTINCT ja.worker_id
    FROM public.job_applications ja
    INNER JOIN public.job_requisitions jr ON jr.id = ja.job_requisition_id
    WHERE ja.tenant_id = p_tenant_id
      AND ja.worker_id IS NOT NULL
      AND p_job_title IS NOT NULL
      AND btrim(p_job_title) <> ''
      AND (
        jr.public_title ILIKE '%' || btrim(p_job_title) || '%'
        OR jr.source_job_title ILIKE '%' || btrim(p_job_title) || '%'
      )
  ),
  filtered AS (
    SELECT
      w.id,
      w.created_at,
      w.first_name,
      w.last_name,
      w.email,
      w.phone,
      w.job_role,
      w.city,
      w.state,
      w.status,
      rm.ai_match_score
    FROM public.worker w
    LEFT JOIN ranked_match rm ON rm.worker_id = w.id
    CROSS JOIN search s
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
      AND (
        NOT p_exclude_converted
        OR (
          lower(trim(coalesce(w.status, ''))) <> 'converted'
          AND NOT EXISTS (
            SELECT 1 FROM public.workers emp WHERE emp.candidate_id = w.id
          )
        )
      )
      AND (p_job_role IS NULL OR btrim(p_job_role) = '' OR w.job_role = p_job_role)
      AND (
        p_city IS NULL OR btrim(p_city) = ''
        OR lower(trim(coalesce(w.city, ''))) = lower(trim(p_city))
      )
      AND (
        p_state IS NULL OR btrim(p_state) = ''
        OR lower(trim(coalesce(w.state, ''))) = lower(trim(p_state))
      )
      AND (p_created_from IS NULL OR w.created_at >= p_created_from)
      AND (p_created_to IS NULL OR w.created_at < p_created_to)
      AND (
        p_progress_status_id IS NULL
        OR rm.status_id = p_progress_status_id
      )
      AND (
        p_job_title IS NULL OR btrim(p_job_title) = ''
        OR w.id IN (SELECT worker_id FROM job_title_workers)
      )
      AND (
        p_match_score_min IS NULL
        OR (
          rm.ai_match_score IS NOT NULL
          AND rm.ai_match_score >= p_match_score_min
          AND (
            p_match_score_max IS NULL
            OR (
              CASE
                WHEN p_match_score_max_inclusive THEN rm.ai_match_score <= p_match_score_max
                ELSE rm.ai_match_score < p_match_score_max
              END
            )
          )
        )
      )
      AND (
        s.q IS NULL
        OR concat_ws(
          ' ',
          w.first_name,
          w.last_name,
          w.email,
          w.phone,
          w.job_role,
          w.city,
          w.state,
          w.zip,
          w.address1,
          w.id::text
        ) ILIKE '%' || s.q || '%'
        OR EXISTS (
          SELECT 1
          FROM public.job_applications ja2
          LEFT JOIN public.job_requisitions jr2 ON jr2.id = ja2.job_requisition_id
          WHERE ja2.worker_id = w.id
            AND ja2.tenant_id = p_tenant_id
            AND concat_ws(
              ' ',
              jr2.public_title,
              jr2.source_job_title,
              jr2.internal_requisition_number,
              jr2.location,
              jr2.facility_name
            ) ILIKE '%' || s.q || '%'
        )
        OR (
          s.digits IS NOT NULL
          AND length(s.digits) >= 3
          AND regexp_replace(coalesce(w.phone, ''), '\D', '', 'g') LIKE '%' || s.digits || '%'
        )
      )
  ),
  counted AS (
    SELECT *, count(*) OVER () AS total_count
    FROM filtered
  )
  SELECT c.id, c.total_count
  FROM counted c
  ORDER BY
    CASE WHEN lower(coalesce(p_sort, 'created_at')) IN ('name', 'lastname') AND lower(coalesce(p_sort_dir, 'desc')) = 'asc'
      THEN lower(coalesce(c.last_name, '')) END ASC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) IN ('name', 'lastname') AND lower(coalesce(p_sort_dir, 'desc')) = 'desc'
      THEN lower(coalesce(c.last_name, '')) END DESC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) IN ('name', 'firstname') AND lower(coalesce(p_sort_dir, 'desc')) = 'asc'
      THEN lower(coalesce(c.first_name, '')) END ASC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) IN ('name', 'firstname') AND lower(coalesce(p_sort_dir, 'desc')) = 'desc'
      THEN lower(coalesce(c.first_name, '')) END DESC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'email' AND lower(coalesce(p_sort_dir, 'desc')) = 'asc'
      THEN lower(coalesce(c.email, '')) END ASC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'email' AND lower(coalesce(p_sort_dir, 'desc')) = 'desc'
      THEN lower(coalesce(c.email, '')) END DESC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'phone' AND lower(coalesce(p_sort_dir, 'desc')) = 'asc'
      THEN coalesce(c.phone, '') END ASC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'phone' AND lower(coalesce(p_sort_dir, 'desc')) = 'desc'
      THEN coalesce(c.phone, '') END DESC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'jobrole' AND lower(coalesce(p_sort_dir, 'desc')) = 'asc'
      THEN lower(coalesce(c.job_role, '')) END ASC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'jobrole' AND lower(coalesce(p_sort_dir, 'desc')) = 'desc'
      THEN lower(coalesce(c.job_role, '')) END DESC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'status' AND lower(coalesce(p_sort_dir, 'desc')) = 'asc'
      THEN lower(coalesce(c.status, '')) END ASC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'status' AND lower(coalesce(p_sort_dir, 'desc')) = 'desc'
      THEN lower(coalesce(c.status, '')) END DESC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'city' AND lower(coalesce(p_sort_dir, 'desc')) = 'asc'
      THEN lower(coalesce(c.city, '')) END ASC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'city' AND lower(coalesce(p_sort_dir, 'desc')) = 'desc'
      THEN lower(coalesce(c.city, '')) END DESC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'state' AND lower(coalesce(p_sort_dir, 'desc')) = 'asc'
      THEN lower(coalesce(c.state, '')) END ASC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'state' AND lower(coalesce(p_sort_dir, 'desc')) = 'desc'
      THEN lower(coalesce(c.state, '')) END DESC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'jobmatch' AND lower(coalesce(p_sort_dir, 'desc')) = 'asc'
      THEN c.ai_match_score END ASC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) = 'jobmatch' AND lower(coalesce(p_sort_dir, 'desc')) <> 'asc'
      THEN c.ai_match_score END DESC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) IN ('created_at', 'createddate', '') AND lower(coalesce(p_sort_dir, 'desc')) = 'asc'
      THEN c.created_at END ASC NULLS LAST,
    CASE WHEN lower(coalesce(p_sort, 'created_at')) IN ('created_at', 'createddate', '') AND lower(coalesce(p_sort_dir, 'desc')) <> 'asc'
      THEN c.created_at END DESC NULLS LAST,
    c.created_at DESC NULLS LAST,
    c.id
  LIMIT greatest(1, least(coalesce(p_limit, 25), 500))
  OFFSET greatest(0, coalesce(p_offset, 0));
$$;

COMMENT ON FUNCTION public.list_candidate_ids_page IS
  'Tenant-scoped paginated candidate IDs with filters/search/sort. SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.list_candidate_ids_page(
  uuid, text, boolean, text, text, text, text, timestamptz, timestamptz,
  text, text, int, int, numeric, numeric, boolean, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_candidate_ids_page(
  uuid, text, boolean, text, text, text, text, timestamptz, timestamptz,
  text, text, int, int, numeric, numeric, boolean, uuid, text
) TO service_role;
