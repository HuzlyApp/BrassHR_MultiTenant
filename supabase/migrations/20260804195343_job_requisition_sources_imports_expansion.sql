-- =============================================================================
-- brassHR Job Requisition / Job Posting model expansion
-- Migration: 20260804195343_job_requisition_sources_imports_expansion
--
-- Compatibility decisions (live schema is source of truth):
-- * Reuse public.job_requisitions (do not recreate).
-- * Reuse public.onboarding_flows via existing workflow_id / workflow_template_id
--   FKs. Do NOT create onboarding_workflow_templates.
-- * Reuse public.applicant_requisitions for applicant↔ requisition linkage.
-- * Reuse public.worker_assignments for hire/placement snapshots.
-- * public.msps remains the MSP entity table; public.job_sources is the
--   import/portal source catalog (global + tenant-scoped).
-- * Keep established Title-Case value conventions for source_type,
--   employment_type, placement_type, and eor_type (Tenant/MSP/...).
-- * Spec field mappings to existing columns (no duplicate columns added):
--   - number_of_positions        → positions_count
--   - years_of_experience (int)  → years_experience_required
--   - years_of_experience (text) → years_of_experience (already present)
--   - source_description         → source_job_details
--   - onboarding_workflow_template_id → workflow_id (onboarding_flows)
--   - recruiter_notes            → applicant_requisitions.notes
--   - job_requisition_id (assign)→ worker_assignments.requisition_id
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) job_sources
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  portal_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_sources_name_nonempty_chk CHECK (char_length(trim(name)) > 0),
  CONSTRAINT job_sources_code_nonempty_chk CHECK (
    code IS NULL OR char_length(trim(code)) > 0
  )
);

COMMENT ON TABLE public.job_sources IS
  'Global (tenant_id IS NULL) and tenant-specific job import/portal sources.';

CREATE UNIQUE INDEX IF NOT EXISTS job_sources_global_code_uidx
  ON public.job_sources (lower(trim(code)))
  WHERE tenant_id IS NULL AND code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_sources_tenant_code_uidx
  ON public.job_sources (tenant_id, lower(trim(code)))
  WHERE tenant_id IS NOT NULL AND code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_sources_global_name_uidx
  ON public.job_sources (lower(trim(name)))
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS job_sources_tenant_active_idx
  ON public.job_sources (tenant_id, is_active);

DROP TRIGGER IF EXISTS set_job_sources_updated_at ON public.job_sources;
CREATE TRIGGER set_job_sources_updated_at
BEFORE UPDATE ON public.job_sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_sources_staff_read ON public.job_sources;
CREATE POLICY job_sources_staff_read
  ON public.job_sources
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL
    OR public.user_is_tenant_staff(tenant_id)
  );

DROP POLICY IF EXISTS job_sources_admin_insert ON public.job_sources;
CREATE POLICY job_sources_admin_insert
  ON public.job_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IS NOT NULL
    AND public.user_is_tenant_admin(tenant_id)
  );

DROP POLICY IF EXISTS job_sources_admin_update ON public.job_sources;
CREATE POLICY job_sources_admin_update
  ON public.job_sources
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND public.user_is_tenant_admin(tenant_id)
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND public.user_is_tenant_admin(tenant_id)
  );

DROP POLICY IF EXISTS job_sources_admin_delete ON public.job_sources;
CREATE POLICY job_sources_admin_delete
  ON public.job_sources
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND public.user_is_tenant_admin(tenant_id)
  );

