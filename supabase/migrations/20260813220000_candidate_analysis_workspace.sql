-- Application-scoped recruiter workspace: analysis versions, decisions,
-- verified evidence, AI screening answers, and recruiter assignment.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS assigned_recruiter_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_analysis_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_analyzed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_analysis_model text,
  ADD COLUMN IF NOT EXISTS recruiter_decision text,
  ADD COLUMN IF NOT EXISTS recruiter_decision_note text,
  ADD COLUMN IF NOT EXISTS recruiter_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS recruiter_decision_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_applications_recruiter_decision_chk'
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_recruiter_decision_chk CHECK (
        recruiter_decision IS NULL OR recruiter_decision IN (
          'proceed_to_screening',
          'needs_verification',
          'keep_as_possible',
          'redirect_candidate',
          'do_not_pursue'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS job_applications_assigned_recruiter_idx
  ON public.job_applications (tenant_id, assigned_recruiter_user_id);

CREATE TABLE IF NOT EXISTS public.job_application_analysis_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.job_applications (id) ON DELETE CASCADE,
  version integer NOT NULL,
  analysis jsonb NOT NULL,
  score numeric,
  category text,
  recommended_action text,
  display_category text,
  model text,
  analyzed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_application_analysis_versions_unique UNIQUE (application_id, version)
);

CREATE INDEX IF NOT EXISTS job_application_analysis_versions_app_idx
  ON public.job_application_analysis_versions (tenant_id, application_id, version DESC);

COMMENT ON TABLE public.job_application_analysis_versions IS
  'Historical AI match analysis versions for a specific job application.';

CREATE TABLE IF NOT EXISTS public.job_application_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.job_applications (id) ON DELETE CASCADE,
  decision text NOT NULL,
  note text,
  recorded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_application_decisions_chk CHECK (
    decision IN (
      'proceed_to_screening',
      'needs_verification',
      'keep_as_possible',
      'redirect_candidate',
      'do_not_pursue'
    )
  )
);

CREATE INDEX IF NOT EXISTS job_application_decisions_app_idx
  ON public.job_application_decisions (tenant_id, application_id, recorded_at DESC);

COMMENT ON TABLE public.job_application_decisions IS
  'Recruiter final decisions for a job application, kept separate from AI recommendations.';

CREATE TABLE IF NOT EXISTS public.job_application_verified_information (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.job_applications (id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'note',
  title text NOT NULL,
  details text,
  verified_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_application_verified_information_category_chk CHECK (
    category IN ('license', 'certification', 'availability', 'note', 'other')
  )
);

CREATE INDEX IF NOT EXISTS job_application_verified_information_app_idx
  ON public.job_application_verified_information (tenant_id, application_id, created_at DESC);

COMMENT ON TABLE public.job_application_verified_information IS
  'Recruiter-confirmed evidence for a specific job application, distinct from AI résumé inference.';

CREATE TABLE IF NOT EXISTS public.job_application_ai_screening_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.job_applications (id) ON DELETE CASCADE,
  question_key text NOT NULL,
  question_text text NOT NULL,
  reason text,
  related_requirement text,
  answer_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_application_ai_screening_answers_unique UNIQUE (application_id, question_key)
);

CREATE INDEX IF NOT EXISTS job_application_ai_screening_answers_app_idx
  ON public.job_application_ai_screening_answers (tenant_id, application_id);

COMMENT ON TABLE public.job_application_ai_screening_answers IS
  'Recruiter-recorded answers to AI-generated screening questions, scoped to one application.';

DROP TRIGGER IF EXISTS set_job_application_verified_information_updated_at
  ON public.job_application_verified_information;
CREATE TRIGGER set_job_application_verified_information_updated_at
BEFORE UPDATE ON public.job_application_verified_information
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_job_application_ai_screening_answers_updated_at
  ON public.job_application_ai_screening_answers;
CREATE TRIGGER set_job_application_ai_screening_answers_updated_at
BEFORE UPDATE ON public.job_application_ai_screening_answers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.job_application_analysis_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_application_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_application_verified_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_application_ai_screening_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_application_analysis_versions_staff ON public.job_application_analysis_versions;
CREATE POLICY job_application_analysis_versions_staff
  ON public.job_application_analysis_versions
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS job_application_decisions_staff ON public.job_application_decisions;
CREATE POLICY job_application_decisions_staff
  ON public.job_application_decisions
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS job_application_verified_information_staff ON public.job_application_verified_information;
CREATE POLICY job_application_verified_information_staff
  ON public.job_application_verified_information
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS job_application_ai_screening_answers_staff ON public.job_application_ai_screening_answers;
CREATE POLICY job_application_ai_screening_answers_staff
  ON public.job_application_ai_screening_answers
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_application_analysis_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_application_decisions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_application_verified_information TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_application_ai_screening_answers TO authenticated;
GRANT ALL ON public.job_application_analysis_versions TO service_role;
GRANT ALL ON public.job_application_decisions TO service_role;
GRANT ALL ON public.job_application_verified_information TO service_role;
GRANT ALL ON public.job_application_ai_screening_answers TO service_role;
