export const EMPLOYMENT_TYPES = ["W2", "1099", "Contract"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const PLACEMENT_TYPES = [
  "Internal",
  "Recruit_and_Release",
  "Recruit_and_EOR",
] as const;
export type PlacementType = (typeof PLACEMENT_TYPES)[number];

export const JOB_REQUISITION_STATUSES = [
  "Draft",
  "Open",
  "Paused",
  "Closed",
  "Filled",
] as const;
export type JobRequisitionStatus = (typeof JOB_REQUISITION_STATUSES)[number];

export type JobRequisitionAttributes = {
  tenantId: string;
  jobRole: string | null;
  employmentType: EmploymentType;
  placementType: PlacementType;
};

export type WorkflowMappingRow = {
  id: string;
  tenant_id: string;
  job_role: string | null;
  employment_type: EmploymentType | null;
  placement_type: PlacementType | null;
  workflow_template_id: string;
  priority: number;
  is_active: boolean;
};

export type JobRequisitionRow = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  external_req_id: string | null;
  job_role: string | null;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType;
  placement_type: PlacementType;
  pay_rate: number | null;
  bill_rate: number | null;
  qualifications: string | null;
  workflow_template_id: string | null;
  workflow_assignment_error: string | null;
  public_job_token: string | null;
  status: JobRequisitionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const CONVERT_TO_WORKER_STEP_ID = "convert-to-worker";

export const WORKFLOW_MAPPING_MISSING_MESSAGE =
  "No onboarding workflow is configured for this job role, employment type, and placement type. Configure a workflow mapping before publishing this job.";

export const WORKFLOW_CONFIG_PATH = "/admin_recruiter/settings/workflow-configuration";
