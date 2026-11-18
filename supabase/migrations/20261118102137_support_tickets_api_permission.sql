-- Allow Help & Support staff to call support ticket APIs (list/create/reply/close).
UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/support-tickets']::text[]
WHERE key = 'settings_help'
  AND NOT (
    '/api/support-tickets' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );
