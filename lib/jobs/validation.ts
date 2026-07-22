import { z } from "zod";
import {
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  SOURCE_TYPES,
  type FieldErrors,
  type JobRequisitionInput,
  type WorkflowMatchKey,
} from "@/lib/jobs/types";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => value?.trim() || null);

const optionalNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: "Must be a valid number" });
      return z.NEVER;
    }
    return parsed;
  });

export const jobRequisitionInputSchema = z.object({
  internalRequisitionNumber: optionalText,
  externalRequisitionId: optionalText,
  sourceType: z.enum(SOURCE_TYPES),
  mspClient: optionalText,
  professionId: z.uuid(),
  specialtyId: optionalText.pipe(z.uuid().nullable()),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  employerOfRecord: optionalText,
  department: optionalText,
  facility: optionalText,
  billRate: optionalNumber,
  payRateMin: optionalNumber,
  payRateMax: optionalNumber,
  targetStartDate: optionalText,
  duration: optionalText,
  shiftType: optionalText,
  shiftDetails: optionalText,
  hoursPerWeek: optionalNumber,
  publicTitle: optionalText,
  publicDescription: optionalText,
  location: optionalText,
  schedule: optionalText,
  qualifications: optionalText,
  responsibilities: optionalText,
  benefits: optionalText,
  applicationDeadline: optionalText,
  numberOfPositions: optionalNumber,
  yearsOfExperience: optionalText,
  additionalLocations: z
    .union([z.array(z.string()), z.null(), z.undefined()])
    .transform((value) =>
      Array.isArray(value)
        ? value.map((item) => item.trim()).filter(Boolean)
        : null
    ),
  showInMultipleAreas: z
    .union([z.boolean(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "boolean" ? value : null)),
  jobLocationType: optionalText,
  isEmployerOnRecord: z
    .union([z.boolean(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "boolean" ? value : null)),
  compensationType: optionalText,
  currency: optionalText,
  showPayBy: optionalText,
  payRatePeriod: optionalText,
  mspName: optionalText,
  sourceJobTitle: optionalText,
  sourceJobUrl: optionalText,
  sourceJobDetails: optionalText,
  suggestedPayRate: optionalNumber,
  requiredCredentials: optionalText,
  specialRequirements: optionalText,
  internalNotes: optionalText,
});

export const jobMutationSchema = z.object({
  job: jobRequisitionInputSchema,
  action: z.enum(["save_draft", "publish", "update", "unpublish", "close", "archive"]),
});

export const jobStatusSchema = z.enum(JOB_STATUSES);

export function validatePublishableJob(
  input: JobRequisitionInput,
  workflowId: string | null
): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.publicTitle?.trim()) errors.publicTitle = "Public job title is required.";
  if (!input.publicDescription?.trim()) {
    errors.publicDescription = "Public job description is required.";
  }
  if (!input.location?.trim()) errors.location = "Location is required.";
  if (!input.professionId) errors.professionId = "Profession is required.";
  if (!input.employmentType) errors.employmentType = "Employment type is required.";
  if (!input.sourceType) errors.sourceType = "Source type is required.";
  if (!workflowId) errors.workflowId = "A matching published workflow is required.";

  if (input.sourceType === "MSP") {
    if (!input.mspClient?.trim()) errors.mspClient = "MSP client is required.";
    if (!input.externalRequisitionId?.trim()) {
      errors.externalRequisitionId = "External requisition ID is required.";
    }
  }

  if (
    input.payRateMin !== null &&
    input.payRateMin !== undefined &&
    input.payRateMax !== null &&
    input.payRateMax !== undefined &&
    input.payRateMin > input.payRateMax
  ) {
    errors.payRateMax = "Maximum pay rate must be greater than or equal to minimum pay rate.";
  }

  return errors;
}

export function normalizeApplicantEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function workflowNoMatchMessage(
  professionName: string,
  key: Pick<WorkflowMatchKey, "employmentType">
): string {
  return [
    "No published workflow is configured for this job.",
    "",
    `Profession: ${professionName}`,
    `Employment Type: ${key.employmentType}`,
    "",
    "Ask an administrator to create a workflow mapping before publishing.",
  ].join("\n");
}
