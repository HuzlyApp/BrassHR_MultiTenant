/**
 * Generate migration SQL that maps AI Match progression steps 1–5 into
 * ai_variant / ai_prompt_template / ai_prompt_version (published + timestamped).
 *
 * Sources: lib/jobs/match-analysis prompts (Quick, Verifications, Follow-Up,
 * Deep already catalogued, Submission).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function extractConst(source, name) {
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`);
  const match = source.match(re);
  if (!match) throw new Error(`Could not extract ${name}`);
  return match[1];
}

function extractPrivateConst(source, name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`);
  const match = source.match(re);
  if (!match) throw new Error(`Could not extract ${name}`);
  return match[1];
}

function sqlDollar(tag, text) {
  // Avoid tag collision with content
  let t = tag;
  while (text.includes(`$${t}$`)) t = `${tag}_${createHash("md5").update(t).digest("hex").slice(0, 6)}`;
  return `$${t}$${text}$${t}$`;
}

function sqlJson(tag, obj) {
  return `${sqlDollar(tag, JSON.stringify(obj))}::jsonb`;
}

const promptsTs = readFileSync(join(root, "lib/jobs/match-analysis/prompts.ts"), "utf8");
const followUpTs = readFileSync(join(root, "lib/jobs/match-analysis/follow-up-questions.ts"), "utf8");
const submissionTs = readFileSync(join(root, "lib/jobs/match-analysis/generate-submission-resume.ts"), "utf8");

const QUICK_SYSTEM = extractConst(promptsTs, "ANALYZE_SYSTEM_PROMPT");
const FOLLOW_UP_SYSTEM = extractConst(followUpTs, "FOLLOW_UP_SYSTEM_PROMPT");
const DEEP_SYSTEM = extractConst(promptsTs, "DEEP_ANALYSIS_SYSTEM_PROMPT");
const SUBMISSION_SYSTEM = extractPrivateConst(submissionTs, "SYSTEM_PROMPT");

const QUICK_USER = `Analyze the candidate's match for the job below.
Treat "recent" experience as work within the past {{recent_experience_months}} months.

JOB INFORMATION
Job ID: {{job_id}}
Job title: {{job_title}}
Client / MSP: {{msp_or_client}}
Specialty: {{specialty}}
Location: {{location}}

MANDATORY REQUIREMENTS
{{mandatory_requirements}}

PREFERRED REQUIREMENTS
{{preferred_requirements}}

REQUIRED LICENSES
{{required_licenses}}

REQUIRED CERTIFICATIONS
{{required_certifications}}

EDUCATION REQUIREMENTS
{{education_requirements}}

REQUIRED YEARS EXPERIENCE
{{required_years_experience}}

FULL JOB DESCRIPTION
{{job_description}}

CANDIDATE INFORMATION
Candidate résumé text:
{{candidate_resume}}

Recruiter-provided verified information:
{{verified_recruiter_info}}

General recruiter notes:
{{recruiter_notes}}

INSTRUCTIONS

1. Extract and classify against JD requirements only. Do not invent skills, certs, dates, products, or scope.
2. Do not score. Do not recommend submit/hold. Do not return strengths or questions.
3. Ignore work auth, citizenship, sponsorship, pay, availability, travel, relocation, onsite/remote, shift, and W2/C2C.
4. One short evidence line with the job and date when status is CONFIRMED or PARTIAL.
5. Return valid JSON only using the Step 1 Quick Match structure. The app recomputes quick_route.`;

const CALL_PACK_USER = `Write the List of screening questions for Step 2 Verifications (call pack).

JOB
{{job_title}}

QUALIFICATION CHECKLIST (recruiter-updated)
{{qualification_checklist}}

INSTRUCTIONS
1. Evaluate the checklist and recruiter notes.
2. Return 3–5 focused questions the recruiter should ask on the call.
3. Each question must map to a related_requirement from the checklist.
4. reason must cite the recruiter note or the remaining gap.
5. If every mandatory item is Confirmed and no note is open, return an empty screening_questions array.`;

const FOLLOW_UP_USER = `Write Follow-Up enrichment screening questions (Step 3).

JOB
{{job_title}}

QUALIFICATION CHECKLIST (recruiter-updated after Verifications)
{{qualification_checklist}}

RECRUITER ENRICHMENT NOTES
{{enrichment_notes}}

INSTRUCTIONS
1. Use remaining open verification items and new notes from Verifications.
2. Return 0–5 focused questions. Prefer empty array when nothing remains open.
3. Each question must map to a related_requirement from the checklist.
4. Do not re-ask Confirmed items unless a note still flags something open.
5. Return valid JSON only.`;

const DEEP_USER = `Analyze the candidate's match for the job below.
Treat "recent" experience as work within the past {{recent_experience_months}} months.

JOB INFORMATION
Job ID: {{job_id}}
Job title: {{job_title}}
Client / MSP: {{msp_or_client}}
Specialty: {{specialty}}
Location: {{location}}

MANDATORY REQUIREMENTS
{{mandatory_requirements}}

PREFERRED REQUIREMENTS
{{preferred_requirements}}

REQUIRED LICENSES
{{required_licenses}}

REQUIRED CERTIFICATIONS
{{required_certifications}}

EDUCATION REQUIREMENTS
{{education_requirements}}

REQUIRED YEARS EXPERIENCE
{{required_years_experience}}

FULL JOB DESCRIPTION
{{job_description}}

CANDIDATE INFORMATION
Candidate résumé text:
{{candidate_resume}}

Recruiter-provided verified information:
{{verified_recruiter_info}}

General recruiter notes:
{{recruiter_notes}}

INSTRUCTIONS

1. Compare each requirement above against the candidate's documented background.
2. Calculate relevant experience without double-counting overlapping employment.
3. Identify confirmed qualifications, partial evidence, missing information, conflicts, and clearly unmet requirements.
4. Assign recommended subscores.
5. Recommend an overall match score and match category.
6. Apply the mandatory-requirement override when appropriate.
7. Recommend recruiter action.
8. Generate no more than 5 focused screening questions.
9. Do not infer qualifications that are not documented.
10. Quote or closely reference exact candidate evidence for every qualification.
11. Keep evidence statements concise (1-2 sentences each).
12. Return valid JSON only using the required response structure.`;

const SUBMISSION_USER = `Target job: {{job_title}}
Candidate: {{candidate_name}}
Contact: {{candidate_contact}}

Recruiter summary: {{recruiter_summary}}

Confirmed evidence:
{{confirmed_evidence}}

Strengths:
{{strengths}}

Recruiter enrichment from Verifications / Follow-Up / Deep Match:
{{enrichment_notes}}

Original résumé:
{{candidate_resume}}`;

const QUICK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "step",
    "quick_route",
    "extracted_resume",
    "mandatory_requirements",
    "preferred_requirements",
    "counts",
    "mand_met",
    "pref_met",
    "weighted",
    "blocking_requirements",
    "items_to_verify",
  ],
  properties: {
    step: { type: "string", const: "quick_match" },
    quick_route: { type: "string", enum: ["STRONG", "REVIEW", "LOW_MATCH"] },
    extracted_resume: { type: "object" },
    mandatory_requirements: { type: "array" },
    preferred_requirements: { type: "array" },
    counts: { type: "object" },
    mand_met: { type: "number" },
    pref_met: { type: "number" },
    weighted: { type: "number" },
    blocking_requirements: { type: "array" },
    items_to_verify: { type: "array" },
  },
};

const SCREENING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["screening_questions"],
  properties: {
    screening_questions: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "question", "reason", "related_requirement"],
        properties: {
          priority: { type: "integer" },
          question: { type: "string" },
          reason: { type: "string" },
          related_requirement: { type: "string" },
        },
      },
    },
  },
};

const SUBMISSION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fullName", "headline", "summary", "skills", "experience", "education", "licenses"],
  properties: {
    fullName: { type: "string" },
    headline: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    location: { type: "string" },
    summary: { type: "string" },
    skills: { type: "array", items: { type: "string" } },
    experience: { type: "array" },
    education: { type: "array" },
    licenses: { type: "array", items: { type: "string" } },
  },
};

// Deep schema mirrors the published catalog structure (object required keys).
const DEEP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "analysis_version",
    "job",
    "candidate_match",
    "subscores",
    "experience_analysis",
    "mandatory_requirements",
    "preferred_requirements",
    "strengths",
    "gaps_and_risks",
    "screening_questions",
    "submission_readiness",
    "alternative_fit",
    "data_quality",
  ],
  properties: {
    analysis_version: { type: "string" },
    job: { type: "object" },
    candidate_match: { type: "object" },
    subscores: { type: "object" },
    experience_analysis: { type: "object" },
    mandatory_requirements: { type: "array" },
    preferred_requirements: { type: "array" },
    strengths: { type: "array" },
    gaps_and_risks: { type: "array" },
    screening_questions: { type: "array" },
    submission_readiness: { type: "object" },
    alternative_fit: { type: "object" },
    data_quality: { type: "object" },
  },
};

const STEPS = [
  {
    key: "quick",
    stepNumber: 1,
    name: "Quick Match",
    description: "Step 1 · Quick Match checklist (no match %). Volume Grok Fast.",
    system: QUICK_SYSTEM,
    user: QUICK_USER,
    schema: QUICK_SCHEMA,
    model: {
      provider: "xai",
      model: "grok-4-fast",
      temperature: 0,
      progression_step: 1,
      progression_stage: "quick",
      fallback_models: ["gemini-3.5-flash-lite", "gpt-5.4-nano"],
    },
    reason: "Map Step 1 Quick Match hardcoded prompt into AI prompt catalog with versioning.",
  },
  {
    key: "call_pack",
    stepNumber: 2,
    name: "Verifications",
    description: "Step 2 · Verifications / call pack screening questions.",
    system: FOLLOW_UP_SYSTEM,
    user: CALL_PACK_USER,
    schema: SCREENING_SCHEMA,
    model: {
      provider: "xai",
      model: "grok-4-fast",
      temperature: 0,
      progression_step: 2,
      progression_stage: "call_pack",
      fallback_models: ["gemini-3.5-flash-lite"],
    },
    reason: "Map Step 2 Verifications (call_pack) prompt into AI prompt catalog with versioning.",
  },
  {
    key: "follow_up",
    stepNumber: 3,
    name: "Follow-Up",
    description: "Step 3 · Follow-Up enrichment screening questions.",
    system: FOLLOW_UP_SYSTEM,
    user: FOLLOW_UP_USER,
    schema: SCREENING_SCHEMA,
    model: {
      provider: "xai",
      model: "grok-4-fast",
      temperature: 0,
      progression_step: 3,
      progression_stage: "follow_up",
      fallback_models: ["gemini-3.5-flash-lite"],
    },
    reason: "Map Step 3 Follow-Up enrichment prompt into AI prompt catalog with versioning.",
  },
  {
    key: "deep",
    stepNumber: 4,
    name: "Deep Match",
    description: "Step 4 · Deep Match (paid). Writes candidate match %.",
    system: DEEP_SYSTEM,
    user: DEEP_USER,
    schema: DEEP_SCHEMA,
    model: {
      provider: "google",
      model: "gemini-3.1-pro-preview",
      temperature: 0,
      progression_step: 4,
      progression_stage: "deep",
      fallback_models: ["grok-4.6", "gpt-5.4"],
      base_max_tokens: 16000,
      long_resume_max_tokens: 24000,
      long_resume_chars: 8000,
    },
    reason: "Ensure Step 4 Deep Match progression mapping; publish current Deep prompt if missing on this vertical.",
    onlyIfNoPublished: true,
  },
  {
    key: "submission",
    stepNumber: 5,
    name: "Submission",
    description: "Step 5 · Submission résumé rewrite for MSP / client.",
    system: SUBMISSION_SYSTEM,
    user: SUBMISSION_USER,
    schema: SUBMISSION_SCHEMA,
    model: {
      provider: "xai",
      model: "grok-4.6",
      temperature: 0,
      progression_step: 5,
      progression_stage: "submission",
      base_max_tokens: 4000,
    },
    reason: "Map Step 5 Submission résumé prompt into AI prompt catalog with versioning.",
  },
];

const parts = [];
parts.push(`-- AI Match progression steps 1–5 → ai_variant / ai_prompt_template / ai_prompt_version
-- Generated by scripts/generate-ai-progression-prompt-seed.mjs
-- Idempotent: skips templates/versions that already exist; deep only seeds when no published body.

-- ---------------------------------------------------------------------------
-- Progression variants (steps 1–5). Keep legacy default + client_gate.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_variant (key, name, description) VALUES
  ('quick', 'Quick Match', 'Step 1 · Quick Match checklist (no match %).'),
  ('call_pack', 'Verifications', 'Step 2 · Verifications / call pack screening questions.'),
  ('follow_up', 'Follow-Up', 'Step 3 · Follow-Up enrichment.'),
  ('submission', 'Submission', 'Step 5 · Submission résumé rewrite.')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

UPDATE public.ai_variant
SET description = 'Step 4 · Deep Match (paid). Writes candidate match %.'
WHERE key = 'deep'
  AND (description IS DISTINCT FROM 'Step 4 · Deep Match (paid). Writes candidate match %.');

-- Master templates for all industry packs × progression variants
INSERT INTO public.ai_prompt_template (tenant_id, feature_id, variant_id, vertical_id, name, description)
SELECT
  NULL,
  f.id,
  v.id,
  y.id,
  initcap(replace(y.key, '_', ' ')) || ' ' || v.name || ' Candidate Match',
  v.description
FROM public.ai_feature f
CROSS JOIN public.ai_variant v
CROSS JOIN public.ai_vertical y
WHERE f.key = 'candidate_match'
  AND y.kind = 'industry'
  AND v.key IN ('quick', 'call_pack', 'follow_up', 'deep', 'submission')
  AND NOT EXISTS (
    SELECT 1
    FROM public.ai_prompt_template t
    WHERE t.tenant_id IS NULL
      AND t.feature_id = f.id
      AND t.variant_id = v.id
      AND t.vertical_id = y.id
  );
`);

for (const step of STEPS) {
  const tag = `s${step.stepNumber}_${step.key}`;
  const onlyIf = step.onlyIfNoPublished
    ? `
  AND NOT EXISTS (
    SELECT 1 FROM public.ai_prompt_version existing
    WHERE existing.template_id = t.id
      AND existing.status = 'published'
  )`
    : `
  AND NOT EXISTS (
    SELECT 1 FROM public.ai_prompt_version existing
    WHERE existing.template_id = t.id
  )`;

  parts.push(`
-- Step ${step.stepNumber}: ${step.name} (${step.key})
INSERT INTO public.ai_prompt_version (
  template_id, version_number, status, is_current,
  system_prompt, user_prompt_template, response_schema, model_config,
  created_at, updated_at
)
SELECT t.id, 1, 'draft', false,
  ${sqlDollar(`${tag}_sys`, step.system)},
  ${sqlDollar(`${tag}_usr`, step.user)},
  ${sqlJson(`${tag}_sch`, step.schema)},
  ${sqlJson(`${tag}_cfg`, step.model)},
  now(), now()
FROM public.ai_prompt_template t
JOIN public.ai_feature f ON f.id = t.feature_id
JOIN public.ai_variant v ON v.id = t.variant_id
JOIN public.ai_vertical y ON y.id = t.vertical_id
WHERE t.tenant_id IS NULL
  AND f.key = 'candidate_match'
  AND v.key = '${step.key}'
  AND y.key = 'global'${onlyIf};

SELECT public.publish_ai_prompt_version(pv.id, ${sqlDollar(`${tag}_why`, step.reason)})
FROM public.ai_prompt_version pv
JOIN public.ai_prompt_template t ON t.id = pv.template_id
JOIN public.ai_feature f ON f.id = t.feature_id
JOIN public.ai_variant v ON v.id = t.variant_id
JOIN public.ai_vertical y ON y.id = t.vertical_id
WHERE t.tenant_id IS NULL
  AND f.key = 'candidate_match'
  AND v.key = '${step.key}'
  AND y.key = 'global'
  AND pv.status = 'draft'
  AND pv.version_number = 1;
`);
}

parts.push(`
-- Mapping view for godadmin / ops (security invoker).
-- Step numbers come from variant keys so existing published Deep rows map without mutation.
CREATE OR REPLACE VIEW public.ai_match_progression_prompts
WITH (security_invoker = true) AS
SELECT
  CASE v.key
    WHEN 'quick' THEN 1
    WHEN 'call_pack' THEN 2
    WHEN 'follow_up' THEN 3
    WHEN 'deep' THEN 4
    WHEN 'submission' THEN 5
  END AS step_number,
  CASE v.key
    WHEN 'quick' THEN 'quick'
    WHEN 'call_pack' THEN 'call_pack'
    WHEN 'follow_up' THEN 'follow_up'
    WHEN 'deep' THEN 'deep'
    WHEN 'submission' THEN 'submission'
  END AS stage,
  v.key AS variant_key,
  v.name AS variant_name,
  y.key AS vertical_key,
  pv.id AS prompt_version_id,
  pv.version_number,
  pv.status,
  pv.is_current,
  pv.content_hash,
  pv.published_at,
  pv.effective_from,
  pv.created_at,
  pv.updated_at,
  pv.change_reason,
  length(pv.system_prompt) AS system_prompt_chars
FROM public.ai_prompt_version pv
JOIN public.ai_prompt_template t ON t.id = pv.template_id
JOIN public.ai_feature f ON f.id = t.feature_id
JOIN public.ai_variant v ON v.id = t.variant_id
JOIN public.ai_vertical y ON y.id = t.vertical_id
WHERE f.key = 'candidate_match'
  AND t.tenant_id IS NULL
  AND v.key IN ('quick', 'call_pack', 'follow_up', 'deep', 'submission')
  AND y.key = 'global'
  AND pv.is_current = true
  AND pv.status = 'published';

GRANT SELECT ON public.ai_match_progression_prompts TO authenticated, service_role;

COMMENT ON VIEW public.ai_match_progression_prompts IS
  'Current published Global AI Match progression prompts (steps 1–5) with version and timestamps.';
`);

const outDir = join(root, "supabase/migrations");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, "20260925133000_ai_match_progression_prompt_variants.sql");
writeFileSync(out, parts.join("\n"), "utf8");
console.log(`Wrote ${out}`);
console.log(
  "Steps:",
  STEPS.map((s) => `${s.stepNumber}:${s.key}(${s.system.length}c)`).join(", ")
);
