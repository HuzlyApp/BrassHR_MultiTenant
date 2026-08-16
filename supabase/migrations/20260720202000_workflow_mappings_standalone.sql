-- Standalone workflow routing tables for environments with legacy job_requisitions schema.

CREATE OR REPLACE FUNCTION public.user_is_tenant_admin(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND ur.role::text = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (
        u.god_admin = true
        OR (u.tenant_id = p_tenant_id AND u.role::text IN ('admin', 'owner'))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_tenant_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.user_is_tenant_admin(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.professions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professions_code_not_empty CHECK (char_length(trim(code)) > 0),
  CONSTRAINT professions_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS professions_global_code_uidx
  ON public.professions (lower(code)) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS professions_tenant_code_uidx
  ON public.professions (tenant_id, lower(code)) WHERE tenant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  profession_id uuid NOT NULL REFERENCES public.professions (id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT specialties_code_not_empty CHECK (char_length(trim(code)) > 0),
  CONSTRAINT specialties_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS specialties_global_code_uidx
  ON public.specialties (profession_id, lower(code)) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS specialties_tenant_code_uidx
  ON public.specialties (tenant_id, profession_id, lower(code)) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS specialties_profession_idx
  ON public.specialties (profession_id, name) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.workflow_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  profession_id uuid NOT NULL REFERENCES public.professions (id) ON DELETE RESTRICT,
  employment_type text NOT NULL,
  workflow_id uuid NOT NULL REFERENCES public.onboarding_flows (id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_mappings_employment_type_chk CHECK (
    employment_type IN ('W2', '1099', 'Contract')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_mappings_active_criteria_uidx
  ON public.workflow_mappings (
    tenant_id,
    profession_id,
    employment_type
  )
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS workflow_mappings_lookup_idx
  ON public.workflow_mappings (
    tenant_id,
    profession_id,
    employment_type,
    priority
  )
  WHERE is_active = true;

INSERT INTO public.professions (tenant_id, code, name)
VALUES
  (NULL, 'RN', 'Registered Nurse'),
  (NULL, 'LPN', 'Licensed Practical Nurse'),
  (NULL, 'CNA', 'Certified Nursing Assistant'),
  (NULL, 'ALLIED_HEALTH', 'Allied Health'),
  (NULL, 'ADMIN', 'Administrative')
ON CONFLICT DO NOTHING;

INSERT INTO public.specialties (tenant_id, profession_id, code, name)
SELECT NULL, p.id, v.code, v.name
FROM (
  VALUES
    ('RN', 'MED_SURG', 'Medical-Surgical'),
    ('RN', 'ICU', 'Intensive Care Unit'),
    ('RN', 'ER', 'Emergency Room'),
    ('RN', 'OR', 'Operating Room'),
    ('RN', 'HOME_HEALTH', 'Home Health'),
    ('LPN', 'LONG_TERM_CARE', 'Long-Term Care'),
    ('CNA', 'LONG_TERM_CARE', 'Long-Term Care')
) AS v(profession_code, code, name)
JOIN public.professions p ON p.tenant_id IS NULL AND p.code = v.profession_code
ON CONFLICT DO NOTHING;

ALTER TABLE public.professions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS professions_read ON public.professions;
CREATE POLICY professions_read ON public.professions FOR SELECT TO anon, authenticated
  USING (is_active AND (tenant_id IS NULL OR public.user_is_tenant_staff(tenant_id)));

DROP POLICY IF EXISTS professions_admin_write ON public.professions;
CREATE POLICY professions_admin_write ON public.professions FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND public.user_is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.user_is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS specialties_read ON public.specialties;
CREATE POLICY specialties_read ON public.specialties FOR SELECT TO anon, authenticated
  USING (is_active AND (tenant_id IS NULL OR public.user_is_tenant_staff(tenant_id)));

DROP POLICY IF EXISTS specialties_admin_write ON public.specialties;
CREATE POLICY specialties_admin_write ON public.specialties FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND public.user_is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.user_is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS workflow_mappings_staff_read ON public.workflow_mappings;
CREATE POLICY workflow_mappings_staff_read ON public.workflow_mappings FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS workflow_mappings_admin_write ON public.workflow_mappings;
CREATE POLICY workflow_mappings_admin_write ON public.workflow_mappings FOR ALL TO authenticated
  USING (public.user_is_tenant_admin(tenant_id))
  WITH CHECK (public.user_is_tenant_admin(tenant_id));

GRANT SELECT ON public.professions, public.specialties TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_mappings TO authenticated;
GRANT ALL ON public.professions, public.specialties, public.workflow_mappings TO service_role;
