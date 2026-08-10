-- Backfill application_id + replace worker-scoped UNIQUEs + applicant RLS.
-- (Columns added in 20260810140700_multi_app_per_tenant_application_id_scope.sql)

UPDATE public.worker_notes t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_call_logs t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_pipeline_checklist_items t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_submitted_documents t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_documents t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_portal_documents t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_requirements t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_legacy_document_reviews t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_firma_signing_sessions t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_onboarding_progress t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_onboarding_step_progress t
SET application_id = COALESCE(t.application_id, p.application_id)
FROM public.worker_onboarding_progress p
WHERE t.worker_onboarding_progress_id = p.id AND t.application_id IS NULL AND p.application_id IS NOT NULL;

UPDATE public.worker_onboarding_step_progress t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.worker_skill_assessment_answers t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.applicant_skill_assessment_answers t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.applicant_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.applicants t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.interview_schedules t
SET application_id = a.application_id
FROM public.applicants a
WHERE t.applicant_id = a.id AND t.application_id IS NULL AND a.application_id IS NOT NULL;

UPDATE public.interview_schedules t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.applicant_appointments t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.candidate_communications t
SET application_id = ja.id
FROM public.job_applications ja
WHERE t.application_id IS NULL AND t.worker_id = ja.worker_id AND t.tenant_id = ja.tenant_id AND ja.worker_id IS NOT NULL;

UPDATE public.workers w
SET source_job_application_id = ja.id
FROM public.job_applications ja
WHERE w.source_job_application_id IS NULL
  AND w.candidate_id = ja.worker_id
  AND w.tenant_id = ja.tenant_id
  AND ja.status = 'hired'
  AND ja.worker_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'skill_assessments' AND column_name = 'application_id'
  ) THEN
    EXECUTE $q$
      UPDATE public.skill_assessments t
      SET application_id = ja.id
      FROM public.job_applications ja
      WHERE t.application_id IS NULL
        AND t.worker_id = ja.worker_id
        AND t.tenant_id = ja.tenant_id
        AND ja.worker_id IS NOT NULL
    $q$;
  END IF;
END $$;

-- Replace blocking UNIQUEs
ALTER TABLE public.worker_requirements DROP CONSTRAINT IF EXISTS worker_requirements_worker_id_key;
DROP INDEX IF EXISTS public.worker_requirements_worker_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS worker_requirements_application_uidx
  ON public.worker_requirements (application_id) WHERE application_id IS NOT NULL;

DROP INDEX IF EXISTS public.worker_submitted_documents_worker_req_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS worker_submitted_documents_application_req_uidx
  ON public.worker_submitted_documents (application_id, required_document_id) WHERE application_id IS NOT NULL;

ALTER TABLE public.worker_pipeline_checklist_items
  DROP CONSTRAINT IF EXISTS worker_screening_checklist_items_worker_id_item_key_key;
ALTER TABLE public.worker_pipeline_checklist_items
  DROP CONSTRAINT IF EXISTS worker_pipeline_checklist_items_worker_id_item_key_key;
DROP INDEX IF EXISTS public.worker_screening_checklist_items_worker_id_item_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS worker_pipeline_checklist_items_application_item_uidx
  ON public.worker_pipeline_checklist_items (application_id, item_key) WHERE application_id IS NOT NULL;

ALTER TABLE public.worker_firma_signing_sessions
  DROP CONSTRAINT IF EXISTS worker_firma_signing_sessions_worker_id_onboarding_step_id_key;
DROP INDEX IF EXISTS public.worker_firma_signing_sessions_worker_id_onboarding_step_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS worker_firma_signing_sessions_application_step_uidx
  ON public.worker_firma_signing_sessions (application_id, onboarding_step_id) WHERE application_id IS NOT NULL;

ALTER TABLE public.worker_onboarding_progress
  DROP CONSTRAINT IF EXISTS worker_onboarding_progress_worker_id_onboarding_config_id_key;
DROP INDEX IF EXISTS public.worker_onboarding_progress_worker_id_onboarding_config_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS worker_onboarding_progress_application_config_uidx
  ON public.worker_onboarding_progress (application_id, onboarding_config_id) WHERE application_id IS NOT NULL;

ALTER TABLE public.worker_skill_assessment_answers
  DROP CONSTRAINT IF EXISTS worker_skill_assessment_answers_worker_id_question_id_key;
DROP INDEX IF EXISTS public.worker_skill_assessment_answers_worker_id_question_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS worker_skill_assessment_answers_application_question_uidx
  ON public.worker_skill_assessment_answers (application_id, question_id) WHERE application_id IS NOT NULL;

ALTER TABLE public.applicant_skill_assessment_answers
  DROP CONSTRAINT IF EXISTS applicant_skill_assessment_answers_applicant_id_category_id_ski;
ALTER TABLE public.applicant_skill_assessment_answers
  DROP CONSTRAINT IF EXISTS applicant_skill_assessment_answers_applicant_category_skill_uid;
DROP INDEX IF EXISTS public.applicant_skill_assessment_answers_applicant_category_skill_uid;
DROP INDEX IF EXISTS public.applicant_skill_assessment_answers_applicant_id_category_id_ski;
CREATE UNIQUE INDEX IF NOT EXISTS applicant_skill_assessment_answers_application_cat_skill_uidx
  ON public.applicant_skill_assessment_answers (application_id, category_id, skill_id)
  WHERE application_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS applicant_skill_assessment_answers_applicant_cat_skill_uidx
  ON public.applicant_skill_assessment_answers (applicant_id, category_id, skill_id)
  WHERE application_id IS NULL;

DROP INDEX IF EXISTS public.applicants_tenant_worker_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS applicants_tenant_application_uidx
  ON public.applicants (tenant_id, application_id) WHERE application_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS applicants_tenant_worker_legacy_uidx
  ON public.applicants (tenant_id, worker_id)
  WHERE application_id IS NULL AND worker_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS worker_documents_application_uidx
  ON public.worker_documents (application_id) WHERE application_id IS NOT NULL;

DROP INDEX IF EXISTS public.worker_legacy_document_reviews_worker_key_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS worker_legacy_document_reviews_application_key_uidx
  ON public.worker_legacy_document_reviews (application_id, document_key) WHERE application_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'skill_assessments' AND column_name = 'application_id'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.skill_assessments_worker_id_category_uidx';
    EXECUTE $q$
      CREATE UNIQUE INDEX IF NOT EXISTS skill_assessments_application_category_uidx
        ON public.skill_assessments (application_id, category)
        WHERE application_id IS NOT NULL
    $q$;
  END IF;
END $$;

DROP POLICY IF EXISTS worker_notes_applicant_application_read ON public.worker_notes;
CREATE POLICY worker_notes_applicant_application_read
  ON public.worker_notes FOR SELECT TO authenticated
  USING (
    application_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.id = worker_notes.application_id
        AND a.applicant_auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS worker_pipeline_checklist_items_applicant_application_read
  ON public.worker_pipeline_checklist_items;
CREATE POLICY worker_pipeline_checklist_items_applicant_application_read
  ON public.worker_pipeline_checklist_items FOR SELECT TO authenticated
  USING (
    application_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.id = worker_pipeline_checklist_items.application_id
        AND a.applicant_auth_user_id = auth.uid()
    )
  );

COMMENT ON COLUMN public.worker_notes.application_id IS
  'Job application this note belongs to. Recruiting context is application-scoped.';
COMMENT ON COLUMN public.worker_requirements.application_id IS
  'Job application this requirements/docs blob belongs to.';
COMMENT ON COLUMN public.workers.source_job_application_id IS
  'Job application that led to this employment conversion, when known.';
