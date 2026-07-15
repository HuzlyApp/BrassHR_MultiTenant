-- Complete Job Requisition / ATS architecture:
-- human-readable Job IDs, expanded statuses, position counts,
-- MSP directory, EOR selection, profession/specialty, structured location,
-- client-hire placements, and workflow mapping enhancements.

-- ---------------------------------------------------------------------------
-- MSP directory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.msps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT msps_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_msps_name_unique
  ON public.msps (lower(trim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_msps_code_unique
  ON public.msps (lower(trim(code)))
  WHERE code IS NOT NULL AND length(trim(code)) > 0;

CREATE TABLE IF NOT EXISTS public.msp_tenant_associations (
  msp_id uuid NOT NULL REFERENCES public.msps (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (msp_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.msp_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  msp_id uuid NOT NULL REFERENCES public.msps (id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  name text NOT NULL,
  external_client_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT msp_clients_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_msp_clients_msp_name_unique
  ON public.msp_clients (msp_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_msp_clients_tenant_id
  ON public.msp_clients (tenant_id);

-- ---------------------------------------------------------------------------
-- Job number sequence (concurrency-safe JOB-YYYY-######)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.job_requisition_number_seq;

CREATE OR REPLACE FUNCTION public.next_job_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
BEGIN
  n := nextval('public.job_requisition_number_seq');
  RETURN 'JOB-' || to_char(timezone('utc', now()), 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- Extend job_requisitions
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS job_number text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS location_type text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state_province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS rate_unit text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS benefits_summary text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS years_experience_required integer,
  ADD COLUMN IF NOT EXISTS special_requirements text,
  ADD COLUMN IF NOT EXISTS positions_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS filled_positions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS msp_id uuid REFERENCES public.msps (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS msp_client_id uuid REFERENCES public.msp_clients (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS msp_client_name text,
  ADD COLUMN IF NOT EXISTS source_job_title text,
  ADD COLUMN IF NOT EXISTS source_job_url text,
  ADD COLUMN IF NOT EXISTS source_job_details text,
  ADD COLUMN IF NOT EXISTS eor_tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pay_rate_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Backfill job numbers for legacy rows
UPDATE public.job_requisitions
SET job_number = public.next_job_number()
WHERE job_number IS NULL;

ALTER TABLE public.job_requisitions
  ALTER COLUMN job_number SET DEFAULT public.next_job_number(),
  ALTER COLUMN job_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_requisitions_job_number_unique
  ON public.job_requisitions (job_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_requisitions_idempotency_key
  ON public.job_requisitions (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_requisitions_msp_external_req_unique
  ON public.job_requisitions (tenant_id, msp_id, lower(trim(external_req_id)))
  WHERE source_type = 'MSP'
    AND msp_id IS NOT NULL
    AND external_req_id IS NOT NULL
    AND length(trim(external_req_id)) > 0
    AND status NOT IN ('Cancelled');

-- Sync profession from job_role where missing
UPDATE public.job_requisitions
SET profession = job_role
WHERE profession IS NULL AND job_role IS NOT NULL;

-- Expand status values; migrate Open → Published
ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_status_check;

UPDATE public.job_requisitions
SET status = 'Published'
WHERE status = 'Open';

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_status_check
  CHECK (
    status IN (
      'Draft',
      'Pending_Approval',
      'Approved',
      'Published',
      'Paused',
      'Closed',
      'Filled',
      'Cancelled'
    )
  );

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_valid_msp_info_check;

-- Soften MSP info: drafts may omit; published MSP jobs must have identifiers
ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_valid_msp_info_check
  CHECK (
    source_type = 'Internal'
    OR status IN ('Draft', 'Pending_Approval', 'Cancelled')
    OR (
      source_type = 'MSP'
      AND external_req_id IS NOT NULL
      AND length(trim(external_req_id)) > 0
      AND (
        msp_id IS NOT NULL
        OR (msp_name IS NOT NULL AND length(trim(msp_name)) > 0)
      )
    )
  );

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_eor_required_check;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_eor_required_check
  CHECK (
    placement_type IS DISTINCT FROM 'Recruit_and_EOR'
    OR status IN ('Draft', 'Pending_Approval', 'Cancelled')
    OR eor_tenant_id IS NOT NULL
  );

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_location_type_check;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_location_type_check
  CHECK (
    location_type IS NULL
    OR location_type IN ('On-site', 'Remote', 'Hybrid')
  );

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_rate_unit_check;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_rate_unit_check
  CHECK (
    rate_unit IS NULL
    OR rate_unit IN ('Hour', 'Day', 'Week', 'Month', 'Year', 'Flat')
  );

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_positions_count_check;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_positions_count_check
  CHECK (positions_count >= 1);

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_filled_positions_check;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_filled_positions_check
  CHECK (filled_positions >= 0 AND filled_positions <= positions_count);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_tenant_job_number
  ON public.job_requisitions (tenant_id, job_number);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_tenant_status
  ON public.job_requisitions (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_profession_specialty
  ON public.job_requisitions (tenant_id, profession, specialty);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_msp_external_req
  ON public.job_requisitions (tenant_id, external_req_id)
  WHERE external_req_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_requisitions_eor_tenant
  ON public.job_requisitions (eor_tenant_id)
  WHERE eor_tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Workflow mapping: profession / specialty / source_type
-- ---------------------------------------------------------------------------
ALTER TABLE public.workflow_template_mappings
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS source_type text;

ALTER TABLE public.workflow_template_mappings
  DROP CONSTRAINT IF EXISTS workflow_template_mappings_source_type_check;

ALTER TABLE public.workflow_template_mappings
  ADD CONSTRAINT workflow_template_mappings_source_type_check
  CHECK (source_type IS NULL OR source_type IN ('Internal', 'MSP'));

UPDATE public.workflow_template_mappings
SET profession = job_role
WHERE profession IS NULL AND job_role IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Job approval events (immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_requisition_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.job_requisitions (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_requisition_approvals_action_check
    CHECK (action IN ('submitted', 'approved', 'rejected', 'request_changes', 'resubmitted'))
);

CREATE INDEX IF NOT EXISTS idx_job_requisition_approvals_req
  ON public.job_requisition_approvals (requisition_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Client hire / Recruit-and-Release placement records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_hire_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  requisition_id uuid REFERENCES public.job_requisitions (id) ON DELETE SET NULL,
  applicant_id uuid NOT NULL,
  applicant_workflow_instance_id uuid,
  client_name text,
  msp_id uuid REFERENCES public.msps (id) ON DELETE SET NULL,
  msp_client_id uuid REFERENCES public.msp_clients (id) ON DELETE SET NULL,
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_hire_placements_applicant_unique UNIQUE (applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_client_hire_placements_tenant
  ON public.client_hire_placements (tenant_id);

CREATE INDEX IF NOT EXISTS idx_client_hire_placements_requisition
  ON public.client_hire_placements (requisition_id);

-- Extend worker_assignments for traceability
ALTER TABLE public.worker_assignments
  ADD COLUMN IF NOT EXISTS applicant_id uuid,
  ADD COLUMN IF NOT EXISTS eor_tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS msp_id uuid REFERENCES public.msps (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS integration_status text NOT NULL DEFAULT 'Not_Required',
  ADD COLUMN IF NOT EXISTS integration_provider text,
  ADD COLUMN IF NOT EXISTS integration_external_id text,
  ADD COLUMN IF NOT EXISTS integration_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS integration_last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS integration_error text,
  ADD COLUMN IF NOT EXISTS integration_retry_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.worker_assignments
  DROP CONSTRAINT IF EXISTS worker_assignments_integration_status_check;

ALTER TABLE public.worker_assignments
  ADD CONSTRAINT worker_assignments_integration_status_check
  CHECK (
    integration_status IN (
      'Not_Required',
      'Pending',
      'Processing',
      'Synced',
      'Failed',
      'Needs_Review'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_assignments_applicant_unique
  ON public.worker_assignments (applicant_id)
  WHERE applicant_id IS NOT NULL;

-- Candidate final disposition on worker (applicant) table
ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS final_disposition text,
  ADD COLUMN IF NOT EXISTS hired_by_client_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_hire_placement_id uuid;

ALTER TABLE public.worker
  DROP CONSTRAINT IF EXISTS worker_final_disposition_check;

ALTER TABLE public.worker
  ADD CONSTRAINT worker_final_disposition_check
  CHECK (
    final_disposition IS NULL
    OR final_disposition IN (
      'converted_to_worker',
      'hired_by_client',
      'rejected',
      'withdrawn',
      'disqualified',
      'not_selected'
    )
  );

-- Allow hired_by_client on worker status if not already present
DO $$
BEGIN
  ALTER TABLE public.worker DROP CONSTRAINT IF EXISTS worker_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Prefer soft add of status values via a flexible check that includes hired_by_client
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'worker_status_check'
      AND conrelid = 'public.worker'::regclass
  ) THEN
    ALTER TABLE public.worker
      ADD CONSTRAINT worker_status_check
      CHECK (
        status IS NULL
        OR lower(status) IN (
          'new', 'pending', 'approved', 'disapproved', 'converted',
          'under_review', 'for_approval', 'active', 'inactive',
          'cancelled', 'banned', 'hired_by_client'
        )
      );
  END IF;
EXCEPTION
  WHEN others THEN
    -- Leave existing status constraint if it cannot be altered safely
    NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Position increment helper (transactional fill)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_job_filled_positions(
  p_requisition_id uuid,
  p_allow_overfill boolean DEFAULT false
)
RETURNS TABLE (
  positions_count integer,
  filled_positions integer,
  remaining_positions integer,
  auto_filled boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_positions integer;
  v_filled integer;
  v_status text;
BEGIN
  SELECT jr.positions_count, jr.filled_positions, jr.status
  INTO v_positions, v_filled, v_status
  FROM public.job_requisitions jr
  WHERE jr.id = p_requisition_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job requisition not found';
  END IF;

  IF v_filled >= v_positions AND NOT p_allow_overfill THEN
    RAISE EXCEPTION 'No remaining positions for this job requisition';
  END IF;

  v_filled := v_filled + 1;

  UPDATE public.job_requisitions
  SET
    filled_positions = v_filled,
    status = CASE
      WHEN v_filled >= v_positions AND status IN ('Published', 'Paused') THEN 'Filled'
      ELSE status
    END,
    closed_at = CASE
      WHEN v_filled >= v_positions AND status IN ('Published', 'Paused') THEN now()
      ELSE closed_at
    END,
    updated_at = now()
  WHERE id = p_requisition_id
  RETURNING
    job_requisitions.positions_count,
    job_requisitions.filled_positions,
    (job_requisitions.positions_count - job_requisitions.filled_positions),
    (job_requisitions.status = 'Filled')
  INTO positions_count, filled_positions, remaining_positions, auto_filled;

  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.msps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msp_tenant_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msp_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requisition_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_hire_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msps_staff_all ON public.msps;
CREATE POLICY msps_staff_all ON public.msps
  FOR ALL
  USING (public.user_is_tenant_staff(auth.uid()))
  WITH CHECK (public.user_is_tenant_staff(auth.uid()));

DROP POLICY IF EXISTS msp_tenant_associations_staff_all ON public.msp_tenant_associations;
CREATE POLICY msp_tenant_associations_staff_all ON public.msp_tenant_associations
  FOR ALL
  USING (public.user_is_tenant_staff(auth.uid()))
  WITH CHECK (public.user_is_tenant_staff(auth.uid()));

DROP POLICY IF EXISTS msp_clients_staff_all ON public.msp_clients;
CREATE POLICY msp_clients_staff_all ON public.msp_clients
  FOR ALL
  USING (public.user_is_tenant_staff(auth.uid()))
  WITH CHECK (public.user_is_tenant_staff(auth.uid()));

DROP POLICY IF EXISTS job_requisition_approvals_staff_all ON public.job_requisition_approvals;
CREATE POLICY job_requisition_approvals_staff_all ON public.job_requisition_approvals
  FOR ALL
  USING (public.user_is_tenant_staff(auth.uid()))
  WITH CHECK (public.user_is_tenant_staff(auth.uid()));

DROP POLICY IF EXISTS client_hire_placements_staff_all ON public.client_hire_placements;
CREATE POLICY client_hire_placements_staff_all ON public.client_hire_placements
  FOR ALL
  USING (public.user_is_tenant_staff(auth.uid()))
  WITH CHECK (public.user_is_tenant_staff(auth.uid()));

-- Public SELECT for published jobs with token (already exists for Open; extend status)
DROP POLICY IF EXISTS job_requisitions_public_open_select ON public.job_requisitions;
CREATE POLICY job_requisitions_public_open_select ON public.job_requisitions
  FOR SELECT
  USING (
    status = 'Published'
    AND public_job_token IS NOT NULL
  );

COMMENT ON COLUMN public.job_requisitions.job_number IS
  'Immutable human-readable Job ID (JOB-YYYY-######).';
COMMENT ON COLUMN public.job_requisitions.eor_tenant_id IS
  'Selected employer-of-record tenant when placement_type is Recruit_and_EOR.';
COMMENT ON TABLE public.client_hire_placements IS
  'Recruit-and-Release placements where the client hires directly (no internal payroll worker).';
COMMENT ON TABLE public.msps IS
  'Managed service provider directory for MSP-sourced job requisitions.';
