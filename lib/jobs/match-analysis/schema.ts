import { z } from "zod";

export const MATCH_CATEGORIES = [
  "STRONG_MATCH",
  "GOOD_MATCH",
  "POSSIBLE_MATCH",
  "WEAK_MATCH",
  "NOT_A_MATCH",
  "NOT_CURRENTLY_SUBMITTABLE",
  "NEEDS_MORE_INFORMATION",
] as const;

export const RECOMMENDED_ACTIONS = [
  "PRIORITIZE_AND_CALL",
  "CALL_AND_VERIFY",
  "KEEP_AS_POSSIBLE",
  "REDIRECT_TO_OTHER_JOB",
  "STOP_FOR_THIS_JOB",
] as const;

export const READINESS_STATUSES = [
  "READY_TO_SUBMIT",
  "VERIFY_BEFORE_SUBMISSION",
  "NOT_CURRENTLY_SUBMITTABLE",
  "INSUFFICIENT_INFORMATION",
] as const;

export const REQUIREMENT_STATUSES = [
  "CONFIRMED",
  "PARTIAL",
  "NOT_FOUND",
  "CONFLICTING",
  "NOT_APPLICABLE",
] as const;

export const REQUIREMENT_OUTCOMES = [
  "MET",
  "VERIFY",
  "NOT_MET",
  "CONFLICT",
  "NOT_APPLICABLE",
] as const;

export const EVIDENCE_SOURCES = [
  "RESUME",
  "VERIFIED_RECRUITER_INPUT",
  "JOB_DESCRIPTION",
  "STRUCTURED_JOB_FIELD",
  "RECRUITER_NOTE",
  "NONE",
] as const;

export const AI_MATCH_PIPELINE_STATUSES = [
  "READY",
  "ANALYZING",
  "ANALYZED",
  "FAILED",
  "NEEDS_REVIEW",
] as const;

export const PIPELINE_PROGRESS_STEPS = [
  "preparing",
  "analyzing",
  "validating",
  "saving",
  "completed",
  "failed",
] as const;

export type MatchCategory = (typeof MATCH_CATEGORIES)[number];
export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];
export type RequirementOutcome = (typeof REQUIREMENT_OUTCOMES)[number];
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];
export type AiMatchPipelineStatus = (typeof AI_MATCH_PIPELINE_STATUSES)[number];
export type PipelineProgressStep = (typeof PIPELINE_PROGRESS_STEPS)[number];

const clampedScore = z.coerce.number().min(0).max(100);
const optionalYears = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(n, 80)) : null;
  });

export const requirementItemSchema = z.object({
  requirement: z.string().trim().min(1).max(2000),
  requirement_type: z.enum(["MANDATORY", "PREFERRED"]),
  status: z.enum(REQUIREMENT_STATUSES),
  requirement_outcome: z.enum(REQUIREMENT_OUTCOMES),
  candidate_evidence: z.string().max(4000).default(""),
  evidence_source: z.enum(EVIDENCE_SOURCES).default("NONE"),
  impact: z.string().max(2000).default(""),
  verification_required: z.boolean().default(false),
  confidence: clampedScore.default(0),
});

export const screeningQuestionSchema = z.object({
  priority: z.coerce.number().int().min(1).max(5),
  question: z.string().trim().min(1).max(1000),
  reason: z.string().max(1000).default(""),
  related_requirement: z.string().max(1000).default(""),
});

