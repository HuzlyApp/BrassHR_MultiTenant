-- Pre-Hire / Post-Hire separation: explicit step phases, hired timestamps,
-- Post-Hire suspend-on-revert, and hired-gated applicant writes.
--
-- Rollback:
--   1. Restore applicant_may_* and activate_post_hire / change_job_application_status
--      from 20260814010000_job_application_workflow_phase.sql and
--      20260810222237_application_statuses_and_history.sql.
--   2. DROP CONSTRAINTS added here; DROP COLUMN hired_at, hired_by,
--      post_hire_suspended_at, assignment_state, applicant_workflow_step_records.phase.
--   Do not delete candidate progress or documents.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS hired_at timestamptz,
  ADD COLUMN IF NOT EXISTS hired_by uuid,
  ADD COLUMN IF NOT EXISTS post_hire_suspended_at timestamptz;

COMMENT ON COLUMN public.job_applications.hired_at IS
  'Authoritative timestamp when this application was marked Hired. Preserved if hire is later reverted.';
COMMENT ON COLUMN public.job_applications.hired_by IS
  'Staff user who marked the application Hired.';
COMMENT ON COLUMN public.job_applications.post_hire_suspended_at IS
  'Set when a Hired application is reverted. Post-Hire progress and documents are preserved but locked.';

ALTER TABLE public.applicant_workflow_instances
  ADD COLUMN IF NOT EXISTS assignment_state text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applicant_workflow_instances_assignment_state_chk'
  ) THEN
    ALTER TABLE public.applicant_workflow_instances
      ADD CONSTRAINT applicant_workflow_instances_assignment_state_chk
      CHECK (assignment_state IN ('active', 'completed', 'replaced', 'archived'));
  END IF;
END $$;

UPDATE public.applicant_workflow_instances
SET assignment_state = CASE
  WHEN status = 'completed' THEN 'completed'
  WHEN status = 'abandoned' THEN 'archived'
  ELSE 'active'
END
WHERE assignment_state IS NULL OR assignment_state = 'active';

