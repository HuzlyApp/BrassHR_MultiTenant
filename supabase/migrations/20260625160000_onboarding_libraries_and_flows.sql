-- Onboarding workflow libraries and tenant-scoped flows (builder-backed)

CREATE TABLE IF NOT EXISTS public.onboarding_libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  slug text NOT NULL,
  is_uncategorized boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_libraries_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT onboarding_libraries_slug_not_empty CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT onboarding_libraries_tenant_slug_unique UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS onboarding_libraries_tenant_idx
  ON public.onboarding_libraries (tenant_id, updated_at DESC);

COMMENT ON TABLE public.onboarding_libraries IS
  'Tenant-scoped folders for grouping onboarding workflow flows.';

CREATE TABLE IF NOT EXISTS public.onboarding_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  library_id uuid REFERENCES public.onboarding_libraries (id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.workflow_templates (id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'unpublished',
  created_as_blank boolean NOT NULL DEFAULT false,
  builder_draft jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_flows_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT onboarding_flows_status_chk CHECK (status IN ('draft', 'published', 'unpublished'))
);

CREATE INDEX IF NOT EXISTS onboarding_flows_tenant_idx
  ON public.onboarding_flows (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS onboarding_flows_library_idx
  ON public.onboarding_flows (library_id);

CREATE INDEX IF NOT EXISTS onboarding_flows_status_idx
  ON public.onboarding_flows (tenant_id, status);

COMMENT ON TABLE public.onboarding_flows IS
  'Tenant onboarding workflow instances. Canvas state stored in builder_draft (nodes/edges).';

CREATE OR REPLACE FUNCTION public.set_onboarding_libraries_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_libraries_updated_at ON public.onboarding_libraries;
CREATE TRIGGER trg_onboarding_libraries_updated_at
BEFORE UPDATE ON public.onboarding_libraries
FOR EACH ROW
EXECUTE FUNCTION public.set_onboarding_libraries_updated_at();

CREATE OR REPLACE FUNCTION public.set_onboarding_flows_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_flows_updated_at ON public.onboarding_flows;
CREATE TRIGGER trg_onboarding_flows_updated_at
BEFORE UPDATE ON public.onboarding_flows
FOR EACH ROW
EXECUTE FUNCTION public.set_onboarding_flows_updated_at();

ALTER TABLE public.onboarding_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_flows ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_libraries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_flows TO authenticated;
GRANT ALL ON public.onboarding_libraries TO service_role;
GRANT ALL ON public.onboarding_flows TO service_role;

DROP POLICY IF EXISTS onboarding_libraries_staff ON public.onboarding_libraries;
CREATE POLICY onboarding_libraries_staff
  ON public.onboarding_libraries FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS onboarding_flows_staff ON public.onboarding_flows;
CREATE POLICY onboarding_flows_staff
  ON public.onboarding_flows FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

-- Seed default libraries and sample flows for each tenant (idempotent)
ALTER TABLE public.onboarding_flows
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.seed_tenant_onboarding_libraries(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uncat_id uuid;
  v_onboarding_id uuid;
  v_marketing_id uuid;
BEGIN
  INSERT INTO public.onboarding_libraries (tenant_id, name, slug, is_uncategorized)
  VALUES (p_tenant_id, 'Uncategorized Flows', 'uncategorized', true)
  ON CONFLICT (tenant_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_uncat_id;

  IF v_uncat_id IS NULL THEN
    SELECT id INTO v_uncat_id
    FROM public.onboarding_libraries
    WHERE tenant_id = p_tenant_id AND slug = 'uncategorized';
  END IF;

  INSERT INTO public.onboarding_libraries (tenant_id, name, slug)
  VALUES (p_tenant_id, 'Onboarding Flows', 'onboarding')
  ON CONFLICT (tenant_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_onboarding_id;

  IF v_onboarding_id IS NULL THEN
    SELECT id INTO v_onboarding_id
    FROM public.onboarding_libraries
    WHERE tenant_id = p_tenant_id AND slug = 'onboarding';
  END IF;

  INSERT INTO public.onboarding_libraries (tenant_id, name, slug)
  VALUES (p_tenant_id, 'Marketing Flows', 'marketing')
  ON CONFLICT (tenant_id, slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_marketing_id;

  IF v_marketing_id IS NULL THEN
    SELECT id INTO v_marketing_id
    FROM public.onboarding_libraries
    WHERE tenant_id = p_tenant_id AND slug = 'marketing';
  END IF;

  -- Published flows in onboarding library
  INSERT INTO public.onboarding_flows (tenant_id, library_id, name, status, created_as_blank, sort_order)
  SELECT p_tenant_id, v_onboarding_id, v.name, 'published', true, v.ord
  FROM (
    VALUES
      ('Pre-Offer (ATS)', 1),
      ('Post-Offer', 2),
      ('Final Offer', 3),
      ('Employee Account Setup', 4),
      ('New Hire Orientation', 5),
      ('HR Document Verification', 6),
      ('IT Equipment Provisioning', 7),
      ('Payroll Enrollment', 8),
      ('Background Check Approval', 9),
      ('Department Introduction', 10),
      ('Training & Compliance', 11),
      ('Benefits Registration', 12)
  ) AS v(name, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.onboarding_flows f
    WHERE f.tenant_id = p_tenant_id AND lower(trim(f.name)) = lower(trim(v.name))
  );

  -- Unpublished flows
  INSERT INTO public.onboarding_flows (tenant_id, library_id, name, status, created_as_blank, sort_order)
  SELECT p_tenant_id, v_onboarding_id, v.name, 'unpublished', true, v.ord
  FROM (
    VALUES
      ('Manager Approval', 13),
      ('Facility Assignment', 14)
  ) AS v(name, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.onboarding_flows f
    WHERE f.tenant_id = p_tenant_id AND lower(trim(f.name)) = lower(trim(v.name))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_tenant_onboarding_libraries (uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.seed_tenant_onboarding_libraries (uuid) TO service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_onboarding_libraries(r.id);
  END LOOP;
END;
$$;
