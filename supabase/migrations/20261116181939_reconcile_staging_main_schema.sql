-- Reconcile staging with the verified main schema without copying production data.
-- Staging-only profile/preferences columns, analytics checks/index/triggers, and pg_net
-- are retained because they are used by newer staging code or strengthen validation.
-- Main was read-only throughout this reconciliation.
-- Retain staging's newer staff-list identity deduplication. Ignore whitespace-only
-- function/view differences, equivalent RNR preset constructors, and message encoding.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, extensions, pg_catalog;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public VERSION '3.3.7';

CREATE TABLE IF NOT EXISTS public."tenant_task_settings" (
  "tenant_id" uuid NOT NULL,
  "assign_only_manager_hr" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_task_settings_pkey" PRIMARY KEY (tenant_id),
  CONSTRAINT "tenant_task_settings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
ALTER TABLE public."tenant_task_settings" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public."zoho_webhook_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "event_id" text NOT NULL,
  "source" text DEFAULT 'zoho'::text NOT NULL,
  "method" text,
  "path" text,
  "query" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "payload" jsonb,
  "raw_body" text,
  "processed" boolean DEFAULT false NOT NULL,
  "processed_at" timestamp with time zone,
  "processing_error" text,
  CONSTRAINT "zoho_webhook_events_pkey" PRIMARY KEY (id)
);
ALTER TABLE public."zoho_webhook_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.worker_license_records ADD COLUMN IF NOT EXISTS certification_name text;
DO $reconcile$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.clients'::regclass AND attname = 'location'
      AND atttypid = 'text'::regtype AND NOT attisdropped
  ) THEN
    -- A failed cast aborts the transaction; no coordinate values are discarded.
    ALTER TABLE public.clients ALTER COLUMN location TYPE public.geography(Point,4326)
      USING location::public.geography(Point,4326);
  END IF;
END;
$reconcile$;
ALTER TABLE public.worker_license_records DROP CONSTRAINT IF EXISTS worker_license_records_type_chk;
ALTER TABLE public.worker_license_records ADD CONSTRAINT worker_license_records_type_chk
  CHECK (license_type = ANY (ARRAY['nursing_license'::text, 'drivers_license'::text, 'cpr_certification'::text, 'bls_certification'::text, 'acls_certification'::text, 'tb_test'::text, 'other'::text, 'other_certification'::text]));

DO $reconcile$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.applicant_workflow_step_events'::regclass AND conname='applicant_workflow_step_events_action_check')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.applicant_workflow_step_events'::regclass AND conname='applicant_workflow_step_events_action_chk') THEN
    ALTER TABLE public.applicant_workflow_step_events RENAME CONSTRAINT applicant_workflow_step_events_action_check TO applicant_workflow_step_events_action_chk;
  END IF;
END;
$reconcile$;

DO $reconcile$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.applicant_workflow_step_events'::regclass AND conname='applicant_workflow_step_events_to_status_check')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.applicant_workflow_step_events'::regclass AND conname='applicant_workflow_step_events_to_status_chk') THEN
    ALTER TABLE public.applicant_workflow_step_events RENAME CONSTRAINT applicant_workflow_step_events_to_status_check TO applicant_workflow_step_events_to_status_chk;
  END IF;
END;
$reconcile$;

