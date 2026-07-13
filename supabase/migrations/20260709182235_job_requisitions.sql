-- Job requisitions, applicant linkage, and worker assignments (internal + MSP placements).
-- Tenant FK uses public.tenants (not public.clients). User FKs use auth.users per project convention.

-- ---------------------------------------------------------------------------
-- job_requisitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,

  title text NOT NULL,
  description text,

  external_req_id text,
  msp_name text,

  source_type text NOT NULL,
  placement_type text NOT NULL,
  employment_type text NOT NULL,

  location text,
  department text,
  shift_type text,
  hours_per_week integer,

  bill_rate numeric(10, 2),
  pay_rate numeric(10, 2),

  job_duration text,
  facility_name text,
  shift_details text,
  target_start_date date,

  required_credentials jsonb NOT NULL DEFAULT '[]'::jsonb,

  onboarding_workflow_id text,
  onboarding_workflow_override jsonb,

  status text NOT NULL DEFAULT 'Draft',

  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  assigned_recruiter uuid REFERENCES auth.users (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,

  CONSTRAINT job_requisitions_source_type_check
    CHECK (source_type IN ('Internal', 'MSP')),

  CONSTRAINT job_requisitions_placement_type_check
    CHECK (placement_type IN ('Internal', 'Recruit_and_Release', 'Recruit_and_EOR')),

  CONSTRAINT job_requisitions_employment_type_check
    CHECK (employment_type IN ('W2', '1099', 'Contract')),

  CONSTRAINT job_requisitions_status_check
    CHECK (status IN ('Draft', 'Open', 'Paused', 'Closed', 'Filled')),

  CONSTRAINT job_requisitions_valid_msp_info_check
    CHECK (
      (
        source_type = 'MSP'
        AND external_req_id IS NOT NULL
        AND msp_name IS NOT NULL
      )
      OR source_type = 'Internal'
    ),

  CONSTRAINT job_requisitions_valid_placement_check
    CHECK (
      (
        source_type = 'Internal'
        AND placement_type = 'Internal'
      )
      OR (
        source_type = 'MSP'
        AND placement_type IN ('Recruit_and_Release', 'Recruit_and_EOR')
      )
    ),

  CONSTRAINT job_requisitions_hours_per_week_check
    CHECK (hours_per_week IS NULL OR hours_per_week > 0),

  CONSTRAINT job_requisitions_bill_rate_check
    CHECK (bill_rate IS NULL OR bill_rate >= 0),

  CONSTRAINT job_requisitions_pay_rate_check
    CHECK (pay_rate IS NULL OR pay_rate >= 0)
);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_tenant_id
  ON public.job_requisitions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_status
  ON public.job_requisitions (status);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_assigned_recruiter
  ON public.job_requisitions (assigned_recruiter);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_source_type
  ON public.job_requisitions (source_type);

COMMENT ON TABLE public.job_requisitions IS
  'Tenant-scoped job requisitions for internal hires and MSP-sourced placements.';

-- ---------------------------------------------------------------------------
-- applicant_requisitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applicant_requisitions (
  applicant_id uuid NOT NULL REFERENCES public.applicants (id) ON DELETE CASCADE,
  requisition_id uuid NOT NULL REFERENCES public.job_requisitions (id) ON DELETE CASCADE,

  applied_at timestamptz NOT NULL DEFAULT now(),
  pipeline_status text,
  notes text,

  PRIMARY KEY (applicant_id, requisition_id)
);

CREATE INDEX IF NOT EXISTS idx_applicant_requisitions_applicant_id
  ON public.applicant_requisitions (applicant_id);

CREATE INDEX IF NOT EXISTS idx_applicant_requisitions_requisition_id
  ON public.applicant_requisitions (requisition_id);

COMMENT ON TABLE public.applicant_requisitions IS
  'Many-to-many link between applicants and job requisitions with pipeline tracking.';

