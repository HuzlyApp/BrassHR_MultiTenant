-- Recruiter list performance: one page of applications, grouped tab counts,
-- grouped job-card counts, and one requirement aggregate.
-- These functions are invoked only by the service role after the API has
-- verified the staff session and resolved the tenant id.

CREATE OR REPLACE FUNCTION public.staff_search_norm(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(lower(coalesce(p_value, '')), '[^[:alnum:][:space:]]', ' ', 'g'),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

COMMENT ON FUNCTION public.staff_search_norm(text) IS
  'Punctuation-insensitive search text, matching the applications list normalizer.';

CREATE OR REPLACE FUNCTION public.staff_us_state_name(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT name
  FROM (
    VALUES
      ('AL', 'Alabama'), ('AK', 'Alaska'), ('AS', 'American Samoa'), ('AZ', 'Arizona'),
      ('AR', 'Arkansas'), ('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'),
      ('DE', 'Delaware'), ('DC', 'District of Columbia'), ('FL', 'Florida'), ('GA', 'Georgia'),
      ('GU', 'Guam'), ('HI', 'Hawaii'), ('ID', 'Idaho'), ('IL', 'Illinois'), ('IN', 'Indiana'),
      ('IA', 'Iowa'), ('KS', 'Kansas'), ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'),
      ('MD', 'Maryland'), ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'),
      ('MS', 'Mississippi'), ('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'),
      ('NV', 'Nevada'), ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'),
      ('NY', 'New York'), ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'),
      ('OK', 'Oklahoma'), ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('PR', 'Puerto Rico'),
      ('RI', 'Rhode Island'), ('SC', 'South Carolina'), ('SD', 'South Dakota'), ('TN', 'Tennessee'),
      ('TX', 'Texas'), ('VI', 'U.S. Virgin Islands'), ('UT', 'Utah'), ('VT', 'Vermont'),
      ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'), ('WI', 'Wisconsin'),
      ('WY', 'Wyoming')
  ) AS states(code, name)
  WHERE code = upper(btrim(coalesce(p_code, '')));
$$;

CREATE OR REPLACE FUNCTION public.staff_expand_state(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN btrim(coalesce(p_value, '')) = '' THEN ''
    WHEN length(btrim(p_value)) = 2 THEN coalesce(public.staff_us_state_name(btrim(p_value)), btrim(p_value))
    ELSE btrim(p_value)
  END;
$$;

-- Worker state (full name when a code), else city, else the state inside city/state/zip.
CREATE OR REPLACE FUNCTION public.staff_location_display(
  p_state text,
  p_city text,
  p_city_state_zip text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN btrim(coalesce(p_state, '')) <> '' THEN public.staff_expand_state(p_state)
    WHEN btrim(coalesce(p_city, '')) <> '' THEN btrim(p_city)
    WHEN btrim(coalesce(p_city_state_zip, '')) = '' THEN ''
    WHEN position(',' IN p_city_state_zip) > 0 THEN public.staff_expand_state(
      split_part(btrim(regexp_replace(split_part(p_city_state_zip, ',', 2), '[0-9]', '', 'g')), ' ', 1)
    )
    WHEN p_city_state_zip !~ '[0-9]' THEN public.staff_expand_state(p_city_state_zip)
    ELSE ''
  END;
$$;

CREATE OR REPLACE FUNCTION public.job_application_requirement_counts(
  p_tenant_id uuid,
  p_application_ids uuid[]
)
RETURNS TABLE (
  job_application_id uuid,
  confirmed integer,
  verify integer,
  not_met integer,
  mandatory integer,
  blocking integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    r.job_application_id,
    count(*) FILTER (WHERE bucket = 'confirmed')::integer AS confirmed,
    count(*) FILTER (WHERE bucket = 'verify')::integer AS verify,
    count(*) FILTER (WHERE bucket = 'not_met')::integer AS not_met,
    count(*) FILTER (WHERE upper(coalesce(r.requirement_type, '')) = 'MANDATORY')::integer AS mandatory,
    count(*) FILTER (WHERE bucket = 'blocking')::integer AS blocking
  FROM public.job_application_match_requirements r
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN upper(coalesce(r.requirement_outcome, '')) = 'NOT_APPLICABLE' THEN 'skip'
      WHEN r.recruiter_verified THEN 'confirmed'
      WHEN upper(coalesce(r.requirement_outcome, '')) = 'CONFLICT'
        OR upper(coalesce(r.status, '')) = 'CONFLICTING' THEN 'blocking'
      WHEN coalesce(r.verification_required, false)
        OR upper(coalesce(r.requirement_outcome, '')) = 'VERIFY' THEN 'verify'
      WHEN upper(coalesce(r.requirement_outcome, '')) = 'NOT_MET' THEN 'not_met'
      WHEN upper(coalesce(r.requirement_outcome, '')) = 'MET'
        OR upper(coalesce(r.status, '')) = 'CONFIRMED' THEN 'confirmed'
      ELSE 'verify'
    END AS bucket
  ) classified
  WHERE r.tenant_id = p_tenant_id
    AND r.job_application_id = ANY (p_application_ids)
  GROUP BY r.job_application_id;
$$;

COMMENT ON FUNCTION public.job_application_requirement_counts(uuid, uuid[]) IS
  'One grouped Conf/Verify/Not Met aggregate for a tenant-scoped application id list.';

CREATE OR REPLACE FUNCTION public.job_list_application_metrics(p_tenant_id uuid)
RETURNS TABLE (
  job_requisition_id uuid,
  applicant_count integer,
  new_count integer,
  in_process_count integer,
  analyzed_count integer,
  strong_count integer,
  ready_count integer,
  hired_count integer,
  in_process_redirect_tab text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH rows AS (
    SELECT
      ja.job_requisition_id,
      CASE lower(btrim(coalesce(ja.status, '')))
        WHEN 'submitted' THEN 'new'
        WHEN 'in_progress' THEN 'reviewing'
        WHEN 'withdrawn' THEN 'undecided'
        WHEN 'new' THEN 'new'
        WHEN 'reviewing' THEN 'reviewing'
        WHEN 'interviewing' THEN 'interviewing'
        WHEN 'rejected' THEN 'rejected'
        WHEN 'hired' THEN 'hired'
        WHEN 'shortlisted' THEN 'shortlisted'
        WHEN 'undecided' THEN 'undecided'
        WHEN 'archived' THEN 'archived'
        ELSE 'reviewing'
      END AS pipeline,
      ja.ai_match_status,
      ja.ai_match_score,
      ja.ai_match_readiness,
      ja.ai_analyzed_at,
      coalesce(nullif(lower(btrim(st.system_key)), ''), NULL) AS system_key
    FROM public.job_applications ja
    LEFT JOIN public.application_statuses st ON st.id = ja.status_id
    WHERE ja.tenant_id = p_tenant_id
  ),
  flagged AS (
    SELECT
      rows.*,
      (pipeline IN ('reviewing', 'shortlisted', 'interviewing')) AS in_process,
      (
        ai_match_status = 'ANALYZED'
        OR ai_match_score IS NOT NULL
        OR ai_analyzed_at IS NOT NULL
      ) AS analyzed
    FROM rows
  ),
  redirect_counts AS (
    SELECT
      job_requisition_id,
      coalesce(system_key, pipeline) AS tab,
      count(*) AS n
    FROM flagged
    WHERE in_process
    GROUP BY job_requisition_id, coalesce(system_key, pipeline)
  ),
  redirect AS (
    SELECT DISTINCT ON (job_requisition_id)
      job_requisition_id,
      tab
    FROM redirect_counts
    ORDER BY job_requisition_id, n DESC, tab ASC
  )
  SELECT
    f.job_requisition_id,
    count(*)::integer AS applicant_count,
    count(*) FILTER (WHERE f.pipeline = 'new')::integer AS new_count,
    count(*) FILTER (WHERE f.in_process)::integer AS in_process_count,
    count(*) FILTER (WHERE f.analyzed)::integer AS analyzed_count,
    count(*) FILTER (WHERE f.ai_match_score >= 90)::integer AS strong_count,
    count(*) FILTER (
      WHERE f.analyzed AND f.ai_match_readiness = 'READY_TO_SUBMIT'
    )::integer AS ready_count,
    count(*) FILTER (WHERE f.pipeline = 'hired')::integer AS hired_count,
    max(r.tab) AS in_process_redirect_tab
  FROM flagged f
  LEFT JOIN redirect r ON r.job_requisition_id = f.job_requisition_id
  GROUP BY f.job_requisition_id;
$$;

COMMENT ON FUNCTION public.job_list_application_metrics(uuid) IS
  'Per-job candidate counts for the jobs list. Replaces embedding every application.';

CREATE OR REPLACE FUNCTION public.staff_application_list_page(
  p_tenant_id uuid,
  p_job_id uuid DEFAULT NULL,
  p_worker_id uuid DEFAULT NULL,
  p_worker_ids uuid[] DEFAULT NULL,
  p_tab text DEFAULT NULL,
  p_status_id uuid DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_location_code text DEFAULT NULL,
  p_listing_job_id uuid DEFAULT NULL,
  p_stage text DEFAULT NULL,
  p_evaluation text DEFAULT NULL,
  p_workflow text DEFAULT NULL,
  p_match_min numeric DEFAULT NULL,
  p_match_max numeric DEFAULT NULL,
  p_match_max_inclusive boolean DEFAULT TRUE,
  p_match_no_score boolean DEFAULT FALSE,
  p_apply_match boolean DEFAULT FALSE,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_date_before timestamptz DEFAULT NULL,
  p_multi_job boolean DEFAULT FALSE,
  p_sort text DEFAULT 'evaluation',
  p_sort_dir text DEFAULT 'desc',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_ids_only boolean DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), CASE WHEN p_ids_only THEN 20000 ELSE 50 END);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_needle text := public.staff_search_norm(p_query);
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_phone_like boolean :=
    coalesce(p_query, '') <> ''
    AND position('@' IN p_query) = 0
    AND regexp_replace(p_query, '[[:space:]().+\-_/]', '', 'g') ~ '^[0-9]{3,}$';
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'evaluation');
  v_dir text := CASE WHEN lower(coalesce(p_sort_dir, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;
  v_req boolean := v_sort IN ('conf', 'verify', 'notMet', 'fit');
  v_sql text;
BEGIN
  v_sql := $sql$
    WITH worker_job_counts AS (
      SELECT ja.worker_id, count(*)::integer AS applied_jobs
      FROM public.job_applications ja
      WHERE ja.tenant_id = $1
        AND ja.worker_id IS NOT NULL
        AND lower(coalesce(ja.status, '')) NOT IN ('rejected', 'withdrawn')
      GROUP BY ja.worker_id
    ),
    req_counts AS (
      SELECT
        r.job_application_id,
        count(*) FILTER (WHERE bucket = 'confirmed')::integer AS confirmed,
        count(*) FILTER (WHERE bucket = 'verify')::integer AS verify,
        count(*) FILTER (WHERE bucket = 'not_met')::integer AS not_met,
        count(*) FILTER (WHERE upper(coalesce(r.requirement_type, '')) = 'MANDATORY')::integer AS mandatory,
        count(*) FILTER (WHERE bucket = 'blocking')::integer AS blocking
      FROM public.job_application_match_requirements r
      CROSS JOIN LATERAL (
        SELECT CASE
          WHEN upper(coalesce(r.requirement_outcome, '')) = 'NOT_APPLICABLE' THEN 'skip'
          WHEN r.recruiter_verified THEN 'confirmed'
          WHEN upper(coalesce(r.requirement_outcome, '')) = 'CONFLICT'
            OR upper(coalesce(r.status, '')) = 'CONFLICTING' THEN 'blocking'
          WHEN coalesce(r.verification_required, false)
            OR upper(coalesce(r.requirement_outcome, '')) = 'VERIFY' THEN 'verify'
          WHEN upper(coalesce(r.requirement_outcome, '')) = 'NOT_MET' THEN 'not_met'
          WHEN upper(coalesce(r.requirement_outcome, '')) = 'MET'
            OR upper(coalesce(r.status, '')) = 'CONFIRMED' THEN 'confirmed'
          ELSE 'verify'
        END AS bucket
      ) classified
      WHERE /*REQ*/
        AND r.tenant_id = $1
      GROUP BY r.job_application_id
    ),
    base AS (
      SELECT
        ja.id,
        ja.status,
        ja.status_id,
        ja.created_at,
        ja.submitted_at,
        ja.updated_at,
        ja.job_requisition_id,
        ja.worker_id,
        ja.ai_match_status,
        ja.ai_match_score,
        ja.ai_analyzed_at,
        st.system_key,
        st.name AS status_name,
        coalesce(wc.applied_jobs, 0) AS applied_jobs,
        coalesce(rc.confirmed, 0) AS confirmed,
        coalesce(rc.verify, 0) AS verify,
        coalesce(rc.not_met, 0) AS not_met,
        coalesce(rc.mandatory, 0) AS mandatory,
        coalesce(rc.blocking, 0) AS blocking,
        CASE
          WHEN ja.ai_match_status IS DISTINCT FROM 'ANALYZED' THEN NULL
          WHEN coalesce(rc.blocking, 0) > 0 OR coalesce(rc.not_met, 0) >= 2 THEN 1
          WHEN coalesce(rc.not_met, 0) = 0
            AND coalesce(rc.blocking, 0) = 0
            AND coalesce(rc.mandatory, 0) > 0
            AND coalesce(rc.confirmed, 0)::numeric / greatest(coalesce(rc.mandatory, 0), 1) >= 0.7 THEN 3
          WHEN ja.ai_match_stage IN ('deep', 'submission') THEN 3
          ELSE 2
        END AS fit_rank,
        CASE lower(btrim(coalesce(ja.status, '')))
          WHEN 'submitted' THEN 'new'
          WHEN 'in_progress' THEN 'reviewing'
          WHEN 'withdrawn' THEN 'undecided'
          WHEN 'new' THEN 'new'
          WHEN 'reviewing' THEN 'reviewing'
          WHEN 'interviewing' THEN 'interviewing'
          WHEN 'rejected' THEN 'rejected'
          WHEN 'hired' THEN 'hired'
          WHEN 'shortlisted' THEN 'shortlisted'
          WHEN 'undecided' THEN 'undecided'
          WHEN 'archived' THEN 'archived'
          ELSE 'reviewing'
        END AS pipeline,
        coalesce(
          nullif(btrim(concat_ws(' ', nullif(btrim(w.first_name), ''), nullif(btrim(w.last_name), ''))), ''),
          nullif(btrim(concat_ws(' ', nullif(btrim(ap.first_name), ''), nullif(btrim(ap.last_name), ''))), ''),
          nullif(btrim(coalesce(w.email, ap.email, '')), '')
        ) AS applicant_name,
        coalesce(nullif(btrim(w.email), ''), nullif(btrim(ap.email), ''), '') AS applicant_email,
        coalesce(nullif(btrim(w.phone), ''), nullif(btrim(ap.phone), ''), '') AS applicant_phone,
        public.staff_location_display(w.state, w.city, ap.city_state_zip) AS location_raw,
        coalesce(
          nullif(btrim(concat_ws(' ', nullif(btrim(assignee.first_name), ''), nullif(btrim(assignee.last_name), ''))), ''),
          nullif(btrim(assignee.email), ''),
          CASE WHEN ja.assigned_recruiter_user_id IS NOT NULL THEN 'Team member' ELSE '' END
        ) AS assignee_name,
        coalesce(nullif(btrim(fl.name), ''), ja.workflow_id::text, '') AS workflow_name,
        coalesce(
          nullif(btrim(jr.internal_requisition_number), ''),
          upper(substr(ja.job_requisition_id::text, 1, 8))
        ) AS job_code,
        btrim(coalesce(jr.external_requisition_id, '')) AS source_job_id,
        coalesce(
          nullif(btrim(jr.location), ''),
          nullif(btrim(jr.facility_name), ''),
          nullif(btrim(jr.facility), ''),
          ''
        ) AS job_location,
        coalesce(nullif(btrim(jr.public_title), ''), nullif(btrim(jr.source_job_title), ''), '') AS job_title,
        CASE
          WHEN nullif(btrim(st.name), '') IS NOT NULL THEN btrim(st.name)
          WHEN lower(btrim(coalesce(ja.status, ''))) IN ('new', 'submitted') THEN 'Reviewing'
          WHEN lower(btrim(coalesce(ja.status, ''))) IN ('reviewing', 'in_progress') THEN 'Reviewing'
          WHEN lower(btrim(coalesce(ja.status, ''))) = 'shortlisted' THEN 'Shortlisted'
          WHEN lower(btrim(coalesce(ja.status, ''))) = 'interviewing' THEN 'Interviewing'
          WHEN lower(btrim(coalesce(ja.status, ''))) = 'hired' THEN 'Selected by Client'
          WHEN lower(btrim(coalesce(ja.status, ''))) = 'undecided' THEN 'Undecided'
          WHEN lower(btrim(coalesce(ja.status, ''))) = 'rejected' THEN 'Rejected'
          WHEN lower(btrim(coalesce(ja.status, ''))) = 'archived' THEN 'Archived'
          ELSE 'Reviewing'
        END AS stage_label,
        lower(coalesce(st.system_key, '')) IN (
          'profile_ready', 'submitted', 'presented', 'approved_by_msp', 'at_msp', 'msp_submitted', 'msp_presented'
        )
        OR (
          lower(coalesce(st.system_key, '')) LIKE '%msp%'
          AND lower(coalesce(st.system_key, '')) <> 'msp'
        )
        OR lower(btrim(coalesce(st.name, ''))) IN (
          'profile ready', 'presented to client', 'submitted for msp review', 'approved by msp'
        )
        OR lower(btrim(coalesce(st.name, ''))) LIKE '%msp%' AS at_msp,
        lower(coalesce(st.system_key, '')) IN ('onboarding', 'onboarded', 'post_hire')
        OR lower(btrim(coalesce(st.name, ''))) LIKE '%onboard%' AS onboarding
      FROM public.job_applications ja
      LEFT JOIN public.worker w ON w.id = ja.worker_id
      LEFT JOIN public.applicant_profiles ap ON ap.id = ja.applicant_profile_id
      LEFT JOIN public.job_requisitions jr ON jr.id = ja.job_requisition_id
      LEFT JOIN public.application_statuses st ON st.id = ja.status_id
      LEFT JOIN public.onboarding_flows fl ON fl.id = ja.workflow_id
      LEFT JOIN public.users assignee
        ON assignee.id = ja.assigned_recruiter_user_id
       AND assignee.tenant_id = ja.tenant_id
      LEFT JOIN worker_job_counts wc ON wc.worker_id = ja.worker_id
      LEFT JOIN req_counts rc ON rc.job_application_id = ja.id
      WHERE ja.tenant_id = $1
        AND ($2::uuid IS NULL OR ja.job_requisition_id = $2)
        AND ($3::uuid IS NULL OR ja.worker_id = $3)
        AND ($4::uuid[] IS NULL OR ja.worker_id = ANY ($4))
        AND (
          NOT $5::boolean
          OR (
            $6::boolean AND ja.ai_match_score IS NULL
          )
          OR (
            NOT $6::boolean
            AND ($7::numeric IS NULL OR ja.ai_match_score >= $7)
            AND (
              $8::numeric IS NULL
              OR (
                CASE WHEN $9::boolean THEN ja.ai_match_score <= $8 ELSE ja.ai_match_score < $8 END
              )
            )
          )
        )
    ),
    matched AS (
      SELECT *
      FROM base b
      WHERE (
        $10::text IS NULL
        OR $10 = ''
        OR public.staff_search_norm(concat_ws(
          ' ',
          b.applicant_name,
          b.applicant_email,
          b.applicant_phone,
          b.job_code,
          b.source_job_id,
          b.job_location,
          b.location_raw,
          b.job_title,
          b.id::text,
          b.job_requisition_id::text
        )) LIKE '%' || public.staff_search_norm($10) || '%'
        OR (
          $11::boolean
          AND position($12 IN regexp_replace(b.applicant_phone, '\D', '', 'g')) > 0
        )
      )
      AND (
        $13::text IS NULL
        OR $13 = ''
        OR b.location_raw ILIKE '%' || $13 || '%'
        OR ($14::text IS NOT NULL AND upper(b.location_raw) = upper($14))
      )
      AND ($15::uuid IS NULL OR b.status_id = $15)
      AND ($16::uuid IS NULL OR b.job_requisition_id = $16)
      AND ($17::text IS NULL OR $17 = '' OR b.stage_label = $17)
      AND (
        $18::text IS NULL
        OR $18 = ''
        OR ($18 = 'analyzed' AND b.ai_match_status = 'ANALYZED')
        OR ($18 = 'not_yet' AND coalesce(b.ai_match_status, '') <> 'ANALYZED')
      )
      AND ($19::text IS NULL OR $19 = '' OR b.workflow_name = $19)
      AND ($20::timestamptz IS NULL OR coalesce(b.submitted_at, b.created_at) >= $20)
      AND ($21::timestamptz IS NULL OR coalesce(b.submitted_at, b.created_at) <= $21)
      AND ($22::timestamptz IS NULL OR coalesce(b.submitted_at, b.created_at) < $22)
      AND (
        $23::text IS NULL
        OR $23 = ''
        OR $23 = 'all'
        OR ($23 IN ('closed') AND NOT b.at_msp AND NOT b.onboarding AND b.pipeline IN ('rejected', 'undecided', 'archived'))
        OR ($23 IN ('in_process', 'in-process') AND NOT b.at_msp AND NOT b.onboarding AND b.pipeline IN ('reviewing', 'shortlisted', 'interviewing'))
        OR (
          $23::text !~* '^(all|closed|in_process|in-process)$'
          AND b.status_id::text = $23
          AND (
            lower(coalesce(b.system_key, '')) = 'archived'
            OR b.pipeline <> 'archived'
          )
        )
      )
    ),
    listed AS (
      SELECT * FROM matched m
      WHERE NOT $24::boolean OR m.applied_jobs > 1
    )
    SELECT jsonb_build_object(
      'ids', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', page.id, 'aiMatchStatus', page.ai_match_status) ORDER BY page.ord)
        FROM (
          SELECT
            listed.id,
            listed.ai_match_status,
            row_number() OVER (
              ORDER BY
                CASE WHEN $25 = 'evaluation' AND listed.ai_analyzed_at IS NULL THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'evaluation' AND $26 = 'desc' THEN listed.ai_analyzed_at END DESC,
                CASE WHEN $25 = 'evaluation' AND $26 = 'asc' THEN listed.ai_analyzed_at END ASC,
                CASE WHEN $25 = 'dateApplied' AND coalesce(listed.submitted_at, listed.created_at) IS NULL THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'dateApplied' AND $26 = 'desc' THEN coalesce(listed.submitted_at, listed.created_at) END DESC,
                CASE WHEN $25 = 'dateApplied' AND $26 = 'asc' THEN coalesce(listed.submitted_at, listed.created_at) END ASC,
                CASE WHEN $25 = 'matches' AND listed.ai_match_score IS NULL THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'matches' AND $26 = 'desc' THEN listed.ai_match_score END DESC,
                CASE WHEN $25 = 'matches' AND $26 = 'asc' THEN listed.ai_match_score END ASC,
                CASE WHEN $25 = 'candidates' AND $26 = 'desc' THEN listed.applicant_name END DESC,
                CASE WHEN $25 = 'candidates' AND $26 <> 'desc' THEN listed.applicant_name END ASC,
                CASE WHEN $25 = 'email' AND listed.applicant_email = '' THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'email' AND $26 = 'desc' THEN listed.applicant_email END DESC,
                CASE WHEN $25 = 'email' AND $26 = 'asc' THEN listed.applicant_email END ASC,
                CASE WHEN $25 = 'status' AND $26 = 'desc' THEN listed.status_name END DESC,
                CASE WHEN $25 = 'status' AND $26 = 'asc' THEN listed.status_name END ASC,
                CASE WHEN $25 = 'location' AND listed.location_raw = '' THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'location' AND $26 = 'desc' THEN listed.location_raw END DESC,
                CASE WHEN $25 = 'location' AND $26 = 'asc' THEN listed.location_raw END ASC,
                CASE WHEN $25 = 'workflow' AND listed.workflow_name = '' THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'workflow' AND $26 = 'desc' THEN listed.workflow_name END DESC,
                CASE WHEN $25 = 'workflow' AND $26 = 'asc' THEN listed.workflow_name END ASC,
                CASE WHEN $25 = 'activity' AND listed.updated_at IS NULL THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'activity' AND $26 = 'desc' THEN listed.updated_at END DESC,
                CASE WHEN $25 = 'activity' AND $26 = 'asc' THEN listed.updated_at END ASC,
                CASE WHEN $25 = 'conf' AND $26 = 'desc' THEN listed.confirmed END DESC,
                CASE WHEN $25 = 'conf' AND $26 = 'asc' THEN listed.confirmed END ASC,
                CASE WHEN $25 = 'verify' AND $26 = 'desc' THEN listed.verify END DESC,
                CASE WHEN $25 = 'verify' AND $26 = 'asc' THEN listed.verify END ASC,
                CASE WHEN $25 = 'notMet' AND $26 = 'desc' THEN listed.not_met END DESC,
                CASE WHEN $25 = 'notMet' AND $26 = 'asc' THEN listed.not_met END ASC,
                CASE WHEN $25 = 'currentStage' AND listed.stage_label = '' THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'currentStage' AND $26 = 'desc' THEN listed.stage_label END DESC,
                CASE WHEN $25 = 'currentStage' AND $26 = 'asc' THEN listed.stage_label END ASC,
                CASE WHEN $25 = 'contact' AND listed.applicant_email = '' THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'contact' AND $26 = 'desc' THEN listed.applicant_email END DESC,
                CASE WHEN $25 = 'contact' AND $26 = 'asc' THEN listed.applicant_email END ASC,
                CASE WHEN $25 = 'contact' AND $26 = 'desc' THEN listed.applicant_phone END DESC,
                CASE WHEN $25 = 'contact' AND $26 = 'asc' THEN listed.applicant_phone END ASC,
                CASE WHEN $25 = 'assignee' AND listed.assignee_name = '' THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'assignee' AND $26 = 'desc' THEN listed.assignee_name END DESC,
                CASE WHEN $25 = 'assignee' AND $26 = 'asc' THEN listed.assignee_name END ASC,
                CASE WHEN $25 = 'fit' AND listed.fit_rank IS NULL THEN 1 ELSE 0 END,
                CASE WHEN $25 = 'fit' AND $26 = 'desc' THEN listed.fit_rank END DESC,
                CASE WHEN $25 = 'fit' AND $26 = 'asc' THEN listed.fit_rank END ASC,
                listed.applicant_name ASC,
                listed.id ASC
            ) AS ord
          FROM listed
        ) page
        WHERE page.ord > $27 AND page.ord <= $27 + $28
      ), '[]'::jsonb),
      'total', (SELECT count(*) FROM listed),
      'unanalyzedCount', (SELECT count(*) FROM listed WHERE coalesce(ai_match_status, '') <> 'ANALYZED'),
      'scopeUnanalyzedCount', (
        SELECT count(*) FROM base WHERE coalesce(ai_match_status, '') <> 'ANALYZED'
      ),
      'multiJobApplicantCount', (
        SELECT count(DISTINCT coalesce(worker_id::text, id::text))
        FROM matched
        WHERE applied_jobs > 1
      ),
      'buckets', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'statusId', status_id,
          'systemKey', system_key,
          'status', status,
          'statusName', status_name,
          'pipeline', pipeline,
          'atMsp', at_msp,
          'onboarding', onboarding,
          'count', n
        ))
        FROM (
          SELECT status_id, system_key, status, status_name, pipeline, at_msp, onboarding, count(*) AS n
          FROM base
          GROUP BY status_id, system_key, status, status_name, pipeline, at_msp, onboarding
        ) g
      ), '[]'::jsonb),
      'stages', coalesce((
        SELECT jsonb_agg(stage_label ORDER BY stage_label)
        FROM (SELECT DISTINCT stage_label FROM base WHERE stage_label <> '' ORDER BY stage_label) stages
      ), '[]'::jsonb),
      'locations', coalesce((
        SELECT jsonb_agg(location_raw ORDER BY location_raw)
        FROM (SELECT DISTINCT location_raw FROM base WHERE location_raw <> '' ORDER BY location_raw LIMIT 200) locs
      ), '[]'::jsonb),
      'workflows', coalesce((
        SELECT jsonb_agg(workflow_name ORDER BY workflow_name)
        FROM (SELECT DISTINCT workflow_name FROM base WHERE workflow_name <> '' ORDER BY workflow_name LIMIT 100) flows
      ), '[]'::jsonb)
    )
  $sql$;
  -- Literal false skips the 1.4s full-tenant requirement group unless the
  -- list is sorted by Conf / Verify / Not Met.
  v_sql := replace(v_sql, '/*REQ*/', CASE WHEN v_req THEN 'true' ELSE 'false' END);
  EXECUTE v_sql
  INTO result
  USING
    p_tenant_id,          -- $1
    p_job_id,             -- $2
    p_worker_id,          -- $3
    p_worker_ids,         -- $4
    p_apply_match,        -- $5
    p_match_no_score,     -- $6
    p_match_min,          -- $7
    p_match_max,          -- $8
    p_match_max_inclusive,-- $9
    NULLIF(btrim(coalesce(p_query, '')), ''), -- $10
    v_phone_like,         -- $11
    v_digits,             -- $12
    NULLIF(btrim(coalesce(p_location, '')), ''), -- $13
    NULLIF(btrim(coalesce(p_location_code, '')), ''), -- $14
    p_status_id,          -- $15
    p_listing_job_id,     -- $16
    NULLIF(btrim(coalesce(p_stage, '')), ''), -- $17
    NULLIF(btrim(coalesce(p_evaluation, '')), ''), -- $18
    NULLIF(btrim(coalesce(p_workflow, '')), ''), -- $19
    p_date_from,          -- $20
    p_date_to,            -- $21
    p_date_before,        -- $22
    NULLIF(btrim(coalesce(p_tab, '')), ''), -- $23
    p_multi_job,          -- $24
    v_sort,               -- $25
    v_dir,                -- $26
    v_offset,             -- $27
    v_limit;              -- $28

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.staff_application_list_page(
  uuid, uuid, uuid, uuid[], text, uuid, text, text, text, uuid, text, text, text,
  numeric, numeric, boolean, boolean, boolean, timestamptz, timestamptz, timestamptz,
  boolean, text, text, integer, integer, boolean
) IS
  'Tenant-scoped applications page: ids, total, tab buckets, locations, and workflows.';

REVOKE ALL ON FUNCTION public.staff_search_norm(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_us_state_name(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_expand_state(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_location_display(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.job_application_requirement_counts(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.job_list_application_metrics(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_application_list_page(
  uuid, uuid, uuid, uuid[], text, uuid, text, text, text, uuid, text, text, text,
  numeric, numeric, boolean, boolean, boolean, timestamptz, timestamptz, timestamptz,
  boolean, text, text, integer, integer, boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.staff_search_norm(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_us_state_name(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_expand_state(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_location_display(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.job_application_requirement_counts(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.job_list_application_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_application_list_page(
  uuid, uuid, uuid, uuid[], text, uuid, text, text, text, uuid, text, text, text,
  numeric, numeric, boolean, boolean, boolean, timestamptz, timestamptz, timestamptz,
  boolean, text, text, integer, integer, boolean
) TO service_role;
