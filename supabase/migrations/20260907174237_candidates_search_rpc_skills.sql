DROP FUNCTION IF EXISTS public.list_candidate_ids_page(
  uuid, text, boolean, text, text, text, text, timestamptz, timestamptz,
  text, text, int, int, numeric, numeric, boolean, uuid, text
);

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
  p_job_title text DEFAULT NULL,
  p_skills text[] DEFAULT NULL
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH search AS (
    SELECT
      nullif(
        trim(regexp_replace(coalesce(p_search, ''), '\s+', ' ', 'g')),
        ''
      ) AS q,
      nullif(
        lower(
          trim(
            regexp_replace(
              regexp_replace(coalesce(p_search, ''), '[^\w\s@+/.-]', ' ', 'g'),
              '\s+',
              ' ',
              'g'
            )
          )
        ),
        ''
      ) AS q_norm,
      nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '') AS digits,
      COALESCE(
        (
          SELECT array_agg(DISTINCT lower(trim(s)))
          FROM unnest(COALESCE(p_skills, ARRAY[]::text[])) AS s
          WHERE trim(s) <> ''
        ),
        ARRAY[]::text[]
      ) AS skills
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
      -- Free-text search (OR across identity / role / apps / resume / profile skills).
      AND (
        s.q IS NULL
        OR lower(
          regexp_replace(
            concat_ws(
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
            ),
            '[^\w\s@+/.-]',
            ' ',
            'g'
          )
        ) ILIKE '%' || s.q_norm || '%'
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
        OR EXISTS (
          SELECT 1
          FROM public.worker_profile_skills wps
          WHERE wps.worker_id = w.id
            AND wps.tenant_id = p_tenant_id
            AND lower(wps.skill_name) ILIKE '%' || s.q_norm || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM public.worker_resumes wr
          WHERE wr.worker_id = w.id
            AND wr.tenant_id = p_tenant_id
            AND wr.deleted_at IS NULL
            AND (
              wr.extracted_text ILIKE '%' || s.q || '%'
              OR (
                length(s.q) >= 3
                AND to_tsvector('english', coalesce(wr.extracted_text, ''))
                  @@ plainto_tsquery('english', s.q)
              )
            )
        )
      )
      -- Skills filter: every skill must appear in profile skills and/or resume (AND).
      -- Combined with p_search above → overall AND between free-text and skills.
      AND (
        cardinality(s.skills) = 0
        OR (
          SELECT bool_and(
            EXISTS (
              SELECT 1
              FROM public.worker_profile_skills wps2
              WHERE wps2.worker_id = w.id
                AND wps2.tenant_id = p_tenant_id
                AND lower(wps2.skill_name) ILIKE '%' || skill || '%'
            )
            OR EXISTS (
              SELECT 1
              FROM public.worker_resumes wr2
              WHERE wr2.worker_id = w.id
                AND wr2.tenant_id = p_tenant_id
                AND wr2.deleted_at IS NULL
                AND lower(coalesce(wr2.extracted_text, '')) ILIKE '%' || skill || '%'
            )
          )
          FROM unnest(s.skills) AS skill
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
  'Tenant-scoped paginated candidate IDs. Free-text (p_search) ORs across name/email/phone/role/apps/resume/skills. Skills (p_skills) AND together; when both set, free-text AND skills. SECURITY INVOKER.';

GRANT EXECUTE ON FUNCTION public.list_candidate_ids_page(
  uuid, text, boolean, text, text, text, text, timestamptz, timestamptz,
  text, text, int, int, numeric, numeric, boolean, uuid, text, text[]
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_candidate_ids_page(
  uuid, text, boolean, text, text, text, text, timestamptz, timestamptz,
  text, text, int, int, numeric, numeric, boolean, uuid, text, text[]
) TO service_role;
