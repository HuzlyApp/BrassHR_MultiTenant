-- Move / seed Figma Pre-hire Screening + Interview library steps.

-- Screening group
UPDATE public.onboarding_step_library
SET
  category_id = 'screening',
  category_label = 'Screening',
  title = CASE step_key
    WHEN 'recruiter-screening' THEN 'Recruiter Screening'
    WHEN 'skill-qualification-assessment' THEN 'Skill / Qualification Assessment'
    WHEN 'reference-verification' THEN 'Reference Verification'
    ELSE title
  END,
  icon_key = CASE step_key
    WHEN 'recruiter-screening' THEN 'recruiter-screening'
    ELSE icon_key
  END,
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"pre_hire"}'::jsonb,
  sort_order = CASE step_key
    WHEN 'recruiter-screening' THEN 1
    WHEN 'skill-qualification-assessment' THEN 2
    WHEN 'reference-verification' THEN 3
    ELSE sort_order
  END
WHERE tenant_id IS NULL
  AND step_key IN (
    'recruiter-screening',
    'skill-qualification-assessment',
    'reference-verification'
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
  'screening',
  'Screening',
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
      'recruiter-screening',
      'custom_question',
      'Recruiter Screening',
      'Recruiter screens the candidate before interview or client review.',
      'recruiter-screening',
      1
    ),
    (
      'skill-qualification-assessment',
      'skill_assessment',
      'Skill / Qualification Assessment',
      'Assess applicant skills and qualifications.',
      'skill-qualification-assessment',
      2
    ),
    (
      'reference-verification',
      'references',
      'Reference Verification',
      'Track reference verification.',
      'reference-verification',
      3
    )
) AS v(step_key, step_type, title, description, icon_key, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.onboarding_step_library existing
  WHERE existing.tenant_id IS NULL
    AND existing.step_key = v.step_key
);

-- Interview group
UPDATE public.onboarding_step_library
SET
  category_id = 'interview',
  category_label = 'Interview',
  title = CASE step_key
    WHEN 'interview-qualification' THEN 'Interview/Qualification'
    WHEN 'internal-select' THEN 'Internal Select'
    ELSE title
  END,
  icon_key = CASE step_key
    WHEN 'interview-qualification' THEN 'interview-qualification'
    WHEN 'internal-select' THEN 'internal-select'
    ELSE icon_key
  END,
  default_settings = COALESCE(default_settings, '{}'::jsonb) || '{"phase":"pre_hire"}'::jsonb,
  sort_order = CASE step_key
    WHEN 'interview-qualification' THEN 1
    WHEN 'internal-select' THEN 2
    ELSE sort_order
  END
WHERE tenant_id IS NULL
  AND step_key IN ('interview-qualification', 'internal-select');

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
  'interview',
  'Interview',
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
      'interview-qualification',
      'custom_question',
      'Interview/Qualification',
      'Track interview or qualification steps for the candidate.',
      'interview-qualification',
      1
    ),
    (
      'internal-select',
      'custom_question',
      'Internal Select',
      'Internally select the candidate to move forward.',
      'internal-select',
      2
    )
) AS v(step_key, step_type, title, description, icon_key, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.onboarding_step_library existing
  WHERE existing.tenant_id IS NULL
    AND existing.step_key = v.step_key
);

-- Remaining screening-compliance rows are Compliance (not Screening).
UPDATE public.onboarding_step_library
SET
  category_label = 'Compliance'
WHERE tenant_id IS NULL
  AND category_id = 'screening-compliance';
