-- Help & Support  available to every staff role.
UPDATE public.permission_resources
SET always_granted = true
WHERE key IN ('settings_help');
