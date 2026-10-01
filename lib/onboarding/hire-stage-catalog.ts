/**
 * Hire-journey stage for each library step key.
 * Source: supabase/migrations/20260915163426_map_prehire_posthire_ui_step_library.sql
 * (`stage_name` written into onboarding_step_library.default_settings).
 * Keyword guesses are not this map.
 */
export const HIRE_STAGE_BY_STEP_KEY: Record<string, string> = {
  "collect-extra-files": "Intake",
  "collect-references": "Intake",
  "custom-form": "Intake",
  "resume-basic-profile": "Intake",
  "parameterized-job-application": "Intake",
  "references-collection": "Intake",
  "custom-application-form": "Intake",

  "recruiter-screening": "Screening",
  "skill-qualification-assessment": "Screening",
  "reference-verification": "Screening",

  "interview-qualification": "Interview",
  "internal-select": "Interview",
  "client-review": "Interview",
  "candidate-selection": "Interview",

  "release-to-client": "Submission",

  "background-check": "Compliance",
  "drug-test-screening": "Compliance",
  "oig-exclusion-check": "Compliance",
  "credential-license-verification": "Compliance",
  "ssn-identity-verification": "Compliance",
  "adverse-action-process": "Compliance",

  "pay-rate-hire-date": "Offer & Agreement",
  "offer-acceptance": "Offer & Agreement",
  "employee-agreement": "Offer & Agreement",
  "i9-right-to-work-verification": "Offer & Agreement",

  "manager-facility-approval": "Approvals",
  "hr-final-approval": "Approvals",

  "tax-forms": "Paperwork",
  "i9-section-2": "Paperwork",
  "document-upload": "Paperwork",

  "direct-deposit-setup": "Payroll & Pay",
  "benefits-enrollment": "Payroll & Pay",
  "401k-enrollment": "Payroll & Pay",
  "payroll-profile-creation": "Payroll & Pay",

  "welcome-packet-esign": "Policies",
  "policy-acknowledgment": "Policies",

  "equipment-badge-acknowledgment": "Access & Equipment",
  "badge-equipment-issuance": "Access & Equipment",
  "schedule-assignment": "Access & Equipment",
  "facility-access-setup": "Access & Equipment",
  "benefits-confirmation": "Access & Equipment",

  "safety-training": "Training",
  "training-modules-quiz": "Training",
  "orientation-video": "Training",
  "compliance-training": "Training",
  "certification-upload": "Training",

  "welcome-email": "Kickoff",
  "manager-welcome-call": "Kickoff",

  "final-onboarding-call": "Day One Ready",
  "buddy-mentor-assignment": "Day One Ready",
  "completion-milestone": "Day One Ready",
};

export function hireStageForStepKey(stepKey: string | null | undefined): string | null {
  const key = String(stepKey ?? "").trim();
  if (!key) return null;
  return HIRE_STAGE_BY_STEP_KEY[key] ?? HIRE_STAGE_BY_STEP_KEY[key.replace(/^step-/, "")] ?? null;
}

/** Persist the library stage on a workflow snapshot when the builder did not set one. */
export function stampHireStageOnStepSettings(
  stepKey: string,
  settings: Record<string, unknown>
): Record<string, unknown> {
  const existing = settings.stageName;
  if (typeof existing === "string" && existing.trim()) return settings;
  const stageName = hireStageForStepKey(stepKey);
  if (!stageName) return settings;
  return { ...settings, stageName };
}
