-- Document Upload belongs under Post-hire Payroll & Taxes.
UPDATE public.onboarding_step_library
SET
  category_id = 'document-esign',
  category_label = 'Payroll & Taxes',
  title = 'Document Upload',
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"post_hire"}'::jsonb
WHERE tenant_id IS NULL
  AND step_key = 'document-upload';
