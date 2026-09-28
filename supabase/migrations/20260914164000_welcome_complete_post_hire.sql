-- Welcome & Complete is Post-hire only.
UPDATE public.onboarding_step_library
SET
  category_label = 'Welcome & Complete',
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"post_hire"}'::jsonb
WHERE tenant_id IS NULL
  AND category_id = 'communication-notification';
