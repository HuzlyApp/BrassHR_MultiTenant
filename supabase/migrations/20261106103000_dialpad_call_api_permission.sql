-- Let company-settings admins call the Dialpad click-to-call API.
UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/admin/dialpad']::text[]
WHERE key = 'settings_company'
  AND NOT (
    '/api/admin/dialpad' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );
