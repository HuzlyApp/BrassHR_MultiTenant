-- Tenant-configurable Skill Assessment catalog with draft/publish snapshots.
-- Published JSON is what new applicants see. Completed skill_assessments rows are not mutated.

CREATE TABLE IF NOT EXISTS public.tenant_skill_assessment_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  allow_skip boolean NOT NULL DEFAULT true,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  published jsonb,
  published_version integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  draft_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_skill_assessment_settings IS
  'Per-tenant Skill Assessment quiz configuration. Draft is edited by admins; published is served to new applicants.';

CREATE INDEX IF NOT EXISTS tenant_skill_assessment_settings_updated_idx
  ON public.tenant_skill_assessment_settings (updated_at DESC);

DROP TRIGGER IF EXISTS set_tenant_skill_assessment_settings_updated_at
  ON public.tenant_skill_assessment_settings;
CREATE TRIGGER set_tenant_skill_assessment_settings_updated_at
BEFORE UPDATE ON public.tenant_skill_assessment_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tenant_skill_assessment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_skill_assessment_settings_staff ON public.tenant_skill_assessment_settings;
CREATE POLICY tenant_skill_assessment_settings_staff
  ON public.tenant_skill_assessment_settings
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_skill_assessment_settings TO authenticated;
GRANT ALL ON public.tenant_skill_assessment_settings TO service_role;
