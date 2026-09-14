-- Consolidate Post-hire Payroll & Tax into one Figma group.
UPDATE public.onboarding_step_library
SET
  category_id = 'payroll-financial',
  category_label = 'Payroll & Tax',
  title = CASE step_key
    WHEN 'tax-forms' THEN 'Tax Forms (W-4 / State)'
    WHEN 'direct-deposit-setup' THEN 'Direct Deposit Setup'
    WHEN 'benefits-enrollment' THEN 'Benefits Enrollment / Selection'
    WHEN '401k-enrollment' THEN '401K / Retirement Enrollment'
    WHEN 'payroll-profile-creation' THEN 'Payroll Profile Creation'
    ELSE title
  END,
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"post_hire"}'::jsonb,
  sort_order = CASE step_key
    WHEN 'tax-forms' THEN 1
    WHEN 'direct-deposit-setup' THEN 2
    WHEN 'benefits-enrollment' THEN 3
    WHEN '401k-enrollment' THEN 4
    WHEN 'payroll-profile-creation' THEN 5
    ELSE sort_order
  END
WHERE tenant_id IS NULL
  AND step_key IN (
    'tax-forms',
    'direct-deposit-setup',
    'benefits-enrollment',
    '401k-enrollment',
    'payroll-profile-creation'
  );

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
  'payroll-financial',
  'Payroll & Tax',
  'i9-section-2',
  'document_upload',
  'I-9 (2)',
  'Complete I-9 Section 2 / E-Verify for the new hire.',
  'i9-section-2',
  6,
  '{"phase":"post_hire"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.onboarding_step_library existing
  WHERE existing.tenant_id IS NULL
    AND existing.step_key = 'i9-section-2'
);

-- Move leftover document-esign items out of the duplicate Payroll header.
UPDATE public.onboarding_step_library
SET
  category_id = 'training-development',
  category_label = 'Training & Policy',
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"post_hire"}'::jsonb
WHERE tenant_id IS NULL
  AND step_key IN ('document-upload', 'welcome-packet-esign', 'policy-acknowledgment');

UPDATE public.onboarding_step_library
SET
  category_id = 'team-operational',
  category_label = 'Access & Systems',
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"post_hire"}'::jsonb
WHERE tenant_id IS NULL
  AND step_key = 'equipment-badge-acknowledgment';
