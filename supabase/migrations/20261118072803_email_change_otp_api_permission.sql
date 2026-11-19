-- Allow personal settings roles to call email-change OTP APIs.
UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/account/email-change']::text[]
WHERE key = 'settings_profile'
  AND NOT (
    '/api/account/email-change' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );
