-- Open all work locations: deactivate platform holds and stop tenant
-- hiring-area allowlists from restricting job post / apply / signup.

UPDATE public.service_area_policies
SET is_active = false
WHERE source = 'platform'
  AND is_active = true;

UPDATE public.tenant_hiring_areas
SET mode = 'all_allowed_platform'
WHERE mode IS DISTINCT FROM 'all_allowed_platform';

INSERT INTO public.tenant_hiring_areas (tenant_id, mode, extra_allowed_states)
SELECT t.id, 'all_allowed_platform', ARRAY[]::text[]
FROM public.tenants t
ON CONFLICT (tenant_id) DO UPDATE
SET mode = EXCLUDED.mode;
