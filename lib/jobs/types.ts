export const JOB_STATUSES = ["draft", "published", "closed", "archived"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const EMPLOYMENT_TYPES = ["W2", "1099", "Contract"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const SOURCE_TYPES = ["Internal", "MSP"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export type JobRequisitionInput = {
  internalRequisitionNumber?: string | null;
  externalRequisitionId?: string | null;
  sourceType: SourceType;
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
  targetStartDate?: string | null;
  duration?: string | null;
  shiftType?: string | null;
  shiftDetails?: string | null;
  hoursPerWeek?: number | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
  location?: string | null;
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

/** Job form fields plus admin Add-candidate fields (`name`, `email`). */
export type FieldErrors = Partial<
  Record<keyof JobRequisitionInput | "workflowId" | "name" | "email", string>
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
