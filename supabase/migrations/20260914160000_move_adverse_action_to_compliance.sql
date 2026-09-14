-- Move Adverse Action Process into Pre-hire Compliance (Figma).
UPDATE public.onboarding_step_library
SET
  category_id = 'screening-compliance',
  category_label = 'Compliance',
  title = 'Adverse Action Process',
  icon_key = 'adverse-action-process',
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"pre_hire"}'::jsonb,
  sort_order = 6
WHERE tenant_id IS NULL
  AND step_key = 'adverse-action-process';

INSERT INTO public.onboarding_step_library (
  tenant_id,
  category_id,
  category_label,
  step_key,
  step_type,
  title,
  description,
  icon_key,
  sort_order,
  default_settings
)
SELECT
  NULL,
  'screening-compliance',
  'Compliance',
  'adverse-action-process',
  'custom_question',
  'Adverse Action Process',
  'Track adverse action steps when required.',
  'adverse-action-process',
  6,
  '{"phase":"pre_hire"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.onboarding_step_library existing
  WHERE existing.tenant_id IS NULL
    AND existing.step_key = 'adverse-action-process'
);

-- Keep Compliance labels consistent for remaining compliance steps.
UPDATE public.onboarding_step_library
SET
  category_label = 'Compliance',
  sort_order = CASE step_key
    WHEN 'background-check' THEN 1
    WHEN 'drug-test-screening' THEN 2
    WHEN 'oig-exclusion-check' THEN 3
    WHEN 'credential-license-verification' THEN 4
    WHEN 'ssn-identity-verification' THEN 5
    WHEN 'adverse-action-process' THEN 6
    ELSE sort_order
  END
WHERE tenant_id IS NULL
  AND category_id = 'screening-compliance'
  AND step_key IN (
    'background-check',
    'drug-test-screening',
    'oig-exclusion-check',
    'credential-license-verification',
    'ssn-identity-verification',
    'adverse-action-process'
  );
