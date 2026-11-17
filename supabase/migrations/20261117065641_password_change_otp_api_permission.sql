-- Allow personal settings roles to call password-change OTP APIs.
UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/account/password-change']::text[]
WHERE key = 'settings_profile'
  AND NOT (
    '/api/account/password-change' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );
