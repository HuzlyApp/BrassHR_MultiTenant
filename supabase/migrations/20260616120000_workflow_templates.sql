-- Workflow builder templates (presets + tenant saved templates)

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  folder text NOT NULL DEFAULT 'saved-templates',
  is_preset boolean NOT NULL DEFAULT false,
  builder_draft jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  flow_name text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_templates_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT workflow_templates_folder_chk CHECK (folder IN ('presets', 'saved-templates')),
  CONSTRAINT workflow_templates_saved_requires_tenant CHECK (
    is_preset = true OR tenant_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS workflow_templates_tenant_folder_idx
  ON public.workflow_templates (tenant_id, folder, updated_at DESC);

CREATE INDEX IF NOT EXISTS workflow_templates_preset_idx
  ON public.workflow_templates (is_preset, folder)
  WHERE is_preset = true;

COMMENT ON TABLE public.workflow_templates IS
  'Saved workflow builder canvases. Presets (is_preset) may be global; saved templates are tenant-scoped.';

CREATE OR REPLACE FUNCTION public.set_workflow_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_templates_updated_at ON public.workflow_templates;
CREATE TRIGGER trg_workflow_templates_updated_at
BEFORE UPDATE ON public.workflow_templates
FOR EACH ROW
EXECUTE FUNCTION public.set_workflow_templates_updated_at();

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_templates TO authenticated;
GRANT ALL ON public.workflow_templates TO service_role;

DROP POLICY IF EXISTS workflow_templates_staff ON public.workflow_templates;
CREATE POLICY workflow_templates_staff
  ON public.workflow_templates FOR ALL TO authenticated
  USING (
    is_preset = true
    OR (tenant_id IS NOT NULL AND public.user_is_tenant_staff(tenant_id))
  )
  WITH CHECK (
    is_preset = false
    AND tenant_id IS NOT NULL
    AND public.user_is_tenant_staff(tenant_id)
  );

DROP POLICY IF EXISTS workflow_templates_read_presets ON public.workflow_templates;
CREATE POLICY workflow_templates_read_presets
  ON public.workflow_templates FOR SELECT TO authenticated
  USING (is_preset = true);

-- Seed global preset templates (visible to all tenants)
INSERT INTO public.workflow_templates (name, folder, is_preset, builder_draft, flow_name)
SELECT v.name, 'presets', true, '{"nodes":[],"edges":[]}'::jsonb, v.flow_name
FROM (
  VALUES
    ('Onboarding 1.tpl', 'Onboarding 1'),
    ('Onboarding 2.tpl', 'Onboarding 2')
) AS v(name, flow_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.workflow_templates wt WHERE wt.is_preset = true AND wt.folder = 'presets'
);
