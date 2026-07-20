import type { EmploymentType } from "@/lib/jobs/types";
import type { WorkflowMappingInput } from "@/lib/workflow-mappings/types";

export type PublishedWorkflowMeta = {
  id: string;
  tenantId: string;
  name: string;
  status: string;
  employmentType?: string | null;
};

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

  return null;
}

export function formatRoutingCriteriaLabel(input: {
  professionName: string;
  employmentType: EmploymentType;
  placementType: string;
}): string {
  return `${input.professionName} + ${input.employmentType} + ${input.placementType}`;
}