-- ---------------------------------------------------------------------------
-- worker_assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  worker_id uuid NOT NULL REFERENCES public.workers (id) ON DELETE CASCADE,
  requisition_id uuid REFERENCES public.job_requisitions (id) ON DELETE SET NULL,

  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,

  placement_type text,
  eor_type text,
  msp_name text,

  bill_rate numeric(10, 2),
  pay_rate numeric(10, 2),

  assignment_start date,
  assignment_end date,

  status text NOT NULL DEFAULT 'Active',

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT worker_assignments_placement_type_check
    CHECK (
      placement_type IS NULL
      OR placement_type IN ('Internal', 'Recruit_and_Release', 'Recruit_and_EOR')
    ),

  CONSTRAINT worker_assignments_eor_type_check
    CHECK (eor_type IS NULL OR eor_type IN ('Tenant', 'MSP')),

  CONSTRAINT worker_assignments_status_check
    CHECK (status IN ('Active', 'Completed', 'Ended', 'Cancelled')),

  CONSTRAINT worker_assignments_bill_rate_check
    CHECK (bill_rate IS NULL OR bill_rate >= 0),

  CONSTRAINT worker_assignments_pay_rate_check
    CHECK (pay_rate IS NULL OR pay_rate >= 0),

  CONSTRAINT worker_assignments_date_range_check
    CHECK (
      assignment_end IS NULL
      OR assignment_start IS NULL
      OR assignment_end >= assignment_start
    ),

  CONSTRAINT worker_assignments_eor_logic_check
    CHECK (
      (placement_type IS DISTINCT FROM 'Recruit_and_EOR' OR eor_type IS NOT NULL)
      AND (eor_type IS DISTINCT FROM 'MSP' OR msp_name IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_worker_assignments_worker_id
  ON public.worker_assignments (worker_id);

CREATE INDEX IF NOT EXISTS idx_worker_assignments_requisition_id
  ON public.worker_assignments (requisition_id);

CREATE INDEX IF NOT EXISTS idx_worker_assignments_tenant_id
  ON public.worker_assignments (tenant_id);

COMMENT ON TABLE public.worker_assignments IS
  'Worker placement records tied to job requisitions (internal, recruit-and-release, or EOR).';

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuse shared helper from interview_scheduling_tables)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_job_requisitions_updated_at ON public.job_requisitions;

CREATE TRIGGER set_job_requisitions_updated_at
BEFORE UPDATE ON public.job_requisitions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_requisitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_requisitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_assignments TO authenticated;

GRANT ALL ON public.job_requisitions TO service_role;
GRANT ALL ON public.applicant_requisitions TO service_role;
GRANT ALL ON public.worker_assignments TO service_role;

DROP POLICY IF EXISTS job_requisitions_staff ON public.job_requisitions;
CREATE POLICY job_requisitions_staff
  ON public.job_requisitions
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS applicant_requisitions_staff ON public.applicant_requisitions;
CREATE POLICY applicant_requisitions_staff
  ON public.applicant_requisitions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applicants a
      JOIN public.job_requisitions jr
        ON jr.id = applicant_requisitions.requisition_id
       AND jr.tenant_id = a.tenant_id
      WHERE a.id = applicant_requisitions.applicant_id
        AND public.user_is_tenant_staff(a.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applicants a
      JOIN public.job_requisitions jr
        ON jr.id = applicant_requisitions.requisition_id
       AND jr.tenant_id = a.tenant_id
      WHERE a.id = applicant_requisitions.applicant_id
        AND public.user_is_tenant_staff(a.tenant_id)
    )
  );

DROP POLICY IF EXISTS worker_assignments_staff ON public.worker_assignments;
CREATE POLICY worker_assignments_staff
  ON public.worker_assignments
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1
      FROM public.workers w
      WHERE w.id = worker_assignments.worker_id
        AND w.tenant_id = worker_assignments.tenant_id
    )
    AND (
      worker_assignments.requisition_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.job_requisitions jr
        WHERE jr.id = worker_assignments.requisition_id
          AND jr.tenant_id = worker_assignments.tenant_id
      )
    )
  );

DROP POLICY IF EXISTS worker_assignments_worker_read ON public.worker_assignments;
CREATE POLICY worker_assignments_worker_read
  ON public.worker_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workers w
      WHERE w.id = worker_assignments.worker_id
        AND public.approved_applicant_owns_worker(w.candidate_id)
    )
  );
