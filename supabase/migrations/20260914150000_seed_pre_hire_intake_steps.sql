-- Seed Figma Pre-hire Intake steps into the global step library.
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
  'application-profile',
  'Application & Profile',
  v.step_key,
  v.step_type,
  v.title,
  v.description,
  v.icon_key,
  v.sort_order,
  '{"phase":"pre_hire"}'::jsonb
FROM (
  VALUES
    (
      'collect-extra-files',
      'document_upload',
      'Collect Extra Files',
      'Request additional files from the candidate during intake.',
      'collect-extra-files',
      0
    ),
    (
      'collect-references',
      'references',
      'Collect References',
      'Ask the candidate to provide professional references.',
      'collect-references',
      0
    )
) AS v(step_key, step_type, title, description, icon_key, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.onboarding_step_library existing
  WHERE existing.tenant_id IS NULL
    AND existing.step_key = v.step_key
);

-- Move Custom Form under Intake for Pre-hire library UI.
UPDATE public.onboarding_step_library
SET
  category_id = 'application-profile',
  category_label = 'Application & Profile',
  title = 'Custom Form',
  description = 'Add a custom intake form for this workflow.',
  icon_key = 'custom-form',
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"pre_hire"}'::jsonb,
  sort_order = 0
WHERE tenant_id IS NULL
  AND step_key = 'custom-form';
