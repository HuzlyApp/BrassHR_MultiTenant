-- Tenants can bind multiple industries; profession rows may use any bound key
-- (or the primary when tenant_industry has not been populated yet).
CREATE OR REPLACE FUNCTION public.tenant_professions_match_industry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_primary text;
  v_bound boolean;
BEGIN
  SELECT NULLIF(TRIM(t.primary_industry_key), '')
  INTO v_primary
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_industry ti
    WHERE ti.tenant_id = NEW.tenant_id
      AND ti.industry_key = NEW.industry_key
  )
  INTO v_bound;

  IF v_bound THEN
    RETURN NEW;
  END IF;

  IF v_primary IS NOT NULL AND NEW.industry_key IS NOT DISTINCT FROM v_primary THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Profession industry must match a bound tenant industry';
END;
$$;
