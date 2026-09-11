import type { PromptTemplateVariables } from "./types";
import type { StructuredJobRequirements } from "@/lib/jobs/match-analysis/schema";

export type MatchAnalysisVariableInput = {
  jobId: string;
  jobTitle: string;
  mspOrClient?: string | null;
  specialty?: string | null;
  location?: string | null;
  structured: StructuredJobRequirements;
  fullJobDescription: string;
  resumeText: string;
  verifiedRecruiterInfo?: Record<string, unknown> | null;
  recruiterNotes?: string | null;
  recentExperienceMonths?: number;
};

function bullets(items: string[] | undefined | null, emptyLabel = "(none provided)"): string {
  const list = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (!list.length) return emptyLabel;
  return list.map((item) => `- ${item}`).join("\n");
}

function hasListedRequirements(structured: StructuredJobRequirements): boolean {
  return (
    structured.mandatoryRequirements.some((item) => item.trim()) ||
    structured.preferredRequirements.some((item) => item.trim())
  );
}

export function assembleMatchAnalysisVariables(
  input: MatchAnalysisVariableInput
): PromptTemplateVariables {
  const months = input.recentExperienceMonths ?? 24;
  const verified = input.verifiedRecruiterInfo
    ? JSON.stringify(input.verifiedRecruiterInfo, null, 2)
    : "{}";
  const notes = (input.recruiterNotes ?? "").trim() || "(none)";
  return {
    job_id: input.jobId || "(unknown)",
    job_title: input.jobTitle || "(unknown)",
    candidate_name: "",
    msp_or_client: input.mspOrClient?.trim() || "(unknown)",
    specialty: input.specialty?.trim() || input.structured.specialty?.trim() || "(unknown)",
    location: input.location?.trim() || input.structured.location?.trim() || "(unknown)",
    recent_experience_months: String(months),
    mandatory_requirements: bullets(
      input.structured.mandatoryRequirements,
      hasListedRequirements(input.structured)
        ? "(none provided)"
        : "(not listed separately — extract every Required Qualifications bullet from the full job description into mandatory_requirements. Do not return an empty array.)"
    ),
    preferred_requirements: bullets(
      input.structured.preferredRequirements,
      hasListedRequirements(input.structured)
        ? "(none provided)"
        : "(not listed separately — extract every Preferred Qualifications bullet from the full job description into preferred_requirements. Do not return an empty array.)"
    ),
    required_licenses: bullets(input.structured.requiredLicenses),
    required_certifications: bullets(input.structured.requiredCertifications),
    education_requirements: bullets(input.structured.educationRequirements),
    required_years_experience: input.structured.requiredYearsExperience?.trim() || "(not specified)",
    job_description: input.fullJobDescription.trim() || "(none)",
    candidate_resume: input.resumeText.trim() || "(empty)",
    verified_recruiter_info: verified,
    recruiter_notes: notes,
  };
}
