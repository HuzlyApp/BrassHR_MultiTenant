-- Candidates list: return one page of unique profiles from the database.
--
-- The previous function returned raw worker ids. The API then requested up to
-- 5,000 of them (500 at a time) and loaded identity columns in chunks of 80
-- before it could show 15 rows. This version collapses email / phone+name
-- duplicates in the database and applies LIMIT/OFFSET to that unique set.
--
-- Resume search uses the existing english full-text index. Substring ILIKE on
-- extracted_text used the trigram index but rechecked hundreds of heap pages
-- (about 355ms for "smith" on production). Name, email, phone, role, and
-- location stay on the existing trigram indexes.
--
-- Behavior notes:
-- * Queries shorter than 2 characters match only a name/email prefix. They do
--   not substring-scan the tenant or résumés.
-- * Résumé matches are word and prefix matches (FTS), not arbitrary substrings
--   inside a word. Name/email/phone substring search is unchanged.
-- * Skill words shorter than 3 characters match profile skills only.
-- * Duplicate profiles collapse to the row that has an email, then the newest
--   created_at, then the smallest id. Page order follows that row's sort columns
--   plus id, so pages stay stable.
-- * p_assignee filters the candidate universe (worker assignee, otherwise the
--   latest application assignee) before paging.

DROP FUNCTION IF EXISTS public.list_candidate_ids_page(
  uuid, text, boolean, text, text, text, text, timestamptz, timestamptz,
  text, text, int, int, numeric, numeric, boolean, uuid, text, text[]
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
  p_skills text[] DEFAULT NULL,
  p_assignee text DEFAULT NULL
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  worker_ids uuid[];
  email_keys text[];
  phone_keys text[];
  created_ats timestamptz[];
  first_names text[];
  last_names text[];
  emails text[];
  phones text[];
  job_roles text[];
  statuses text[];
  cities text[];
  states text[];
  match_scores numeric[];
  has_email boolean[];
  parent int[];
  best int[];
  rep_ords int[];
  n int;
  i int;
  r int;
  b int;
  members int[];
  grp record;
  anchor int;
  member int;
  ra int;
  rb int;
  page_limit int;
  page_offset int;
BEGIN
  page_limit := greatest(1, least(coalesce(p_limit, 25), 500));
  page_offset := greatest(0, coalesce(p_offset, 0));

  WITH search AS (
    SELECT
      nullif(trim(regexp_replace(coalesce(p_search, ''), '\s+', ' ', 'g')), '') AS q,
      nullif(
        replace(
          replace(
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
            '%',
            '\%'
          ),
          '_',
          '\_'
        ),
        ''
      ) AS q_like,
      CASE
        WHEN position('@' in coalesce(p_search, '')) > 0 THEN NULL
        WHEN regexp_replace(coalesce(p_search, ''), '[\s().+\-_/]', '', 'g') ~ '^\d{3,}$'
          THEN nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '')
        ELSE NULL
      END AS digits,
      COALESCE(
        (
          SELECT array_agg(DISTINCT lower(trim(s)))
          FROM unnest(COALESCE(p_skills, ARRAY[]::text[])) AS s
          WHERE length(trim(s)) >= 2
        ),
        ARRAY[]::text[]
      ) AS skills,
      COALESCE(
        (
          SELECT array_agg(tok)
          FROM (
            SELECT DISTINCT trim(t) AS tok
            FROM regexp_split_to_table(
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
              '\s+'
            ) AS t
            WHERE length(trim(t)) >= 2
          ) tokens
        ),
        ARRAY[]::text[]
      ) AS tokens
  ),
  resume_query AS (
    SELECT to_tsquery(
      'english',
      string_agg(clean || ':*', ' & ' ORDER BY clean)
    ) AS tsq
    FROM (
      SELECT DISTINCT regexp_replace(tok, '[^a-z0-9]', '', 'g') AS clean
      FROM search s
      CROSS JOIN LATERAL unnest(s.tokens) AS tok
      WHERE length(regexp_replace(tok, '[^a-z0-9]', '', 'g')) >= 3
    ) cleaned
    WHERE clean <> ''
  ),
  free_text_hits AS (
    SELECT w.id AS worker_id
    FROM public.worker w
    CROSS JOIN search s
    WHERE s.q IS NOT NULL
      AND w.tenant_id = p_tenant_id
      AND (
        (
          length(s.q_like) = 1
          AND (
            lower(coalesce(w.first_name, '')) LIKE s.q_like || '%' ESCAPE '\'
            OR lower(coalesce(w.last_name, '')) LIKE s.q_like || '%' ESCAPE '\'
            OR lower(coalesce(w.email, '')) LIKE s.q_like || '%' ESCAPE '\'
          )
        )
        OR (
          length(s.q_like) >= 2
          AND (
            lower(coalesce(w.first_name, '')) LIKE '%' || s.q_like || '%' ESCAPE '\'
            OR lower(coalesce(w.last_name, '')) LIKE '%' || s.q_like || '%' ESCAPE '\'
            OR lower(trim(coalesce(w.first_name, '') || ' ' || coalesce(w.last_name, '')))
              LIKE '%' || s.q_like || '%' ESCAPE '\'
            OR lower(trim(coalesce(w.last_name, '') || ' ' || coalesce(w.first_name, '')))
              LIKE '%' || s.q_like || '%' ESCAPE '\'
            OR lower(coalesce(w.email, '')) LIKE '%' || s.q_like || '%' ESCAPE '\'
            OR lower(coalesce(w.job_role, '')) LIKE '%' || s.q_like || '%' ESCAPE '\'
            OR lower(coalesce(w.city, '')) LIKE '%' || s.q_like || '%' ESCAPE '\'
            OR lower(coalesce(w.state, '')) LIKE '%' || s.q_like || '%' ESCAPE '\'
            OR (
              cardinality(s.tokens) > 1
              AND (
                SELECT bool_and(
                  lower(coalesce(w.first_name, '')) LIKE '%' || replace(replace(tok, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
                  OR lower(coalesce(w.last_name, '')) LIKE '%' || replace(replace(tok, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
                  OR lower(coalesce(w.email, '')) LIKE '%' || replace(replace(tok, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
                  OR lower(coalesce(w.job_role, '')) LIKE '%' || replace(replace(tok, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
                )
                FROM unnest(s.tokens) AS tok
              )
            )
          )
        )
        OR (
          s.digits IS NOT NULL
          AND length(s.digits) >= 3
          AND regexp_replace(coalesce(w.phone, ''), '\D', '', 'g') LIKE '%' || s.digits || '%'
        )
      )

    UNION

    SELECT DISTINCT ja.worker_id
    FROM public.job_applications ja
    INNER JOIN public.job_requisitions jr ON jr.id = ja.job_requisition_id
    CROSS JOIN search s
    WHERE s.q IS NOT NULL
      AND length(s.q) >= 2
      AND ja.tenant_id = p_tenant_id
      AND ja.worker_id IS NOT NULL
      AND (
        jr.public_title ILIKE '%' || s.q || '%'
        OR jr.source_job_title ILIKE '%' || s.q || '%'
        OR jr.internal_requisition_number ILIKE '%' || s.q || '%'
        OR jr.external_requisition_id ILIKE '%' || s.q || '%'
      )

    UNION

    SELECT DISTINCT wps.worker_id
    FROM public.worker_profile_skills wps
    CROSS JOIN search s
    WHERE s.q IS NOT NULL
      AND length(s.q_like) >= 2
      AND wps.tenant_id = p_tenant_id
      AND lower(wps.skill_name) LIKE '%' || s.q_like || '%' ESCAPE '\'

    UNION

    SELECT DISTINCT wr.worker_id
    FROM public.worker_resumes wr
    CROSS JOIN resume_query rq
    WHERE rq.tsq IS NOT NULL
      AND wr.tenant_id = p_tenant_id
      AND wr.deleted_at IS NULL
      AND wr.worker_id IS NOT NULL
      AND to_tsvector('english', coalesce(wr.extracted_text, '')) @@ rq.tsq
  ),
  skill_hits AS (
    SELECT cand.worker_id
    FROM (
      SELECT DISTINCT worker_id
      FROM (
        SELECT wps.worker_id
        FROM public.worker_profile_skills wps
        CROSS JOIN search s
        CROSS JOIN unnest(s.skills) AS skill
        WHERE cardinality(s.skills) > 0
          AND wps.tenant_id = p_tenant_id
          AND lower(wps.skill_name) LIKE '%' || replace(replace(skill, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
        UNION
        SELECT wr.worker_id
        FROM public.worker_resumes wr
        CROSS JOIN search s
        CROSS JOIN unnest(s.skills) AS skill
        WHERE cardinality(s.skills) > 0
          AND length(regexp_replace(skill, '[^a-z0-9]', '', 'g')) >= 3
          AND wr.tenant_id = p_tenant_id
          AND wr.deleted_at IS NULL
          AND wr.worker_id IS NOT NULL
          AND to_tsvector('english', coalesce(wr.extracted_text, ''))
            @@ to_tsquery(
              'english',
              regexp_replace(skill, '[^a-z0-9]', '', 'g') || ':*'
            )
      ) any_skill
    ) cand
    CROSS JOIN search s
    WHERE cardinality(s.skills) > 0
      AND (
        SELECT bool_and(
          EXISTS (
            SELECT 1
            FROM public.worker_profile_skills wps
            WHERE wps.worker_id = cand.worker_id
              AND wps.tenant_id = p_tenant_id
              AND lower(wps.skill_name) LIKE '%' || replace(replace(skill, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
          )
          OR (
            length(regexp_replace(skill, '[^a-z0-9]', '', 'g')) >= 3
            AND EXISTS (
              SELECT 1
              FROM public.worker_resumes wr
              WHERE wr.worker_id = cand.worker_id
                AND wr.tenant_id = p_tenant_id
                AND wr.deleted_at IS NULL
                AND to_tsvector('english', coalesce(wr.extracted_text, ''))
                  @@ to_tsquery(
                    'english',
                    regexp_replace(skill, '[^a-z0-9]', '', 'g') || ':*'
                  )
            )
          )
        )
        FROM unnest(s.skills) AS skill
      )
  ),
  needs_match_join AS (
    SELECT
      (p_match_score_min IS NOT NULL OR p_progress_status_id IS NOT NULL
        OR lower(coalesce(p_sort, '')) = 'jobmatch') AS needed
  ),
  ranked_match AS (
    SELECT DISTINCT ON (ja.worker_id)
      ja.worker_id,
      ja.ai_match_score,
      ja.status_id
    FROM public.job_applications ja
    CROSS JOIN needs_match_join n
    WHERE n.needed
      AND ja.tenant_id = p_tenant_id
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
      rm.ai_match_score,
      nullif(lower(btrim(w.email)), '') AS email_key,
      CASE
        WHEN length(regexp_replace(coalesce(w.phone, ''), '\D', '', 'g')) >= 10
          AND btrim(
            regexp_replace(
              lower(btrim(coalesce(w.first_name, '')) || ' ' || btrim(coalesce(w.last_name, ''))),
              '\s+',
              ' ',
              'g'
            )
          ) <> ''
        THEN right(regexp_replace(coalesce(w.phone, ''), '\D', '', 'g'), 10)
          || ':'
          || regexp_replace(
            lower(btrim(coalesce(w.first_name, '')) || ' ' || btrim(coalesce(w.last_name, ''))),
            '\s+',
            ' ',
            'g'
          )
        ELSE NULL
      END AS phone_key
    FROM public.worker w
    CROSS JOIN search s
    LEFT JOIN ranked_match rm ON rm.worker_id = w.id
    WHERE w.tenant_id = p_tenant_id
      AND (
        s.q IS NULL
        OR w.id IN (SELECT worker_id FROM free_text_hits)
      )
      AND (
        cardinality(s.skills) = 0
        OR w.id IN (SELECT worker_id FROM skill_hits)
      )
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
      AND (p_progress_status_id IS NULL OR rm.status_id = p_progress_status_id)
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
        p_assignee IS NULL
        OR btrim(p_assignee) = ''
        OR (
          lower(btrim(p_assignee)) = 'unassigned'
          AND coalesce(w.assigned_recruiter_user_id::text, '') = ''
          AND NOT EXISTS (
            SELECT 1
            FROM public.job_applications ja
            WHERE ja.tenant_id = p_tenant_id
              AND ja.worker_id = w.id
              AND ja.assigned_recruiter_user_id IS NOT NULL
          )
        )
        OR (
          lower(btrim(p_assignee)) <> 'unassigned'
          AND btrim(p_assignee) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND coalesce(
            nullif(w.assigned_recruiter_user_id::text, ''),
            (
              SELECT ja.assigned_recruiter_user_id::text
              FROM public.job_applications ja
              WHERE ja.tenant_id = p_tenant_id
                AND ja.worker_id = w.id
                AND ja.assigned_recruiter_user_id IS NOT NULL
              ORDER BY ja.updated_at DESC NULLS LAST, ja.id
              LIMIT 1
            ),
            ''
          ) = btrim(p_assignee)
        )
      )
  ),
  numbered AS (
    SELECT row_number() OVER ()::int AS ord, f.*
    FROM filtered f
  )
  SELECT
    coalesce(array_agg(n.id ORDER BY n.ord), ARRAY[]::uuid[]),
    coalesce(array_agg(n.email_key ORDER BY n.ord), ARRAY[]::text[]),
    coalesce(array_agg(n.phone_key ORDER BY n.ord), ARRAY[]::text[]),
    coalesce(array_agg(n.created_at ORDER BY n.ord), ARRAY[]::timestamptz[]),
    coalesce(array_agg(n.first_name ORDER BY n.ord), ARRAY[]::text[]),
    coalesce(array_agg(n.last_name ORDER BY n.ord), ARRAY[]::text[]),
    coalesce(array_agg(n.email ORDER BY n.ord), ARRAY[]::text[]),
    coalesce(array_agg(n.phone ORDER BY n.ord), ARRAY[]::text[]),
    coalesce(array_agg(n.job_role ORDER BY n.ord), ARRAY[]::text[]),
    coalesce(array_agg(n.status ORDER BY n.ord), ARRAY[]::text[]),
    coalesce(array_agg(n.city ORDER BY n.ord), ARRAY[]::text[]),
    coalesce(array_agg(n.state ORDER BY n.ord), ARRAY[]::text[]),
    coalesce(array_agg(n.ai_match_score ORDER BY n.ord), ARRAY[]::numeric[]),
    coalesce(array_agg((n.email_key IS NOT NULL) ORDER BY n.ord), ARRAY[]::boolean[])
  INTO
    worker_ids, email_keys, phone_keys, created_ats, first_names, last_names,
    emails, phones, job_roles, statuses, cities, states, match_scores, has_email
  FROM numbered n;

  n := coalesce(array_length(worker_ids, 1), 0);
  IF n = 0 THEN
    RETURN;
  END IF;

  parent := ARRAY(SELECT g FROM generate_series(1, n) AS g);
  best := array_fill(0, ARRAY[n]);

  FOR grp IN
    SELECT array_agg(ordinality::int ORDER BY ordinality) AS member_ords
    FROM unnest(email_keys) WITH ORDINALITY AS t(email_key, ordinality)
    WHERE email_key IS NOT NULL AND email_key <> ''
    GROUP BY email_key
    HAVING count(*) > 1
  LOOP
    members := grp.member_ords;
    anchor := members[1];
    FOREACH member IN ARRAY members LOOP
      ra := anchor;
      WHILE parent[ra] <> ra LOOP
        parent[ra] := parent[parent[ra]];
        ra := parent[ra];
      END LOOP;
      rb := member;
      WHILE parent[rb] <> rb LOOP
        parent[rb] := parent[parent[rb]];
        rb := parent[rb];
      END LOOP;
      IF ra <> rb THEN
        parent[rb] := ra;
      END IF;
      anchor := ra;
    END LOOP;
  END LOOP;

  FOR grp IN
    SELECT array_agg(ordinality::int ORDER BY ordinality) AS member_ords
    FROM unnest(phone_keys) WITH ORDINALITY AS t(phone_key, ordinality)
    WHERE phone_key IS NOT NULL AND phone_key <> ''
    GROUP BY phone_key
    HAVING count(*) > 1
  LOOP
    members := grp.member_ords;
    anchor := members[1];
    FOREACH member IN ARRAY members LOOP
      ra := anchor;
      WHILE parent[ra] <> ra LOOP
        parent[ra] := parent[parent[ra]];
        ra := parent[ra];
      END LOOP;
      rb := member;
      WHILE parent[rb] <> rb LOOP
        parent[rb] := parent[parent[rb]];
        rb := parent[rb];
      END LOOP;
      IF ra <> rb THEN
        parent[rb] := ra;
      END IF;
      anchor := ra;
    END LOOP;
  END LOOP;

  FOR i IN 1..n LOOP
    r := i;
    WHILE parent[r] <> r LOOP
      r := parent[r];
    END LOOP;
    parent[i] := r;
    b := best[r];
    IF b = 0
      OR (has_email[i] AND NOT has_email[b])
      OR (
        has_email[i] = has_email[b]
        AND created_ats[i] IS NOT NULL
        AND (created_ats[b] IS NULL OR created_ats[i] > created_ats[b])
      )
      OR (
        has_email[i] = has_email[b]
        AND created_ats[i] IS NOT DISTINCT FROM created_ats[b]
        AND worker_ids[i] < worker_ids[b]
      )
    THEN
      best[r] := i;
    END IF;
  END LOOP;

  SELECT coalesce(array_agg(DISTINCT slot), ARRAY[]::int[])
  INTO rep_ords
  FROM unnest(best) AS slot
  WHERE slot > 0;

  RETURN QUERY
  WITH reps AS (
    SELECT
      worker_ids[ord] AS id,
      created_ats[ord] AS created_at,
      first_names[ord] AS first_name,
      last_names[ord] AS last_name,
      emails[ord] AS email,
      phones[ord] AS phone,
      job_roles[ord] AS job_role,
      statuses[ord] AS status,
      cities[ord] AS city,
      states[ord] AS state,
      match_scores[ord] AS ai_match_score
    FROM unnest(rep_ords) AS ord
  ),
  counted AS (
    SELECT reps.*, count(*) OVER () AS total_count
    FROM reps
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
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_candidate_ids_page(
  uuid, text, boolean, text, text, text, text, timestamptz, timestamptz,
  text, text, int, int, numeric, numeric, boolean, uuid, text, text[], text
) TO authenticated, anon, service_role;

-- Measurement leftovers from benchmarking this body under a separate name.
DROP FUNCTION IF EXISTS public.list_candidate_ids_page_perfcheck(
  uuid, text, boolean, text, text, text, text, timestamptz, timestamptz,
  text, text, int, int, numeric, numeric, boolean, uuid, text, text[], text
);
DROP TABLE IF EXISTS public._sql_load;

NOTIFY pgrst, 'reload schema';
