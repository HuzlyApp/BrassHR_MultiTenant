-- Expand workflow mapping criteria beyond profession + employment type.
-- Optional attributes (NULL = wildcard) enable most-specific matching.
-- Jobs record whether workflow assignment was automatic or manually overridden.

-- Allow Contract (R&R) on employment-typed presets / flows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onboarding_templates_employment_type_chk'
      AND conrelid = 'public.onboarding_templates'::regclass
  ) THEN
    ALTER TABLE public.onboarding_templates
      DROP CONSTRAINT onboarding_templates_employment_type_chk;
  END IF;

  ALTER TABLE public.onboarding_templates
    ADD CONSTRAINT onboarding_templates_employment_type_chk
    CHECK (employment_type IS NULL OR employment_type IN ('W2', '1099', 'Contract'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onboarding_flows_employment_type_chk'
      AND conrelid = 'public.onboarding_flows'::regclass
  ) THEN
    ALTER TABLE public.onboarding_flows
      DROP CONSTRAINT onboarding_flows_employment_type_chk;
  END IF;

  ALTER TABLE public.onboarding_flows
    ADD CONSTRAINT onboarding_flows_employment_type_chk
    CHECK (employment_type IS NULL OR employment_type IN ('W2', '1099', 'Contract'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional matching attributes on workflow_mappings (NULL = matches any).
ALTER TABLE public.workflow_mappings
  ALTER COLUMN profession_id DROP NOT NULL;

ALTER TABLE public.workflow_mappings
  ADD COLUMN IF NOT EXISTS specialty_id uuid REFERENCES public.specialties (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS location_type text,
  ADD COLUMN IF NOT EXISTS years_of_experience text;

-- Replace exact profession+employment uniqueness with full criteria uniqueness.
DROP INDEX IF EXISTS public.workflow_mappings_active_criteria_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_mappings_active_criteria_uidx
  ON public.workflow_mappings (
    tenant_id,
    employment_type,
    COALESCE(profession_id::text, ''),
    COALESCE(specialty_id::text, ''),
    COALESCE(lower(btrim(location)), ''),
    COALESCE(lower(btrim(location_type)), ''),
    COALESCE(lower(btrim(years_of_experience)), '')
  )
  WHERE is_active = true;

DROP INDEX IF EXISTS public.workflow_mappings_lookup_idx;

CREATE INDEX IF NOT EXISTS workflow_mappings_lookup_idx
  ON public.workflow_mappings (
    tenant_id,
    employment_type,
    is_active,
    priority
  );

-- Job assignment provenance + manual override support.
ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS workflow_assignment_mode text NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS workflow_mapping_id uuid REFERENCES public.workflow_mappings (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workflow_assignment_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_requisitions_workflow_assignment_mode_chk'
      AND conrelid = 'public.job_requisitions'::regclass
  ) THEN
    ALTER TABLE public.job_requisitions
      ADD CONSTRAINT job_requisitions_workflow_assignment_mode_chk
      CHECK (workflow_assignment_mode IN ('automatic', 'manual'));
  END IF;
END $$;

COMMENT ON COLUMN public.workflow_mappings.specialty_id IS
  'Optional specialty criterion. NULL matches any specialty.';
COMMENT ON COLUMN public.workflow_mappings.location IS
  'Optional job location criterion (case-insensitive). NULL matches any location.';
COMMENT ON COLUMN public.workflow_mappings.location_type IS
  'Optional location type criterion (e.g. On-site). NULL matches any type.';
COMMENT ON COLUMN public.workflow_mappings.years_of_experience IS
  'Optional years-of-experience criterion. NULL matches any value.';
COMMENT ON COLUMN public.job_requisitions.workflow_assignment_mode IS
  'automatic = resolved from mappings/defaults; manual = admin override (not replaced on attribute changes).';
