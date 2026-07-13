-- Job requisition workflow architecture: mappings, applicant instances, resume parsing persistence

-- ---------------------------------------------------------------------------
-- 1. Ensure base job_requisitions exists (remote may already have this)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  external_req_id text,
  msp_name text,
  source_type text NOT NULL DEFAULT 'Internal',
  placement_type text NOT NULL DEFAULT 'Internal',
  employment_type text NOT NULL DEFAULT 'W2',
  location text,
  department text,
  shift_type text,
  hours_per_week integer,
  bill_rate numeric,
  pay_rate numeric,
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
  closed_at timestamptz
);

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS job_role text,
  ADD COLUMN IF NOT EXISTS qualifications text,
  ADD COLUMN IF NOT EXISTS workflow_template_id uuid REFERENCES public.onboarding_flows (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_job_token text,
  ADD COLUMN IF NOT EXISTS workflow_assignment_error text;

CREATE UNIQUE INDEX IF NOT EXISTS job_requisitions_public_job_token_uidx
  ON public.job_requisitions (public_job_token)
  WHERE public_job_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_requisitions_workflow_template_id
  ON public.job_requisitions (workflow_template_id);

CREATE INDEX IF NOT EXISTS idx_job_requisitions_job_role
  ON public.job_requisitions (tenant_id, job_role);

-- Backfill workflow_template_id from legacy text column when it is a UUID
UPDATE public.job_requisitions jr
SET workflow_template_id = jr.onboarding_workflow_id::uuid
WHERE jr.workflow_template_id IS NULL
  AND jr.onboarding_workflow_id IS NOT NULL
  AND jr.onboarding_workflow_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- ---------------------------------------------------------------------------
-- 2. Workflow template mappings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workflow_template_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  job_role text,
  employment_type text,
  placement_type text,
  workflow_template_id uuid NOT NULL REFERENCES public.onboarding_flows (id) ON DELETE RESTRICT,
  priority integer NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_template_mappings_employment_type_chk CHECK (
    employment_type IS NULL OR employment_type IN ('W2', '1099', 'Contract')
  ),
  CONSTRAINT workflow_template_mappings_placement_type_chk CHECK (
    placement_type IS NULL OR placement_type IN ('Internal', 'Recruit_and_Release', 'Recruit_and_EOR')
  ),
  CONSTRAINT workflow_template_mappings_priority_chk CHECK (priority >= 0 AND priority <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_template_mappings_active_combo_uidx
  ON public.workflow_template_mappings (
    tenant_id,
    COALESCE(job_role, ''),
    COALESCE(employment_type, ''),
    COALESCE(placement_type, '')
  )
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS workflow_template_mappings_lookup_idx
  ON public.workflow_template_mappings (tenant_id, is_active, priority DESC);

-- ---------------------------------------------------------------------------
-- 3. Tenant default workflow
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_workflow_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  default_workflow_template_id uuid REFERENCES public.onboarding_flows (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. Master template protection on onboarding flows
-- ---------------------------------------------------------------------------

ALTER TABLE public.onboarding_flows
  ADD COLUMN IF NOT EXISTS is_master_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES public.onboarding_flows (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.workflow_templates
  ADD COLUMN IF NOT EXISTS is_master_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES public.workflow_templates (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 5. Applicant workflow instances (single end-to-end workflow per applicant)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.applicant_workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  job_requisition_id uuid REFERENCES public.job_requisitions (id) ON DELETE SET NULL,
  onboarding_flow_id uuid NOT NULL REFERENCES public.onboarding_flows (id) ON DELETE RESTRICT,
  workflow_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversion_node_id text,
  conversion_status text NOT NULL DEFAULT 'not_started',
  converted_worker_id uuid REFERENCES public.workers (id) ON DELETE SET NULL,
  converted_at timestamptz,
  converted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  worker_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applicant_workflow_instances_conversion_status_chk CHECK (
    conversion_status IN ('not_started', 'ready', 'completed', 'skipped')
  ),
  CONSTRAINT applicant_workflow_instances_worker_type_chk CHECK (
    worker_type IS NULL OR worker_type IN ('w2', '1099', 'contract', 'W2', '1099', 'Contract')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS applicant_workflow_instances_worker_uidx
  ON public.applicant_workflow_instances (worker_id);

CREATE INDEX IF NOT EXISTS applicant_workflow_instances_job_requisition_idx
  ON public.applicant_workflow_instances (job_requisition_id);

-- ---------------------------------------------------------------------------
-- 6. Worker linkage + conversion audit fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS job_requisition_id uuid REFERENCES public.job_requisitions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applicant_workflow_instance_id uuid REFERENCES public.applicant_workflow_instances (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_flow_id uuid REFERENCES public.onboarding_flows (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_worker_id uuid REFERENCES public.workers (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversion_status text;

ALTER TABLE public.worker_onboarding_progress
  ADD COLUMN IF NOT EXISTS applicant_workflow_instance_id uuid REFERENCES public.applicant_workflow_instances (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_flow_id uuid REFERENCES public.onboarding_flows (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_worker_job_requisition_id
  ON public.worker (job_requisition_id);

-- ---------------------------------------------------------------------------
-- 7. Resume parsing persistence + deduplication
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.resume_parsing_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  worker_id uuid REFERENCES public.worker (id) ON DELETE CASCADE,
  resume_file_id uuid REFERENCES public.worker_resumes (id) ON DELETE CASCADE,
  file_hash text NOT NULL,
  parser_provider text NOT NULL DEFAULT 'xai',
  parser_model text NOT NULL,
  parser_version text NOT NULL DEFAULT '1',
  parsing_status text NOT NULL DEFAULT 'pending',
  parsed_json jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resume_parsing_results_status_chk CHECK (
    parsing_status IN ('pending', 'processing', 'completed', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS resume_parsing_results_dedup_uidx
  ON public.resume_parsing_results (tenant_id, file_hash, parser_version)
  WHERE parsing_status IN ('pending', 'processing', 'completed');

CREATE INDEX IF NOT EXISTS resume_parsing_results_worker_idx
  ON public.resume_parsing_results (worker_id, parsing_status);

ALTER TABLE public.worker_resumes
  ADD COLUMN IF NOT EXISTS file_hash text;

-- ---------------------------------------------------------------------------
-- 8. Applicant requisitions junction (if missing)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.applicant_requisitions (
  applicant_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  requisition_id uuid NOT NULL REFERENCES public.job_requisitions (id) ON DELETE CASCADE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  pipeline_status text,
  notes text,
  PRIMARY KEY (applicant_id, requisition_id)
);

CREATE INDEX IF NOT EXISTS idx_applicant_requisitions_requisition_id
  ON public.applicant_requisitions (requisition_id);

-- ---------------------------------------------------------------------------
-- 9. Updated-at triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_generic_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_template_mappings_updated_at ON public.workflow_template_mappings;
CREATE TRIGGER trg_workflow_template_mappings_updated_at
BEFORE UPDATE ON public.workflow_template_mappings
FOR EACH ROW EXECUTE FUNCTION public.set_generic_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_workflow_settings_updated_at ON public.tenant_workflow_settings;
CREATE TRIGGER trg_tenant_workflow_settings_updated_at
BEFORE UPDATE ON public.tenant_workflow_settings
FOR EACH ROW EXECUTE FUNCTION public.set_generic_updated_at();

DROP TRIGGER IF EXISTS trg_applicant_workflow_instances_updated_at ON public.applicant_workflow_instances;
CREATE TRIGGER trg_applicant_workflow_instances_updated_at
BEFORE UPDATE ON public.applicant_workflow_instances
FOR EACH ROW EXECUTE FUNCTION public.set_generic_updated_at();

DROP TRIGGER IF EXISTS trg_resume_parsing_results_updated_at ON public.resume_parsing_results;
CREATE TRIGGER trg_resume_parsing_results_updated_at
BEFORE UPDATE ON public.resume_parsing_results
FOR EACH ROW EXECUTE FUNCTION public.set_generic_updated_at();

-- ---------------------------------------------------------------------------
-- 10. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.workflow_template_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_workflow_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_parsing_results ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_template_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_workflow_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_workflow_instances TO authenticated;
GRANT SELECT ON public.resume_parsing_results TO authenticated;

GRANT ALL ON public.workflow_template_mappings TO service_role;
GRANT ALL ON public.tenant_workflow_settings TO service_role;
GRANT ALL ON public.applicant_workflow_instances TO service_role;
GRANT ALL ON public.resume_parsing_results TO service_role;

DROP POLICY IF EXISTS workflow_template_mappings_staff ON public.workflow_template_mappings;
CREATE POLICY workflow_template_mappings_staff
  ON public.workflow_template_mappings FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS tenant_workflow_settings_staff ON public.tenant_workflow_settings;
CREATE POLICY tenant_workflow_settings_staff
  ON public.tenant_workflow_settings FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS applicant_workflow_instances_staff ON public.applicant_workflow_instances;
CREATE POLICY applicant_workflow_instances_staff
  ON public.applicant_workflow_instances FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS applicant_workflow_instances_own ON public.applicant_workflow_instances;
CREATE POLICY applicant_workflow_instances_own
  ON public.applicant_workflow_instances FOR SELECT TO authenticated
  USING (public.worker_belongs_to_auth(worker_id));

DROP POLICY IF EXISTS resume_parsing_results_staff ON public.resume_parsing_results;
CREATE POLICY resume_parsing_results_staff
  ON public.resume_parsing_results FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

-- Public read for active job requisitions by token (anon apply links)
ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_requisitions_public_active ON public.job_requisitions;
CREATE POLICY job_requisitions_public_active
  ON public.job_requisitions FOR SELECT TO anon, authenticated
  USING (
    status = 'Open'
    AND public_job_token IS NOT NULL
  );

COMMENT ON TABLE public.workflow_template_mappings IS
  'Maps job attributes to onboarding workflow templates with priority-based matching.';
COMMENT ON TABLE public.applicant_workflow_instances IS
  'Per-applicant pinned workflow snapshot for job-based applications.';
COMMENT ON TABLE public.resume_parsing_results IS
  'Deduplicated resume parse results keyed by tenant, file hash, and parser version.';

-- Flow-based applicant step progress (nullable tenant step FK)
ALTER TABLE public.worker_onboarding_step_progress
  DROP CONSTRAINT IF EXISTS worker_onboarding_step_progress_onboarding_step_id_fkey;
ALTER TABLE public.worker_onboarding_step_progress
  ALTER COLUMN onboarding_step_id DROP NOT NULL;
ALTER TABLE public.worker_onboarding_step_progress
  ADD COLUMN IF NOT EXISTS flow_step_id text;
CREATE UNIQUE INDEX IF NOT EXISTS worker_onboarding_step_progress_flow_step_uidx
  ON public.worker_onboarding_step_progress (worker_onboarding_progress_id, flow_step_id)
  WHERE flow_step_id IS NOT NULL;
ALTER TABLE public.worker_onboarding_step_progress
  DROP CONSTRAINT IF EXISTS worker_onboarding_step_progress_step_ref_chk;
ALTER TABLE public.worker_onboarding_step_progress
  ADD CONSTRAINT worker_onboarding_step_progress_step_ref_chk
  CHECK (onboarding_step_id IS NOT NULL OR flow_step_id IS NOT NULL);
