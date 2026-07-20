-- Optional routing metadata on published tenant workflows (UI validation only; runtime uses workflow_mappings).

ALTER TABLE public.onboarding_flows
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS profession_id uuid REFERENCES public.professions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placement_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onboarding_flows_employment_type_chk'
      AND conrelid = 'public.onboarding_flows'::regclass
  ) THEN
    ALTER TABLE public.onboarding_flows
      ADD CONSTRAINT onboarding_flows_employment_type_chk
      CHECK (employment_type IS NULL OR employment_type IN ('W2', '1099', 'Contract'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onboarding_flows_placement_type_chk'
      AND conrelid = 'public.onboarding_flows'::regclass
  ) THEN
    ALTER TABLE public.onboarding_flows
      ADD CONSTRAINT onboarding_flows_placement_type_chk
      CHECK (
        placement_type IS NULL OR placement_type IN ('Internal', 'Recruit_and_Release', 'Recruit_and_EOR')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS onboarding_flows_routing_metadata_idx
  ON public.onboarding_flows (tenant_id, employment_type, profession_id, placement_type)
  WHERE status = 'published';
