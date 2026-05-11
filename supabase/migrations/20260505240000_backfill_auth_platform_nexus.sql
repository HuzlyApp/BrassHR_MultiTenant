-- Ensure every auth user is treated as Nexus app traffic (JWT app_metadata.platform).
-- Safe merge into raw_app_meta_data; rerunnable.
UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('platform', 'nexus')
WHERE COALESCE(raw_app_meta_data ->> 'platform', '') IS DISTINCT FROM 'nexus';
