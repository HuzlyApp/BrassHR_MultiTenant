-- Align legacy applicant_workflow_instances with job-application workflow snapshots.
-- Staging already had an older table (worker_id + onboarding_flow_id), so
-- CREATE TABLE IF NOT EXISTS in earlier migrations never applied the new columns.

ALTER TABLE public.applicant_workflow_instances
  ADD COLUMN IF NOT EXISTS application_id uuid,
  ADD COLUMN IF NOT EXISTS workflow_id uuid,
  ADD COLUMN IF NOT EXISTS workflow_name text,
  ADD COLUMN IF NOT EXISTS workflow_version text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Legacy NOT NULL columns block job-application inserts that only set the new fields.
ALTER TABLE public.applicant_workflow_instances
  ALTER COLUMN worker_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applicant_workflow_instances'
      AND column_name = 'onboarding_flow_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.applicant_workflow_instances
      ALTER COLUMN onboarding_flow_id DROP NOT NULL;
  END IF;
END $$;

-- Backfill from legacy columns where present.
UPDATE public.applicant_workflow_instances
SET workflow_id = onboarding_flow_id
WHERE workflow_id IS NULL
  AND onboarding_flow_id IS NOT NULL;

UPDATE public.applicant_workflow_instances awi
SET workflow_name = COALESCE(awi.workflow_name, f.name, 'Workflow')
FROM public.onboarding_flows f
WHERE awi.workflow_id = f.id
  AND (awi.workflow_name IS NULL OR btrim(awi.workflow_name) = '');

UPDATE public.applicant_workflow_instances
SET workflow_name = COALESCE(NULLIF(btrim(workflow_name), ''), 'Workflow')
WHERE workflow_name IS NULL OR btrim(workflow_name) = '';

UPDATE public.applicant_workflow_instances
SET workflow_version = COALESCE(
  NULLIF(btrim(workflow_version), ''),
  to_char(COALESCE(updated_at, created_at, now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)
WHERE workflow_version IS NULL OR btrim(workflow_version) = '';

UPDATE public.applicant_workflow_instances
SET status = COALESCE(NULLIF(btrim(status), ''), 'in_progress')
WHERE status IS NULL OR btrim(status) = '';

UPDATE public.applicant_workflow_instances
SET started_at = COALESCE(started_at, created_at, now())
WHERE started_at IS NULL;

-- Defaults for new rows.
ALTER TABLE public.applicant_workflow_instances
  ALTER COLUMN workflow_snapshot SET DEFAULT '{}'::jsonb,
  ALTER COLUMN status SET DEFAULT 'in_progress',
  ALTER COLUMN started_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applicant_workflow_instances_application_id_fkey'
      AND conrelid = 'public.applicant_workflow_instances'::regclass
  ) THEN
    ALTER TABLE public.applicant_workflow_instances
      ADD CONSTRAINT applicant_workflow_instances_application_id_fkey
      FOREIGN KEY (application_id)
      REFERENCES public.job_applications (id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applicant_workflow_instances_workflow_id_fkey'
      AND conrelid = 'public.applicant_workflow_instances'::regclass
  ) THEN
    ALTER TABLE public.applicant_workflow_instances
      ADD CONSTRAINT applicant_workflow_instances_workflow_id_fkey
      FOREIGN KEY (workflow_id)
      REFERENCES public.onboarding_flows (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS applicant_workflow_instances_application_id_uidx
  ON public.applicant_workflow_instances (application_id)
  WHERE application_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applicant_workflow_instances_status_chk'
      AND conrelid = 'public.applicant_workflow_instances'::regclass
  ) THEN
    ALTER TABLE public.applicant_workflow_instances
      ADD CONSTRAINT applicant_workflow_instances_status_chk
      CHECK (status IN ('not_started', 'in_progress', 'completed', 'abandoned'));
  END IF;
END $$;
