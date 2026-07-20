-- Optional routing metadata on published tenant workflows (UI validation only; runtime uses workflow_mappings).

ALTER TABLE public.onboarding_flows
  ADD COLUMN IF NOT EXISTS employment_type text;

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

CREATE INDEX IF NOT EXISTS onboarding_flows_employment_type_idx
  ON public.onboarding_flows (tenant_id, employment_type)
  WHERE status = 'published';
