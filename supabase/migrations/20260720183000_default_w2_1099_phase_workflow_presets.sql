-- Default W2 and 1099 workflow presets with explicit pre/transition/post-hire phases.

ALTER TABLE public.onboarding_templates
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS is_system_preset boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_editable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onboarding_templates_employment_type_chk'
      AND conrelid = 'public.onboarding_templates'::regclass
  ) THEN
    ALTER TABLE public.onboarding_templates
      ADD CONSTRAINT onboarding_templates_employment_type_chk
      CHECK (employment_type IS NULL OR employment_type IN ('W2', '1099'));
  END IF;
END $$;

ALTER TABLE public.onboarding_flow_steps
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'pre_hire',
  ADD COLUMN IF NOT EXISTS phase_order integer,
  ADD COLUMN IF NOT EXISTS step_order integer,
  ADD COLUMN IF NOT EXISTS is_conditional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlock_condition text,
  ADD COLUMN IF NOT EXISTS completion_owner text;

ALTER TABLE public.onboarding_template_steps
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'pre_hire',
  ADD COLUMN IF NOT EXISTS phase_order integer,
  ADD COLUMN IF NOT EXISTS step_order integer,
  ADD COLUMN IF NOT EXISTS is_conditional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlock_condition text,
  ADD COLUMN IF NOT EXISTS completion_owner text;

ALTER TABLE public.applicant_workflow_instances
  ADD COLUMN IF NOT EXISTS pre_hire_status text,
  ADD COLUMN IF NOT EXISTS pre_hire_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_hire_approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_to_worker_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.worker (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS post_hire_unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_hire_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS workflow_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.upsert_default_phase_workflow_presets()
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  w2_template_id uuid;
  c1099_template_id uuid;
  w2_draft jsonb;
  c1099_draft jsonb;
BEGIN
  w2_draft := $json_w2${
    "nodes":[
      {"id":"w2-01","stepId":"resume-basic-profile","label":"Resume & Basic Profile","description":"Collect resume, name, contact, address, employment history, education, and applicant profile.","position":{"x":80,"y":80},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":1,"completionOwner":"applicant"}},
      {"id":"w2-02","stepId":"parameterized-job-application","label":"Parameterized Job Application","description":"Persist requisition, profession, specialty, location, W2 classification, and expected start date.","position":{"x":80,"y":220},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":2,"completionOwner":"applicant"}},
      {"id":"w2-03","stepId":"references-collection","label":"References Collection","description":"Collect at least two professional references by default.","position":{"x":80,"y":360},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":3,"completionOwner":"applicant","isConditional":true,"unlockCondition":"admin_can_override_min_references_or_make_optional"}},
      {"id":"w2-04","stepId":"skill-qualification-assessment","label":"Skill / Qualification Assessment","description":"Assign profession/specialty assessment when configured.","position":{"x":80,"y":500},"day":1,"required":false,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":4,"completionOwner":"applicant","isConditional":true,"unlockCondition":"only_if_assessment_configured"}},
      {"id":"w2-05","stepId":"credential-license-verification","label":"Credential / License Verification","description":"Collect license data and supporting documentation when required.","position":{"x":80,"y":640},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":5,"completionOwner":"applicant","isConditional":true,"unlockCondition":"role_requires_license"}},
      {"id":"w2-06","stepId":"reference-verification","label":"Reference Verification","description":"Recruiter or HR verifies submitted references.","position":{"x":80,"y":780},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":6,"completionOwner":"recruiter_or_hr"}},
      {"id":"w2-07","stepId":"background-check","label":"Background Check","description":"Collect authorization and trigger configured process.","position":{"x":80,"y":920},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":7,"completionOwner":"recruiter_or_hr"}},
      {"id":"w2-08","stepId":"drug-test-screening","label":"Drug Test / Screening","description":"Run screening when required by tenant, facility, job, profession, or client.","position":{"x":80,"y":1060},"day":1,"required":false,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":8,"completionOwner":"recruiter_or_hr","isConditional":true,"unlockCondition":"job_or_facility_requires_drug_test"}},
      {"id":"w2-09","stepId":"oig-exclusion-check","label":"OIG / Exclusion Check","description":"Enabled by default for healthcare roles.","position":{"x":80,"y":1200},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":9,"completionOwner":"recruiter_or_hr","isConditional":true,"unlockCondition":"healthcare_role"}},
      {"id":"w2-10","stepId":"ssn-identity-verification","label":"SSN / Identity Verification","description":"Collect minimum required identity details with tenant-scoped access controls.","position":{"x":80,"y":1340},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":10,"completionOwner":"applicant"}},
      {"id":"w2-11","stepId":"manager-facility-approval","label":"Manager / Facility Approval","description":"Require manager/facility/client approval when configured.","position":{"x":80,"y":1480},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":11,"completionOwner":"manager_or_facility","isConditional":true,"unlockCondition":"manager_approval_required"}},
      {"id":"w2-12","stepId":"offer-acceptance","label":"Offer Acceptance","description":"Capture W2 offer acceptance details and expiration.","position":{"x":80,"y":1620},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":12,"completionOwner":"applicant"}},
      {"id":"w2-13","stepId":"employee-agreement","label":"Employee Agreement / Contract eSign","description":"Load tenant W2 agreement and require e-sign.","position":{"x":80,"y":1760},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":13,"completionOwner":"applicant"}},
      {"id":"w2-14","stepId":"hr-final-approval","label":"HR Final Approval","description":"Allow HR/Admin final decision and adverse action initiation.","position":{"x":80,"y":1900},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":14,"completionOwner":"hr_admin"}},
      {"id":"w2-15","stepId":"completion-milestone","label":"Pre-Hire Approval","description":"Approve conversion to W2 worker and unlock post-hire requirements.","position":{"x":80,"y":2040},"day":1,"required":true,"settings":{"phase":"transition","phaseOrder":2,"stepOrder":15,"completionOwner":"authorized_internal","unlockCondition":"all_required_pre_hire_complete"}},
      {"id":"w2-16","stepId":"i9-right-to-work-verification","label":"I-9 / Right to Work Verification","description":"Collect and track right-to-work documentation.","position":{"x":80,"y":2180},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":16,"completionOwner":"applicant_or_hr"}},
      {"id":"w2-17","stepId":"tax-forms","label":"Tax Forms (W-4 / State)","description":"Collect federal/state tax forms and tenant tax docs.","position":{"x":80,"y":2320},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":17,"completionOwner":"applicant"}},
      {"id":"w2-18","stepId":"direct-deposit-setup","label":"Direct Deposit Setup","description":"Securely collect payroll banking details.","position":{"x":80,"y":2460},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":18,"completionOwner":"applicant"}},
      {"id":"w2-19","stepId":"pay-rate-hire-date","label":"Pay Rate & Hire Date Entry","description":"Verify pay rate, hire date, title, department, type, and location.","position":{"x":80,"y":2600},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":19,"completionOwner":"recruiter_or_hr"}},
      {"id":"w2-20","stepId":"payroll-profile-creation","label":"Payroll Profile Creation","description":"Create/sync worker payroll profile.","position":{"x":80,"y":2740},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":20,"completionOwner":"hr_or_payroll"}},
      {"id":"w2-21","stepId":"benefits-enrollment","label":"Benefits Enrollment / Selection","description":"Show when W2 worker is benefits-eligible.","position":{"x":80,"y":2880},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":21,"completionOwner":"applicant","isConditional":true,"unlockCondition":"w2_benefits_eligible"}},
      {"id":"w2-22","stepId":"401k-enrollment","label":"401K / Retirement Enrollment","description":"Show when worker is retirement-eligible and offered by tenant.","position":{"x":80,"y":3020},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":22,"completionOwner":"applicant","isConditional":true,"unlockCondition":"w2_401k_eligible"}},
      {"id":"w2-23","stepId":"policy-acknowledgment","label":"Policy Acknowledgment","description":"Collect policy acknowledgments.","position":{"x":80,"y":3160},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":23,"completionOwner":"applicant"}},
      {"id":"w2-24","stepId":"welcome-packet-esign","label":"Welcome Packet & eSign","description":"Deliver and collect onboarding packet signatures.","position":{"x":80,"y":3300},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":24,"completionOwner":"applicant"}},
      {"id":"w2-25","stepId":"safety-training","label":"Safety Training","description":"Assign role/facility-specific safety training.","position":{"x":80,"y":3440},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":25,"completionOwner":"worker"}},
      {"id":"w2-26","stepId":"compliance-training","label":"Compliance Training","description":"Assign compliance modules.","position":{"x":80,"y":3580},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":26,"completionOwner":"worker"}},
      {"id":"w2-27","stepId":"training-modules-quiz","label":"Training Modules + Quiz","description":"Assign role-specific modules and quizzes.","position":{"x":80,"y":3720},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":27,"completionOwner":"worker"}},
      {"id":"w2-28","stepId":"orientation-video","label":"Orientation / Onboarding Video","description":"Track orientation content completion.","position":{"x":80,"y":3860},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":28,"completionOwner":"worker"}},
      {"id":"w2-29","stepId":"certification-upload","label":"Certification Upload / Renewal","description":"Track certifications and renewal dates.","position":{"x":80,"y":4000},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":29,"completionOwner":"worker","isConditional":true,"unlockCondition":"certification_required"}},
      {"id":"w2-30","stepId":"schedule-assignment","label":"Schedule Assignment","description":"Assign/confirm initial work schedule.","position":{"x":80,"y":4140},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":30,"completionOwner":"manager","isConditional":true,"unlockCondition":"requires_scheduling"}},
      {"id":"w2-31","stepId":"badge-equipment-issuance","label":"Badge / Equipment Issuance","description":"Track badge, device, and equipment issuance.","position":{"x":80,"y":4280},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":31,"completionOwner":"operations","isConditional":true,"unlockCondition":"equipment_required"}},
      {"id":"w2-32","stepId":"facility-access-setup","label":"Facility Access Setup","description":"Track system/building access provisioning.","position":{"x":80,"y":4420},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":32,"completionOwner":"operations","isConditional":true,"unlockCondition":"access_required"}},
      {"id":"w2-33","stepId":"buddy-mentor-assignment","label":"Buddy / Mentor Assignment","description":"Assign buddy/mentor when tenant enables.","position":{"x":80,"y":4560},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":33,"completionOwner":"manager","isConditional":true,"unlockCondition":"tenant_buddy_program_enabled"}},
      {"id":"w2-34","stepId":"benefits-confirmation","label":"Benefits Confirmation","description":"Confirm processed benefits selections.","position":{"x":80,"y":4700},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":34,"completionOwner":"hr","isConditional":true,"unlockCondition":"benefits_enabled"}},
      {"id":"w2-35","stepId":"welcome-email","label":"Welcome Email","description":"Send welcome details after approvals.","position":{"x":80,"y":4840},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":35,"completionOwner":"system"}},
      {"id":"w2-36","stepId":"manager-welcome-call","label":"Manager Welcome Call","description":"Create manager follow-up task.","position":{"x":80,"y":4980},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":36,"completionOwner":"manager"}},
      {"id":"w2-37","stepId":"final-onboarding-call","label":"Final Onboarding Call","description":"Create final recruiter/HR check-in.","position":{"x":80,"y":5120},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":37,"completionOwner":"recruiter_or_hr"}},
      {"id":"w2-38","stepId":"completion-milestone","label":"Completion / Milestone","description":"Mark onboarding complete and activate W2 worker status.","position":{"x":80,"y":5260},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":38,"completionOwner":"authorized_internal"}}
    ],
    "edges":[]
  }$json_w2$::jsonb;

  c1099_draft := $json_1099${
    "nodes":[
      {"id":"c1099-01","stepId":"resume-basic-profile","label":"Resume & Basic Profile","description":"Collect contractor resume and profile.","position":{"x":80,"y":80},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":1,"completionOwner":"applicant"}},
      {"id":"c1099-02","stepId":"parameterized-job-application","label":"Parameterized Job Application","description":"Persist requisition, role, location, and 1099 classification.","position":{"x":80,"y":220},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":2,"completionOwner":"applicant"}},
      {"id":"c1099-03","stepId":"references-collection","label":"References Collection","description":"Collect professional references per tenant config.","position":{"x":80,"y":360},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":3,"completionOwner":"applicant"}},
      {"id":"c1099-04","stepId":"skill-qualification-assessment","label":"Skill / Qualification Assessment","description":"Assign role-specific assessment when configured.","position":{"x":80,"y":500},"day":1,"required":false,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":4,"completionOwner":"applicant","isConditional":true,"unlockCondition":"assessment_configured"}},
      {"id":"c1099-05","stepId":"credential-license-verification","label":"Credential / License Verification","description":"Collect credential and expiration details for required roles.","position":{"x":80,"y":640},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":5,"completionOwner":"applicant","isConditional":true,"unlockCondition":"credential_required"}},
      {"id":"c1099-06","stepId":"reference-verification","label":"Reference Verification","description":"Authorized recruiter/HR verifies references.","position":{"x":80,"y":780},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":6,"completionOwner":"recruiter_or_hr"}},
      {"id":"c1099-07","stepId":"background-check","label":"Background Check","description":"Trigger configured contractor background check process.","position":{"x":80,"y":920},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":7,"completionOwner":"recruiter_or_hr"}},
      {"id":"c1099-08","stepId":"drug-test-screening","label":"Drug Test / Screening","description":"Conditional on engagement/client/facility requirements.","position":{"x":80,"y":1060},"day":1,"required":false,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":8,"completionOwner":"recruiter_or_hr","isConditional":true,"unlockCondition":"drug_test_required"}},
      {"id":"c1099-09","stepId":"oig-exclusion-check","label":"OIG / Exclusion Check","description":"Enable for applicable healthcare contractor roles.","position":{"x":80,"y":1200},"day":1,"required":false,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":9,"completionOwner":"recruiter_or_hr","isConditional":true,"unlockCondition":"healthcare_role"}},
      {"id":"c1099-10","stepId":"manager-facility-approval","label":"Manager / Facility Approval","description":"Require when configured by tenant/client/facility.","position":{"x":80,"y":1340},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":10,"completionOwner":"manager_or_facility","isConditional":true,"unlockCondition":"manager_approval_required"}},
      {"id":"c1099-11","stepId":"offer-acceptance","label":"Offer Acceptance","description":"Capture contract rate, duration, and terms acceptance.","position":{"x":80,"y":1480},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":11,"completionOwner":"applicant"}},
      {"id":"c1099-12","stepId":"employee-agreement","label":"Independent Contractor Agreement","description":"Load tenant-configured 1099 agreement for e-sign.","position":{"x":80,"y":1620},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":12,"completionOwner":"applicant"}},
      {"id":"c1099-13","stepId":"hr-final-approval","label":"HR Final Approval","description":"Final internal approval for contractor conversion.","position":{"x":80,"y":1760},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":13,"completionOwner":"hr_admin"}},
      {"id":"c1099-14","stepId":"completion-milestone","label":"Pre-Hire Approval","description":"Approve conversion to 1099 contractor and unlock post-hire setup.","position":{"x":80,"y":1900},"day":1,"required":true,"settings":{"phase":"transition","phaseOrder":2,"stepOrder":14,"completionOwner":"authorized_internal","unlockCondition":"all_required_pre_hire_complete"}},
      {"id":"c1099-15","stepId":"custom-form","label":"W-9 Tax Form","description":"Collect contractor W-9 using custom form/upload.","position":{"x":80,"y":2040},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":15,"completionOwner":"contractor"}},
      {"id":"c1099-16","stepId":"direct-deposit-setup","label":"Direct Deposit Setup","description":"Collect payment details when payments are platform-managed.","position":{"x":80,"y":2180},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":16,"completionOwner":"contractor","isConditional":true,"unlockCondition":"payment_managed_in_platform"}},
      {"id":"c1099-17","stepId":"pay-rate-hire-date","label":"Contract Rate & Start Date Entry","description":"Capture contract rate/start/end/payment frequency/engagement type.","position":{"x":80,"y":2320},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":17,"completionOwner":"recruiter_or_operations"}},
      {"id":"c1099-18","stepId":"payroll-profile-creation","label":"Contractor Payment Profile Creation","description":"Create or sync contractor payment profile.","position":{"x":80,"y":2460},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":18,"completionOwner":"operations","isConditional":true,"unlockCondition":"payment_managed_in_platform"}},
      {"id":"c1099-19","stepId":"policy-acknowledgment","label":"Policy Acknowledgment","description":"Collect only contractor-applicable policy acknowledgments.","position":{"x":80,"y":2600},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":19,"completionOwner":"contractor"}},
      {"id":"c1099-20","stepId":"welcome-packet-esign","label":"Welcome Packet & eSign","description":"Show when contractor-specific docs are configured.","position":{"x":80,"y":2740},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":20,"completionOwner":"contractor","isConditional":true,"unlockCondition":"contractor_docs_configured"}},
      {"id":"c1099-21","stepId":"safety-training","label":"Safety Training","description":"Assign role/facility-specific safety requirements.","position":{"x":80,"y":2880},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":21,"completionOwner":"contractor","isConditional":true,"unlockCondition":"safety_training_required"}},
      {"id":"c1099-22","stepId":"compliance-training","label":"Compliance Training","description":"Assign contractor compliance modules.","position":{"x":80,"y":3020},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":22,"completionOwner":"contractor","isConditional":true,"unlockCondition":"compliance_training_required"}},
      {"id":"c1099-23","stepId":"certification-upload","label":"Certification Upload / Renewal","description":"Track required cert uploads and expiration.","position":{"x":80,"y":3160},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":23,"completionOwner":"contractor","isConditional":true,"unlockCondition":"certification_required"}},
      {"id":"c1099-24","stepId":"schedule-assignment","label":"Schedule Assignment","description":"Show when engagement requires scheduling.","position":{"x":80,"y":3300},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":24,"completionOwner":"manager","isConditional":true,"unlockCondition":"requires_scheduling"}},
      {"id":"c1099-25","stepId":"badge-equipment-issuance","label":"Badge / Equipment Issuance","description":"Track temporary badges/equipment for contractors.","position":{"x":80,"y":3440},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":25,"completionOwner":"operations","isConditional":true,"unlockCondition":"equipment_required"}},
      {"id":"c1099-26","stepId":"facility-access-setup","label":"Facility Access Setup","description":"Provision facility/system access when required.","position":{"x":80,"y":3580},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":26,"completionOwner":"operations","isConditional":true,"unlockCondition":"access_required"}},
      {"id":"c1099-27","stepId":"welcome-email","label":"Welcome Email","description":"Send contractor-specific welcome communication.","position":{"x":80,"y":3720},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":27,"completionOwner":"system"}},
      {"id":"c1099-28","stepId":"manager-welcome-call","label":"Manager Welcome Call","description":"Manager follow-up task when required.","position":{"x":80,"y":3860},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":28,"completionOwner":"manager","isConditional":true,"unlockCondition":"manager_followup_required"}},
      {"id":"c1099-29","stepId":"final-onboarding-call","label":"Final Onboarding Call","description":"Recruiter/operations follow-up checkpoint.","position":{"x":80,"y":4000},"day":2,"required":false,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":29,"completionOwner":"recruiter_or_operations"}},
      {"id":"c1099-30","stepId":"completion-milestone","label":"Completion / Milestone","description":"Mark contractor onboarding complete and activate contractor status.","position":{"x":80,"y":4140},"day":2,"required":true,"settings":{"phase":"post_hire","phaseOrder":3,"stepOrder":30,"completionOwner":"authorized_internal"}}
    ],
    "edges":[]
  }$json_1099$::jsonb;

  -- Sequential edges for both presets.
  w2_draft := jsonb_set(
    w2_draft,
    '{edges}',
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', format('w2-e%s', i),
          'source', format('w2-%s', lpad(i::text, 2, '0')),
          'target', format('w2-%s', lpad((i + 1)::text, 2, '0'))
        )
      )
      FROM generate_series(1, 37) AS i
    )
  );
  c1099_draft := jsonb_set(
    c1099_draft,
    '{edges}',
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', format('c1099-e%s', i),
          'source', format('c1099-%s', lpad(i::text, 2, '0')),
          'target', format('c1099-%s', lpad((i + 1)::text, 2, '0'))
        )
      )
      FROM generate_series(1, 29) AS i
    )
  );

  INSERT INTO public.onboarding_templates (
    tenant_id, name, description, type, status, flow_name, builder_draft,
    employment_type, template_type, is_system_preset, is_editable, version
  )
  SELECT
    NULL,
    'Default W2 Employee Workflow',
    'Standard employee workflow with separate pre-hire screening and approval, followed by tax, payroll, benefits, training, operational setup, and final onboarding requirements.',
    'preset',
    'published',
    'W2 Employee Workflow',
    w2_draft,
    'W2',
    'default',
    true,
    false,
    1
  WHERE NOT EXISTS (
    SELECT 1 FROM public.onboarding_templates t
    WHERE t.type = 'preset' AND lower(t.name) = lower('Default W2 Employee Workflow')
  );

  INSERT INTO public.onboarding_templates (
    tenant_id, name, description, type, status, flow_name, builder_draft,
    employment_type, template_type, is_system_preset, is_editable, version
  )
  SELECT
    NULL,
    'Default 1099 Contractor Workflow',
    'Standard contractor workflow with separate pre-hire qualification and approval, followed by W-9 collection, payment setup, compliance, access provisioning, and contractor onboarding requirements.',
    'preset',
    'published',
    '1099 Contractor Workflow',
    c1099_draft,
    '1099',
    'default',
    true,
    false,
    1
  WHERE NOT EXISTS (
    SELECT 1 FROM public.onboarding_templates t
    WHERE t.type = 'preset' AND lower(t.name) = lower('Default 1099 Contractor Workflow')
  );

  UPDATE public.onboarding_templates
  SET
    description = 'Standard employee workflow with separate pre-hire screening and approval, followed by tax, payroll, benefits, training, operational setup, and final onboarding requirements.',
    status = 'published',
    flow_name = 'W2 Employee Workflow',
    builder_draft = w2_draft,
    employment_type = 'W2',
    template_type = 'default',
    is_system_preset = true,
    is_editable = false,
    updated_at = now()
  WHERE type = 'preset' AND lower(name) = lower('Default W2 Employee Workflow');

  UPDATE public.onboarding_templates
  SET
    description = 'Standard contractor workflow with separate pre-hire qualification and approval, followed by W-9 collection, payment setup, compliance, access provisioning, and contractor onboarding requirements.',
    status = 'published',
    flow_name = '1099 Contractor Workflow',
    builder_draft = c1099_draft,
    employment_type = '1099',
    template_type = 'default',
    is_system_preset = true,
    is_editable = false,
    updated_at = now()
  WHERE type = 'preset' AND lower(name) = lower('Default 1099 Contractor Workflow');

  SELECT id INTO w2_template_id
  FROM public.onboarding_templates
  WHERE type = 'preset' AND lower(name) = lower('Default W2 Employee Workflow')
  LIMIT 1;

  SELECT id INTO c1099_template_id
  FROM public.onboarding_templates
  WHERE type = 'preset' AND lower(name) = lower('Default 1099 Contractor Workflow')
  LIMIT 1;

  IF w2_template_id IS NOT NULL THEN
    DELETE FROM public.onboarding_template_steps WHERE template_id = w2_template_id;
    INSERT INTO public.onboarding_template_steps (
      template_id, step_type, title, description, position, day, is_required,
      phase, phase_order, step_order, is_conditional, unlock_condition, completion_owner,
      settings, metadata, canvas_node_id
    )
    SELECT
      w2_template_id,
      (node->>'stepId'),
      (node->>'label'),
      NULLIF(node->>'description', ''),
      ordinality::integer,
      COALESCE((node->>'day')::integer, 1),
      COALESCE((node->>'required')::boolean, true),
      COALESCE(node->'settings'->>'phase', 'pre_hire'),
      COALESCE((node->'settings'->>'phaseOrder')::integer, CASE COALESCE(node->'settings'->>'phase', 'pre_hire') WHEN 'transition' THEN 2 WHEN 'post_hire' THEN 3 ELSE 1 END),
      COALESCE((node->'settings'->>'stepOrder')::integer, ordinality::integer),
      COALESCE((node->'settings'->>'isConditional')::boolean, false),
      NULLIF(node->'settings'->>'unlockCondition', ''),
      NULLIF(node->'settings'->>'completionOwner', ''),
      COALESCE(node->'settings', '{}'::jsonb),
      jsonb_build_object('library_step_key', node->>'stepId'),
      node->>'id'
    FROM jsonb_array_elements(w2_draft->'nodes') WITH ORDINALITY AS t(node, ordinality);
  END IF;

  IF c1099_template_id IS NOT NULL THEN
    DELETE FROM public.onboarding_template_steps WHERE template_id = c1099_template_id;
    INSERT INTO public.onboarding_template_steps (
      template_id, step_type, title, description, position, day, is_required,
      phase, phase_order, step_order, is_conditional, unlock_condition, completion_owner,
      settings, metadata, canvas_node_id
    )
    SELECT
      c1099_template_id,
      (node->>'stepId'),
      (node->>'label'),
      NULLIF(node->>'description', ''),
      ordinality::integer,
      COALESCE((node->>'day')::integer, 1),
      COALESCE((node->>'required')::boolean, true),
      COALESCE(node->'settings'->>'phase', 'pre_hire'),
      COALESCE((node->'settings'->>'phaseOrder')::integer, CASE COALESCE(node->'settings'->>'phase', 'pre_hire') WHEN 'transition' THEN 2 WHEN 'post_hire' THEN 3 ELSE 1 END),
      COALESCE((node->'settings'->>'stepOrder')::integer, ordinality::integer),
      COALESCE((node->'settings'->>'isConditional')::boolean, false),
      NULLIF(node->'settings'->>'unlockCondition', ''),
      NULLIF(node->'settings'->>'completionOwner', ''),
      COALESCE(node->'settings', '{}'::jsonb),
      jsonb_build_object('library_step_key', node->>'stepId'),
      node->>'id'
    FROM jsonb_array_elements(c1099_draft->'nodes') WITH ORDINALITY AS t(node, ordinality);
  END IF;
END;
$fn$;

SELECT public.upsert_default_phase_workflow_presets();
