-- Atomic bulk claim for worker candidates and job applications.
-- Claims only unclaimed rows within the caller's tenant; never overwrites an existing owner.

CREATE OR REPLACE FUNCTION public.claim_worker_candidates(
  p_tenant_id uuid,
  p_candidate_ids uuid[],
  p_recruiter_user_id uuid
)
RETURNS TABLE (
  candidate_id uuid,
  outcome text,
  previous_owner uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_owner uuid;
  v_status text;
  v_found boolean;
BEGIN
  IF p_tenant_id IS NULL OR p_recruiter_user_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id and recruiter_user_id are required';
  END IF;

  FOREACH v_id IN ARRAY COALESCE(p_candidate_ids, ARRAY[]::uuid[])
  LOOP
    SELECT w.assigned_recruiter_user_id, lower(coalesce(w.status, ''))
      INTO v_owner, v_status
    FROM public.worker w
    WHERE w.id = v_id
      AND w.tenant_id = p_tenant_id
    FOR UPDATE;

    v_found := FOUND;

    IF NOT v_found THEN
      candidate_id := v_id;
      outcome := 'not_found';
      previous_owner := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_status IN ('inactive', 'cancelled', 'banned', 'suspended', 'archived') THEN
      candidate_id := v_id;
      outcome := 'ineligible';
      previous_owner := v_owner;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_owner IS NOT NULL AND v_owner = p_recruiter_user_id THEN
      candidate_id := v_id;
      outcome := 'already_claimed';
      previous_owner := v_owner;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_owner IS NOT NULL AND v_owner <> p_recruiter_user_id THEN
      candidate_id := v_id;
      outcome := 'already_claimed';
      previous_owner := v_owner;
      RETURN NEXT;
      CONTINUE;
    END IF;

    UPDATE public.worker w
    SET
      assigned_recruiter_user_id = p_recruiter_user_id,
      updated_at = now()
    WHERE w.id = v_id
      AND w.tenant_id = p_tenant_id
      AND w.assigned_recruiter_user_id IS NULL;

    IF FOUND THEN
      candidate_id := v_id;
      outcome := 'claimed';
      previous_owner := NULL;
      RETURN NEXT;
    ELSE
      -- Concurrent claim won the race.
      SELECT w.assigned_recruiter_user_id INTO v_owner
      FROM public.worker w
      WHERE w.id = v_id AND w.tenant_id = p_tenant_id;
      candidate_id := v_id;
      outcome := 'already_claimed';
      previous_owner := v_owner;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.claim_worker_candidates(uuid, uuid[], uuid) IS
  'Tenant-scoped bulk claim of worker.assigned_recruiter_user_id. Never overwrites an existing owner.';

CREATE OR REPLACE FUNCTION public.claim_job_applications(
  p_tenant_id uuid,
  p_application_ids uuid[],
  p_recruiter_user_id uuid
)
RETURNS TABLE (
  application_id uuid,
  outcome text,
  previous_owner uuid,
  worker_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_owner uuid;
  v_status text;
  v_worker uuid;
  v_found boolean;
BEGIN
  IF p_tenant_id IS NULL OR p_recruiter_user_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id and recruiter_user_id are required';
  END IF;

  FOREACH v_id IN ARRAY COALESCE(p_application_ids, ARRAY[]::uuid[])
  LOOP
    SELECT
      ja.assigned_recruiter_user_id,
      lower(coalesce(ja.status, '')),
      ja.worker_id
      INTO v_owner, v_status, v_worker
    FROM public.job_applications ja
    WHERE ja.id = v_id
      AND ja.tenant_id = p_tenant_id
    FOR UPDATE;

    v_found := FOUND;

    IF NOT v_found THEN
      application_id := v_id;
      outcome := 'not_found';
      previous_owner := NULL;
      worker_id := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_status IN ('archived', 'withdrawn', 'rejected') THEN
      application_id := v_id;
      outcome := 'ineligible';
      previous_owner := v_owner;
      worker_id := v_worker;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_owner IS NOT NULL THEN
      application_id := v_id;
      outcome := 'already_claimed';
      previous_owner := v_owner;
      worker_id := v_worker;
      RETURN NEXT;
      CONTINUE;
    END IF;

    UPDATE public.job_applications ja
    SET
      assigned_recruiter_user_id = p_recruiter_user_id,
      updated_at = now()
    WHERE ja.id = v_id
      AND ja.tenant_id = p_tenant_id
      AND ja.assigned_recruiter_user_id IS NULL;

    IF FOUND THEN
      -- Keep worker ownership in sync when previously unclaimed.
      IF v_worker IS NOT NULL THEN
        UPDATE public.worker w
        SET
          assigned_recruiter_user_id = p_recruiter_user_id,
          updated_at = now()
        WHERE w.id = v_worker
          AND w.tenant_id = p_tenant_id
          AND w.assigned_recruiter_user_id IS NULL;
      END IF;

      application_id := v_id;
      outcome := 'claimed';
      previous_owner := NULL;
      worker_id := v_worker;
      RETURN NEXT;
    ELSE
      SELECT ja.assigned_recruiter_user_id, ja.worker_id
        INTO v_owner, v_worker
      FROM public.job_applications ja
      WHERE ja.id = v_id AND ja.tenant_id = p_tenant_id;
      application_id := v_id;
      outcome := 'already_claimed';
      previous_owner := v_owner;
      worker_id := v_worker;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.claim_job_applications(uuid, uuid[], uuid) IS
  'Tenant-scoped bulk claim of job_applications.assigned_recruiter_user_id. Never overwrites an existing owner.';

REVOKE ALL ON FUNCTION public.claim_worker_candidates(uuid, uuid[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_job_applications(uuid, uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_worker_candidates(uuid, uuid[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_job_applications(uuid, uuid[], uuid) TO service_role;

-- Allow authenticated staff to insert recruiter activity audit rows for their tenant.
DROP POLICY IF EXISTS recruiter_activity_logs_staff_insert ON public.recruiter_activity_logs;
CREATE POLICY recruiter_activity_logs_staff_insert
  ON public.recruiter_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND (
      recruiter_user_id IS NULL
      OR recruiter_user_id = auth.uid()
    )
  );
