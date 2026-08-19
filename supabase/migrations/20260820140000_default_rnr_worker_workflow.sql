-- Add RNR (Recruit and Release) as a first-class workflow employment type
-- and seed the Default RNR Worker Workflow preset.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onboarding_templates_employment_type_chk'
      AND conrelid = 'public.onboarding_templates'::regclass
  ) THEN
    ALTER TABLE public.onboarding_templates
      DROP CONSTRAINT onboarding_templates_employment_type_chk;
  END IF;

  ALTER TABLE public.onboarding_templates
    ADD CONSTRAINT onboarding_templates_employment_type_chk
    CHECK (employment_type IS NULL OR employment_type IN ('W2', '1099', 'Contract', 'RNR'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onboarding_flows_employment_type_chk'
      AND conrelid = 'public.onboarding_flows'::regclass
  ) THEN
    ALTER TABLE public.onboarding_flows
      DROP CONSTRAINT onboarding_flows_employment_type_chk;
  END IF;

  ALTER TABLE public.onboarding_flows
    ADD CONSTRAINT onboarding_flows_employment_type_chk
    CHECK (employment_type IS NULL OR employment_type IN ('W2', '1099', 'Contract', 'RNR'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_mappings_employment_type_chk'
      AND conrelid = 'public.workflow_mappings'::regclass
  ) THEN
    ALTER TABLE public.workflow_mappings
      DROP CONSTRAINT workflow_mappings_employment_type_chk;
  END IF;

  ALTER TABLE public.workflow_mappings
    ADD CONSTRAINT workflow_mappings_employment_type_chk
    CHECK (employment_type IN ('W2', '1099', 'Contract', 'RNR'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.onboarding_step_library (
  tenant_id, category_id, category_label, step_key, step_type, title, description, icon_key, sort_order, default_settings
)
SELECT NULL, 'approval-decision', 'Approval & Decision Steps', 'recruiter-screening', 'custom_question',
  'Recruiter Screening', 'Recruiter screens the candidate before client review.', 'reference-verification', 6, '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_step_library WHERE tenant_id IS NULL AND step_key = 'recruiter-screening'
);

INSERT INTO public.onboarding_step_library (
  tenant_id, category_id, category_label, step_key, step_type, title, description, icon_key, sort_order, default_settings
)
SELECT NULL, 'approval-decision', 'Approval & Decision Steps', 'interview-qualification', 'custom_question',
  'Interview / Qualification', 'Track interview or qualification steps for the candidate.', 'manager-welcome-call', 7, '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_step_library WHERE tenant_id IS NULL AND step_key = 'interview-qualification'
);

INSERT INTO public.onboarding_step_library (
  tenant_id, category_id, category_label, step_key, step_type, title, description, icon_key, sort_order, default_settings
)
SELECT NULL, 'approval-decision', 'Approval & Decision Steps', 'client-review', 'custom_question',
  'Client Review', 'Client reviews the candidate before hire or handoff.', 'manager-facility-approval', 8, '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_step_library WHERE tenant_id IS NULL AND step_key = 'client-review'
);

INSERT INTO public.onboarding_step_library (
  tenant_id, category_id, category_label, step_key, step_type, title, description, icon_key, sort_order, default_settings
)
SELECT NULL, 'approval-decision', 'Approval & Decision Steps', 'candidate-selection', 'custom_question',
  'Candidate Approval / Selection', 'Approve or select the candidate for client handoff.', 'hr-final-approval', 9, '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_step_library WHERE tenant_id IS NULL AND step_key = 'candidate-selection'
);

INSERT INTO public.onboarding_step_library (
  tenant_id, category_id, category_label, step_key, step_type, title, description, icon_key, sort_order, default_settings
)
SELECT NULL, 'approval-decision', 'Approval & Decision Steps', 'release-to-client', 'custom_question',
  'Release to Client',
  'Mark recruitment complete and hand the candidate off to the client for final hiring.',
  'completion-milestone', 10, jsonb_build_object('phase', 'transition')
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_step_library WHERE tenant_id IS NULL AND step_key = 'release-to-client'
);

CREATE OR REPLACE FUNCTION public.upsert_default_rnr_workflow_preset()
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  rnr_template_id uuid;
  rnr_draft jsonb;
