-- Per-requirement verification notes for match analysis (Needs Verification).
-- Notes are scoped to tenant + application + requirement (+ worker/job denormalized).
-- Soft-delete + audit trail preserve history instead of overwriting.

CREATE TABLE IF NOT EXISTS public.job_application_match_requirement_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  job_application_id uuid NOT NULL REFERENCES public.job_applications (id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.job_application_match_requirements (id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.worker (id) ON DELETE SET NULL,
  job_requisition_id uuid REFERENCES public.job_requisitions (id) ON DELETE SET NULL,
  analysis_version integer,
  note_body text NOT NULL,
  candidate_question text,
  due_date date,
  verification_status text NOT NULL DEFAULT 'pending',
  candidate_response text,
  candidate_responded_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT job_application_match_requirement_notes_status_chk CHECK (
    verification_status IN (
      'pending',
      'sent_to_candidate',
      'candidate_responded',
      'verified',
      'rejected'
    )
  ),
  CONSTRAINT job_application_match_requirement_notes_body_not_empty CHECK (
    char_length(btrim(note_body)) > 0
  )
);

CREATE INDEX IF NOT EXISTS job_application_match_requirement_notes_app_idx
  ON public.job_application_match_requirement_notes (
    tenant_id,
    job_application_id,
    requirement_id,
    created_at DESC
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS job_application_match_requirement_notes_req_idx
  ON public.job_application_match_requirement_notes (requirement_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS job_application_match_requirement_notes_worker_idx
  ON public.job_application_match_requirement_notes (tenant_id, worker_id, created_at DESC)
  WHERE deleted_at IS NULL AND worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_application_match_requirement_notes_status_idx
  ON public.job_application_match_requirement_notes (
    tenant_id,
    job_application_id,
    verification_status
  )
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.job_application_match_requirement_notes IS
  'Recruiter verification notes for individual match-analysis requirements. Scoped to one candidate application and requirement.';

CREATE TABLE IF NOT EXISTS public.job_application_match_requirement_note_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  note_id uuid NOT NULL REFERENCES public.job_application_match_requirement_notes (id) ON DELETE CASCADE,
  job_application_id uuid NOT NULL REFERENCES public.job_applications (id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.job_application_match_requirements (id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_application_match_requirement_note_audit_action_chk CHECK (
    action IN (
      'created',
      'updated',
      'deleted',
      'status_changed',
      'response_recorded'
    )
  )
);

CREATE INDEX IF NOT EXISTS job_application_match_requirement_note_audit_note_idx
  ON public.job_application_match_requirement_note_audit (note_id, created_at DESC);

CREATE INDEX IF NOT EXISTS job_application_match_requirement_note_audit_app_idx
  ON public.job_application_match_requirement_note_audit (
    tenant_id,
    job_application_id,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS job_application_match_requirement_note_audit_req_idx
  ON public.job_application_match_requirement_note_audit (
    requirement_id,
    created_at DESC
  );

COMMENT ON TABLE public.job_application_match_requirement_note_audit IS
  'Immutable audit trail for verification note create/update/delete/status/response events.';

DROP TRIGGER IF EXISTS set_job_application_match_requirement_notes_updated_at
  ON public.job_application_match_requirement_notes;
CREATE TRIGGER set_job_application_match_requirement_notes_updated_at
BEFORE UPDATE ON public.job_application_match_requirement_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_job_application_match_requirement_notes_tenant_integrity
  ON public.job_application_match_requirement_notes;
CREATE TRIGGER trg_job_application_match_requirement_notes_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.job_application_match_requirement_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

DROP TRIGGER IF EXISTS trg_job_application_match_requirement_note_audit_tenant_integrity
  ON public.job_application_match_requirement_note_audit;
CREATE TRIGGER trg_job_application_match_requirement_note_audit_tenant_integrity
  BEFORE INSERT OR UPDATE ON public.job_application_match_requirement_note_audit
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_child_tenant();

ALTER TABLE public.job_application_match_requirement_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_application_match_requirement_note_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_application_match_requirement_notes_staff
  ON public.job_application_match_requirement_notes;
CREATE POLICY job_application_match_requirement_notes_staff
  ON public.job_application_match_requirement_notes
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1
      FROM public.job_applications a
      WHERE a.id = job_application_id
        AND a.tenant_id = job_application_match_requirement_notes.tenant_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.job_application_match_requirements r
      WHERE r.id = requirement_id
        AND r.job_application_id = job_application_match_requirement_notes.job_application_id
        AND r.tenant_id = job_application_match_requirement_notes.tenant_id
    )
  );

DROP POLICY IF EXISTS job_application_match_requirement_note_audit_staff
  ON public.job_application_match_requirement_note_audit;
CREATE POLICY job_application_match_requirement_note_audit_staff
  ON public.job_application_match_requirement_note_audit
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1
      FROM public.job_applications a
      WHERE a.id = job_application_id
        AND a.tenant_id = job_application_match_requirement_note_audit.tenant_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_application_match_requirement_notes TO authenticated;
GRANT SELECT, INSERT ON public.job_application_match_requirement_note_audit TO authenticated;
GRANT ALL ON public.job_application_match_requirement_notes TO service_role;
GRANT ALL ON public.job_application_match_requirement_note_audit TO service_role;
