-- Job-specific screening questions and per-application answers.

CREATE TABLE IF NOT EXISTS public.job_screening_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.job_requisitions (id) ON DELETE CASCADE,
  question text NOT NULL,
  question_type text NOT NULL DEFAULT 'short_text',
  options jsonb,
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_screening_questions_type_chk CHECK (
    question_type IN (
      'yes_no',
      'single_select',
      'multiple_select',
      'short_text',
      'long_text',
      'number'
    )
  )
);

CREATE INDEX IF NOT EXISTS job_screening_questions_job_idx
  ON public.job_screening_questions (tenant_id, job_id, sort_order);

COMMENT ON TABLE public.job_screening_questions IS
  'Job-specific pre-screening questions configured by recruiters.';

CREATE TABLE IF NOT EXISTS public.application_screening_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.job_applications (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.job_screening_questions (id) ON DELETE RESTRICT,
  question_text text NOT NULL,
  answer jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_screening_answers_unique UNIQUE (application_id, question_id)
);

CREATE INDEX IF NOT EXISTS application_screening_answers_app_idx
  ON public.application_screening_answers (tenant_id, application_id);

COMMENT ON TABLE public.application_screening_answers IS
  'Applicant answers to job screening questions, scoped to a single job application.';

DROP TRIGGER IF EXISTS set_job_screening_questions_updated_at
  ON public.job_screening_questions;
CREATE TRIGGER set_job_screening_questions_updated_at
BEFORE UPDATE ON public.job_screening_questions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_application_screening_answers_updated_at
  ON public.application_screening_answers;
CREATE TRIGGER set_application_screening_answers_updated_at
BEFORE UPDATE ON public.application_screening_answers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.job_screening_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_screening_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_screening_questions_staff ON public.job_screening_questions;
CREATE POLICY job_screening_questions_staff
  ON public.job_screening_questions
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS job_screening_questions_public_read ON public.job_screening_questions;
CREATE POLICY job_screening_questions_public_read
  ON public.job_screening_questions
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.job_requisitions jr
      WHERE jr.id = job_id
        AND jr.tenant_id = job_screening_questions.tenant_id
        AND jr.status = 'published'
    )
  );

DROP POLICY IF EXISTS application_screening_answers_staff ON public.application_screening_answers;
CREATE POLICY application_screening_answers_staff
  ON public.application_screening_answers
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS application_screening_answers_self ON public.application_screening_answers;
CREATE POLICY application_screening_answers_self
  ON public.application_screening_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_applications a
      WHERE a.id = application_id
        AND a.applicant_auth_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_screening_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_screening_answers TO authenticated;
GRANT ALL ON public.job_screening_questions TO service_role;
GRANT ALL ON public.application_screening_answers TO service_role;