BEGIN
  rnr_draft := $json_rnr${
    "nodes":[
      {"id":"rnr-01","stepId":"parameterized-job-application","label":"Candidate Application","description":"Collect the candidate application for this Recruit and Release assignment.","position":{"x":80,"y":80},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":1,"completionOwner":"applicant"}},
      {"id":"rnr-02","stepId":"resume-basic-profile","label":"Resume / Profile Collection","description":"Collect resume, contact details, and candidate profile for history and collaboration.","position":{"x":80,"y":220},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":2,"completionOwner":"applicant"}},
      {"id":"rnr-03","stepId":"credential-license-verification","label":"Professional License / Credential Collection","description":"Collect professional license or credential details when required for the role.","position":{"x":80,"y":360},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":3,"completionOwner":"applicant","isConditional":true,"unlockCondition":"role_requires_license"}},
      {"id":"rnr-04","stepId":"skill-qualification-assessment","label":"Skill Assessment","description":"Assign a skill or qualification assessment when configured for the role.","position":{"x":80,"y":500},"day":1,"required":false,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":4,"completionOwner":"applicant","isConditional":true,"unlockCondition":"assessment_configured"}},
      {"id":"rnr-05","stepId":"recruiter-screening","label":"Recruiter Screening","description":"Recruiter screens the candidate before interview or client review.","position":{"x":80,"y":640},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":5,"completionOwner":"recruiter_or_hr"}},
      {"id":"rnr-06","stepId":"interview-qualification","label":"Interview / Qualification","description":"Track interview or qualification steps for the candidate.","position":{"x":80,"y":780},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":6,"completionOwner":"recruiter_or_hr"}},
      {"id":"rnr-07","stepId":"document-upload","label":"Required Candidate Documentation","description":"Collect required candidate documents for recruitment and client review.","position":{"x":80,"y":920},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":7,"completionOwner":"applicant"}},
      {"id":"rnr-08","stepId":"client-review","label":"Client Review","description":"Client reviews the candidate before approval and handoff.","position":{"x":80,"y":1060},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":8,"completionOwner":"manager_or_facility"}},
      {"id":"rnr-09","stepId":"candidate-selection","label":"Candidate Approval / Selection","description":"Approve or select the candidate for client handoff.","position":{"x":80,"y":1200},"day":1,"required":true,"settings":{"phase":"pre_hire","phaseOrder":1,"stepOrder":9,"completionOwner":"hr_admin"}},
      {"id":"rnr-10","stepId":"release-to-client","label":"Release to Client","description":"Recruitment requirements are complete and the candidate is approved for client handoff. The client becomes responsible for final hiring and onboarding. Candidate records and workflow history remain available in Brass.","position":{"x":80,"y":1340},"day":1,"required":true,"settings":{"phase":"transition","phaseOrder":2,"stepOrder":10,"completionOwner":"authorized_internal","unlockCondition":"all_required_pre_hire_complete"}}
    ],
    "edges":[]
  }$json_rnr$::jsonb;

  UPDATE public.onboarding_templates
  SET
    name = 'Default RNR Worker Workflow',
    description = 'Recruit and Release workflow designed for candidates recruited by Brass and handed off to the client for final hiring and onboarding.',
    status = 'published',
    flow_name = 'RNR Worker Workflow',
    builder_draft = rnr_draft,
    employment_type = 'RNR',
    template_type = 'default',
    is_system_preset = true,
    is_editable = false,
    updated_at = now()
  WHERE type = 'preset'
    AND lower(name) IN (lower('Default RNR Worker Workflow'), lower('Default R&R Workflow'));

  INSERT INTO public.onboarding_templates (
    tenant_id,
    name,
    description,
    type,
    status,
    flow_name,
    builder_draft,
    employment_type,
    template_type,
    is_system_preset,
    is_editable,
    version
  )
  SELECT
    NULL,
    'Default RNR Worker Workflow',
    'Recruit and Release workflow designed for candidates recruited by Brass and handed off to the client for final hiring and onboarding.',
    'preset',
    'published',
    'RNR Worker Workflow',
    rnr_draft,
    'RNR',
    'default',
    true,
    false,
    1
  WHERE NOT EXISTS (
    SELECT 1 FROM public.onboarding_templates t
    WHERE t.type = 'preset' AND lower(t.name) = lower('Default RNR Worker Workflow')
  );

  SELECT id INTO rnr_template_id
  FROM public.onboarding_templates
  WHERE type = 'preset' AND lower(name) = lower('Default RNR Worker Workflow')
  LIMIT 1;

  IF rnr_template_id IS NOT NULL THEN
    DELETE FROM public.onboarding_template_steps WHERE template_id = rnr_template_id;
    INSERT INTO public.onboarding_template_steps (
      template_id, step_type, title, description, position, day, is_required,
      phase, phase_order, step_order, is_conditional, unlock_condition, completion_owner,
      settings, metadata, canvas_node_id
    )
    SELECT
      rnr_template_id,
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
    FROM jsonb_array_elements(rnr_draft->'nodes') WITH ORDINALITY AS t(node, ordinality);
  END IF;
END;
$fn$;

SELECT public.upsert_default_rnr_workflow_preset();
