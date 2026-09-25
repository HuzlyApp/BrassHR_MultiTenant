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

export type FollowUpChecklistVariableRow = {
  requirement: string;
  type: string;
  status: string;
  recruiterNote: string;
  candidateQuestion: string;
  candidateResponse: string;
};

export function assembleFollowUpPromptVariables(input: {
  jobTitle?: string | null;
  checklist: FollowUpChecklistVariableRow[];
  enrichmentNotes?: string | null;
}): PromptTemplateVariables {
  const lines = input.checklist.length
    ? input.checklist.map((row, index) => {
        const parts = [`${index + 1}. [${row.status}] ${row.type}: ${row.requirement}`];
        if (row.recruiterNote) parts.push(`   Recruiter note: ${row.recruiterNote}`);
        if (row.candidateQuestion) parts.push(`   Question sent: ${row.candidateQuestion}`);
        if (row.candidateResponse) parts.push(`   Candidate reply: ${row.candidateResponse}`);
        return parts.join("\n");
      })
    : ["(empty checklist)"];
  return {
    job_title: input.jobTitle?.trim() || "(unknown)",
    qualification_checklist: lines.join("\n"),
    enrichment_notes: String(input.enrichmentNotes ?? "").trim() || "(none)",
  };
}

export function assembleSubmissionResumeVariables(input: {
  jobTitle?: string | null;
  candidateName?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  recruiterSummary?: string | null;
  confirmedEvidence?: string[] | null;
  strengths?: string[] | null;
  enrichmentNotes?: string | null;
  resumeText?: string | null;
}): PromptTemplateVariables {
  const contact = [input.email, input.phone, input.location]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" | ");
  const confirmed = (input.confirmedEvidence ?? []).map((line) => line.trim()).filter(Boolean);
  const strengths = (input.strengths ?? []).map((line) => line.trim()).filter(Boolean);
  return {
    job_title: input.jobTitle?.trim() || "Unknown",
    candidate_name: input.candidateName?.trim() || "Candidate",
    candidate_contact: contact || "(none)",
    recruiter_summary: input.recruiterSummary?.trim() || "(none)",
    confirmed_evidence: confirmed.length
      ? confirmed.map((line) => `- ${line}`).join("\n")
      : "(none)",
    strengths: strengths.length ? strengths.map((line) => `- ${line}`).join("\n") : "(none)",
    enrichment_notes: String(input.enrichmentNotes ?? "").trim() || "(none)",
    candidate_resume: String(input.resumeText ?? "").trim() || "(no résumé text)",
  };
}
