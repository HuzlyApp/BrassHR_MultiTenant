-- Tenant-configurable worker onboarding (configs, steps, documents, assessments, progress).

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarding_config_version int NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- Configuration tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_onboarding_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_onboarding_configs_one_active_idx
  ON public.tenant_onboarding_configs (tenant_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS tenant_onboarding_configs_tenant_idx
  ON public.tenant_onboarding_configs (tenant_id);

CREATE TABLE IF NOT EXISTS public.tenant_onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_config_id uuid NOT NULL REFERENCES public.tenant_onboarding_configs (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  step_key text NOT NULL,
  title text NOT NULL,
  description text,
  step_type text NOT NULL,
  sort_order int NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  is_enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_onboarding_steps_step_type_chk CHECK (
    step_type IN (
      'resume_upload',
      'document_upload',
      'skill_assessment',
      'profile_information',
      'custom_question',
      'review_submit',
      'professional_license',
      'references',
      'authorizations'
    )
  ),
  UNIQUE (onboarding_config_id, step_key),
  UNIQUE (onboarding_config_id, sort_order)
);

CREATE INDEX IF NOT EXISTS tenant_onboarding_steps_config_sort_idx
  ON public.tenant_onboarding_steps (onboarding_config_id, sort_order);

CREATE TABLE IF NOT EXISTS public.tenant_required_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  onboarding_step_id uuid NOT NULL REFERENCES public.tenant_onboarding_steps (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  accepted_file_types text[] NOT NULL DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png'],
  max_file_size_mb int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_required_documents_step_idx
  ON public.tenant_required_documents (onboarding_step_id, sort_order);

CREATE TABLE IF NOT EXISTS public.tenant_skill_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  onboarding_step_id uuid NOT NULL REFERENCES public.tenant_onboarding_steps (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_skill_assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.tenant_skill_assessments (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer jsonb,
  is_required boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL,
  points int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_skill_assessment_questions_type_chk CHECK (
    question_type IN ('single_choice', 'multi_choice', 'scale', 'text', 'boolean')
  )
);

CREATE INDEX IF NOT EXISTS tenant_skill_assessment_questions_assessment_idx
  ON public.tenant_skill_assessment_questions (assessment_id, sort_order);

-- ---------------------------------------------------------------------------
-- Worker submission & progress
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.worker_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  file_url text NOT NULL,
  original_file_name text,
  parsed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsing_status text NOT NULL DEFAULT 'pending',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  parsed_at timestamptz,
  CONSTRAINT worker_resumes_parsing_status_chk CHECK (
    parsing_status IN ('pending', 'processing', 'completed', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS worker_resumes_worker_uidx ON public.worker_resumes (worker_id);

CREATE TABLE IF NOT EXISTS public.worker_submitted_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  required_document_id uuid NOT NULL REFERENCES public.tenant_required_documents (id) ON DELETE CASCADE,
  file_url text NOT NULL,
  original_file_name text,
  file_type text,
  file_size bigint,
  status text NOT NULL DEFAULT 'uploaded',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id),
  CONSTRAINT worker_submitted_documents_status_chk CHECK (
    status IN ('uploaded', 'under_review', 'approved', 'rejected')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS worker_submitted_documents_worker_req_uidx
  ON public.worker_submitted_documents (worker_id, required_document_id);

CREATE TABLE IF NOT EXISTS public.worker_skill_assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.tenant_skill_assessments (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.tenant_skill_assessment_questions (id) ON DELETE CASCADE,
  answer jsonb NOT NULL,
  score numeric,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.worker_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  onboarding_config_id uuid NOT NULL REFERENCES public.tenant_onboarding_configs (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_onboarding_progress_status_chk CHECK (
    status IN ('not_started', 'in_progress', 'completed', 'abandoned')
  ),
  UNIQUE (worker_id, onboarding_config_id)
);

CREATE TABLE IF NOT EXISTS public.worker_onboarding_step_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_onboarding_progress_id uuid NOT NULL REFERENCES public.worker_onboarding_progress (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  onboarding_step_id uuid NOT NULL REFERENCES public.tenant_onboarding_steps (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_onboarding_step_progress_status_chk CHECK (
    status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')
  ),
  UNIQUE (worker_onboarding_progress_id, onboarding_step_id)
);

-- ---------------------------------------------------------------------------
-- Storage: tenant logos
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('organization-logos', 'organization-logos', true, false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_is_tenant_staff(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND ur.role::text IN ('admin', 'client', 'recruiter', 'support')
  )
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = p_tenant_id
      AND u.role::text IN ('admin', 'client', 'recruiter', 'support')
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_tenant_staff (uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.user_is_tenant_staff (uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.worker_belongs_to_auth(p_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.worker w
    WHERE w.id = p_worker_id AND w.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.worker_belongs_to_auth (uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.worker_belongs_to_auth (uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Seed default onboarding (resume + legacy-compatible steps)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_default_tenant_onboarding(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config_id uuid;
  v_resume_step_id uuid;
  v_license_step_id uuid;
  v_skill_step_id uuid;
  v_auth_step_id uuid;
  v_refs_step_id uuid;
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
      v_config_id, p_tenant_id, 'resume_upload', 'Add Resume',
      'Upload and review your resume',
      'resume_upload', 10, true, true,
      '{"parsing_enabled":true,"required":true}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'professional_license', 'Professional License',
      'Upload professional license documents',
      'professional_license', 20, true, true, '{}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'skill_assessment', 'Skill Assessment',
      'Complete the skills assessment',
      'skill_assessment', 30, true, true, '{}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'authorizations', 'Authorizations & Documents',
      'Upload required authorization documents',
      'authorizations', 40, true, true, '{}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'references', 'Add References',
      'Provide professional references',
      'references', 50, true, true, '{"min_count":2}'::jsonb
    ),
    (
      v_config_id, p_tenant_id, 'review_submit', 'Summary',
      'Review and submit your application',
      'review_submit', 60, true, true, '{}'::jsonb
    )
  ON CONFLICT (onboarding_config_id, step_key) DO NOTHING;

  SELECT id INTO v_resume_step_id
  FROM public.tenant_onboarding_steps
  WHERE onboarding_config_id = v_config_id AND step_key = 'resume_upload';

  SELECT id INTO v_license_step_id
  FROM public.tenant_onboarding_steps
  WHERE onboarding_config_id = v_config_id AND step_key = 'professional_license';

  SELECT id INTO v_skill_step_id
  FROM public.tenant_onboarding_steps
  WHERE onboarding_config_id = v_config_id AND step_key = 'skill_assessment';

  SELECT id INTO v_auth_step_id
  FROM public.tenant_onboarding_steps
  WHERE onboarding_config_id = v_config_id AND step_key = 'authorizations';

  SELECT id INTO v_refs_step_id
  FROM public.tenant_onboarding_steps
  WHERE onboarding_config_id = v_config_id AND step_key = 'references';

  -- Legacy authorization document slots on authorizations step
  IF v_auth_step_id IS NOT NULL THEN
    INSERT INTO public.tenant_required_documents (
      tenant_id, onboarding_step_id, title, description, is_required, sort_order
    )
    SELECT p_tenant_id, v_auth_step_id, v.title, v.description, true, v.sort_order
    FROM (VALUES
      ('SSN Card', 'Upload SSN card (front/back if applicable)', 10),
      ('Driver''s License', 'Upload driver''s license', 20),
      ('Employee Agreement', 'Signed employee agreement', 30)
    ) AS v(title, description, sort_order)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tenant_required_documents d
      WHERE d.onboarding_step_id = v_auth_step_id AND d.title = v.title
    );
  END IF;

  -- Clone global skill categories → tenant assessments + questions (idempotent by title per step)
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

-- Backfill all tenants
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_tenant_onboarding(r.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.tenant_onboarding_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_required_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_skill_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_skill_assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_submitted_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_skill_assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_onboarding_step_progress ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.tenant_onboarding_configs TO anon, authenticated;
GRANT SELECT ON public.tenant_onboarding_steps TO anon, authenticated;
GRANT SELECT ON public.tenant_required_documents TO anon, authenticated;
GRANT SELECT ON public.tenant_skill_assessments TO anon, authenticated;
GRANT SELECT ON public.tenant_skill_assessment_questions TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_resumes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_submitted_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_skill_assessment_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_onboarding_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_onboarding_step_progress TO authenticated;

GRANT ALL ON public.tenant_onboarding_configs TO service_role;
GRANT ALL ON public.tenant_onboarding_steps TO service_role;
GRANT ALL ON public.tenant_required_documents TO service_role;
GRANT ALL ON public.tenant_skill_assessments TO service_role;
GRANT ALL ON public.tenant_skill_assessment_questions TO service_role;
GRANT ALL ON public.worker_resumes TO service_role;
GRANT ALL ON public.worker_submitted_documents TO service_role;
GRANT ALL ON public.worker_skill_assessment_answers TO service_role;
GRANT ALL ON public.worker_onboarding_progress TO service_role;
GRANT ALL ON public.worker_onboarding_step_progress TO service_role;

-- Config: workers read own tenant; staff manage
DROP POLICY IF EXISTS tenant_onboarding_configs_worker_select ON public.tenant_onboarding_configs;
CREATE POLICY tenant_onboarding_configs_worker_select
  ON public.tenant_onboarding_configs FOR SELECT TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.worker w
      WHERE w.user_id = auth.uid() AND w.tenant_id = tenant_onboarding_configs.tenant_id
    )
  );

DROP POLICY IF EXISTS tenant_onboarding_configs_staff ON public.tenant_onboarding_configs;
CREATE POLICY tenant_onboarding_configs_staff
  ON public.tenant_onboarding_configs FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS tenant_onboarding_steps_read ON public.tenant_onboarding_steps;
CREATE POLICY tenant_onboarding_steps_read
  ON public.tenant_onboarding_steps FOR SELECT TO authenticated
  USING (
    is_enabled = true
    AND (
      EXISTS (
        SELECT 1 FROM public.worker w
        WHERE w.user_id = auth.uid() AND w.tenant_id = tenant_onboarding_steps.tenant_id
      )
      OR public.user_is_tenant_staff(tenant_id)
    )
  );

DROP POLICY IF EXISTS tenant_onboarding_steps_staff_write ON public.tenant_onboarding_steps;
CREATE POLICY tenant_onboarding_steps_staff_write
  ON public.tenant_onboarding_steps FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS tenant_required_documents_read ON public.tenant_required_documents;
CREATE POLICY tenant_required_documents_read
  ON public.tenant_required_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.worker w
      WHERE w.user_id = auth.uid() AND w.tenant_id = tenant_required_documents.tenant_id
    )
    OR public.user_is_tenant_staff(tenant_id)
  );

DROP POLICY IF EXISTS tenant_required_documents_staff ON public.tenant_required_documents;
CREATE POLICY tenant_required_documents_staff
  ON public.tenant_required_documents FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS tenant_skill_assessments_read ON public.tenant_skill_assessments;
CREATE POLICY tenant_skill_assessments_read
  ON public.tenant_skill_assessments FOR SELECT TO authenticated
  USING (
    is_enabled = true
    AND (
      EXISTS (
        SELECT 1 FROM public.worker w
        WHERE w.user_id = auth.uid() AND w.tenant_id = tenant_skill_assessments.tenant_id
      )
      OR public.user_is_tenant_staff(tenant_id)
    )
  );

DROP POLICY IF EXISTS tenant_skill_assessments_staff ON public.tenant_skill_assessments;
CREATE POLICY tenant_skill_assessments_staff
  ON public.tenant_skill_assessments FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS tenant_skill_questions_worker_select ON public.tenant_skill_assessment_questions;
CREATE POLICY tenant_skill_questions_worker_select
  ON public.tenant_skill_assessment_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.worker w
      WHERE w.user_id = auth.uid() AND w.tenant_id = tenant_skill_assessment_questions.tenant_id
    )
  );

DROP POLICY IF EXISTS tenant_skill_questions_staff ON public.tenant_skill_assessment_questions;
CREATE POLICY tenant_skill_questions_staff
  ON public.tenant_skill_assessment_questions FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

-- Worker-owned rows
DROP POLICY IF EXISTS worker_resumes_own ON public.worker_resumes;
CREATE POLICY worker_resumes_own
  ON public.worker_resumes FOR ALL TO authenticated
  USING (public.worker_belongs_to_auth(worker_id))
  WITH CHECK (public.worker_belongs_to_auth(worker_id));

DROP POLICY IF EXISTS worker_resumes_staff_select ON public.worker_resumes;
CREATE POLICY worker_resumes_staff_select
  ON public.worker_resumes FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_submitted_documents_own ON public.worker_submitted_documents;
CREATE POLICY worker_submitted_documents_own
  ON public.worker_submitted_documents FOR ALL TO authenticated
  USING (public.worker_belongs_to_auth(worker_id))
  WITH CHECK (public.worker_belongs_to_auth(worker_id));

DROP POLICY IF EXISTS worker_submitted_documents_staff ON public.worker_submitted_documents;
CREATE POLICY worker_submitted_documents_staff
  ON public.worker_submitted_documents FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_skill_answers_own ON public.worker_skill_assessment_answers;
CREATE POLICY worker_skill_answers_own
  ON public.worker_skill_assessment_answers FOR ALL TO authenticated
  USING (public.worker_belongs_to_auth(worker_id))
  WITH CHECK (public.worker_belongs_to_auth(worker_id));

DROP POLICY IF EXISTS worker_skill_answers_staff ON public.worker_skill_assessment_answers;
CREATE POLICY worker_skill_answers_staff_select
  ON public.worker_skill_assessment_answers FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_onboarding_progress_own ON public.worker_onboarding_progress;
CREATE POLICY worker_onboarding_progress_own
  ON public.worker_onboarding_progress FOR ALL TO authenticated
  USING (public.worker_belongs_to_auth(worker_id))
  WITH CHECK (public.worker_belongs_to_auth(worker_id));

DROP POLICY IF EXISTS worker_onboarding_progress_staff ON public.worker_onboarding_progress;
CREATE POLICY worker_onboarding_progress_staff
  ON public.worker_onboarding_progress FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_onboarding_step_progress_own ON public.worker_onboarding_step_progress;
CREATE POLICY worker_onboarding_step_progress_own
  ON public.worker_onboarding_step_progress FOR ALL TO authenticated
  USING (public.worker_belongs_to_auth(worker_id))
  WITH CHECK (public.worker_belongs_to_auth(worker_id));

DROP POLICY IF EXISTS worker_onboarding_step_progress_staff ON public.worker_onboarding_step_progress;
CREATE POLICY worker_onboarding_step_progress_staff
  ON public.worker_onboarding_step_progress FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));
