-- Tenant department catalog.
-- A job stores department_id so every candidate on that job inherits it.
-- A candidate stores department_id when they are mapped directly.
-- The candidate's own department wins over the job's department.

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_name_not_empty CHECK (char_length(btrim(name)) > 0)
);

COMMENT ON TABLE public.departments IS
  'Organization departments. Jobs and candidates reference a row in this catalog.';

CREATE UNIQUE INDEX IF NOT EXISTS departments_tenant_name_uidx
  ON public.departments (tenant_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS departments_tenant_active_idx
  ON public.departments (tenant_id, is_active, name);

DROP TRIGGER IF EXISTS trg_departments_set_updated_at ON public.departments;
CREATE TRIGGER trg_departments_set_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.job_requisitions.department_id IS
  'Catalog department for this job. department text stays as the display label.';

CREATE INDEX IF NOT EXISTS job_requisitions_department_id_idx
  ON public.job_requisitions (department_id);

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.worker.department_id IS
  'Direct department for this candidate. When set, it overrides the job department.';

CREATE INDEX IF NOT EXISTS worker_department_id_idx
  ON public.worker (department_id);

CREATE OR REPLACE FUNCTION public.sync_job_requisition_department_label()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_tenant uuid;
BEGIN
  IF NEW.department_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT btrim(name), tenant_id
  INTO v_name, v_tenant
  FROM public.departments
  WHERE id = NEW.department_id;

  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Department does not belong to this organization';
  END IF;

  NEW.department = v_name;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_job_requisition_department_label() IS
  'Copies the catalog department name onto the job and rejects a department from another tenant.';

REVOKE ALL ON FUNCTION public.sync_job_requisition_department_label() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_job_requisition_department_label() FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_job_requisition_department_label() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_job_requisitions_sync_department_label ON public.job_requisitions;
CREATE TRIGGER trg_job_requisitions_sync_department_label
  BEFORE INSERT OR UPDATE OF department_id ON public.job_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_job_requisition_department_label();

CREATE OR REPLACE FUNCTION public.assert_worker_department_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF NEW.department_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id
  INTO v_tenant
  FROM public.departments
  WHERE id = NEW.department_id;

  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Department does not belong to this organization';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assert_worker_department_tenant() IS
  'Rejects a candidate department that belongs to another tenant.';

REVOKE ALL ON FUNCTION public.assert_worker_department_tenant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_worker_department_tenant() FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_worker_department_tenant() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_worker_assert_department_tenant ON public.worker;
CREATE TRIGGER trg_worker_assert_department_tenant
  BEFORE INSERT OR UPDATE OF department_id ON public.worker
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_worker_department_tenant();

INSERT INTO public.departments (tenant_id, name)
SELECT DISTINCT ON (j.tenant_id, lower(btrim(j.department)))
  j.tenant_id,
  btrim(j.department)
FROM public.job_requisitions j
WHERE j.department IS NOT NULL
  AND char_length(btrim(j.department)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.departments d
    WHERE d.tenant_id = j.tenant_id
      AND lower(btrim(d.name)) = lower(btrim(j.department))
  )
ORDER BY j.tenant_id, lower(btrim(j.department)), btrim(j.department);

UPDATE public.job_requisitions j
SET department_id = d.id
FROM public.departments d
WHERE j.department_id IS NULL
  AND j.tenant_id = d.tenant_id
  AND j.department IS NOT NULL
  AND lower(btrim(j.department)) = lower(btrim(d.name));

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_staff_select ON public.departments;
CREATE POLICY departments_staff_select
  ON public.departments
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

DROP POLICY IF EXISTS departments_admin_write ON public.departments;
CREATE POLICY departments_admin_write
  ON public.departments
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_admin(tenant_id))
  )
  WITH CHECK (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_admin(tenant_id))
  );

REVOKE ALL ON TABLE public.departments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.departments TO authenticated;
GRANT ALL ON TABLE public.departments TO service_role;

UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/admin/departments']::text[]
WHERE key = 'settings_company'
  AND NOT (
    '/api/admin/departments' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );

NOTIFY pgrst, 'reload schema';
