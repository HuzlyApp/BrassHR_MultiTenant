export const JOB_STATUSES = [
  "draft",
  "open",
  "paused",
  "filled",
  "closed",
  "archived",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Statuses that appear on the public jobs board and accept applications. */
export const PUBLIC_ACCEPTING_JOB_STATUSES = ["open"] as const;

/**
 * Dual-read values for public/open queries during rollout
 * (legacy rows may still say "published" until backfilled).
 */
export const PUBLIC_ACCEPTING_JOB_STATUS_QUERY = ["open", "published"] as const;

export const EMPLOYMENT_TYPES = ["W2", "1099", "Contract"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const SOURCE_TYPES = ["Internal", "MSP"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const PLACEMENT_TYPES = [
  "Internal",
  "Recruit_and_Release",
  "Recruit_and_EOR",
] as const;
export type PlacementType = (typeof PLACEMENT_TYPES)[number];

export const EOR_TYPES = ["Tenant", "MSP"] as const;
export type EorType = (typeof EOR_TYPES)[number];

export type JobRequisitionInput = {
  internalRequisitionNumber?: string | null;
  externalRequisitionId?: string | null;
  sourceType: SourceType;
  /** Internal | Recruit_and_Release | Recruit_and_EOR */
  placementType?: PlacementType | null;
  /** Tenant (tenant EOR) | MSP (MSP EOR for R&R) */
  eorType?: EorType | null;
  mspClient?: string | null;
  professionId?: string | null;
  specialtyId?: string | null;
  employmentType: EmploymentType;
  employerOfRecord?: string | null;
  department?: string | null;
  facility?: string | null;
  billRate?: number | null;
  payRateMin?: number | null;
  payRateMax?: number | null;
  /** MSP R&R: tenant commission fee (USD fixed and/or percent). */
  commissionPercent?: number | null;
  commissionFixedAmount?: number | null;
  targetStartDate?: string | null;
  duration?: string | null;
  shiftType?: string | null;
  shiftDetails?: string | null;
  hoursPerWeek?: number | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
  /** User-facing industry key from industry_catalog. */
  industryKey?: string | null;
  location?: string | null;
  /** ZIP from location search when available; not shown in the form UI. */
  postalCode?: string | null;
  worksiteCity?: string | null;
  worksiteState?: string | null;
  worksitePostalCode?: string | null;
  /** Required when work location type is Remote. No United States shortcut. */
  remoteAllowedStates?: string[] | null;
  schedule?: string | null;
  qualifications?: string | null;
  responsibilities?: string | null;
  benefits?: string | null;
  applicationDeadline?: string | null;
  /** Figma create-job fields */
  numberOfPositions?: number | null;
  yearsOfExperience?: string | null;
  additionalLocations?: string[] | null;
  showInMultipleAreas?: boolean | null;
  jobLocationType?: string | null;
  acceptableMatchRate?: string | null;
  isEmployerOnRecord?: boolean | null;
  compensationType?: string | null;
  currency?: string | null;
  showPayBy?: string | null;
  payRatePeriod?: string | null;
  /** MSP Job Source Details (shown only when sourceType = MSP) */
  mspName?: string | null;
  sourceJobTitle?: string | null;
  sourceJobUrl?: string | null;
  sourceJobDetails?: string | null;
  suggestedPayRate?: number | null;
  requiredCredentials?: string | null;
  specialRequirements?: string | null;
  internalNotes?: string | null;
};

export type WorkflowMatchKey = {
  employmentType: EmploymentType;
  professionId?: string | null;
  specialtyId?: string | null;
  location?: string | null;
  yearsOfExperience?: string | null;
  jobLocationType?: string | null;
  locationType?: string | null;
};

export type WorkflowAssignmentMode = "automatic" | "manual";

export type WorkflowMatch = {
  mappingId: string | null;
  workflowId: string;
  workflowName: string;
  source: "mapping" | "default" | "manual";
  specificity: number;
  criteriaLabel?: string;
};

/** Options controlling automatic vs manual workflow assignment on save. */
export type JobWorkflowAssignmentOptions = {
  /** Force re-resolve even if the job currently has a manual override. */
  resetToAutomatic?: boolean;
  /** Explicit admin override of the assigned published workflow. */
  overrideWorkflowId?: string | null;
};

/** Job form fields plus admin Add-candidate and job-patch fields. */
export type FieldErrors = Partial<
  Record<
    | keyof JobRequisitionInput
    | "workflowId"
    | "name"
    | "email"
    | "status"
    | "assignee"
    | "tags"
    | "is_hot"
    | "remoteAllowedStates"
    | "worksite_state"
    | "work_state",
    string
  >
>;

export class JobValidationError extends Error {
  readonly fieldErrors: FieldErrors;
  readonly code: string;

  constructor(message: string, fieldErrors: FieldErrors, code = "JOB_VALIDATION_FAILED") {
    super(message);
    this.name = "JobValidationError";
    this.fieldErrors = fieldErrors;
    this.code = code;
  }
}

/** Invalid industry keys are HTTP 400; other job validation stays 422. */
export function jobValidationHttpStatus(error: JobValidationError): number {
  return error.fieldErrors.industryKey ? 400 : 422;
}
