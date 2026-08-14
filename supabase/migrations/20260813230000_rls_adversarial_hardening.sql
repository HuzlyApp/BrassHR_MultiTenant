-- Adversarial RLS hardening (do not wholesale-replace policies).
-- Fixes:
-- 1) change_job_application_status: require staff or service_role; revoke anon EXECUTE
-- 2) Child-row tenant/application consistency triggers (FK spoof)
-- 3) Block users from forging role / god_admin / tenant_id
-- 4) Restore applicant_messages staff insert worker-tenant match
-- 5) Revoke leftover anon EXECUTE on seed/status helper RPCs

-- ---------------------------------------------------------------------------
-- 1) Status-change RPC must not be callable by anonymous PostgREST
-- ---------------------------------------------------------------------------
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

  SELECT ja.id, ja.tenant_id, ja.status_id, ja.status
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

  UPDATE public.job_applications
  SET
    status_id = v_to.id,
    status = COALESCE(v_to.system_key, 'custom'),
    updated_at = now()
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
      'changedAt', now()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.ensure_default_application_statuses(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_default_application_statuses(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_default_application_statuses(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.seed_default_tenant_onboarding(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_default_tenant_onboarding(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.seed_default_tenant_onboarding(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Parent-tenant consistency for recruiting child rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_application_child_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row jsonb := to_jsonb(NEW);
  v_app_id uuid;
  v_worker_id uuid;
BEGIN
  v_app_id := NULLIF(v_row->>'application_id', '')::uuid;
  IF v_app_id IS NULL THEN
    v_app_id := NULLIF(v_row->>'job_application_id', '')::uuid;
  END IF;
  v_worker_id := NULLIF(v_row->>'worker_id', '')::uuid;

  IF v_app_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.job_applications a
    WHERE a.id = v_app_id
      AND a.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Child record tenant_id must match the parent application tenant'
      USING ERRCODE = '23514';
  END IF;

  IF v_worker_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.worker w
    WHERE w.id = v_worker_id
      AND w.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Child record tenant_id must match the worker tenant'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_interview_child_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.interview_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.interview_schedules s
    WHERE s.id = NEW.interview_id
      AND s.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Interview child tenant_id must match the parent interview tenant'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_job_child_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.job_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.job_requisitions j
    WHERE j.id = NEW.job_id
      AND j.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Job child tenant_id must match the parent job tenant'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_notes_tenant_integrity ON public.worker_notes;
CREATE TRIGGER trg_worker_notes_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.worker_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

DROP TRIGGER IF EXISTS trg_application_screening_answers_tenant_integrity ON public.application_screening_answers;
CREATE TRIGGER trg_application_screening_answers_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.application_screening_answers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

DROP TRIGGER IF EXISTS trg_application_status_history_tenant_integrity ON public.application_status_history;
CREATE TRIGGER trg_application_status_history_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.application_status_history
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

DROP TRIGGER IF EXISTS trg_interview_schedules_tenant_integrity ON public.interview_schedules;
CREATE TRIGGER trg_interview_schedules_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.interview_schedules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

DROP TRIGGER IF EXISTS trg_job_application_analysis_versions_tenant_integrity ON public.job_application_analysis_versions;
CREATE TRIGGER trg_job_application_analysis_versions_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.job_application_analysis_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

DROP TRIGGER IF EXISTS trg_job_application_decisions_tenant_integrity ON public.job_application_decisions;
CREATE TRIGGER trg_job_application_decisions_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.job_application_decisions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

DROP TRIGGER IF EXISTS trg_job_application_verified_information_tenant_integrity ON public.job_application_verified_information;
CREATE TRIGGER trg_job_application_verified_information_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.job_application_verified_information
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

DROP TRIGGER IF EXISTS trg_job_application_ai_screening_answers_tenant_integrity ON public.job_application_ai_screening_answers;
CREATE TRIGGER trg_job_application_ai_screening_answers_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.job_application_ai_screening_answers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

DROP TRIGGER IF EXISTS trg_job_application_match_requirements_tenant_integrity ON public.job_application_match_requirements;
CREATE TRIGGER trg_job_application_match_requirements_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.job_application_match_requirements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

DROP TRIGGER IF EXISTS trg_interview_attendees_tenant_integrity ON public.interview_attendees;
CREATE TRIGGER trg_interview_attendees_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.interview_attendees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_interview_child_tenant();

DROP TRIGGER IF EXISTS trg_interview_invitation_deliveries_tenant_integrity ON public.interview_invitation_deliveries;
CREATE TRIGGER trg_interview_invitation_deliveries_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.interview_invitation_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_interview_child_tenant();

DROP TRIGGER IF EXISTS trg_job_screening_questions_tenant_integrity ON public.job_screening_questions;
CREATE TRIGGER trg_job_screening_questions_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.job_screening_questions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_job_child_tenant();

-- Staff WITH CHECK must also reject FK spoofing at RLS (JWT path).
DROP POLICY IF EXISTS worker_notes_staff ON public.worker_notes;
CREATE POLICY worker_notes_staff
  ON public.worker_notes FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.worker w
      WHERE w.id = worker_id AND w.tenant_id = worker_notes.tenant_id
    )
    AND (
      application_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.job_applications a
        WHERE a.id = application_id AND a.tenant_id = worker_notes.tenant_id
      )
    )
  );

DROP POLICY IF EXISTS application_screening_answers_staff ON public.application_screening_answers;
CREATE POLICY application_screening_answers_staff
  ON public.application_screening_answers FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.id = application_id AND a.tenant_id = application_screening_answers.tenant_id
    )
  );

DROP POLICY IF EXISTS interview_schedules_staff ON public.interview_schedules;
CREATE POLICY interview_schedules_staff
  ON public.interview_schedules FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND (
      application_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.job_applications a
        WHERE a.id = application_id AND a.tenant_id = interview_schedules.tenant_id
      )
    )
  );

