import type { EmploymentType } from "@/lib/jobs/types";

export type WorkflowMappingKey = {
  employmentType: EmploymentType;
  professionId?: string | null;
  specialtyId?: string | null;
  location?: string | null;
  locationType?: string | null;
  yearsOfExperience?: string | null;
};

export type WorkflowMappingInput = WorkflowMappingKey & {
  id?: string;
  workflowId: string;
  isActive?: boolean;
  priority?: number;
};

export type WorkflowMappingListItem = {
  id: string;
  professionId: string | null;
  professionName: string | null;
  specialtyId: string | null;
  specialtyName: string | null;
  employmentType: EmploymentType;
  location: string | null;
  locationType: string | null;
  yearsOfExperience: string | null;
  workflowId: string;
  workflowName: string;
  workflowEmploymentType: string | null;
  isActive: boolean;
  priority: number;
  specificity: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowResolveResult =
  | {
      matched: true;
      mappingId: string | null;
      workflowId: string;
      workflowName: string;
      source: "mapping" | "default";
      specificity: number;
      criteriaLabel: string;
    }
  | {
      matched: false;
      workflowId: null;
      message: string;
    };

export type WorkflowAssignmentMode = "automatic" | "manual";

export class WorkflowMappingError extends Error {
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, code = "WORKFLOW_MAPPING_ERROR", fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "WorkflowMappingError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
