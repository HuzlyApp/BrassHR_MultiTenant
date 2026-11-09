-- Let company-settings admins manage inbound Integration API keys.
UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/admin/integrations']::text[]
WHERE key = 'settings_company'
  AND NOT (
    '/api/admin/integrations' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );
