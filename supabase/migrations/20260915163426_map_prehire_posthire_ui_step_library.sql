-- Map global onboarding_step_library rows to the Figma Pre-hire / Post-hire UI.
-- Categories, titles, icons, phase, and hire-journey stageName become the source of truth.

WITH mapped (
  step_key,
  category_id,
  category_label,
  step_type,
  title,
  description,
  icon_key,
  sort_order,
  phase,
  stage_name
) AS (
  SELECT * FROM (
    VALUES
      -- Pre-hire: Intake
      (
        'collect-extra-files',
        'application-profile',
        'Intake',
        'document_upload',
        'Collect Extra Files',
        'Request additional files from the candidate during intake.',
        'collect-extra-files',
        1,
        'pre_hire',
        'Intake'
      ),
      (
        'collect-references',
        'application-profile',
        'Intake',
        'references',
        'Collect References',
        'Ask the candidate to provide professional references.',
        'collect-references',
        2,
        'pre_hire',
        'Intake'
      ),
      (
        'custom-form',
        'application-profile',
        'Intake',
        'custom_question',
        'Custom Form',
        'Add a custom intake form for this workflow.',
        'custom-form',
        3,
        'pre_hire',
        'Intake'
      ),

      -- Pre-hire: Screening
      (
        'recruiter-screening',
        'screening',
        'Screening',
        'custom_question',
        'Recruiter Screening',
        'Recruiter screens the candidate before interview or client review.',
        'recruiter-screening',
        1,
        'pre_hire',
        'Screening'
      ),
      (
        'skill-qualification-assessment',
        'screening',
        'Screening',
        'skill_assessment',
        'Skill / Qualification Assessment',
        'Assess applicant skills and qualifications.',
        'skill-qualification-assessment',
        2,
        'pre_hire',
        'Screening'
      ),
      (
        'reference-verification',
        'screening',
        'Screening',
        'references',
        'Reference Verification',
        'Track reference verification.',
        'reference-verification',
        3,
        'pre_hire',
        'Screening'
      ),

      -- Pre-hire: Interview
      (
        'interview-qualification',
        'interview',
        'Interview',
        'custom_question',
        'Interview/Qualification',
        'Track interview or qualification steps for the candidate.',
        'interview-qualification',
        1,
        'pre_hire',
        'Interview'
      ),
      (
        'internal-select',
        'interview',
        'Interview',
        'custom_question',
        'Internal Select',
        'Internally select the candidate to move forward.',
        'internal-select',
        2,
        'pre_hire',
        'Interview'
      ),

      -- Pre-hire: Submission
      (
        'release-to-client',
        'submission',
        'Submission',
        'custom_question',
        'Release to Client',
        'Mark recruitment complete and hand the candidate off to the client for final hiring.',
        'release-to-client',
        1,
        'transition',
        'Submission'
      ),

      -- Pre-hire: Compliance
      (
        'background-check',
        'screening-compliance',
        'Compliance',
        'custom_question',
        'Background Check',
        'Track background check completion.',
        'background-check',
        1,
        'pre_hire',
        'Compliance'
      ),
      (
        'drug-test-screening',
        'screening-compliance',
        'Compliance',
        'custom_question',
        'Drug Test / Screening',
        'Track drug test or screening requirements.',
        'drug-test-screening',
        2,
        'pre_hire',
        'Compliance'
      ),
      (
        'oig-exclusion-check',
        'screening-compliance',
        'Compliance',
        'custom_question',
        'OIG / Exclusion Check',
        'Track OIG or exclusion screening.',
        'oig-exclusion-check',
        3,
        'pre_hire',
        'Compliance'
      ),
      (
        'credential-license-verification',
        'screening-compliance',
        'Compliance',
        'professional_license',
        'Credential / License Verification',
        'Verify professional credentials and licenses.',
        'credential-license-verification',
        4,
        'pre_hire',
        'Compliance'
      ),
      (
        'ssn-identity-verification',
        'screening-compliance',
        'Compliance',
        'document_upload',
        'SSN / Identity Verification',
        'Collect identity verification documentation.',
        'ssn-identity-verification',
        5,
        'pre_hire',
        'Compliance'
      ),
      (
        'adverse-action-process',
        'screening-compliance',
        'Compliance',
        'custom_question',
        'Adverse Action Process',
        'Track adverse action steps when required.',
        'adverse-action-process',
        6,
        'pre_hire',
        'Compliance'
      ),

      -- Pre-hire: Offer & Agreement
      (
        'pay-rate-hire-date',
        'offer-agreement',
        'Offer & Agreement',
        'profile_information',
        'Pay and Start Date',
        'Confirm pay rate and agreed start date.',
        'pay-and-start-date',
        1,
        'pre_hire',
        'Offer & Agreement'
      ),
      (
        'offer-acceptance',
        'offer-agreement',
        'Offer & Agreement',
        'custom_question',
        'Offer Accepted',
        'Track offer acceptance from the candidate.',
        'offer-accepted',
        2,
        'pre_hire',
        'Offer & Agreement'
      ),
      (
        'employee-agreement',
        'offer-agreement',
        'Offer & Agreement',
        'authorizations',
        'Agreement eSign',
        'Collect employee agreement signatures.',
        'agreement-esign',
        3,
        'pre_hire',
        'Offer & Agreement'
      ),
      (
        'i9-right-to-work-verification',
        'offer-agreement',
        'Offer & Agreement',
        'document_upload',
        'I-9 section 1',
        'Complete I-9 Section 1 for the candidate.',
        'i9-section-1',
        4,
        'pre_hire',
        'Offer & Agreement'
      ),

      -- Pre-hire: Approvals
      (
        'manager-facility-approval',
        'approval-decision',
        'Approvals',
        'custom_question',
        'Manager / Facility Approval',
        'Request manager or facility approval.',
        'manager-facility-approval',
        1,
        'pre_hire',
        'Approvals'
      ),
      (
        'hr-final-approval',
        'approval-decision',
        'Approvals',
        'custom_question',
        'HR Final Approval',
        'Request final HR approval before hire.',
        'hr-final-approval',
        2,
        'pre_hire',
        'Approvals'
      ),

      -- Post-hire: Payroll & Tax
      (
        'tax-forms',
        'payroll-financial',
        'Payroll & Tax',
        'document_upload',
        'Tax Forms (W-4 / State)',
        'Collect payroll tax forms.',
        'tax-forms',
        1,
        'post_hire',
        'Paperwork'
      ),
      (
        'direct-deposit-setup',
        'payroll-financial',
        'Payroll & Tax',
        'profile_information',
        'Direct Deposit Setup',
        'Collect direct deposit information.',
        'direct-deposit-setup',
        2,
        'post_hire',
        'Payroll & Pay'
      ),
      (
        'benefits-enrollment',
        'payroll-financial',
        'Payroll & Tax',
        'profile_information',
        'Benefits Enrollment / Selection',
        'Collect benefits enrollment choices.',
        'benefits-enrollment',
        3,
        'post_hire',
        'Payroll & Pay'
      ),
      (
        '401k-enrollment',
        'payroll-financial',
        'Payroll & Tax',
        'profile_information',
        '401K / Retirement Enrollment',
        'Collect retirement enrollment choices.',
        '401k-enrollment',
        4,
        'post_hire',
        'Payroll & Pay'
      ),
      (
        'payroll-profile-creation',
        'payroll-financial',
        'Payroll & Tax',
        'profile_information',
        'Payroll Profile Creation',
        'Create the payroll profile checklist.',
        'payroll-profile-creation',
        5,
        'post_hire',
        'Payroll & Pay'
      ),
      (
        'i9-section-2',
        'payroll-financial',
        'Payroll & Tax',
        'document_upload',
        'I-9 (2)',
        'Complete I-9 Section 2 / E-Verify for the new hire.',
        'i9-section-2',
        6,
        'post_hire',
        'Paperwork'
      ),

      -- Post-hire: Training & Policy
      (
        'document-upload',
        'training-development',
        'Training & Policy',
        'document_upload',
        'Document Upload',
        'Request tenant-specific documents.',
        'document-upload',
        1,
        'post_hire',
        'Paperwork'
      ),
      (
        'welcome-packet-esign',
        'training-development',
        'Training & Policy',
        'authorizations',
        'Welcome Packet & eSign',
        'Collect signed onboarding packet acknowledgments.',
        'welcome-packet-esign',
        2,
        'post_hire',
        'Policies'
      ),
      (
        'policy-acknowledgment',
        'training-development',
        'Training & Policy',
        'authorizations',
        'Policy Acknowledgment',
        'Collect policy acknowledgments.',
        'policy-acknowledgment',
        3,
        'post_hire',
        'Policies'
      ),
      (
        'safety-training',
        'training-development',
        'Training & Policy',
        'custom_question',
        'Safety Training',
        'Assign safety training tasks.',
        'safety-training',
        4,
        'post_hire',
        'Training'
      ),
      (
        'training-modules-quiz',
        'training-development',
        'Training & Policy',
        'skill_assessment',
        'Training Modules + Quiz',
        'Assign training modules and quiz questions.',
        'training-modules-quiz',
        5,
        'post_hire',
        'Training'
      ),
      (
        'orientation-video',
        'training-development',
        'Training & Policy',
        'custom_question',
        'Orientation / Onboarding Video',
        'Assign orientation content.',
        'orientation-video',
        6,
        'post_hire',
        'Training'
      ),
      (
        'compliance-training',
        'training-development',
        'Training & Policy',
        'custom_question',
        'Compliance Training',
        'Assign compliance training content.',
        'compliance-training',
        7,
        'post_hire',
        'Training'
      ),
      (
        'certification-upload',
        'training-development',
        'Training & Policy',
        'professional_license',
        'Certification Upload / Renewal',
        'Request certification upload or renewal details.',
        'certification-upload',
        8,
        'post_hire',
        'Training'
      ),

      -- Post-hire: Access & Systems
      (
        'equipment-badge-acknowledgment',
        'team-operational',
        'Access & Systems',
        'document_upload',
        'Equipment / Badge Acknowledgment',
        'Track equipment or badge acknowledgment.',
        'equipment-badge-acknowledgment',
        1,
        'post_hire',
        'Access & Equipment'
      ),
      (
        'badge-equipment-issuance',
        'team-operational',
        'Access & Systems',
        'custom_question',
        'Badge / Equipment Issuance',
        'Track badge or equipment issuance.',
        'badge-equipment-issuance',
        2,
        'post_hire',
        'Access & Equipment'
      ),
      (
        'schedule-assignment',
        'team-operational',
        'Access & Systems',
        'custom_question',
        'Schedule Assignment',
        'Assign work schedule for the new hire.',
        'schedule-assignment',
        3,
        'post_hire',
        'Access & Equipment'
      ),
      (
        'facility-access-setup',
        'team-operational',
        'Access & Systems',
        'custom_question',
        'Facility Access Setup',
        'Set up facility access for the new hire.',
        'facility-access-setup',
        4,
        'post_hire',
        'Access & Equipment'
      ),
      (
        'benefits-confirmation',
        'team-operational',
        'Access & Systems',
        'custom_question',
        'Benefits Confirmation',
        'Confirm benefits enrollment details.',
        'benefits-confirmation',
        5,
        'post_hire',
        'Access & Equipment'
      ),

      -- Post-hire: Welcome & Complete
      (
        'welcome-email',
        'communication-notification',
        'Welcome & Complete',
        'custom_question',
        'Send Message',
        'Send a welcome or onboarding message to the new hire.',
        'welcome-email',
        1,
        'post_hire',
        'Kickoff'
      ),
      (
        'manager-welcome-call',
        'communication-notification',
        'Welcome & Complete',
        'custom_question',
        'Welcome Call',
        'Schedule or track a welcome call.',
        'manager-welcome-call',
        2,
        'post_hire',
        'Kickoff'
      ),
      (
        'final-onboarding-call',
        'communication-notification',
        'Welcome & Complete',
        'custom_question',
        'Final Onboarding Call',
        'Schedule or track the final onboarding call.',
        'final-onboarding-call',
        3,
        'post_hire',
        'Day One Ready'
      ),
      (
        'buddy-mentor-assignment',
        'communication-notification',
        'Welcome & Complete',
        'custom_question',
        'Buddy / Mentor Assignment',
        'Assign a buddy or mentor to the new hire.',
        'buddy-mentor-assignment',
        4,
        'post_hire',
        'Day One Ready'
      ),
      (
        'completion-milestone',
        'communication-notification',
        'Welcome & Complete',
        'custom_question',
        'Onboarding Complete',
        'Mark onboarding complete.',
        'completion-milestone',
        5,
        'post_hire',
        'Day One Ready'
      )
  ) AS v(
    step_key,
    category_id,
    category_label,
    step_type,
    title,
    description,
    icon_key,
    sort_order,
    phase,
    stage_name
  )
),
updated AS (
  UPDATE public.onboarding_step_library lib
  SET
    category_id = mapped.category_id,
    category_label = mapped.category_label,
    step_type = mapped.step_type,
    title = mapped.title,
    description = mapped.description,
    icon_key = mapped.icon_key,
    sort_order = mapped.sort_order,
    default_settings = COALESCE(lib.default_settings, '{}'::jsonb)
      || jsonb_build_object('phase', mapped.phase, 'stageName', mapped.stage_name),
    updated_at = now()
  FROM mapped
  WHERE lib.tenant_id IS NULL
    AND lib.step_key = mapped.step_key
  RETURNING lib.step_key
)
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
  mapped.category_id,
  mapped.category_label,
  mapped.step_key,
  mapped.step_type,
  mapped.title,
  mapped.description,
  mapped.icon_key,
  mapped.sort_order,
  jsonb_build_object('phase', mapped.phase, 'stageName', mapped.stage_name)
FROM mapped
WHERE NOT EXISTS (
  SELECT 1
  FROM public.onboarding_step_library existing
  WHERE existing.tenant_id IS NULL
    AND existing.step_key = mapped.step_key
);

-- Leftover Intake rows keep the Figma section label.
UPDATE public.onboarding_step_library
SET
  category_label = 'Intake',
  default_settings = COALESCE(default_settings, '{}'::jsonb)
    || '{"phase":"pre_hire","stageName":"Intake"}'::jsonb,
  updated_at = now()
WHERE tenant_id IS NULL
  AND category_id = 'application-profile'
  AND step_key NOT IN ('collect-extra-files', 'collect-references', 'custom-form');

-- Leftover Approvals rows (not on the Figma Approvals card).
UPDATE public.onboarding_step_library
SET
  category_label = 'Approvals',
  default_settings = COALESCE(default_settings, '{}'::jsonb)
    || '{"phase":"pre_hire","stageName":"Approvals"}'::jsonb,
  updated_at = now()
WHERE tenant_id IS NULL
  AND category_id = 'approval-decision'
  AND step_key NOT IN ('manager-facility-approval', 'hr-final-approval');

-- Interview leftovers (client review / selection) stay with Interview.
UPDATE public.onboarding_step_library
SET
  category_id = 'interview',
  category_label = 'Interview',
  default_settings = COALESCE(default_settings, '{}'::jsonb)
    || '{"phase":"pre_hire","stageName":"Interview"}'::jsonb,
  sort_order = CASE step_key
    WHEN 'client-review' THEN 3
    WHEN 'candidate-selection' THEN 4
    ELSE sort_order
  END,
  updated_at = now()
WHERE tenant_id IS NULL
  AND step_key IN ('client-review', 'candidate-selection');

-- Leftover Welcome & Complete notifications.
UPDATE public.onboarding_step_library
SET
  category_label = 'Welcome & Complete',
  default_settings = COALESCE(default_settings, '{}'::jsonb)
    || '{"phase":"post_hire","stageName":"Kickoff"}'::jsonb,
  updated_at = now()
WHERE tenant_id IS NULL
  AND category_id = 'communication-notification'
  AND step_key NOT IN (
    'welcome-email',
    'manager-welcome-call',
    'final-onboarding-call',
    'buddy-mentor-assignment',
    'completion-milestone'
  );
