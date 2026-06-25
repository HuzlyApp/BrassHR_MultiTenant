-- Normalized onboarding schema: step library, flow steps, templates

CREATE TABLE IF NOT EXISTS public.onboarding_step_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  category_id text NOT NULL,
  category_label text NOT NULL,
  step_key text NOT NULL,
  step_type text NOT NULL,
  title text NOT NULL,
  description text,
  icon_key text NOT NULL,
  color text,
  default_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS onboarding_step_library_global_step_key_idx
  ON public.onboarding_step_library (step_key)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS onboarding_step_library_tenant_step_key_idx
  ON public.onboarding_step_library (tenant_id, step_key)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS onboarding_step_library_tenant_category_idx
  ON public.onboarding_step_library (tenant_id, category_id, sort_order);

CREATE TABLE IF NOT EXISTS public.onboarding_flow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.onboarding_flows (id) ON DELETE CASCADE,
  step_type text NOT NULL,
  title text NOT NULL,
  description text,
  position integer NOT NULL,
  parent_step_id uuid REFERENCES public.onboarding_flow_steps (id) ON DELETE SET NULL,
  day integer NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  canvas_node_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_flow_steps_position_positive CHECK (position > 0)
);

CREATE INDEX IF NOT EXISTS onboarding_flow_steps_flow_position_idx
  ON public.onboarding_flow_steps (flow_id, position ASC);

CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'saved',
  status text NOT NULL DEFAULT 'draft',
  flow_name text,
  builder_draft jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_templates_type_chk CHECK (type IN ('preset', 'saved')),
  CONSTRAINT onboarding_templates_status_chk CHECK (status IN ('draft', 'published', 'unpublished')),
  CONSTRAINT onboarding_templates_saved_requires_tenant CHECK (
    type = 'preset' OR tenant_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS onboarding_templates_tenant_type_idx
  ON public.onboarding_templates (tenant_id, type, updated_at DESC);

CREATE INDEX IF NOT EXISTS onboarding_templates_preset_idx
  ON public.onboarding_templates (type)
  WHERE type = 'preset';

CREATE TABLE IF NOT EXISTS public.onboarding_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates (id) ON DELETE CASCADE,
  step_type text NOT NULL,
  title text NOT NULL,
  description text,
  position integer NOT NULL,
  parent_step_id uuid REFERENCES public.onboarding_template_steps (id) ON DELETE SET NULL,
  day integer NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  canvas_node_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_template_steps_template_position_idx
  ON public.onboarding_template_steps (template_id, position ASC);

-- Migrate workflow_templates into onboarding_templates (idempotent)
INSERT INTO public.onboarding_templates (
  id, tenant_id, name, description, type, status, flow_name, builder_draft,
  created_by, updated_by, created_at, updated_at
)
SELECT
  wt.id,
  wt.tenant_id,
  wt.name,
  NULL,
  CASE WHEN wt.is_preset THEN 'preset' ELSE 'saved' END,
  'published',
  wt.flow_name,
  COALESCE(wt.builder_draft, '{"nodes":[],"edges":[]}'::jsonb),
  wt.created_by,
  wt.updated_by,
  wt.created_at,
  wt.updated_at
FROM public.workflow_templates wt
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_templates ot WHERE ot.id = wt.id
);

ALTER TABLE public.onboarding_step_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_template_steps ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.onboarding_step_library TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_flow_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_template_steps TO authenticated;
GRANT ALL ON public.onboarding_step_library TO service_role;
GRANT ALL ON public.onboarding_flow_steps TO service_role;
GRANT ALL ON public.onboarding_templates TO service_role;
GRANT ALL ON public.onboarding_template_steps TO service_role;

DROP POLICY IF EXISTS onboarding_step_library_read ON public.onboarding_step_library;
CREATE POLICY onboarding_step_library_read
  ON public.onboarding_step_library FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS onboarding_flow_steps_staff ON public.onboarding_flow_steps;
CREATE POLICY onboarding_flow_steps_staff
  ON public.onboarding_flow_steps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_flows f
      WHERE f.id = onboarding_flow_steps.flow_id
        AND public.user_is_tenant_staff(f.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_flows f
      WHERE f.id = onboarding_flow_steps.flow_id
        AND public.user_is_tenant_staff(f.tenant_id)
    )
  );

DROP POLICY IF EXISTS onboarding_templates_staff ON public.onboarding_templates;
CREATE POLICY onboarding_templates_staff
  ON public.onboarding_templates FOR ALL TO authenticated
  USING (
    type = 'preset'
    OR (tenant_id IS NOT NULL AND public.user_is_tenant_staff(tenant_id))
  )
  WITH CHECK (
    type = 'saved'
    AND tenant_id IS NOT NULL
    AND public.user_is_tenant_staff(tenant_id)
  );

DROP POLICY IF EXISTS onboarding_templates_read_presets ON public.onboarding_templates;
CREATE POLICY onboarding_templates_read_presets
  ON public.onboarding_templates FOR SELECT TO authenticated
  USING (type = 'preset');

DROP POLICY IF EXISTS onboarding_template_steps_staff ON public.onboarding_template_steps;
CREATE POLICY onboarding_template_steps_staff
  ON public.onboarding_template_steps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_templates t
      WHERE t.id = onboarding_template_steps.template_id
        AND (t.type = 'preset' OR (t.tenant_id IS NOT NULL AND public.user_is_tenant_staff(t.tenant_id)))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_templates t
      WHERE t.id = onboarding_template_steps.template_id
        AND t.type = 'saved'
        AND t.tenant_id IS NOT NULL
        AND public.user_is_tenant_staff(t.tenant_id)
    )
  );