export const matchAnalysisResponseSchema = z.object({
  analysis_version: z.string().default("1.0"),
  job: z
    .object({
      job_id: z.string().default(""),
      job_title: z.string().default(""),
      msp_or_client: z.string().default(""),
      specialty: z.string().default(""),
      location: z.string().default(""),
    })
    .default({
      job_id: "",
      job_title: "",
      msp_or_client: "",
      specialty: "",
      location: "",
    }),
  candidate_match: z.object({
    recommended_overall_match_score: clampedScore.default(0),
    match_category: z.enum(MATCH_CATEGORIES),
    display_category: z.string().default(""),
    confidence_score: clampedScore.default(0),
    mandatory_requirement_override: z.boolean().default(false),
    recommended_action: z.enum(RECOMMENDED_ACTIONS),
    recruiter_decision_summary: z.string().max(4000).default(""),
  }),
  subscores: z
    .object({
      mandatory_requirements_score: clampedScore.default(0),
      specialty_experience_score: clampedScore.default(0),
      clinical_skills_score: clampedScore.default(0),
      licenses_certifications_score: clampedScore.default(0),
      work_setting_equipment_score: clampedScore.default(0),
      preferred_qualifications_score: clampedScore.default(0),
    })
    .default({
      mandatory_requirements_score: 0,
      specialty_experience_score: 0,
      clinical_skills_score: 0,
      licenses_certifications_score: 0,
      work_setting_equipment_score: 0,
      preferred_qualifications_score: 0,
    }),
  experience_analysis: z
    .object({
      total_professional_experience_years: optionalYears.default(null),
      relevant_specialty_experience_years: optionalYears.default(null),
      recent_relevant_experience_years: optionalYears.default(null),
      travel_experience_confirmed: z.boolean().default(false),
      required_work_setting_experience_confirmed: z.boolean().default(false),
      is_estimated: z.boolean().default(false),
      experience_calculation_notes: z.array(z.string().max(500)).max(20).default([]),
    })
    .default({
      total_professional_experience_years: null,
      relevant_specialty_experience_years: null,
      recent_relevant_experience_years: null,
      travel_experience_confirmed: false,
      required_work_setting_experience_confirmed: false,
      is_estimated: false,
      experience_calculation_notes: [],
    }),
  mandatory_requirements: z.array(requirementItemSchema).max(60).default([]),
  preferred_requirements: z.array(requirementItemSchema).max(60).default([]),
  strengths: z.array(z.string().max(1000)).max(20).default([]),
  gaps_and_risks: z.array(z.string().max(1000)).max(20).default([]),
  screening_questions: z.array(screeningQuestionSchema).max(5).default([]),
  submission_readiness: z
    .object({
      ready_to_submit: z.boolean().default(false),
      readiness_status: z.enum(READINESS_STATUSES),
      items_to_verify_before_submission: z.array(z.string().max(1000)).max(30).default([]),
      documents_or_credentials_needed: z.array(z.string().max(1000)).max(30).default([]),
      blocking_requirements: z.array(z.string().max(1000)).max(30).default([]),
    })
    .default({
      ready_to_submit: false,
      readiness_status: "INSUFFICIENT_INFORMATION",
      items_to_verify_before_submission: [],
      documents_or_credentials_needed: [],
      blocking_requirements: [],
    }),
  alternative_fit: z
    .object({
      redirect_recommended: z.boolean().default(false),
      redirect_reason: z.string().max(2000).default(""),
      possible_job_types: z.array(z.string().max(200)).max(20).default([]),
    })
    .default({
      redirect_recommended: false,
      redirect_reason: "",
      possible_job_types: [],
    }),
  data_quality: z
    .object({
      resume_completeness: z.enum(["HIGH", "MODERATE", "LOW"]).default("MODERATE"),
      job_description_completeness: z.enum(["HIGH", "MODERATE", "LOW"]).default("MODERATE"),
      job_description_conflicts: z.array(z.string().max(500)).max(20).default([]),
      resume_conflicts: z.array(z.string().max(500)).max(20).default([]),
      missing_information: z.array(z.string().max(500)).max(30).default([]),
    })
    .default({
      resume_completeness: "MODERATE",
      job_description_completeness: "MODERATE",
      job_description_conflicts: [],
      resume_conflicts: [],
      missing_information: [],
    }),
});

export type RequirementItem = z.infer<typeof requirementItemSchema>;
export type MatchAnalysisResponse = z.infer<typeof matchAnalysisResponseSchema>;

export const structuredJobRequirementsSchema = z.object({
  mandatoryRequirements: z.array(z.string().max(1000)).max(40).default([]),
  preferredRequirements: z.array(z.string().max(1000)).max(40).default([]),
  requiredLicenses: z.array(z.string().max(200)).max(20).default([]),
  requiredCertifications: z.array(z.string().max(200)).max(20).default([]),
  educationRequirements: z.array(z.string().max(500)).max(10).default([]),
  requiredYearsExperience: z.string().max(100).nullable().optional(),
  specialty: z.string().max(200).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
});

export type StructuredJobRequirements = z.infer<typeof structuredJobRequirementsSchema>;

export const MATCH_ANALYSIS_ERROR =
  "We couldn’t complete the match analysis right now. Please try again.";

/** Display labels for match categories. */
export const MATCH_CATEGORY_LABELS: Record<MatchCategory, string> = {
  STRONG_MATCH: "Strong Match",
  GOOD_MATCH: "Good Match",
  POSSIBLE_MATCH: "Possible Match",
  WEAK_MATCH: "Weak Match",
  NOT_A_MATCH: "Not a Match",
  NOT_CURRENTLY_SUBMITTABLE: "Not Currently Submittable",
  NEEDS_MORE_INFORMATION: "Needs More Information",
};

export const RECOMMENDED_ACTION_LABELS: Record<RecommendedAction, string> = {
  PRIORITIZE_AND_CALL: "Prioritize & Call",
  CALL_AND_VERIFY: "Call & Verify",
  KEEP_AS_POSSIBLE: "Keep as Possible",
  REDIRECT_TO_OTHER_JOB: "Redirect to Other Job",
  STOP_FOR_THIS_JOB: "Stop for This Job",
};