GRANT SELECT ON public.job_sources TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.job_sources TO authenticated;
GRANT ALL ON public.job_sources TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Expand job_requisitions (additive only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS job_source_id uuid,
  ADD COLUMN IF NOT EXISTS eor_type text,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hot_job boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_match_enabled boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_requisitions_job_source_id_fkey'
      AND conrelid = 'public.job_requisitions'::regclass
  ) THEN
    ALTER TABLE public.job_requisitions
      ADD CONSTRAINT job_requisitions_job_source_id_fkey
      FOREIGN KEY (job_source_id)
      REFERENCES public.job_sources (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Preserve established Title-Case conventions; expand eor_type for Self/External.
ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_eor_type_check;
ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_eor_type_check
  CHECK (
    eor_type IS NULL
    OR eor_type = ANY (ARRAY['Tenant'::text, 'MSP'::text, 'Self'::text, 'External'::text])
  );

-- Published jobs must expose public title + description (safe: live data clean).
ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_published_public_fields_chk;
ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_published_public_fields_chk
  CHECK (
    status IS DISTINCT FROM 'published'
    AND status IS DISTINCT FROM 'Published'
    AND status IS DISTINCT FROM 'Open'
    OR (
      char_length(trim(COALESCE(public_title, ''))) > 0
      AND char_length(trim(COALESCE(public_description, description, ''))) > 0
    )
  ) NOT VALID;

ALTER TABLE public.job_requisitions
  VALIDATE CONSTRAINT job_requisitions_published_public_fields_chk;

-- MSP rows that set job_source_id must also have external_req_id.
-- Kept NOT VALID initially so historical MSP rows without job_source_id remain valid.
ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_msp_job_source_required_chk;
ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_msp_job_source_required_chk
  CHECK (
    source_type IS DISTINCT FROM 'MSP'
    OR status = ANY (ARRAY['Draft'::text, 'draft'::text, 'Pending_Approval'::text, 'Cancelled'::text])
    OR (
      job_source_id IS NOT NULL
      AND external_req_id IS NOT NULL
      AND char_length(trim(external_req_id)) > 0
    )
    OR (
      -- Legacy path still allowed until all MSP jobs adopt job_source_id
      (msp_id IS NOT NULL OR (msp_name IS NOT NULL AND char_length(trim(msp_name)) > 0))
      AND external_req_id IS NOT NULL
      AND char_length(trim(external_req_id)) > 0
    )
  ) NOT VALID;

ALTER TABLE public.job_requisitions
  VALIDATE CONSTRAINT job_requisitions_msp_job_source_required_chk;

UPDATE public.job_requisitions
SET is_published = true
WHERE is_published = false
  AND (
    status IN ('published', 'Published', 'Open')
    OR published_at IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS job_requisitions_tenant_source_type_idx
  ON public.job_requisitions (tenant_id, source_type);

CREATE INDEX IF NOT EXISTS job_requisitions_tenant_placement_type_idx
  ON public.job_requisitions (tenant_id, placement_type);

CREATE INDEX IF NOT EXISTS job_requisitions_job_source_id_idx
  ON public.job_requisitions (job_source_id);

CREATE INDEX IF NOT EXISTS job_requisitions_tenant_published_status_idx
  ON public.job_requisitions (tenant_id, is_published, status);

CREATE UNIQUE INDEX IF NOT EXISTS job_requisitions_msp_source_external_uidx
  ON public.job_requisitions (
    tenant_id,
    job_source_id,
    lower(trim(external_req_id))
  )
  WHERE job_source_id IS NOT NULL
    AND external_req_id IS NOT NULL
    AND char_length(trim(external_req_id)) > 0
    AND status IS DISTINCT FROM 'Cancelled'
    AND status IS DISTINCT FROM 'cancelled';

COMMENT ON COLUMN public.job_requisitions.job_source_id IS
  'Optional FK to job_sources for MSP/import provenance. Complements legacy msp_id.';
COMMENT ON COLUMN public.job_requisitions.eor_type IS
  'EOR classification: Tenant | MSP | Self | External. Complements eor_tenant_id.';
COMMENT ON COLUMN public.job_requisitions.is_published IS
  'Denormalized publish flag; keep in sync with status/published_at in application code.';
COMMENT ON COLUMN public.job_requisitions.source_job_details IS
  'Maps to specification field source_description.';
COMMENT ON COLUMN public.job_requisitions.positions_count IS
  'Maps to specification field number_of_positions.';
COMMENT ON COLUMN public.job_requisitions.years_experience_required IS
  'Maps to specification integer years_of_experience.';
COMMENT ON COLUMN public.job_requisitions.workflow_id IS
  'Assigned published onboarding_flows row. Maps to onboarding_workflow_template_id.';

-- ---------------------------------------------------------------------------
-- 3) job_import_batches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  job_source_id uuid REFERENCES public.job_sources (id) ON DELETE SET NULL,
  source_file_name text,
  source_type text,
  status text NOT NULL DEFAULT 'uploaded',
  ai_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_import_batches_status_chk CHECK (
    status = ANY (ARRAY[
      'uploaded'::text,
      'analyzing'::text,
      'ready'::text,
      'imported'::text,
      'archived'::text,
      'failed'::text
    ])
  ),
  CONSTRAINT job_import_batches_source_type_chk CHECK (
    source_type IS NULL
    OR source_type = ANY (ARRAY['Internal'::text, 'MSP'::text, 'internal'::text, 'msp'::text])
  )
);

CREATE INDEX IF NOT EXISTS job_import_batches_tenant_status_idx
  ON public.job_import_batches (tenant_id, status);

CREATE INDEX IF NOT EXISTS job_import_batches_job_source_id_idx
  ON public.job_import_batches (job_source_id);

DROP TRIGGER IF EXISTS set_job_import_batches_updated_at ON public.job_import_batches;
CREATE TRIGGER set_job_import_batches_updated_at
BEFORE UPDATE ON public.job_import_batches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.job_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_import_batches_staff_all ON public.job_import_batches;
CREATE POLICY job_import_batches_staff_all
  ON public.job_import_batches
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_import_batches TO authenticated;
GRANT ALL ON public.job_import_batches TO service_role;

