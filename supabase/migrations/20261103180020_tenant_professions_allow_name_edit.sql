-- Allow renaming tenant professions. Keep ownership and catalog origin locked.
-- UI: Edit (name) + Delete. Documents remain editable separately.

COMMENT ON TABLE public.tenant_professions IS
  'Per-tenant profession list. Isolated by tenant_id. Name may be edited; tenant_id, industry_key, and catalog_key are immutable after insert. Soft-delete via is_active.';

COMMENT ON COLUMN public.tenant_professions.name IS
  'Display label. Editable by tenant admins within the tenant.';

CREATE OR REPLACE FUNCTION public.tenant_professions_identity_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.industry_key IS DISTINCT FROM OLD.industry_key
     OR NEW.catalog_key IS DISTINCT FROM OLD.catalog_key THEN
    RAISE EXCEPTION
      'Profession ownership and catalog origin cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;
