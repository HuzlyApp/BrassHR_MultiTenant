-- Launch Pad company settings must pass the existing Company settings permission gate.
-- Route handlers still require a tenant admin and resolve the tenant from the session.
UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/admin/launch-pad']::text[]
WHERE key = 'settings_company'
  AND NOT ('/api/admin/launch-pad' = ANY(coalesce(api_prefixes, ARRAY[]::text[])));
