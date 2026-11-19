-- Allow personal settings roles to call phone-change OTP APIs.
UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/account/phone-change']::text[]
WHERE key = 'settings_profile'
  AND NOT (
    '/api/account/phone-change' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );
