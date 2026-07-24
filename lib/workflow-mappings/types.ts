import type { EmploymentType } from "@/lib/jobs/types";

export type WorkflowMappingKey = {
  professionId: string;
  employmentType: EmploymentType;
};

export type WorkflowMappingInput = WorkflowMappingKey & {
  id?: string;
  workflowId: string;
  isActive?: boolean;
  priority?: number;
};

export type WorkflowMappingListItem = {
  id: string;
  professionId: string;
  professionName: string;
  employmentType: EmploymentType;
  workflowId: string;
  workflowName: string;
  workflowEmploymentType: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowResolveResult =
  | {
      matched: true;
      mappingId: string;
      workflowId: string;
      workflowName: string;
    }
  | {
      matched: false;
      workflowId: null;
      message: string;
    };

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
