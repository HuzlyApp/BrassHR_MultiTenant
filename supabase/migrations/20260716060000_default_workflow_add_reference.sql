-- Replace default Agreement Signature step with Add Reference.
-- Also expand worker_references for professional reference fields + tenant isolation.
-- Safely remaps platform-default workflows only (exact 6-key fingerprint including agreement_signature).

-- ---------------------------------------------------------------------------
-- 1) worker_references schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.worker_references
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS relationship text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS years_known numeric(4,1),
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill tenant_id from worker when missing
UPDATE public.worker_references wr
SET tenant_id = w.tenant_id
FROM public.worker w
WHERE wr.worker_id = w.id
  AND wr.tenant_id IS NULL
  AND w.tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS worker_references_tenant_id_idx
  ON public.worker_references (tenant_id);

CREATE INDEX IF NOT EXISTS worker_references_tenant_worker_idx
  ON public.worker_references (tenant_id, worker_id);

ALTER TABLE public.worker_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_references_own ON public.worker_references;
CREATE POLICY worker_references_own
  ON public.worker_references
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.worker w
      WHERE w.id = worker_references.worker_id
        AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.worker w
      WHERE w.id = worker_references.worker_id
        AND w.user_id = auth.uid()
        AND (
          worker_references.tenant_id IS NULL
          OR worker_references.tenant_id = w.tenant_id
        )
    )
  );

DROP POLICY IF EXISTS worker_references_staff ON public.worker_references;
CREATE POLICY worker_references_staff
  ON public.worker_references
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = worker_references.tenant_id
        AND ur.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_references TO authenticated;
GRANT ALL ON public.worker_references TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Migration report table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.default_workflow_migration_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  workflows_inspected int NOT NULL DEFAULT 0,
  workflows_updated int NOT NULL DEFAULT 0,
  customized_workflows_skipped int NOT NULL DEFAULT 0,
  applicants_remapped int NOT NULL DEFAULT 0,
  records_preserved int NOT NULL DEFAULT 0,
  records_requiring_manual_review int NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 3) Replace seed_default_tenant_onboarding agreement step with references
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_tenant_onboarding(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config_id uuid;
  v_skill_step_id uuid;
  v_license_step_id uuid;
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
      v_config_id, p_tenant_id, 'references', 'Add Reference',
      'Add professional references for verification',
      'references', 50, true, true,
      '{"min_count":1,"workflow_step_id":"references-collection"}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'review_submit', 'Final Review / Completion',
      'Review your application and complete onboarding',
      'review_submit', 60, true, true,
      '{"workflow_step_id":"completion-milestone"}'::jsonb
    )
  ON CONFLICT (onboarding_config_id, step_key) DO NOTHING;

  SELECT id INTO v_license_step_id
  FROM public.tenant_onboarding_steps
  WHERE onboarding_config_id = v_config_id AND step_key = 'professional_license';

  IF v_license_step_id IS NOT NULL THEN
    INSERT INTO public.tenant_required_documents (
      tenant_id, onboarding_step_id, title, description, is_required, sort_order
    )
    SELECT
      p_tenant_id,
      v_license_step_id,
      v.title,
      v.description,
      true,
      v.sort_order
    FROM (
      VALUES
        ('Nursing License', 'Front and back if applicable', 10),
        ('TB Test', 'Within the last 12 months', 20),
        ('CPR Certifications', NULL::text, 30)
    ) AS v(title, description, sort_order)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tenant_required_documents d
      WHERE d.onboarding_step_id = v_license_step_id
    );
  END IF;

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

-- ---------------------------------------------------------------------------
-- 4) Backfill platform-default configs that still have agreement_signature
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_inspected int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_remapped int := 0;
  v_preserved int := 0;
  v_manual int := 0;
  v_cfg record;
  v_keys text[];
  v_agree_id uuid;
  v_bg_id uuid;
  v_ref_id uuid;
  v_new_ref_id uuid;
  v_progress_rows int;
BEGIN
  FOR v_cfg IN
    SELECT toc.id AS config_id, toc.tenant_id
    FROM public.tenant_onboarding_configs toc
    WHERE toc.is_active = true
  LOOP
    v_inspected := v_inspected + 1;

    SELECT array_agg(tos.step_key ORDER BY tos.sort_order)
      INTO v_keys
    FROM public.tenant_onboarding_steps tos
    WHERE tos.onboarding_config_id = v_cfg.config_id
      AND tos.is_enabled = true;

    -- Exact default fingerprint that erroneously included Agreement Signature
    IF v_keys IS DISTINCT FROM ARRAY[
      'resume_upload',
      'professional_license',
      'skill_assessment',
      'authorization_background_check',
      'agreement_signature',
      'review_submit'
    ] THEN
      IF 'agreement_signature' = ANY (COALESCE(v_keys, ARRAY[]::text[])) THEN
        v_manual := v_manual + 1;
        v_skipped := v_skipped + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
      CONTINUE;
    END IF;

    SELECT id INTO v_agree_id
    FROM public.tenant_onboarding_steps
    WHERE onboarding_config_id = v_cfg.config_id
      AND step_key = 'agreement_signature'
    LIMIT 1;

    SELECT id INTO v_bg_id
    FROM public.tenant_onboarding_steps
    WHERE onboarding_config_id = v_cfg.config_id
      AND step_key = 'authorization_background_check'
    LIMIT 1;

    SELECT id INTO v_ref_id
    FROM public.tenant_onboarding_steps
    WHERE onboarding_config_id = v_cfg.config_id
      AND step_key = 'references'
    LIMIT 1;

    -- Free sort_order 50 before inserting/updating references
    IF v_agree_id IS NOT NULL THEN
      UPDATE public.tenant_onboarding_steps
      SET sort_order = 999, updated_at = now()
      WHERE id = v_agree_id;
    END IF;

    IF v_ref_id IS NULL THEN
      INSERT INTO public.tenant_onboarding_steps (
        onboarding_config_id, tenant_id, step_key, title, description,
        step_type, sort_order, is_required, is_enabled, metadata
      ) VALUES (
        v_cfg.config_id,
        v_cfg.tenant_id,
        'references',
        'Add Reference',
        'Add professional references for verification',
        'references',
        50,
        true,
        true,
        '{"min_count":1,"workflow_step_id":"references-collection"}'::jsonb
      )
      RETURNING id INTO v_new_ref_id;
    ELSE
      UPDATE public.tenant_onboarding_steps
      SET
        title = 'Add Reference',
        description = 'Add professional references for verification',
        step_type = 'references',
        sort_order = 50,
        is_required = true,
        is_enabled = true,
        metadata = COALESCE(metadata, '{}'::jsonb) || '{"min_count":1,"workflow_step_id":"references-collection"}'::jsonb,
        updated_at = now()
      WHERE id = v_ref_id;
      v_new_ref_id := v_ref_id;
    END IF;

    -- Remap applicant progress from agreement → references (or back to auth if auth incomplete)
    IF v_agree_id IS NOT NULL AND v_new_ref_id IS NOT NULL THEN
      WITH remapped AS (
        UPDATE public.worker_onboarding_step_progress sp
        SET
          onboarding_step_id = CASE
            WHEN EXISTS (
              SELECT 1
              FROM public.worker_onboarding_step_progress bg
              WHERE bg.worker_onboarding_progress_id = sp.worker_onboarding_progress_id
                AND bg.onboarding_step_id = v_bg_id
                AND bg.status IN ('completed', 'skipped')
            ) THEN v_new_ref_id
            WHEN v_bg_id IS NOT NULL THEN v_bg_id
            ELSE v_new_ref_id
          END,
          updated_at = now()
        WHERE sp.onboarding_step_id = v_agree_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.worker_onboarding_step_progress other
            WHERE other.worker_onboarding_progress_id = sp.worker_onboarding_progress_id
              AND other.onboarding_step_id = CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM public.worker_onboarding_step_progress bg
                  WHERE bg.worker_onboarding_progress_id = sp.worker_onboarding_progress_id
                    AND bg.onboarding_step_id = v_bg_id
                    AND bg.status IN ('completed', 'skipped')
                ) THEN v_new_ref_id
                WHEN v_bg_id IS NOT NULL THEN v_bg_id
                ELSE v_new_ref_id
              END
          )
        RETURNING 1
      )
      SELECT count(*) INTO v_progress_rows FROM remapped;
      v_remapped := v_remapped + COALESCE(v_progress_rows, 0);

      -- Preserve completed/skipped agreement progress markers into notes without deleting
      UPDATE public.worker_onboarding_step_progress sp
      SET data = COALESCE(sp.data, '{}'::jsonb) || jsonb_build_object(
        'migrated_from_agreement_signature', true,
        'migrated_at', now()
      )
      WHERE sp.onboarding_step_id IN (v_new_ref_id, v_bg_id)
        AND COALESCE((sp.data ->> 'migrated_from_agreement_signature')::boolean, false) = false
        AND EXISTS (
          SELECT 1
          FROM public.worker_onboarding_step_progress old
          WHERE old.worker_onboarding_progress_id = sp.worker_onboarding_progress_id
            AND old.onboarding_step_id = v_agree_id
        );
    END IF;

    -- Soft-disable agreement step (keep row + any FK integrity); do not destroy Firma history
    IF v_agree_id IS NOT NULL THEN
      UPDATE public.tenant_onboarding_steps
      SET
        is_enabled = false,
        sort_order = 999,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'retired_from_default', true,
          'retired_at', now()::text,
          'replaced_by', 'references'
        ),
        updated_at = now()
      WHERE id = v_agree_id;
      v_preserved := v_preserved + 1;
    END IF;

    v_updated := v_updated + 1;
  END LOOP;

  INSERT INTO public.default_workflow_migration_report (
    workflows_inspected,
    workflows_updated,
    customized_workflows_skipped,
    applicants_remapped,
    records_preserved,
    records_requiring_manual_review,
    details
  ) VALUES (
    v_inspected,
    v_updated,
    v_skipped,
    v_remapped,
    v_preserved,
    v_manual,
    jsonb_build_object(
      'note',
      'Replaced platform-default agreement_signature with references; custom workflows with agreement_signature flagged for manual review; Firma/signature rows untouched.'
    )
  );
END $$;
