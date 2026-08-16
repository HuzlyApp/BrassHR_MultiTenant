-- Candidate↔ job AI match analysis: status/score on applications + per-requirement rows.

-- ---------------------------------------------------------------------------
-- 1) Cached structured requirements on job_requisitions
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS structured_requirements jsonb;

COMMENT ON COLUMN public.job_requisitions.structured_requirements IS
  'Cached structured requirement lists for AI match (mandatoryRequirements, preferredRequirements, requiredLicenses, requiredCertifications, educationRequirements, requiredYearsExperience, specialty, location).';

-- ---------------------------------------------------------------------------
-- 2) Match analysis columns on job_applications
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS ai_match_status text NOT NULL DEFAULT 'READY',
  ADD COLUMN IF NOT EXISTS ai_match_score numeric,
  ADD COLUMN IF NOT EXISTS ai_match_category text,
  ADD COLUMN IF NOT EXISTS ai_match_action text,
  ADD COLUMN IF NOT EXISTS ai_match_readiness text,
  ADD COLUMN IF NOT EXISTS ai_match_display_category text,
  ADD COLUMN IF NOT EXISTS ai_analysis_raw jsonb,
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_analysis_error text,
  ADD COLUMN IF NOT EXISTS ai_analysis_progress text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_applications_ai_match_status_chk'
      AND conrelid = 'public.job_applications'::regclass
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_ai_match_status_chk CHECK (
        ai_match_status IN ('READY', 'ANALYZING', 'ANALYZED', 'FAILED', 'NEEDS_REVIEW')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.job_applications.ai_match_status IS
  'AI match pipeline status: READY → ANALYZING → ANALYZED | FAILED | NEEDS_REVIEW.';
COMMENT ON COLUMN public.job_applications.ai_analysis_raw IS
  'Raw model JSON before deterministic rescoring.';
COMMENT ON COLUMN public.job_applications.ai_analysis IS
  'Validated + deterministically rescored match analysis JSON.';

CREATE INDEX IF NOT EXISTS job_applications_ai_match_score_idx
  ON public.job_applications (tenant_id, job_requisition_id, ai_match_score DESC NULLS LAST)
  WHERE ai_match_status = 'ANALYZED';

-- ---------------------------------------------------------------------------
-- 3) Per-requirement rows (preserves recruiter verifications on reanalyze)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_application_match_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  job_application_id uuid NOT NULL REFERENCES public.job_applications (id) ON DELETE CASCADE,
  requirement_text text NOT NULL,
  requirement_type text NOT NULL,
  status text NOT NULL,
  requirement_outcome text NOT NULL,
  candidate_evidence text NOT NULL DEFAULT '',
  evidence_source text NOT NULL DEFAULT 'NONE',
  impact text NOT NULL DEFAULT '',
  verification_required boolean NOT NULL DEFAULT false,
  confidence numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  recruiter_verified boolean NOT NULL DEFAULT false,
  recruiter_note text,
  recruiter_verified_at timestamptz,
  recruiter_verified_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_application_match_requirements_type_chk CHECK (
    requirement_type IN ('MANDATORY', 'PREFERRED')
  ),
  CONSTRAINT job_application_match_requirements_status_chk CHECK (
    status IN ('CONFIRMED', 'PARTIAL', 'NOT_FOUND', 'CONFLICTING', 'NOT_APPLICABLE')
  ),
  CONSTRAINT job_application_match_requirements_outcome_chk CHECK (
    requirement_outcome IN ('MET', 'VERIFY', 'NOT_MET', 'CONFLICT', 'NOT_APPLICABLE')
  ),
  CONSTRAINT job_application_match_requirements_evidence_source_chk CHECK (
    evidence_source IN (
      'RESUME',
      'VERIFIED_RECRUITER_INPUT',
      'JOB_DESCRIPTION',
      'STRUCTURED_JOB_FIELD',
      'RECRUITER_NOTE',
      'NONE'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS job_application_match_requirements_uidx
  ON public.job_application_match_requirements (
    job_application_id,
    requirement_type,
    md5(lower(btrim(requirement_text)))
  );

CREATE INDEX IF NOT EXISTS job_application_match_requirements_app_idx
  ON public.job_application_match_requirements (tenant_id, job_application_id, sort_order);

DROP TRIGGER IF EXISTS set_job_application_match_requirements_updated_at
  ON public.job_application_match_requirements;
CREATE TRIGGER set_job_application_match_requirements_updated_at
BEFORE UPDATE ON public.job_application_match_requirements
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.job_application_match_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_application_match_requirements_staff
  ON public.job_application_match_requirements;
CREATE POLICY job_application_match_requirements_staff
  ON public.job_application_match_requirements
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_application_match_requirements TO authenticated;
GRANT ALL ON public.job_application_match_requirements TO service_role;
