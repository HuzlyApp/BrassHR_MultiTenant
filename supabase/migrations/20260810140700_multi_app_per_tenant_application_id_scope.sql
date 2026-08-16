-- Multi-app per tenant: add application_id columns + indexes.
-- Backfill / UNIQUE replacements live in 20260810140942_multi_app_per_tenant_backfill_and_uniques.sql
-- Person-level within tenant (NOT re-keyed): worker profile, worker_resumes, worker_license_records.

ALTER TABLE public.worker_notes
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_call_logs
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_pipeline_checklist_items
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_submitted_documents
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_documents
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_portal_documents
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_requirements
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_legacy_document_reviews
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_firma_signing_sessions
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_onboarding_progress
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_onboarding_step_progress
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.worker_skill_assessment_answers
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.applicant_skill_assessment_answers
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.interview_schedules
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.applicant_appointments
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
ALTER TABLE public.candidate_communications
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE SET NULL;

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS source_job_application_id uuid REFERENCES public.job_applications (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'skill_assessments'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'skill_assessments' AND column_name = 'worker_id'
  ) THEN
    ALTER TABLE public.skill_assessments
      ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.job_applications (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS worker_notes_application_id_idx ON public.worker_notes (application_id);
CREATE INDEX IF NOT EXISTS worker_call_logs_application_id_idx ON public.worker_call_logs (application_id);
CREATE INDEX IF NOT EXISTS worker_pipeline_checklist_items_application_id_idx ON public.worker_pipeline_checklist_items (application_id);
CREATE INDEX IF NOT EXISTS worker_submitted_documents_application_id_idx ON public.worker_submitted_documents (application_id);
CREATE INDEX IF NOT EXISTS worker_documents_application_id_idx ON public.worker_documents (application_id);
CREATE INDEX IF NOT EXISTS worker_portal_documents_application_id_idx ON public.worker_portal_documents (application_id);
CREATE INDEX IF NOT EXISTS worker_requirements_application_id_idx ON public.worker_requirements (application_id);
CREATE INDEX IF NOT EXISTS worker_legacy_document_reviews_application_id_idx ON public.worker_legacy_document_reviews (application_id);
CREATE INDEX IF NOT EXISTS worker_firma_signing_sessions_application_id_idx ON public.worker_firma_signing_sessions (application_id);
CREATE INDEX IF NOT EXISTS worker_onboarding_progress_application_id_idx ON public.worker_onboarding_progress (application_id);
CREATE INDEX IF NOT EXISTS worker_onboarding_step_progress_application_id_idx ON public.worker_onboarding_step_progress (application_id);
CREATE INDEX IF NOT EXISTS worker_skill_assessment_answers_application_id_idx ON public.worker_skill_assessment_answers (application_id);
CREATE INDEX IF NOT EXISTS applicant_skill_assessment_answers_application_id_idx ON public.applicant_skill_assessment_answers (application_id);
CREATE INDEX IF NOT EXISTS applicants_application_id_idx ON public.applicants (application_id);
CREATE INDEX IF NOT EXISTS interview_schedules_application_id_idx ON public.interview_schedules (application_id);
CREATE INDEX IF NOT EXISTS applicant_appointments_application_id_idx ON public.applicant_appointments (application_id);
CREATE INDEX IF NOT EXISTS candidate_communications_application_id_idx ON public.candidate_communications (application_id);
CREATE INDEX IF NOT EXISTS workers_source_job_application_id_idx ON public.workers (source_job_application_id);
