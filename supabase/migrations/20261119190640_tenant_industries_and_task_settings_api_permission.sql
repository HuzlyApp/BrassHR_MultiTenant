-- Gate industry binding and task settings behind Company settings (admin roles).
-- Without these prefixes, middleware classifies the routes as unmapped and returns 403.

UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/admin/tenant-industries']::text[]
WHERE key = 'settings_company'
  AND NOT (
    '/api/admin/tenant-industries' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );

UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/admin/task-settings']::text[]
WHERE key = 'settings_company'
  AND NOT (
    '/api/admin/task-settings' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );
