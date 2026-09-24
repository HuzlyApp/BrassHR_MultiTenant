-- Candidate Match AI progression (FS-AI-MATCH-001 v1.5):
-- stage so match % is only written after Deep Match, plus screening-card uploads.
-- Applied on production as 20260917165444; staging parity applied separately if needed.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS ai_match_stage text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_applications_ai_match_stage_chk'
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_ai_match_stage_chk CHECK (
        ai_match_stage IS NULL OR ai_match_stage IN ('quick', 'call_pack', 'deep')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.job_applications.ai_match_stage IS
  'Match AI progression: quick (checklist, no %), call_pack (screening questions), deep (writes match %).';

CREATE TABLE IF NOT EXISTS public.job_application_ai_screening_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.job_applications (id) ON DELETE CASCADE,
  question_key text,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  extracted_text text,
  uploaded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_application_ai_screening_uploads_app_idx
  ON public.job_application_ai_screening_uploads (tenant_id, application_id, created_at DESC);

COMMENT ON TABLE public.job_application_ai_screening_uploads IS
  'Screenshots / email replies uploaded on AI screening questions for a job application.';

ALTER TABLE public.job_application_ai_screening_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_application_ai_screening_uploads_staff
  ON public.job_application_ai_screening_uploads;
CREATE POLICY job_application_ai_screening_uploads_staff
  ON public.job_application_ai_screening_uploads FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.id = application_id
        AND a.tenant_id = job_application_ai_screening_uploads.tenant_id
    )
  );

DROP TRIGGER IF EXISTS trg_job_application_ai_screening_uploads_tenant_integrity
  ON public.job_application_ai_screening_uploads;
CREATE TRIGGER trg_job_application_ai_screening_uploads_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.job_application_ai_screening_uploads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_application_ai_screening_uploads TO authenticated;
GRANT ALL ON public.job_application_ai_screening_uploads TO service_role;
