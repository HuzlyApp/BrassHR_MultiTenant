-- Help & Support and Reports live in Settings for every authenticated staff role.
UPDATE public.permission_resources
SET always_granted = true
WHERE key IN ('settings_help', 'settings_reports');

-- Drop obsolete matrix rows; access is always_granted going forward.
DELETE FROM public.tenant_role_permissions
WHERE resource_key IN ('settings_help', 'settings_reports');
