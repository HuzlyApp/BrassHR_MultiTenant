-- Phase-gated staffing workflow: Pre-Hire is active until placement acceptance,
-- then Post-Hire onboarding unlocks on the specific job application.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS workflow_phase text NOT NULL DEFAULT 'pre_hire',
  ADD COLUMN IF NOT EXISTS post_hire_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_hire_activation_email_sent_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_applications_workflow_phase_chk'
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_workflow_phase_chk
      CHECK (workflow_phase IN ('pre_hire', 'post_hire', 'completed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS job_applications_tenant_phase_idx
  ON public.job_applications (tenant_id, workflow_phase);

ALTER TABLE public.applicant_continuation_links
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS applicant_continuation_links_application_idx
  ON public.applicant_continuation_links (application_id)
  WHERE application_id IS NOT NULL;

COMMENT ON COLUMN public.job_applications.workflow_phase IS
  'Applicant-facing staffing lifecycle for this job application: pre_hire, post_hire, or completed.';
COMMENT ON COLUMN public.job_applications.post_hire_activated_at IS
  'When Post-Hire onboarding was activated after placement acceptance. Never cleared on email failure.';

-- Existing hired applications already passed the acceptance gate.
UPDATE public.job_applications
SET
  workflow_phase = 'post_hire',
  post_hire_activated_at = COALESCE(post_hire_activated_at, updated_at, created_at, now())
WHERE workflow_phase = 'pre_hire'
  AND lower(COALESCE(status, '')) = 'hired';

UPDATE public.applicant_workflow_instances awi
SET post_hire_unlocked_at = COALESCE(awi.post_hire_unlocked_at, ja.post_hire_activated_at)
FROM public.job_applications ja
WHERE awi.application_id = ja.id
  AND awi.tenant_id = ja.tenant_id
  AND ja.workflow_phase IN ('post_hire', 'completed')
  AND awi.post_hire_unlocked_at IS NULL;

CREATE OR REPLACE FUNCTION public.step_lifecycle_phase(p_step_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN lower(COALESCE(
      ts.metadata->'workflow_settings'->>'phase',
      ts.metadata->>'phase',
      'pre_hire'
    )) = 'post_hire' THEN 'post_hire'
    ELSE 'pre_hire'
  END
  FROM public.tenant_onboarding_steps ts
  WHERE ts.id = p_step_id
$$;

CREATE OR REPLACE FUNCTION public.application_workflow_phase(p_application_id uuid, p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(ja.workflow_phase, 'pre_hire')
  FROM public.job_applications ja
  WHERE ja.id = p_application_id
    AND ja.tenant_id = p_tenant_id
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
  v_phase text;
  v_step_phase text;
BEGIN
  IF p_application_id IS NULL THEN
    v_phase := 'pre_hire';
  ELSE
    v_phase := COALESCE(public.application_workflow_phase(p_application_id, p_tenant_id), 'pre_hire');
  END IF;

  v_step_phase := COALESCE(public.step_lifecycle_phase(p_step_id), 'pre_hire');

  IF v_phase = 'pre_hire' THEN
    RETURN v_step_phase = 'pre_hire';
  END IF;

  -- After acceptance the applicant works Post-Hire; Pre-Hire history remains readable.
  RETURN v_step_phase = 'post_hire' OR v_step_phase = 'pre_hire';
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
BEGIN
  IF p_application_id IS NULL THEN
    v_phase := 'pre_hire';
  ELSE
    v_phase := COALESCE(public.application_workflow_phase(p_application_id, p_tenant_id), 'pre_hire');
  END IF;

  IF v_phase = 'completed' THEN
    RETURN false;
  END IF;

  v_step_phase := COALESCE(public.step_lifecycle_phase(p_step_id), 'pre_hire');
  RETURN v_phase = v_step_phase;
END;
$$;

DROP POLICY IF EXISTS worker_onboarding_step_progress_own ON public.worker_onboarding_step_progress;
DROP POLICY IF EXISTS worker_onboarding_step_progress_own_select ON public.worker_onboarding_step_progress;
DROP POLICY IF EXISTS worker_onboarding_step_progress_own_write ON public.worker_onboarding_step_progress;

CREATE POLICY worker_onboarding_step_progress_own_select
  ON public.worker_onboarding_step_progress
  FOR SELECT TO authenticated
  USING (
    public.worker_belongs_to_auth(worker_id)
    AND public.applicant_may_read_onboarding_step(
      worker_id,
      tenant_id,
      application_id,
      onboarding_step_id
    )
  );

CREATE POLICY worker_onboarding_step_progress_own_insert
  ON public.worker_onboarding_step_progress
  FOR INSERT TO authenticated
  WITH CHECK (
    public.worker_belongs_to_auth(worker_id)
    AND public.applicant_may_write_onboarding_step(
      worker_id,
      tenant_id,
      application_id,
      onboarding_step_id
    )
  );

CREATE POLICY worker_onboarding_step_progress_own_update
  ON public.worker_onboarding_step_progress
  FOR UPDATE TO authenticated
  USING (
    public.worker_belongs_to_auth(worker_id)
    AND public.applicant_may_write_onboarding_step(
      worker_id,
      tenant_id,
      application_id,
      onboarding_step_id
    )
  )
  WITH CHECK (
    public.worker_belongs_to_auth(worker_id)
    AND public.applicant_may_write_onboarding_step(
      worker_id,
      tenant_id,
      application_id,
      onboarding_step_id
    )
  );

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

  IF v_app.workflow_phase IN ('post_hire', 'completed') THEN
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

  UPDATE public.job_applications
  SET
    workflow_phase = 'post_hire',
    post_hire_activated_at = COALESCE(post_hire_activated_at, v_now),
    updated_at = v_now
  WHERE id = v_app.id
    AND tenant_id = p_tenant_id
    AND workflow_phase = 'pre_hire';

  UPDATE public.applicant_workflow_instances
  SET post_hire_unlocked_at = COALESCE(post_hire_unlocked_at, v_now)
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

REVOKE ALL ON FUNCTION public.activate_post_hire(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_post_hire(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_post_hire(uuid, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.step_lifecycle_phase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.step_lifecycle_phase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.step_lifecycle_phase(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.application_workflow_phase(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.application_workflow_phase(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.application_workflow_phase(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.applicant_may_read_onboarding_step(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.applicant_may_read_onboarding_step(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.applicant_may_read_onboarding_step(uuid, uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.applicant_may_write_onboarding_step(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.applicant_may_write_onboarding_step(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.applicant_may_write_onboarding_step(uuid, uuid, uuid, uuid) TO service_role;

INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL,
  'placement_accepted',
  'Placement accepted — start onboarding',
  'Congratulations — your placement has been accepted',
  '<p>Congratulations, {{applicantName}}!</p><p>Your placement for <strong>{{jobTitle}}</strong> with {{tenantName}} has been accepted.</p><p>The next step is to complete your onboarding requirements.</p><p><a href="{{onboardingLink}}">Continue Onboarding</a></p><p>Your onboarding may include:</p><ul><li>Tax forms</li><li>Direct deposit</li><li>Required agreements</li><li>Compliance documents</li><li>Training</li><li>Scheduling information</li></ul><p>Please complete the required items before your start date.</p><p>Questions? Contact us at {{supportEmail}}.</p>',
  E'Congratulations, {{applicantName}}!\n\nYour placement for {{jobTitle}} with {{tenantName}} has been accepted.\n\nThe next step is to complete your onboarding requirements:\n{{onboardingLink}}\n\nYour onboarding may include tax forms, direct deposit, required agreements, compliance documents, training, and scheduling information.\n\nPlease complete the required items before your start date.\n\nQuestions? {{supportEmail}}',
  '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"jobTitle","required":true},{"key":"onboardingLink","required":true},{"key":"supportEmail","required":true}]'::jsonb,
  'en',
  'active',
  1,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.email_templates t
  WHERE t.tenant_id IS NULL
    AND t.template_key = 'placement_accepted'
    AND t.locale = 'en'
    AND t.version = 1
);
