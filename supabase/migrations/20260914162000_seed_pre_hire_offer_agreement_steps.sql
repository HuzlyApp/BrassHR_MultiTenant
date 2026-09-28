-- Move / seed Figma Pre-hire Offer & Agreement library steps.
UPDATE public.onboarding_step_library
SET
  category_id = 'offer-agreement',
  category_label = 'Offer & Agreement',
  title = CASE step_key
    WHEN 'pay-rate-hire-date' THEN 'Pay and Start Date'
    WHEN 'offer-acceptance' THEN 'Offer Accepted'
    WHEN 'employee-agreement' THEN 'Agreement eSign'
    WHEN 'i9-right-to-work-verification' THEN 'I-9 section 1'
    ELSE title
  END,
  icon_key = CASE step_key
    WHEN 'pay-rate-hire-date' THEN 'pay-and-start-date'
    WHEN 'offer-acceptance' THEN 'offer-accepted'
    WHEN 'employee-agreement' THEN 'agreement-esign'
    WHEN 'i9-right-to-work-verification' THEN 'i9-section-1'
    ELSE icon_key
  END,
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"pre_hire"}'::jsonb,
  sort_order = CASE step_key
    WHEN 'pay-rate-hire-date' THEN 1
    WHEN 'offer-acceptance' THEN 2
    WHEN 'employee-agreement' THEN 3
    WHEN 'i9-right-to-work-verification' THEN 4
    ELSE sort_order
  END
WHERE tenant_id IS NULL
  AND step_key IN (
    'pay-rate-hire-date',
    'offer-acceptance',
    'employee-agreement',
    'i9-right-to-work-verification'
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
  'offer-agreement',
  'Offer & Agreement',
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
      'pay-rate-hire-date',
      'profile_information',
      'Pay and Start Date',
      'Confirm pay rate and agreed start date.',
      'pay-and-start-date',
      1
    ),
    (
      'offer-acceptance',
      'custom_question',
      'Offer Accepted',
      'Track offer acceptance from the candidate.',
      'offer-accepted',
      2
    ),
    (
      'employee-agreement',
      'authorizations',
      'Agreement eSign',
      'Collect employee agreement signatures.',
      'agreement-esign',
      3
    ),
    (
      'i9-right-to-work-verification',
      'document_upload',
      'I-9 section 1',
      'Complete I-9 Section 1 for the candidate.',
      'i9-section-1',
      4
    )
) AS v(step_key, step_type, title, description, icon_key, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.onboarding_step_library existing
  WHERE existing.tenant_id IS NULL
    AND existing.step_key = v.step_key
);
