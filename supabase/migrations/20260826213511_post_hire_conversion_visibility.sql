-- Post-Hire applicant access requires an authoritative worker conversion.
-- Hired application status or a mapped Post-Hire workflow is not enough.

CREATE OR REPLACE FUNCTION public.worker_is_authoritatively_converted(
  p_worker_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.worker w
    WHERE w.id = p_worker_id
      AND w.tenant_id = p_tenant_id
      AND (
        lower(COALESCE(w.status, '')) = 'converted'
        OR (
          lower(COALESCE(w.conversion_status, '')) = 'completed'
          AND (w.converted_at IS NOT NULL OR w.converted_worker_id IS NOT NULL)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.applicant_may_read_onboarding_step(
  p_worker_id uuid,
  p_tenant_id uuid,
  p_application_id uuid,
  p_step_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_step_phase text;
BEGIN
  v_step_phase := COALESCE(public.step_lifecycle_phase(p_step_id), 'pre_hire');

  IF v_step_phase = 'pre_hire' THEN
    RETURN true;
  END IF;

  RETURN public.worker_is_authoritatively_converted(p_worker_id, p_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.applicant_may_write_onboarding_step(
  p_worker_id uuid,
  p_tenant_id uuid,
  p_application_id uuid,
  p_step_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_phase text;
  v_step_phase text;
  v_hired boolean := false;
  v_status text;
  v_suspended timestamptz;
BEGIN
  v_step_phase := COALESCE(public.step_lifecycle_phase(p_step_id), 'pre_hire');

  IF p_application_id IS NULL THEN
    v_phase := 'pre_hire';
  ELSE
    SELECT ja.workflow_phase, ja.status, ja.post_hire_suspended_at
      INTO v_phase, v_status, v_suspended
    FROM public.job_applications ja
    WHERE ja.id = p_application_id
      AND ja.tenant_id = p_tenant_id;

    v_phase := COALESCE(v_phase, 'pre_hire');
    v_hired := lower(COALESCE(v_status, '')) = 'hired' AND v_suspended IS NULL;
  END IF;

  IF v_phase = 'completed' THEN
    RETURN false;
  END IF;

  IF v_step_phase = 'post_hire' THEN
    RETURN public.worker_is_authoritatively_converted(p_worker_id, p_tenant_id)
      AND v_hired
      AND v_phase = 'post_hire';
  END IF;

  RETURN v_phase = 'pre_hire';
END;
$$;

REVOKE ALL ON FUNCTION public.worker_is_authoritatively_converted(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_is_authoritatively_converted(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.worker_is_authoritatively_converted(uuid, uuid) TO service_role;