CREATE UNIQUE INDEX IF NOT EXISTS departments_tenant_code_uidx ON public.departments USING btree (tenant_id, lower(btrim(code))) WHERE ((code IS NOT NULL) AND (char_length(btrim(code)) > 0));
CREATE INDEX IF NOT EXISTS tenant_task_settings_updated_idx ON public.tenant_task_settings USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS worker_resumes_tenant_worker_file_hash_idx ON public.worker_resumes USING btree (tenant_id, worker_id, file_hash) WHERE ((deleted_at IS NULL) AND (file_hash IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS zoho_webhook_events_event_id_uidx ON public.zoho_webhook_events USING btree (event_id);
CREATE INDEX IF NOT EXISTS zoho_webhook_events_received_at_idx ON public.zoho_webhook_events USING btree (received_at DESC);

-- Replace only the obsolete candidate-search overload (no CASCADE or row deletion).
DROP FUNCTION IF EXISTS public.list_candidate_ids_page(uuid, text, boolean, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text, integer, integer, numeric, numeric, boolean, uuid, text, text[]);

CREATE OR REPLACE FUNCTION public.build_employment_worker_application_snapshot(p_tenant_id uuid, p_application_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_snap jsonb;
BEGIN
  IF p_tenant_id IS NULL OR p_application_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'id', ja.id,
    'status', ja.status,
    'jobRequisitionId', ja.job_requisition_id,
    'submittedAt', ja.submitted_at,
    'hiredAt', ja.hired_at,
    'workflowPhase', ja.workflow_phase,
    'source', ja.source,
    'aiMatchScore', ja.ai_match_score
  )
  INTO v_snap
  FROM public.job_applications ja
  WHERE ja.tenant_id = p_tenant_id
    AND ja.id = p_application_id;

  RETURN coalesce(v_snap, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.build_employment_worker_documents_manifest(p_tenant_id uuid, p_candidate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_items jsonb := '[]'::jsonb;
  v_legacy public.worker_documents%ROWTYPE;
BEGIN
  IF p_tenant_id IS NULL OR p_candidate_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source', 'worker_resumes',
        'id', wr.id,
        'title', coalesce(nullif(wr.original_file_name, ''), nullif(wr.file_name, ''), 'Resume'),
        'path', coalesce(nullif(wr.storage_path, ''), nullif(wr.file_url, '')),
        'bucket', 'worker-resumes',
        'applicationId', wr.job_application_id,
        'uploadedAt', wr.uploaded_at
      )
      ORDER BY wr.uploaded_at DESC NULLS LAST
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.worker_resumes wr
  WHERE wr.tenant_id = p_tenant_id
    AND wr.worker_id = p_candidate_id
    AND wr.deleted_at IS NULL
    AND coalesce(nullif(wr.storage_path, ''), nullif(wr.file_url, '')) IS NOT NULL;

  SELECT coalesce(v_items, '[]'::jsonb) || coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'source', 'worker_submitted_documents',
          'id', wsd.id,
          'title', coalesce(nullif(wsd.original_file_name, ''), 'Submitted document'),
          'path', nullif(wsd.file_url, ''),
          'bucket', 'worker_required_files',
          'applicationId', wsd.application_id,
          'status', wsd.status,
          'uploadedAt', wsd.uploaded_at
        )
        ORDER BY wsd.uploaded_at DESC NULLS LAST
      )
      FROM public.worker_submitted_documents wsd
      WHERE wsd.tenant_id = p_tenant_id
        AND wsd.worker_id = p_candidate_id
        AND nullif(wsd.file_url, '') IS NOT NULL
    ),
    '[]'::jsonb
  )
  INTO v_items;

  FOR v_legacy IN
    SELECT *
    FROM public.worker_documents wd
    WHERE wd.tenant_id = p_tenant_id
      AND wd.worker_id = p_candidate_id
  LOOP
    IF nullif(trim(v_legacy.document_url), '') IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'source', 'worker_documents', 'id', v_legacy.id, 'title', 'document_url',
        'path', trim(v_legacy.document_url), 'bucket', 'worker_required_files',
        'applicationId', v_legacy.application_id, 'field', 'document_url'
      ));
    END IF;
    IF nullif(trim(v_legacy.ssn_url), '') IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'source', 'worker_documents', 'id', v_legacy.id, 'title', 'ssn_url',
        'path', trim(v_legacy.ssn_url), 'bucket', 'worker_required_files',
        'applicationId', v_legacy.application_id, 'field', 'ssn_url'
      ));
    END IF;
    IF nullif(trim(v_legacy.ssn_back_url), '') IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'source', 'worker_documents', 'id', v_legacy.id, 'title', 'ssn_back_url',
        'path', trim(v_legacy.ssn_back_url), 'bucket', 'worker_required_files',
        'applicationId', v_legacy.application_id, 'field', 'ssn_back_url'
      ));
    END IF;
    IF nullif(trim(v_legacy.drivers_license_url), '') IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'source', 'worker_documents', 'id', v_legacy.id, 'title', 'drivers_license_url',
        'path', trim(v_legacy.drivers_license_url), 'bucket', 'worker_required_files',
        'applicationId', v_legacy.application_id, 'field', 'drivers_license_url'
      ));
    END IF;
    IF nullif(trim(v_legacy.drivers_license_back_url), '') IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'source', 'worker_documents', 'id', v_legacy.id, 'title', 'drivers_license_back_url',
        'path', trim(v_legacy.drivers_license_back_url), 'bucket', 'worker_required_files',
        'applicationId', v_legacy.application_id, 'field', 'drivers_license_back_url'
      ));
    END IF;
    IF nullif(trim(v_legacy.cpr_certification_url), '') IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'source', 'worker_documents', 'id', v_legacy.id, 'title', 'cpr_certification_url',
        'path', trim(v_legacy.cpr_certification_url), 'bucket', 'worker_required_files',
        'applicationId', v_legacy.application_id, 'field', 'cpr_certification_url'
      ));
    END IF;
    IF nullif(trim(v_legacy.nursing_license_url), '') IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'source', 'worker_documents', 'id', v_legacy.id, 'title', 'nursing_license_url',
        'path', trim(v_legacy.nursing_license_url), 'bucket', 'worker_required_files',
        'applicationId', v_legacy.application_id, 'field', 'nursing_license_url'
      ));
    END IF;
    IF nullif(trim(v_legacy.tb_test_url), '') IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'source', 'worker_documents', 'id', v_legacy.id, 'title', 'tb_test_url',
        'path', trim(v_legacy.tb_test_url), 'bucket', 'worker_required_files',
        'applicationId', v_legacy.application_id, 'field', 'tb_test_url'
      ));
    END IF;
    IF nullif(trim(v_legacy.agreement_w2_url), '') IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'source', 'worker_documents', 'id', v_legacy.id, 'title', 'agreement_w2_url',
        'path', trim(v_legacy.agreement_w2_url), 'bucket', 'worker_required_files',
        'applicationId', v_legacy.application_id, 'field', 'agreement_w2_url'
      ));
    END IF;
    IF nullif(trim(v_legacy.agreement_i9_url), '') IS NOT NULL THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'source', 'worker_documents', 'id', v_legacy.id, 'title', 'agreement_i9_url',
        'path', trim(v_legacy.agreement_i9_url), 'bucket', 'worker_required_files',
        'applicationId', v_legacy.application_id, 'field', 'agreement_i9_url'
      ));
    END IF;
  END LOOP;

  RETURN coalesce(v_items, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.convert_candidate_to_employment_worker(p_tenant_id uuid, p_candidate_id uuid, p_worker_type text, p_source_job_application_id uuid DEFAULT NULL::uuid, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_type text;
  v_candidate public.worker%ROWTYPE;
  v_existing public.workers%ROWTYPE;
  v_worker_id uuid;
  v_created boolean := false;
  v_converted_at timestamptz := now();
  v_classification text;
  v_tax boolean;
  v_payroll boolean;
  v_contractor boolean;
  v_location text;
  v_app_id uuid;
  v_app_snapshot jsonb := '{}'::jsonb;
  v_docs_manifest jsonb := '[]'::jsonb;
BEGIN
  IF p_tenant_id IS NULL OR p_candidate_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id and candidate_id are required';
  END IF;

  v_type := lower(trim(coalesce(p_worker_type, '')));
  IF v_type IN ('w-2') THEN
    v_type := 'w2';
  END IF;
  IF v_type NOT IN ('w2', '1099') THEN
    RAISE EXCEPTION 'Invalid worker_type. Expected w2 or 1099.';
  END IF;

  SELECT * INTO v_candidate
  FROM public.worker w
  WHERE w.id = p_candidate_id
    AND w.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Candidate not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.workers emp
  WHERE emp.candidate_id = p_candidate_id
  FOR UPDATE;

  IF FOUND THEN
    v_app_id := coalesce(v_existing.source_job_application_id, p_source_job_application_id);
    IF v_app_id IS NULL THEN
      SELECT ja.id INTO v_app_id
      FROM public.job_applications ja
      WHERE ja.tenant_id = p_tenant_id
        AND ja.worker_id = p_candidate_id
      ORDER BY coalesce(ja.submitted_at, ja.created_at) DESC NULLS LAST
      LIMIT 1;
    END IF;

    v_app_snapshot := public.build_employment_worker_application_snapshot(p_tenant_id, v_app_id);
    v_docs_manifest := public.build_employment_worker_documents_manifest(p_tenant_id, p_candidate_id);

    UPDATE public.worker w
    SET
      status = 'converted',
      converted_worker_type = coalesce(nullif(w.converted_worker_type, ''), v_existing.worker_type),
      converted_at = coalesce(w.converted_at, v_existing.converted_at, v_converted_at),
      updated_at = v_converted_at
    WHERE w.id = p_candidate_id
      AND w.tenant_id = p_tenant_id
      AND (
        lower(coalesce(w.status, '')) <> 'converted'
        OR w.converted_worker_type IS NULL
        OR w.converted_at IS NULL
      );

    UPDATE public.workers emp
    SET
      profile_photo = coalesce(nullif(trim(v_candidate.profile_photo), ''), emp.profile_photo),
      job_role = coalesce(nullif(trim(v_candidate.job_role), ''), emp.job_role),
      location = coalesce(
        nullif(
          trim(both ', ' FROM concat_ws(', ', nullif(trim(v_candidate.city), ''), nullif(trim(v_candidate.state), ''))),
          ''
        ),
        emp.location
      ),
      source_job_application_id = coalesce(emp.source_job_application_id, v_app_id),
      application_snapshot = CASE
        WHEN v_app_snapshot <> '{}'::jsonb THEN v_app_snapshot
        ELSE emp.application_snapshot
      END,
      documents_manifest = CASE
        WHEN jsonb_array_length(v_docs_manifest) > 0 THEN v_docs_manifest
        ELSE emp.documents_manifest
      END,
      updated_at = v_converted_at
    WHERE emp.id = v_existing.id;

    RETURN jsonb_build_object(
      'ok', true,
      'created', false,
      'workerRecordId', v_existing.id,
      'candidateId', p_candidate_id,
      'workerType', v_existing.worker_type,
      'sourceJobApplicationId', coalesce(v_existing.source_job_application_id, v_app_id),
      'convertedAt', coalesce(v_existing.converted_at, v_converted_at),
      'documentsCount', jsonb_array_length(
        coalesce(
          (SELECT documents_manifest FROM public.workers WHERE id = v_existing.id),
          '[]'::jsonb
        )
      )
    );
  END IF;

  IF lower(coalesce(v_candidate.status, '')) = 'converted' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'This candidate has already been converted.',
      'code', 'ALREADY_CONVERTED'
    );
  END IF;

  IF lower(coalesce(v_candidate.status, '')) NOT IN ('approved', 'for_approval') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Only for-approval or approved candidates can be converted to workers.',
      'code', 'INELIGIBLE_STATUS',
      'status', v_candidate.status
    );
  END IF;

  IF v_type = 'w2' THEN
    v_classification := 'employee';
    v_tax := true;
    v_payroll := true;
    v_contractor := false;
  ELSE
    v_classification := 'contractor';
    v_tax := false;
    v_payroll := false;
    v_contractor := true;
  END IF;

  v_location := nullif(
    trim(both ', ' FROM concat_ws(', ', nullif(trim(v_candidate.city), ''), nullif(trim(v_candidate.state), ''))),
    ''
  );

  v_app_id := p_source_job_application_id;
  IF v_app_id IS NULL THEN
    SELECT ja.id INTO v_app_id
    FROM public.job_applications ja
    WHERE ja.tenant_id = p_tenant_id
      AND ja.worker_id = p_candidate_id
    ORDER BY coalesce(ja.submitted_at, ja.created_at) DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_app_snapshot := public.build_employment_worker_application_snapshot(p_tenant_id, v_app_id);
  v_docs_manifest := public.build_employment_worker_documents_manifest(p_tenant_id, p_candidate_id);

  INSERT INTO public.workers (
    tenant_id, candidate_id, first_name, last_name, email, phone, job_role, location, status,
    worker_type, employment_classification, tax_withholding_required, payroll_enabled,
    contractor_payment_enabled, conversion_status, converted_at, source_job_application_id,
    profile_photo, application_snapshot, documents_manifest, updated_at
  )
  VALUES (
    p_tenant_id, p_candidate_id,
    nullif(trim(v_candidate.first_name), ''), nullif(trim(v_candidate.last_name), ''),
    nullif(trim(v_candidate.email), ''), nullif(trim(v_candidate.phone), ''),
    nullif(trim(v_candidate.job_role), ''), v_location, 'active', v_type, v_classification,
    v_tax, v_payroll, v_contractor, 'converted', v_converted_at, v_app_id,
    nullif(trim(v_candidate.profile_photo), ''), v_app_snapshot, v_docs_manifest, v_converted_at
  )
  RETURNING id INTO v_worker_id;

  v_created := true;

  UPDATE public.worker w
  SET
    status = 'converted',
    converted_worker_type = v_type,
    converted_at = v_converted_at,
    updated_at = v_converted_at
  WHERE w.id = p_candidate_id
    AND w.tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'created', v_created,
    'workerRecordId', v_worker_id,
    'candidateId', p_candidate_id,
    'workerType', v_type,
    'sourceJobApplicationId', v_app_id,
    'convertedAt', v_converted_at,
    'actorUserId', p_actor_user_id,
    'documentsCount', jsonb_array_length(v_docs_manifest)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_candidate_ids_page(p_tenant_id uuid, p_pipeline_status text DEFAULT NULL::text, p_exclude_converted boolean DEFAULT true, p_search text DEFAULT NULL::text, p_job_role text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_created_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_created_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sort text DEFAULT 'created_at'::text, p_sort_dir text DEFAULT 'desc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_match_score_min numeric DEFAULT NULL::numeric, p_match_score_max numeric DEFAULT NULL::numeric, p_match_score_max_inclusive boolean DEFAULT true, p_progress_status_id uuid DEFAULT NULL::uuid, p_job_title text DEFAULT NULL::text, p_skills text[] DEFAULT NULL::text[], p_assignee text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, total_count bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.match_resume_worker_ids(p_tenant_id uuid, p_pattern text, p_limit integer DEFAULT 250)
 RETURNS TABLE(worker_id uuid)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  lim integer;
BEGIN
  IF p_tenant_id IS NULL OR p_pattern IS NULL OR btrim(p_pattern) = '' THEN
    RETURN;
  END IF;

  lim := least(greatest(coalesce(p_limit, 250), 1), 500);

  RETURN QUERY EXECUTE format(
    $sql$
    SELECT wr.worker_id
    FROM public.worker_resumes wr
    WHERE wr.tenant_id = %L::uuid
      AND wr.deleted_at IS NULL
      AND wr.worker_id IS NOT NULL
      AND coalesce(wr.extracted_text, '') ILIKE %L
    LIMIT %s
    $sql$,
    p_tenant_id,
    p_pattern,
    lim
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_can_view_resource(p_tenant_id uuid, p_resource_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.tenant_id = p_tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.is_active = true
      AND (
        u.god_admin = true OR (
          (ur.is_active = true OR (ur.user_id IS NULL AND u.tenant_id = p_tenant_id))
          AND EXISTS (
            SELECT 1 FROM public.tenant_role_permissions rp
            JOIN public.tenant_roles tr ON tr.tenant_id = rp.tenant_id AND tr.role_key = rp.role_key
            WHERE rp.tenant_id = p_tenant_id AND rp.resource_key = p_resource_key AND rp.can_view = true
              AND (
                rp.role_key = COALESCE(ur.role, u.role)
                OR EXISTS (
                  SELECT 1 FROM public.staff_roles sr WHERE sr.is_active = true AND sr.is_staff = true
                    AND sr.key = rp.role_key
                    AND (sr.storage_key = COALESCE(ur.role,u.role) OR COALESCE(ur.role,u.role) = ANY(sr.aliases))
                )
              )
          )
        )
      )
  );
$function$;

-- Reconcile only grants that actually differ. Newly added helper functions are private.
REVOKE ALL ON FUNCTION public."list_candidate_ids_page"(uuid, text, boolean, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text, integer, integer, numeric, numeric, boolean, uuid, text, text[], text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public."list_candidate_ids_page"(uuid, text, boolean, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text, integer, integer, numeric, numeric, boolean, uuid, text, text[], text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public."list_candidate_ids_page"(uuid, text, boolean, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text, integer, integer, numeric, numeric, boolean, uuid, text, text[], text) TO "anon";
GRANT EXECUTE ON FUNCTION public."list_candidate_ids_page"(uuid, text, boolean, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text, integer, integer, numeric, numeric, boolean, uuid, text, text[], text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public."list_candidate_ids_page"(uuid, text, boolean, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text, integer, integer, numeric, numeric, boolean, uuid, text, text[], text) TO "service_role";
REVOKE ALL ON FUNCTION public."build_employment_worker_documents_manifest"(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public."build_employment_worker_documents_manifest"(uuid, uuid) TO "service_role";
REVOKE ALL ON FUNCTION public."build_employment_worker_application_snapshot"(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public."build_employment_worker_application_snapshot"(uuid, uuid) TO "service_role";
REVOKE ALL ON FUNCTION public."staff_can_view_resource"(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public."staff_can_view_resource"(uuid, text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public."staff_can_view_resource"(uuid, text) TO "service_role";
REVOKE EXECUTE ON FUNCTION public."activate_post_hire"(uuid, uuid, uuid) FROM "anon";
REVOKE EXECUTE ON FUNCTION public."activate_post_hire"(uuid, uuid, uuid) FROM "authenticated";
REVOKE EXECUTE ON FUNCTION public."worker_belongs_to_auth"(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."is_god_admin_user"() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."convert_candidate_to_employment_worker"(uuid, uuid, text, uuid, uuid) FROM "anon";
REVOKE EXECUTE ON FUNCTION public."convert_candidate_to_employment_worker"(uuid, uuid, text, uuid, uuid) FROM "authenticated";
REVOKE EXECUTE ON FUNCTION public."approved_applicant_owns_worker"(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."worker_owns_record"(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."applicant_assigned_to_group"(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."consume_auth_login_otp"(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."consume_auth_login_otp"(text, text, text) FROM "anon";
REVOKE EXECUTE ON FUNCTION public."consume_auth_login_otp"(text, text, text) FROM "authenticated";
REVOKE EXECUTE ON FUNCTION public."issue_auth_login_otp"(text, text, text, uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."issue_auth_login_otp"(text, text, text, uuid, timestamp with time zone, timestamp with time zone) FROM "anon";
REVOKE EXECUTE ON FUNCTION public."issue_auth_login_otp"(text, text, text, uuid, timestamp with time zone, timestamp with time zone) FROM "authenticated";
REVOKE EXECUTE ON FUNCTION public."seed_tenant_onboarding_libraries"(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public."seed_tenant_onboarding_libraries"(uuid) FROM "anon";
REVOKE EXECUTE ON FUNCTION public."seed_tenant_onboarding_libraries"(uuid) FROM "authenticated";
REVOKE EXECUTE ON FUNCTION public."seed_profession_upload_documents"(uuid) FROM "anon";
REVOKE EXECUTE ON FUNCTION public."seed_profession_upload_documents"(uuid) FROM "authenticated";
GRANT EXECUTE ON FUNCTION public."ensure_default_application_statuses"(uuid) TO "authenticated";
REVOKE EXECUTE ON FUNCTION public."bulk_delete_workers"(uuid, uuid[]) FROM "anon";
REVOKE EXECUTE ON FUNCTION public."bulk_delete_workers"(uuid, uuid[]) FROM "authenticated";
REVOKE EXECUTE ON FUNCTION public."claim_job_applications"(uuid, uuid[], uuid) FROM "anon";
REVOKE EXECUTE ON FUNCTION public."claim_job_applications"(uuid, uuid[], uuid) FROM "authenticated";
REVOKE EXECUTE ON FUNCTION public."claim_worker_candidates"(uuid, uuid[], uuid) FROM "anon";
REVOKE EXECUTE ON FUNCTION public."claim_worker_candidates"(uuid, uuid[], uuid) FROM "authenticated";
REVOKE EXECUTE ON FUNCTION public."seed_tenant_profession_catalog"(uuid) FROM "anon";
REVOKE EXECUTE ON FUNCTION public."seed_tenant_profession_catalog"(uuid) FROM "authenticated";

DO $reconcile$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_requisitions' AND policyname='job_requisitions_verified_reader') THEN
    CREATE POLICY "job_requisitions_verified_reader" ON "public"."job_requisitions" AS RESTRICTIVE FOR SELECT TO "authenticated" USING (staff_can_view_resource(tenant_id, 'jobs'::text));
  END IF;
END;
$reconcile$;
DO $reconcile$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tenant_task_settings' AND policyname='tenant_task_settings_staff') THEN
    CREATE POLICY "tenant_task_settings_staff" ON "public"."tenant_task_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_is_tenant_staff(tenant_id)) WITH CHECK (user_is_tenant_staff(tenant_id));
  END IF;
END;
$reconcile$;
DO $reconcile$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='worker' AND policyname='worker_verified_reader') THEN
    CREATE POLICY "worker_verified_reader" ON "public"."worker" AS RESTRICTIVE FOR SELECT TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR staff_can_view_resource(tenant_id, 'hiring'::text)));
  END IF;
END;
$reconcile$;
ALTER POLICY "worker_required_files_staff_insert" ON "storage"."objects" TO "authenticated" WITH CHECK (((bucket_id = 'worker_required_files'::text) AND (user_is_tenant_staff(((storage.foldername(name))[1])::uuid) OR ((storage.foldername(name))[1] = (auth.uid())::text))));
ALTER POLICY "worker_required_files_staff_select" ON "storage"."objects" TO "authenticated" USING (((bucket_id = 'worker_required_files'::text) AND (user_is_tenant_staff(((storage.foldername(name))[1])::uuid) OR ((storage.foldername(name))[1] = (auth.uid())::text))));
ALTER POLICY "worker_required_files_staff_update" ON "storage"."objects" TO "authenticated" USING (((bucket_id = 'worker_required_files'::text) AND (user_is_tenant_staff(((storage.foldername(name))[1])::uuid) OR ((storage.foldername(name))[1] = (auth.uid())::text)))) WITH CHECK (((bucket_id = 'worker_required_files'::text) AND (user_is_tenant_staff(((storage.foldername(name))[1])::uuid) OR ((storage.foldername(name))[1] = (auth.uid())::text))));

CREATE OR REPLACE TRIGGER set_tenant_task_settings_updated_at BEFORE UPDATE ON tenant_task_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.default_workflow_migration_report ENABLE ROW LEVEL SECURITY;
REVOKE DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."default_workflow_migration_report" FROM "anon";
REVOKE DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."default_workflow_migration_report" FROM "authenticated";
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public."worker" FROM "anon";
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public."worker" FROM "authenticated";
REVOKE DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."job_requisitions" FROM "anon";
REVOKE DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public."job_requisitions" FROM "authenticated";

REVOKE ALL ON TABLE public.tenant_task_settings FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.tenant_task_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_task_settings TO authenticated;
GRANT ALL ON TABLE public.tenant_task_settings TO service_role;

-- The webhook audit store retains RLS with no client policies, matching main.
-- It contains service-level event IDs, not tenant workflow rows.
-- PostGIS installs its own reference objects; no extension definitions are copied here.

-- Default only missing task settings, keyed by the tenant.
INSERT INTO public.tenant_task_settings (tenant_id, assign_only_manager_hr)
SELECT t.id, true FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_task_settings s WHERE s.tenant_id=t.id);
NOTIFY pgrst, 'reload schema';
COMMIT;

