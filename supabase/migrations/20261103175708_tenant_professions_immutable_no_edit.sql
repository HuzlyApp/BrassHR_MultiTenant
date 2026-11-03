-- Tenant professions: create + soft-delete only (no rename/edit).
-- Settings UI exposes Delete only; enforce the same rule in the database.
-- Each tenant keeps an isolated profession set via tenant_id + RLS.

COMMENT ON TABLE public.tenant_professions IS
  'Per-tenant profession list. Create and soft-delete (is_active) only; name, catalog_key, industry_key, and tenant_id are immutable after insert. Isolated by tenant_id.';

COMMENT ON COLUMN public.tenant_professions.name IS
  'Display label set at create time. Immutable — delete and add again to change.';

COMMENT ON COLUMN public.tenant_professions.catalog_key IS
  'Optional profession_catalog key copied at create time. Immutable after insert.';

COMMENT ON COLUMN public.tenant_professions.tenant_id IS
  'Owning tenant. Required; professions never span tenants.';

CREATE OR REPLACE FUNCTION public.tenant_professions_identity_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.industry_key IS DISTINCT FROM OLD.industry_key
     OR NEW.catalog_key IS DISTINCT FROM OLD.catalog_key
     OR NEW.name IS DISTINCT FROM OLD.name THEN
    RAISE EXCEPTION
      'Tenant professions cannot be edited; delete and add again instead';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_professions_identity_immutable
  ON public.tenant_professions;

CREATE TRIGGER trg_tenant_professions_identity_immutable
BEFORE UPDATE ON public.tenant_professions
FOR EACH ROW
EXECUTE FUNCTION public.tenant_professions_identity_immutable();

-- Replace broad FOR ALL write policy with explicit insert / update / delete.
-- UPDATE remains for soft-delete and reactivate (is_active only; identity guard above).
DROP POLICY IF EXISTS tenant_professions_admin_write ON public.tenant_professions;

DROP POLICY IF EXISTS tenant_professions_admin_insert ON public.tenant_professions;
CREATE POLICY tenant_professions_admin_insert
  ON public.tenant_professions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.user_is_tenant_admin(tenant_id)));

DROP POLICY IF EXISTS tenant_professions_admin_update ON public.tenant_professions;
CREATE POLICY tenant_professions_admin_update
  ON public.tenant_professions
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.user_is_tenant_admin(tenant_id)))
  WITH CHECK ((SELECT public.user_is_tenant_admin(tenant_id)));

DROP POLICY IF EXISTS tenant_professions_admin_delete ON public.tenant_professions;
CREATE POLICY tenant_professions_admin_delete
  ON public.tenant_professions
  FOR DELETE
  TO authenticated
  USING ((SELECT public.user_is_tenant_admin(tenant_id)));

-- One active catalog profession per tenant. Inactive rows may remain after industry changes.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_professions_active_catalog_uidx
  ON public.tenant_professions (tenant_id, catalog_key)
  WHERE catalog_key IS NOT NULL AND is_active = true;
