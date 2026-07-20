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
  professionId: string;
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
};

export type WorkflowMatchKey = Pick<JobRequisitionInput, "professionId" | "employmentType">;

export type WorkflowMatch = {
  mappingId: string;
  workflowId: string;
  workflowName: string;
};

export type FieldErrors = Partial<Record<keyof JobRequisitionInput | "workflowId", string>>;

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
