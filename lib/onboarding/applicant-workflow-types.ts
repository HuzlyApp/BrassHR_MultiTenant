export type WorkflowStepType =
  | "skill_qualification_assessment"
  | "document_upload"
  | "background_check"
  | "reference_verification"
  | string;

export type PublishedWorkflowStatus = "published" | "draft";

export type WorkflowStepSettings = Record<string, unknown>;

export type PublishedWorkflowStep = {
  id: string;
  type: WorkflowStepType;
  title: string;
  description: string;
  required: boolean;
  day: number;
  order: number;
  settings: WorkflowStepSettings;
};

export type PublishedWorkflow = {
  workflowId: string;
  tenant: string;
  version: number;
  status: PublishedWorkflowStatus;
  steps: PublishedWorkflowStep[];
};

export type ApplicantStepStatusValue =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped"
  | "waiting_for_candidate"
  | "failed";

export type ApplicantStepStatus = {
  stepId: string;
  status: ApplicantStepStatusValue;
  metadata?: Record<string, unknown>;
  completedAt?: string | null;
  applicationId?: string;
  workflowId?: string;
  workflowVersion?: number;
};
