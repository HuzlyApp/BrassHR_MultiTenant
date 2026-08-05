import type { EmploymentType } from "@/lib/jobs/types";
import type { WorkflowMappingInput, WorkflowMappingKey } from "@/lib/workflow-mappings/types";

export type PublishedWorkflowMeta = {
  id: string;
  tenantId: string;
  name: string;
  status: string;
  employmentType?: string | null;
};

export type MappingCandidate = {
  id: string;
  workflowId: string;
  workflowName: string;
  priority: number;
  createdAt: string;
  employmentType: EmploymentType;
  professionId: string | null;
  specialtyId: string | null;
  location: string | null;
  locationType: string | null;
  yearsOfExperience: string | null;
};

function norm(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.toLowerCase() : null;
}

/** Count of configured (non-wildcard) attributes on a mapping rule. */
export function mappingSpecificity(mapping: {
  employmentType?: string | null;
  professionId?: string | null;
  specialtyId?: string | null;
  location?: string | null;
  locationType?: string | null;
  yearsOfExperience?: string | null;
}): number {
  let score = 0;
  if (mapping.employmentType) score += 1;
  if (mapping.professionId) score += 1;
  if (mapping.specialtyId) score += 1;
  if (norm(mapping.location)) score += 1;
  if (norm(mapping.locationType)) score += 1;
  if (norm(mapping.yearsOfExperience)) score += 1;
  return score;
}

function attributeMatches(
  mappingValue: string | null | undefined,
  jobValue: string | null | undefined,
  { caseInsensitive = false }: { caseInsensitive?: boolean } = {}
): boolean {
  const mapped = mappingValue?.trim() || null;
  if (!mapped) return true; // wildcard
  const job = jobValue?.trim() || null;
  if (!job) return false;
  if (caseInsensitive) return mapped.toLowerCase() === job.toLowerCase();
  return mapped === job;
}

/** True when every configured attribute on the mapping matches the job key. */
export function mappingMatchesJob(mapping: MappingCandidate, job: WorkflowMappingKey): boolean {
  if (mapping.employmentType !== job.employmentType) return false;
  if (mapping.professionId && mapping.professionId !== (job.professionId ?? null)) return false;
  if (mapping.specialtyId && mapping.specialtyId !== (job.specialtyId ?? null)) return false;
  if (!attributeMatches(mapping.location, job.location, { caseInsensitive: true })) return false;
  if (!attributeMatches(mapping.locationType, job.locationType, { caseInsensitive: true })) {
    return false;
  }
  if (
    !attributeMatches(mapping.yearsOfExperience, job.yearsOfExperience, {
      caseInsensitive: true,
    })
  ) {
    return false;
  }
  return true;
}

/**
 * Prefer the most specific matching rule; ties break on lowest priority number,
 * then earliest created_at.
 */
export function pickBestMappingMatch(
  candidates: MappingCandidate[],
  job: WorkflowMappingKey
): (MappingCandidate & { specificity: number }) | null {
  const matches = candidates
    .filter((candidate) => mappingMatchesJob(candidate, job))
    .map((candidate) => ({
      ...candidate,
      specificity: mappingSpecificity(candidate),
    }));

  if (!matches.length) return null;

  matches.sort((a, b) => {
    if (b.specificity !== a.specificity) return b.specificity - a.specificity;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return matches[0] ?? null;
}

export function validateWorkflowCompatibility(
  criteria: Pick<WorkflowMappingInput, "employmentType">,
  workflow: PublishedWorkflowMeta
): string | null {
  if (workflow.status !== "published") {
    return "Only published workflows can be mapped.";
  }

  const workflowEmployment = workflow.employmentType?.trim() || null;
  if (!workflowEmployment) return null;

  if (criteria.employmentType === "W2" && workflowEmployment === "1099") {
    return "W2 job criteria cannot be mapped to a 1099-only workflow.";
  }
  if (criteria.employmentType === "1099" && workflowEmployment === "W2") {
    return "1099 job criteria cannot be mapped to a W2-only workflow.";
  }
  if (criteria.employmentType === "Contract" && workflowEmployment !== "Contract") {
    // Contract/R&R may map to Contract-tagged flows or untagged flows only.
    if (workflowEmployment === "W2" || workflowEmployment === "1099") {
      return "R&R job criteria cannot be mapped to a W2 or 1099-only workflow.";
    }
  }

  return null;
}

export function formatRoutingCriteriaLabel(input: {
  employmentType: EmploymentType;
  professionName?: string | null;
  specialtyName?: string | null;
  location?: string | null;
  locationType?: string | null;
  yearsOfExperience?: string | null;
}): string {
  const parts: string[] = [];
  const employmentLabel = input.employmentType === "Contract" ? "R&R" : input.employmentType;
  parts.push(employmentLabel);
  if (input.professionName?.trim()) parts.push(input.professionName.trim());
  if (input.specialtyName?.trim()) parts.push(input.specialtyName.trim());
  if (input.locationType?.trim()) parts.push(input.locationType.trim());
  if (input.location?.trim()) parts.push(input.location.trim());
  if (input.yearsOfExperience?.trim()) parts.push(`${input.yearsOfExperience.trim()} yrs`);
  return parts.join(" + ");
}

export function employmentTypeDisplayLabel(type: EmploymentType): string {
  return type === "Contract" ? "R&R" : type;
}