DROP POLICY IF EXISTS job_application_analysis_versions_staff ON public.job_application_analysis_versions;
CREATE POLICY job_application_analysis_versions_staff
  ON public.job_application_analysis_versions FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.id = application_id AND a.tenant_id = job_application_analysis_versions.tenant_id
    )
  );

DROP POLICY IF EXISTS job_application_decisions_staff ON public.job_application_decisions;
CREATE POLICY job_application_decisions_staff
  ON public.job_application_decisions FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.id = application_id AND a.tenant_id = job_application_decisions.tenant_id
    )
  );

DROP POLICY IF EXISTS job_application_verified_information_staff ON public.job_application_verified_information;
CREATE POLICY job_application_verified_information_staff
  ON public.job_application_verified_information FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.id = application_id AND a.tenant_id = job_application_verified_information.tenant_id
    )
  );

DROP POLICY IF EXISTS job_application_ai_screening_answers_staff ON public.job_application_ai_screening_answers;
CREATE POLICY job_application_ai_screening_answers_staff
  ON public.job_application_ai_screening_answers FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.id = application_id AND a.tenant_id = job_application_ai_screening_answers.tenant_id
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Users cannot forge admin/tenant membership via users_update_own
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_users_security_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.role IS DISTINCT FROM OLD.role
       OR NEW.god_admin IS DISTINCT FROM OLD.god_admin
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     )
     AND COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin')
  THEN
    RAISE EXCEPTION 'Cannot modify role, god_admin, or tenant_id'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_protect_security_columns ON public.users;
CREATE TRIGGER trg_users_protect_security_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_users_security_columns();

-- ---------------------------------------------------------------------------
-- 4) Restore staff message insert so worker.tenant_id must match the message
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS applicant_messages_insert_staff ON public.applicant_messages;
CREATE POLICY applicant_messages_insert_staff
  ON public.applicant_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND sender_role = 'recruiter'
    AND sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.worker w
      WHERE w.id = worker_id
        AND w.tenant_id = applicant_messages.tenant_id
    )
  );
