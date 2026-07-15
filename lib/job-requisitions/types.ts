export const EMPLOYMENT_TYPES = ["W2", "1099", "Contract"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const PLACEMENT_TYPES = [
  "Internal",
  "Recruit_and_Release",
  "Recruit_and_EOR",
] as const;
export type PlacementType = (typeof PLACEMENT_TYPES)[number];

export const JOB_SOURCE_TYPES = ["Internal", "MSP"] as const;
export type JobSourceType = (typeof JOB_SOURCE_TYPES)[number];

export const JOB_REQUISITION_STATUSES = [
  "Draft",
  "Pending_Approval",
  "Approved",
  "Published",
  "Paused",
  "Closed",
  "Filled",
  "Cancelled",
] as const;
export type JobRequisitionStatus = (typeof JOB_REQUISITION_STATUSES)[number];

/** Legacy alias still accepted on read paths. */
export const LEGACY_PUBLISHED_STATUS = "Open" as const;

export const LOCATION_TYPES = ["On-site", "Remote", "Hybrid"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const RATE_UNITS = ["Hour", "Day", "Week", "Month", "Year", "Flat"] as const;
export type RateUnit = (typeof RATE_UNITS)[number];

export const FINAL_DISPOSITIONS = [
  "converted_to_worker",
  "hired_by_client",
  "rejected",
  "withdrawn",
  "disqualified",
  "not_selected",
] as const;
export type FinalDisposition = (typeof FINAL_DISPOSITIONS)[number];

export type JobRequisitionAttributes = {
  tenantId: string;
  jobRole: string | null;
  profession?: string | null;
  specialty?: string | null;
  employmentType: EmploymentType;
  placementType: PlacementType;
  sourceType?: JobSourceType | null;
};

export type WorkflowMappingRow = {
  id: string;
  tenant_id: string;
  job_role: string | null;
  profession?: string | null;
  specialty?: string | null;
  employment_type: EmploymentType | null;
  placement_type: PlacementType | null;
  source_type?: JobSourceType | null;
  workflow_template_id: string;
  priority: number;
  is_active: boolean;
};

export type JobRequisitionRow = {
  id: string;
  tenant_id: string;
  job_number: string;
  title: string;
  description: string | null;
  external_req_id: string | null;
  job_role: string | null;
  profession: string | null;
  specialty: string | null;
  department: string | null;
  location: string | null;
  location_type: LocationType | null;
  employment_type: EmploymentType;
  placement_type: PlacementType;
  source_type: JobSourceType;
  pay_rate: number | null;
  bill_rate: number | null;
  rate_unit: RateUnit | null;
  currency: string;
  qualifications: string | null;
  workflow_template_id: string | null;
  workflow_assignment_error: string | null;
  public_job_token: string | null;
  status: JobRequisitionStatus;
  positions_count: number;
  filled_positions: number;
  msp_id: string | null;
  msp_name: string | null;
  eor_tenant_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const CONVERT_TO_WORKER_STEP_ID = "convert-to-worker";

export const WORKFLOW_MAPPING_MISSING_MESSAGE =
  "No onboarding workflow is configured for this profession, specialty, employment type, and placement type. Configure a workflow mapping before publishing this job.";

export const WORKFLOW_CONFIG_PATH = "/admin_recruiter/settings/workflow-configuration";

export function isPublishedJobStatus(status: string | null | undefined): boolean {
  return status === "Published" || status === LEGACY_PUBLISHED_STATUS;
}

export function normalizeJobStatus(status: string | null | undefined): JobRequisitionStatus | null {
  if (!status) return null;
  if (status === LEGACY_PUBLISHED_STATUS) return "Published";
  return (JOB_REQUISITION_STATUSES as readonly string[]).includes(status)
    ? (status as JobRequisitionStatus)
    : null;
}

export function remainingPositions(positionsCount: number, filledPositions: number): number {
  return Math.max(0, positionsCount - filledPositions);
}
