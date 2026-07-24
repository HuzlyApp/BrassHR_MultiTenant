-- Workflow routing uses profession + employment type only.

DROP INDEX IF EXISTS public.workflow_mappings_active_criteria_uidx;
DROP INDEX IF EXISTS public.workflow_mappings_lookup_idx;

ALTER TABLE public.workflow_mappings
  DROP COLUMN IF EXISTS placement_type;

DROP INDEX IF EXISTS public.workflow_mappings_active_criteria_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS workflow_mappings_active_criteria_uidx
  ON public.workflow_mappings (tenant_id, profession_id, employment_type)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS workflow_mappings_lookup_idx
  ON public.workflow_mappings (tenant_id, profession_id, employment_type, priority)
  WHERE is_active = true;