ALTER TABLE public.applicant_workflow_step_records
  ADD COLUMN IF NOT EXISTS phase text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applicant_workflow_step_records_phase_chk'
  ) THEN
    ALTER TABLE public.applicant_workflow_step_records
      ADD CONSTRAINT applicant_workflow_step_records_phase_chk
      CHECK (phase IS NULL OR phase IN ('pre_hire', 'post_hire'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_flow_steps_phase_chk'
  ) THEN
    ALTER TABLE public.onboarding_flow_steps
      ADD CONSTRAINT onboarding_flow_steps_phase_chk
      CHECK (phase IN ('pre_hire', 'transition', 'post_hire'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_template_steps_phase_chk'
  ) THEN
    ALTER TABLE public.onboarding_template_steps
      ADD CONSTRAINT onboarding_template_steps_phase_chk
      CHECK (phase IN ('pre_hire', 'transition', 'post_hire'));
  END IF;
END $$;

-- Sync the denormalized column from explicit settings.phase only. Do not infer from titles.
UPDATE public.onboarding_flow_steps
SET phase = lower(settings->>'phase')
WHERE lower(COALESCE(settings->>'phase', '')) IN ('pre_hire', 'transition', 'post_hire')
  AND phase IS DISTINCT FROM lower(settings->>'phase');

UPDATE public.onboarding_template_steps
SET phase = lower(settings->>'phase')
WHERE lower(COALESCE(settings->>'phase', '')) IN ('pre_hire', 'transition', 'post_hire')
  AND phase IS DISTINCT FROM lower(settings->>'phase');

UPDATE public.applicant_workflow_step_records
SET phase = CASE
  WHEN lower(COALESCE(settings->>'phase', '')) = 'post_hire' THEN 'post_hire'
  WHEN lower(COALESCE(settings->>'phase', '')) IN ('pre_hire', 'transition') THEN 'pre_hire'
  ELSE phase
END
WHERE phase IS NULL
  AND lower(COALESCE(settings->>'phase', '')) IN ('pre_hire', 'transition', 'post_hire');

-- Existing hired applications: persist hired_at without inventing a second hire event.
UPDATE public.job_applications
SET hired_at = COALESCE(hired_at, post_hire_activated_at, updated_at, created_at)
WHERE lower(COALESCE(status, '')) = 'hired'
  AND hired_at IS NULL;

CREATE INDEX IF NOT EXISTS job_applications_tenant_hired_idx
  ON public.job_applications (tenant_id, status)
  WHERE lower(COALESCE(status, '')) = 'hired';

CREATE INDEX IF NOT EXISTS job_applications_tenant_suspended_idx
  ON public.job_applications (tenant_id, post_hire_suspended_at)
  WHERE post_hire_suspended_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS applicant_workflow_instances_tenant_worker_state_idx
  ON public.applicant_workflow_instances (tenant_id, worker_id, assignment_state);

CREATE INDEX IF NOT EXISTS onboarding_flow_steps_flow_phase_position_idx
  ON public.onboarding_flow_steps (flow_id, phase, position);

-- ---------------------------------------------------------------------------
-- Hire-aware step gates
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.application_is_authoritatively_hired(
  p_application_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_applications ja
    WHERE ja.id = p_application_id
      AND ja.tenant_id = p_tenant_id
      AND lower(COALESCE(ja.status, '')) = 'hired'
      AND ja.post_hire_suspended_at IS NULL
  )
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
  v_hired boolean;
BEGIN
  v_step_phase := COALESCE(public.step_lifecycle_phase(p_step_id), 'pre_hire');

  IF v_step_phase = 'pre_hire' THEN
    RETURN true;
  END IF;

  IF p_application_id IS NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.job_applications ja
      WHERE ja.worker_id = p_worker_id
        AND ja.tenant_id = p_tenant_id
        AND lower(COALESCE(ja.status, '')) = 'hired'
        AND ja.post_hire_suspended_at IS NULL
    ) INTO v_hired;
    RETURN COALESCE(v_hired, false);
  END IF;

  RETURN public.application_is_authoritatively_hired(p_application_id, p_tenant_id);
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
    RETURN v_hired AND v_phase = 'post_hire';
  END IF;

  RETURN v_phase = 'pre_hire';
END;
$$;

CREATE OR REPLACE FUNCTION public.applicant_may_write_required_document(
  p_worker_id uuid,
  p_tenant_id uuid,
  p_application_id uuid,
  p_required_document_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_step_id uuid;
BEGIN
  SELECT trd.onboarding_step_id
    INTO v_step_id
  FROM public.tenant_required_documents trd
  WHERE trd.id = p_required_document_id
    AND trd.tenant_id = p_tenant_id;

  IF v_step_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.applicant_may_write_onboarding_step(
    p_worker_id,
    p_tenant_id,
    p_application_id,
    v_step_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.application_is_authoritatively_hired(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.application_is_authoritatively_hired(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.application_is_authoritatively_hired(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.applicant_may_write_required_document(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.applicant_may_write_required_document(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.applicant_may_write_required_document(uuid, uuid, uuid, uuid) TO service_role;

DROP POLICY IF EXISTS worker_submitted_documents_own ON public.worker_submitted_documents;
DROP POLICY IF EXISTS worker_submitted_documents_own_select ON public.worker_submitted_documents;
DROP POLICY IF EXISTS worker_submitted_documents_own_insert ON public.worker_submitted_documents;
DROP POLICY IF EXISTS worker_submitted_documents_own_update ON public.worker_submitted_documents;

CREATE POLICY worker_submitted_documents_own_select
  ON public.worker_submitted_documents
  FOR SELECT TO authenticated
  USING (
    public.worker_belongs_to_auth(worker_id)
    AND (
      required_document_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.tenant_required_documents trd
        WHERE trd.id = worker_submitted_documents.required_document_id
          AND trd.tenant_id = worker_submitted_documents.tenant_id
          AND public.applicant_may_read_onboarding_step(
            worker_submitted_documents.worker_id,
            worker_submitted_documents.tenant_id,
            worker_submitted_documents.application_id,
            trd.onboarding_step_id
          )
      )
    )
  );

CREATE POLICY worker_submitted_documents_own_insert
  ON public.worker_submitted_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.worker_belongs_to_auth(worker_id)
    AND (
      required_document_id IS NULL
      OR public.applicant_may_write_required_document(
        worker_id,
        tenant_id,
        application_id,
        required_document_id
      )
    )
  );

CREATE POLICY worker_submitted_documents_own_update
  ON public.worker_submitted_documents
  FOR UPDATE TO authenticated
  USING (
    public.worker_belongs_to_auth(worker_id)
    AND (
      required_document_id IS NULL
      OR public.applicant_may_write_required_document(
        worker_id,
        tenant_id,
        application_id,
        required_document_id
      )
    )
  )
  WITH CHECK (
    public.worker_belongs_to_auth(worker_id)
    AND (
      required_document_id IS NULL
      OR public.applicant_may_write_required_document(
        worker_id,
        tenant_id,
        application_id,
        required_document_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Hired transition (atomic with status change)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.activate_post_hire(
  p_tenant_id uuid,
  p_application_id uuid,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app record;
  v_now timestamptz := now();
BEGIN
  IF COALESCE(auth.role(), '') = 'anon' THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.user_is_tenant_staff(p_tenant_id) THEN
      RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT
    ja.id,
    ja.tenant_id,
    ja.status,
    ja.workflow_phase,
    ja.post_hire_activated_at,
    ja.post_hire_suspended_at,
    ja.hired_at,
    ja.hired_by,
    ja.applicant_workflow_instance_id
  INTO v_app
  FROM public.job_applications ja
  WHERE ja.id = p_application_id
    AND ja.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
  END IF;

  IF lower(COALESCE(v_app.status, '')) IN ('rejected', 'withdrawn', 'archived') THEN
    RETURN jsonb_build_object(
      'activated', false,
      'alreadyActive', false,
      'skipped', true,
      'reason', 'TERMINAL_STATUS',
      'phase', v_app.workflow_phase,
      'postHireActivatedAt', v_app.post_hire_activated_at,
      'applicationId', v_app.id
    );
  END IF;

  IF lower(COALESCE(v_app.status, '')) IS DISTINCT FROM 'hired' THEN
    RETURN jsonb_build_object(
      'activated', false,
      'alreadyActive', false,
      'skipped', true,
      'reason', 'NOT_ACCEPTED',
      'phase', v_app.workflow_phase,
      'postHireActivatedAt', v_app.post_hire_activated_at,
      'applicationId', v_app.id
    );
  END IF;

  -- Re-hire after revert: clear suspend without duplicating the instance.
  IF v_app.workflow_phase IN ('post_hire', 'completed') AND v_app.post_hire_suspended_at IS NULL THEN
    RETURN jsonb_build_object(
      'activated', false,
      'alreadyActive', true,
      'skipped', false,
      'reason', NULL,
      'phase', v_app.workflow_phase,
      'postHireActivatedAt', v_app.post_hire_activated_at,
      'applicationId', v_app.id
    );
  END IF;

  UPDATE public.job_applications
  SET
    workflow_phase = 'post_hire',
    post_hire_activated_at = COALESCE(post_hire_activated_at, v_now),
    post_hire_suspended_at = NULL,
    hired_at = COALESCE(hired_at, v_now),
    hired_by = COALESCE(hired_by, p_actor_user_id),
    updated_at = v_now
  WHERE id = v_app.id
    AND tenant_id = p_tenant_id;

  UPDATE public.applicant_workflow_instances
  SET
    post_hire_unlocked_at = COALESCE(post_hire_unlocked_at, v_now),
    pre_hire_completed_at = COALESCE(pre_hire_completed_at, v_now),
    assignment_state = CASE
      WHEN assignment_state IN ('replaced', 'archived') THEN assignment_state
      ELSE 'active'
    END,
    updated_at = v_now
  WHERE application_id = v_app.id
    AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'activated', true,
    'alreadyActive', false,
    'skipped', false,
    'reason', NULL,
    'phase', 'post_hire',
    'postHireActivatedAt', COALESCE(v_app.post_hire_activated_at, v_now),
    'applicationId', v_app.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.change_job_application_status(
  p_tenant_id uuid,
  p_application_id uuid,
  p_to_status_id uuid,
  p_changed_by_user_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app record;
  v_from record;
  v_to record;
  v_history_id uuid;
  v_note text;
  v_changed_by uuid;
  v_now timestamptz := now();
  v_to_key text;
  v_from_key text;
BEGIN
  IF COALESCE(auth.role(), '') = 'anon' THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR NOT public.user_is_tenant_staff(p_tenant_id) THEN
      RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    v_changed_by := auth.uid();
  ELSE
    v_changed_by := p_changed_by_user_id;
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  IF v_note IS NOT NULL AND length(v_note) > 4000 THEN
    RAISE EXCEPTION 'Note too long' USING ERRCODE = '22001';
  END IF;

  SELECT ja.id, ja.tenant_id, ja.status_id, ja.status, ja.hired_at, ja.hired_by, ja.post_hire_suspended_at
  INTO v_app
  FROM public.job_applications ja
  WHERE ja.id = p_application_id
    AND ja.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.id, s.name, s.system_key, s.is_active, s.tenant_id
  INTO v_to
  FROM public.application_statuses s
  WHERE s.id = p_to_status_id
    AND s.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status not found for tenant' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_to.is_active THEN
    RAISE EXCEPTION 'Status is inactive' USING ERRCODE = '22000';
  END IF;

  IF v_app.status_id IS NOT DISTINCT FROM v_to.id THEN
    RETURN jsonb_build_object(
      'unchanged', true,
      'application', jsonb_build_object(
        'id', v_app.id,
        'statusId', v_to.id,
        'status', COALESCE(v_to.system_key, 'custom'),
        'statusName', v_to.name
      ),
      'history', NULL
    );
  END IF;

  IF v_app.status_id IS NOT NULL THEN
    SELECT s.id, s.name, s.system_key
    INTO v_from
    FROM public.application_statuses s
    WHERE s.id = v_app.status_id;
  END IF;

  v_to_key := lower(COALESCE(v_to.system_key, 'custom'));
  v_from_key := lower(COALESCE(v_from.system_key, v_app.status, ''));

  UPDATE public.job_applications
  SET
    status_id = v_to.id,
    status = COALESCE(v_to.system_key, 'custom'),
    hired_at = CASE
      WHEN v_to_key = 'hired' THEN COALESCE(hired_at, v_now)
      ELSE hired_at
    END,
    hired_by = CASE
      WHEN v_to_key = 'hired' THEN COALESCE(hired_by, v_changed_by)
      ELSE hired_by
    END,
    post_hire_suspended_at = CASE
      WHEN v_to_key = 'hired' THEN NULL
      WHEN v_from_key = 'hired' AND v_to_key IS DISTINCT FROM 'hired'
        THEN COALESCE(post_hire_suspended_at, v_now)
      ELSE post_hire_suspended_at
    END,
    updated_at = v_now
  WHERE id = v_app.id
    AND tenant_id = p_tenant_id;

  INSERT INTO public.application_status_history (
    tenant_id,
    application_id,
    from_status_id,
    from_status_name,
    to_status_id,
    to_status_name,
    changed_by_user_id,
    note
  ) VALUES (
    p_tenant_id,
    v_app.id,
    v_from.id,
    v_from.name,
    v_to.id,
    v_to.name,
    v_changed_by,
    v_note
  )
  RETURNING id INTO v_history_id;

  IF v_to_key = 'hired' THEN
    PERFORM public.activate_post_hire(p_tenant_id, p_application_id, v_changed_by);
  END IF;

  RETURN jsonb_build_object(
    'unchanged', false,
    'application', jsonb_build_object(
      'id', v_app.id,
      'statusId', v_to.id,
      'status', COALESCE(v_to.system_key, 'custom'),
      'statusName', v_to.name
    ),
    'history', jsonb_build_object(
      'id', v_history_id,
      'fromStatusId', v_from.id,
      'fromStatusName', v_from.name,
      'toStatusId', v_to.id,
      'toStatusName', v_to.name,
      'note', v_note,
      'changedByUserId', v_changed_by,
      'changedAt', v_now
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) TO service_role;