-- ---------------------------------------------------------------------------
-- 4) job_import_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.job_import_batches (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_req_id text,
  source_job_title text,
  bill_rate numeric(10, 2),
  pay_rate_estimate numeric(10, 2),
  margin_estimate numeric(10, 2),
  rank_score numeric,
  recommended boolean NOT NULL DEFAULT false,
  selected_for_import boolean NOT NULL DEFAULT false,
  imported_requisition_id uuid REFERENCES public.job_requisitions (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_import_items_status_chk CHECK (
    status = ANY (ARRAY[
      'pending'::text,
      'imported'::text,
      'skipped'::text,
      'failed'::text
    ])
  ),
  CONSTRAINT job_import_items_bill_rate_chk CHECK (
    bill_rate IS NULL OR bill_rate >= 0
  ),
  CONSTRAINT job_import_items_pay_rate_estimate_chk CHECK (
    pay_rate_estimate IS NULL OR pay_rate_estimate >= 0
  )
);

CREATE INDEX IF NOT EXISTS job_import_items_tenant_batch_idx
  ON public.job_import_items (tenant_id, batch_id);

CREATE INDEX IF NOT EXISTS job_import_items_batch_status_idx
  ON public.job_import_items (batch_id, status);

CREATE INDEX IF NOT EXISTS job_import_items_imported_requisition_idx
  ON public.job_import_items (imported_requisition_id);

DROP TRIGGER IF EXISTS set_job_import_items_updated_at ON public.job_import_items;
CREATE TRIGGER set_job_import_items_updated_at
BEFORE UPDATE ON public.job_import_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_job_import_item_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.job_import_batches b
    WHERE b.id = NEW.batch_id
      AND b.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'job_import_items.tenant_id must match job_import_batches.tenant_id';
  END IF;

  IF NEW.imported_requisition_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.job_requisitions jr
    WHERE jr.id = NEW.imported_requisition_id
      AND jr.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'imported_requisition_id must belong to the same tenant';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_import_items_tenant_integrity ON public.job_import_items;
CREATE TRIGGER trg_job_import_items_tenant_integrity
BEFORE INSERT OR UPDATE ON public.job_import_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_job_import_item_tenant();

ALTER TABLE public.job_import_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_import_items_staff_all ON public.job_import_items;
CREATE POLICY job_import_items_staff_all
  ON public.job_import_items
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_import_items TO authenticated;
GRANT ALL ON public.job_import_items TO service_role;

-- ---------------------------------------------------------------------------
-- 5) applicant_requisitions AI / audit fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.applicant_requisitions
  ADD COLUMN IF NOT EXISTS ai_match_score numeric,
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.applicant_requisitions.notes IS
  'Recruiter notes (specification field recruiter_notes).';
COMMENT ON COLUMN public.applicant_requisitions.pipeline_status IS
  'Applicant pipeline stage for this requisition.';

DROP TRIGGER IF EXISTS set_applicant_requisitions_updated_at ON public.applicant_requisitions;
CREATE TRIGGER set_applicant_requisitions_updated_at
BEFORE UPDATE ON public.applicant_requisitions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6) worker_assignments hire snapshot fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.worker_assignments
  ADD COLUMN IF NOT EXISTS rate_unit text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.worker_assignments
  DROP CONSTRAINT IF EXISTS worker_assignments_rate_unit_check;
ALTER TABLE public.worker_assignments
  ADD CONSTRAINT worker_assignments_rate_unit_check
  CHECK (
    rate_unit IS NULL
    OR rate_unit = ANY (ARRAY[
      'Hour'::text, 'Day'::text, 'Week'::text, 'Month'::text, 'Year'::text, 'Flat'::text
    ])
  );

-- Expand eor_type to include Self/External while preserving Title-Case convention.
ALTER TABLE public.worker_assignments
  DROP CONSTRAINT IF EXISTS worker_assignments_eor_type_check;
ALTER TABLE public.worker_assignments
  ADD CONSTRAINT worker_assignments_eor_type_check
  CHECK (
    eor_type IS NULL
    OR eor_type = ANY (ARRAY['Tenant'::text, 'MSP'::text, 'Self'::text, 'External'::text])
  );

COMMENT ON COLUMN public.worker_assignments.requisition_id IS
  'Maps to specification field job_requisition_id.';

DROP TRIGGER IF EXISTS set_worker_assignments_updated_at ON public.worker_assignments;
CREATE TRIGGER set_worker_assignments_updated_at
BEFORE UPDATE ON public.worker_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7) Seed global job sources (idempotent by global code)
-- ---------------------------------------------------------------------------
INSERT INTO public.job_sources (tenant_id, name, code, is_active)
SELECT NULL, v.name, v.code, true
FROM (
  VALUES
    ('Internal', 'internal'),
    ('Aya Healthcare', 'aya_healthcare'),
    ('Randstad', 'randstad'),
    ('LotusOne', 'lotusone'),
    ('Aptiv Arc', 'aptiv_arc'),
    ('Elevate', 'elevate')
) AS v(name, code)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.job_sources s
  WHERE s.tenant_id IS NULL
    AND lower(trim(s.code)) = lower(trim(v.code))
);
