-- Extend the existing department catalog; no replacement department system.
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.departments ADD COLUMN parent_department_id uuid;
CREATE UNIQUE INDEX departments_tenant_id_uidx ON public.departments(tenant_id, id);
ALTER TABLE public.departments ADD CONSTRAINT departments_parent_same_tenant_fk
  FOREIGN KEY (tenant_id, parent_department_id) REFERENCES public.departments(tenant_id, id);
ALTER TABLE public.departments ADD CONSTRAINT departments_code_length
  CHECK (code IS NULL OR char_length(btrim(code)) BETWEEN 1 AND 40);
CREATE INDEX departments_parent_idx ON public.departments(tenant_id, parent_department_id)
  WHERE parent_department_id IS NOT NULL;

CREATE FUNCTION public.assert_department_hierarchy() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Serialize changes to one tenant hierarchy to prevent concurrent cycles.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.tenant_id::text, 781));
  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Department tenant cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF NEW.parent_department_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.departments d
      WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.parent_department_id) THEN
      RAISE EXCEPTION 'Parent department not found in tenant' USING ERRCODE = '23503';
    END IF;
    IF NEW.parent_department_id = NEW.id OR EXISTS (
      WITH RECURSIVE ancestors AS (
        SELECT d.id, d.parent_department_id FROM public.departments d
        WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.parent_department_id
        UNION
        SELECT d.id, d.parent_department_id FROM public.departments d
        JOIN ancestors a ON a.parent_department_id = d.id
        WHERE d.tenant_id = NEW.tenant_id
      ) SELECT 1 FROM ancestors WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Department hierarchy cannot contain a cycle' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_department_hierarchy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_department_hierarchy() TO authenticated, service_role;
CREATE TRIGGER trg_departments_hierarchy BEFORE INSERT OR UPDATE OF tenant_id, parent_department_id
ON public.departments FOR EACH ROW EXECUTE FUNCTION public.assert_department_hierarchy();
NOTIFY pgrst, 'reload schema';
