-- Align seeded default tenant onboarding steps with the platform default workflow.

CREATE OR REPLACE FUNCTION public.seed_default_tenant_onboarding(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config_id uuid;
  v_skill_step_id uuid;
  v_cat record;
  v_assessment_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id required';
  END IF;

  SELECT id INTO v_config_id
  FROM public.tenant_onboarding_configs
  WHERE tenant_id = p_tenant_id AND is_active = true
  LIMIT 1;

  IF v_config_id IS NULL THEN
    UPDATE public.tenant_onboarding_configs SET is_active = false, updated_at = now()
    WHERE tenant_id = p_tenant_id AND is_active = true;

    INSERT INTO public.tenant_onboarding_configs (tenant_id, is_active)
    VALUES (p_tenant_id, true)
    RETURNING id INTO v_config_id;
  END IF;

  INSERT INTO public.tenant_onboarding_steps (
    onboarding_config_id, tenant_id, step_key, title, description,
    step_type, sort_order, is_required, is_enabled, metadata
  ) VALUES
    (
      v_config_id, p_tenant_id, 'resume_upload', 'Upload Resume',
      'Upload your resume and confirm your contact information.',
      'resume_upload', 10, true, true,
      '{"parsing_enabled":true,"required":true,"workflow_step_id":"resume-basic-profile"}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'professional_license', 'Professional License',
      'Upload professional license documents',
      'professional_license', 20, true, true,
      '{"workflow_step_id":"credential-license-verification"}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'skill_assessment', 'Skill Assessment',
      'Complete the skills assessment',
      'skill_assessment', 30, true, true,
      '{"workflow_step_id":"skill-qualification-assessment"}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'authorization_background_check', 'Authorization / Background Check',
      'Complete authorization and background screening requirements',
      'custom_question', 40, true, true,
      '{"workflow_step_id":"background-check"}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'agreement_signature', 'Agreement / Signature',
      'Review and sign required agreements',
      'authorizations', 50, true, true,
      '{"workflow_step_id":"employee-agreement"}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'review_submit', 'Final Review / Completion',
      'Review your application and complete onboarding',
      'review_submit', 60, true, true,
      '{"workflow_step_id":"completion-milestone"}'::jsonb
    )
  ON CONFLICT (onboarding_config_id, step_key) DO NOTHING;

  SELECT id INTO v_skill_step_id
  FROM public.tenant_onboarding_steps
  WHERE onboarding_config_id = v_config_id AND step_key = 'skill_assessment';

  IF v_skill_step_id IS NOT NULL THEN
    FOR v_cat IN
      SELECT sc.id, sc.title, sc.description, sc.slug
      FROM public.skill_categories sc
      ORDER BY sc.order_number NULLS LAST, sc.title
    LOOP
      SELECT tsa.id INTO v_assessment_id
      FROM public.tenant_skill_assessments tsa
      WHERE tsa.onboarding_step_id = v_skill_step_id
        AND tsa.title = v_cat.title
      LIMIT 1;

      IF v_assessment_id IS NULL THEN
        INSERT INTO public.tenant_skill_assessments (
          tenant_id, onboarding_step_id, title, description, is_enabled
        ) VALUES (
          p_tenant_id, v_skill_step_id, v_cat.title, v_cat.description, true
        )
        RETURNING id INTO v_assessment_id;

        INSERT INTO public.tenant_skill_assessment_questions (
          assessment_id, tenant_id, question_text, question_type, options,
          is_required, sort_order, points
        )
        SELECT
          v_assessment_id,
          p_tenant_id,
          sq.question,
          'boolean',
          '[]'::jsonb,
          true,
          sq.quiz_number,
          1
        FROM public.skill_questions sq
        WHERE sq.category_id = v_cat.id
        ORDER BY sq.quiz_number;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.tenants
  SET onboarding_config_version = GREATEST(COALESCE(onboarding_config_version, 0), 1), updated_at = now()
  WHERE id = p_tenant_id;

  RETURN v_config_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_tenant_onboarding (uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.seed_default_tenant_onboarding (uuid) TO service_role;
