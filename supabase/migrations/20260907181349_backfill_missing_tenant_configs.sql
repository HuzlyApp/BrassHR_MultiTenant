-- Backfill missing per-tenant config rows and restore global workflow template presets.
-- Idempotent: safe to re-run.

-- 1) Default onboarding config + steps for tenants that have none active
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.id
    FROM public.tenants t
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tenant_onboarding_configs c
      WHERE c.tenant_id = t.id
        AND c.is_active = true
    )
  LOOP
    PERFORM public.seed_default_tenant_onboarding(r.id);
  END LOOP;
END $$;

-- 2) Onboarding libraries for every tenant
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_onboarding_libraries(r.id);
  END LOOP;
END $$;

-- 3) Application status catalog (no-op when already present)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.ensure_default_application_statuses(r.id);
  END LOOP;
END $$;

-- 4) Recruiter Activity dashboard settings (defaults from table column defaults)
INSERT INTO public.tenant_recruiter_activity_settings (tenant_id)
SELECT t.id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_recruiter_activity_settings s
  WHERE s.tenant_id = t.id
);

-- 5) Workflow settings row per tenant (optional default_workflow_template_id left null)
INSERT INTO public.tenant_workflow_settings (tenant_id)
SELECT t.id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_workflow_settings s
  WHERE s.tenant_id = t.id
);

-- 6) Skill assessment settings: copy a known-good draft catalog when available,
--    otherwise insert an empty draft (app normalizer falls back to platform defaults).
INSERT INTO public.tenant_skill_assessment_settings (
  tenant_id,
  enabled,
  allow_skip,
  draft,
  published,
  published_version,
  published_at,
  draft_updated_at
)
SELECT
  t.id,
  true,
  true,
  COALESCE(
    (
      SELECT s.draft
      FROM public.tenant_skill_assessment_settings s
      WHERE s.draft ? 'categories'
      ORDER BY s.draft_updated_at DESC NULLS LAST
      LIMIT 1
    ),
    '{}'::jsonb
  ),
  NULL,
  0,
  NULL,
  now()
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_skill_assessment_settings s
  WHERE s.tenant_id = t.id
);

-- 7) Restore global workflow builder presets (visible to all tenants)
INSERT INTO public.workflow_templates (name, folder, is_preset, builder_draft, flow_name)
SELECT v.name, 'presets', true, '{"nodes":[],"edges":[]}'::jsonb, v.flow_name
FROM (
  VALUES
    ('Onboarding 1.tpl', 'Onboarding 1'),
    ('Onboarding 2.tpl', 'Onboarding 2')
) AS v(name, flow_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.workflow_templates wt
  WHERE wt.is_preset = true
    AND wt.folder = 'presets'
    AND wt.name = v.name
);
