-- Atomic candidate → employment worker conversion.
-- Creates public.workers exactly once and marks public.worker as converted in one transaction.

CREATE OR REPLACE FUNCTION public.convert_candidate_to_employment_worker(
  p_tenant_id uuid,
  p_candidate_id uuid,
  p_worker_type text,
  p_source_job_application_id uuid DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    -- Repair candidate pipeline status if a prior partial conversion left it Approved.
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

    RETURN jsonb_build_object(
      'ok', true,
      'created', false,
      'workerRecordId', v_existing.id,
      'candidateId', p_candidate_id,
      'workerType', v_existing.worker_type,
      'sourceJobApplicationId', v_existing.source_job_application_id,
      'convertedAt', coalesce(v_existing.converted_at, v_converted_at)
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

  INSERT INTO public.workers (
    tenant_id,
    candidate_id,
    first_name,
    last_name,
    email,
    phone,
    job_role,
    location,
    status,
    worker_type,
    employment_classification,
    tax_withholding_required,
    payroll_enabled,
    contractor_payment_enabled,
    conversion_status,
    converted_at,
    source_job_application_id,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_candidate_id,
    nullif(trim(v_candidate.first_name), ''),
    nullif(trim(v_candidate.last_name), ''),
    nullif(trim(v_candidate.email), ''),
    nullif(trim(v_candidate.phone), ''),
    nullif(trim(v_candidate.job_role), ''),
    v_location,
    'active',
    v_type,
    v_classification,
    v_tax,
    v_payroll,
    v_contractor,
    'converted',
    v_converted_at,
    v_app_id,
    v_converted_at
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
    'actorUserId', p_actor_user_id
  );
END;
$$;

COMMENT ON FUNCTION public.convert_candidate_to_employment_worker(uuid, uuid, text, uuid, uuid) IS
  'Atomically create public.workers employment row and mark public.worker as converted. Idempotent per candidate_id.';

REVOKE ALL ON FUNCTION public.convert_candidate_to_employment_worker(uuid, uuid, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_candidate_to_employment_worker(uuid, uuid, text, uuid, uuid) TO service_role;
