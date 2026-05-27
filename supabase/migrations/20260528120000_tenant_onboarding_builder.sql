-- Tenant-scoped onboarding builder metadata (draft/publish, workflow canvas state)

ALTER TABLE public.tenant_onboarding_configs
  ADD COLUMN IF NOT EXISTS flow_name text NOT NULL DEFAULT 'Worker onboarding',
  ADD COLUMN IF NOT EXISTS publish_status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS builder_draft jsonb,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.tenant_onboarding_configs
    ADD CONSTRAINT tenant_onboarding_configs_publish_status_chk
    CHECK (publish_status IN ('draft', 'published'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.tenant_onboarding_configs.flow_name IS
  'Display name for the tenant applicant onboarding flow in the builder.';
COMMENT ON COLUMN public.tenant_onboarding_configs.publish_status IS
  'draft: builder changes not yet live for applicants; published: steps are active.';
COMMENT ON COLUMN public.tenant_onboarding_configs.builder_draft IS
  'Serialized workflow builder canvas (nodes/edges) for draft edits.';
