import { z } from "zod";
import {
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  PLACEMENT_TYPES,
  SOURCE_TYPES,
  type FieldErrors,
  type JobRequisitionInput,
  type WorkflowMatchKey,
} from "@/lib/jobs/types";
import { jobRequiresWorkflow } from "@/lib/jobs/placement";
import { industryKeyValidationMessage } from "@/lib/ai-catalog/industry-catalog";
import { isRemoteJobLocationType } from "@/lib/service-area/location-type";
import { locationFromFreeText } from "@/lib/service-area/normalize";

/**
 * Zod 4.6 treats a union that includes `undefined` as still required on an object.
 * Omitted JSON keys then fail with "expected nonoptional, received undefined".
 * `.optional()` marks the key as omittable; the transform stores null.
 */
export function jobTitleValidationError(value: string | null | undefined): string | null {
  if ((value?.trim().length ?? 0) > 200) return "Job title must be 200 characters or fewer.";
  if (value && /<\/?[a-z][^>]*>/i.test(value)) return "Job title must be plain text without HTML tags.";
  return null;
}

const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => (typeof value === "string" ? value.trim() || null : null));

const optionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value == null || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: "Must be a valid number" });
      return z.NEVER;
    }
    return parsed;
  });

/** Pay, hours, and similar amounts must be finite and not negative when provided. */
const optionalNonNegativeNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value == null || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: "Must be a valid number" });
      return z.NEVER;
    }
    if (parsed < 0) {
      ctx.addIssue({ code: "custom", message: "Cannot be negative" });
      return z.NEVER;
    }
    return parsed;
  });

export const jobRequisitionInputSchema = z.object({
  internalRequisitionNumber: optionalText,
  externalRequisitionId: optionalText,
  sourceType: z.enum(SOURCE_TYPES),
  placementType: z.enum(PLACEMENT_TYPES).nullable().optional(),
  eorType: z.enum(["Tenant", "MSP"]).nullable().optional(),
  mspClient: optionalText,
  professionId: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => (typeof value === "string" ? value.trim() || null : null))
    .pipe(z.union([z.uuid(), z.null()])),
  profession: optionalText,
  specialtyId: optionalText.pipe(z.uuid().nullable()),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  employerOfRecord: optionalText,
  department: optionalText,
  facility: optionalText,
  billRate: optionalNonNegativeNumber,
  payRateMin: optionalNonNegativeNumber,
  payRateMax: optionalNonNegativeNumber,
  commissionPercent: optionalNonNegativeNumber,
  commissionFixedAmount: optionalNonNegativeNumber,
  targetStartDate: optionalText,
  duration: optionalText,
  shiftType: optionalText,
  shiftDetails: optionalText,
  hoursPerWeek: optionalNonNegativeNumber,
  publicTitle: optionalText.superRefine((value, ctx) => {
    const message = jobTitleValidationError(value);
    if (message) ctx.addIssue({ code: "custom", message });
  }),
  publicDescription: optionalText,
  industryKey: optionalText,
  location: optionalText,
  postalCode: optionalText,
  worksiteCity: optionalText,
  worksiteState: optionalText,
  worksitePostalCode: optionalText,
  remoteAllowedStates: z
    .union([z.array(z.string()), z.null()])
    .optional()
    .transform((value) =>
      Array.isArray(value)
        ? value.map((item) => item.trim().toUpperCase()).filter(Boolean)
        : null
    ),
  schedule: optionalText,
  qualifications: optionalText,
  responsibilities: optionalText,
  benefits: optionalText,
  applicationDeadline: optionalText,
  numberOfPositions: optionalNonNegativeNumber,
  yearsOfExperience: optionalText,
  additionalLocations: z
    .union([z.array(z.string()), z.null()])
    .optional()
    .transform((value) =>
      Array.isArray(value)
        ? value.map((item) => item.trim()).filter(Boolean)
        : null
    ),
  showInMultipleAreas: z
    .union([z.boolean(), z.null()])
    .optional()
    .transform((value) => (typeof value === "boolean" ? value : null)),
  jobLocationType: optionalText,
  acceptableMatchRate: optionalText,
  isEmployerOnRecord: z
    .union([z.boolean(), z.null()])
    .optional()
    .transform((value) => (typeof value === "boolean" ? value : null)),
  compensationType: optionalText,
  currency: optionalText,
  showPayBy: optionalText,
  payRatePeriod: optionalText,
  mspName: optionalText,
  sourceJobTitle: optionalText,
  sourceJobUrl: optionalText,
  sourceJobDetails: optionalText,
  suggestedPayRate: optionalNonNegativeNumber,
  requiredCredentials: optionalText,
  specialRequirements: optionalText,
  internalNotes: optionalText,
}).superRefine((job, ctx) => {
  if (job.payRateMin != null && job.payRateMax != null && job.payRateMin > job.payRateMax) {
    ctx.addIssue({ code: "custom", path: ["payRateMax"], message: "Maximum pay rate must be greater than or equal to minimum pay rate." });
  }
});

export const jobMutationSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
  job: jobRequisitionInputSchema,
  action: z.enum(["save_draft", "publish", "update", "unpublish", "close", "archive"]),
});

const JOB_MUTATION_FIELD_LABELS: Record<string, string> = {
  professionId: "Profession",
  specialtyId: "Specialty",
  employmentType: "Payroll employment type",
  sourceType: "Job source",
  placementType: "MSP placement",
  eorType: "Employer of record type",
  payRateMin: "Pay rate",
  payRateMax: "Maximum pay rate",
  suggestedPayRate: "Suggested pay rate",
  billRate: "Bill rate",
  hoursPerWeek: "Expected hours",
  commissionPercent: "Commission percent",
  commissionFixedAmount: "Commission amount",
  numberOfPositions: "Number of positions",
  remoteAllowedStates: "Remote work states",
  additionalLocations: "Additional locations",
  showInMultipleAreas: "Show in multiple areas",
  isEmployerOnRecord: "Employer on record",
  targetStartDate: "Start date",
  applicationDeadline: "Application deadline",
  sourceJobUrl: "Source job URL",
  publicDescription: "Job description",
  industryKey: "Industry",
  action: "Save action",
};

/** Turn a failed job-save parse into a banner message and per-field errors. */
export function formatJobMutationFailure(error: z.ZodError): {
  error: string;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const parts = issue.path.filter((part) => part !== "job").map(String);
    const key = parts[parts.length - 1] || "job";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const details = Object.entries(fieldErrors)
    .map(([key, message]) => `${JOB_MUTATION_FIELD_LABELS[key] ?? key}: ${message}`)
    .join(" ");
  return {
    error: details ? `Invalid job requisition. ${details}` : "Invalid job requisition",
    fieldErrors,
  };
}

export const jobStatusSchema = z.enum(JOB_STATUSES);

export function jobApplicationDeadlineError(value: string | null | undefined): string | undefined {
  if (!value) return;
  const date = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latest = new Date(today);
  latest.setMonth(latest.getMonth() + 6);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) return "Enter a valid application deadline.";
  if (date < today) return "Application deadline cannot be in the past.";
  if (date > latest) return "Application deadline must be within the next six months.";
}

export function validatePublishableJob(
  input: JobRequisitionInput,
  workflowId: string | null
): FieldErrors {
  const errors: FieldErrors = {};
  const isMsp = input.sourceType === "MSP";
  const deadlineError = jobApplicationDeadlineError(input.applicationDeadline);
  if (deadlineError) errors.applicationDeadline = deadlineError;
  const isMspEor = isMsp && input.placementType === "Recruit_and_EOR";
  const isMspRnr = isMsp && input.placementType === "Recruit_and_Release";
  const requiresWorkflow = jobRequiresWorkflow(input);
  const location = input.location?.trim() || input.facility?.trim() || "";

  if (!input.publicTitle?.trim()) errors.publicTitle = "Public job title is required.";
  if (!input.publicDescription?.trim()) {
    errors.publicDescription = "Public job description is required.";
  }
  const isRemote = isRemoteJobLocationType(input.jobLocationType ?? input.schedule);
  if (!isRemote) {
    const parsed = locationFromFreeText(location, input.postalCode);
    const hasWorksite = Boolean(parsed.city && parsed.state);
    if (!hasWorksite) {
      errors.location = "Every job needs a worksite city and state.";
    }
  }
  if (!input.employmentType) errors.employmentType = "Employment type is required.";
  if (!input.shiftType?.trim()) errors.shiftType = "Employment Type is required.";
  if (!input.sourceType) errors.sourceType = "Source type is required.";
  const industryError = industryKeyValidationMessage(input.industryKey);
  if (industryError) errors.industryKey = industryError;

  if (!input.professionId && !input.profession?.trim()) {
    errors.professionId = "Profession is required.";
  }

  if (!isMsp) {
    if (requiresWorkflow && !workflowId) {
      errors.workflowId = "A matching published workflow is required.";
    }
  }

  if (isMspRnr) {
    if (requiresWorkflow && !workflowId) {
      errors.workflowId = "A matching published workflow is required.";
    }
    // Commission fees are optional. Validate ranges only when values are provided.
    // commissionFixedAmount (Fixed Commission Amount) may be left blank.
    if (
      input.commissionPercent != null &&
      (input.commissionPercent < 0 || input.commissionPercent > 100)
    ) {
      errors.commissionPercent = "Commission percentage must be between 0 and 100.";
    }
    if (input.commissionFixedAmount != null && input.commissionFixedAmount < 0) {
      errors.commissionFixedAmount = "Fixed commission amount cannot be negative.";
    }
  }

  if (isMspEor) {
    if (input.employmentType !== "W2" && input.employmentType !== "1099") {
      errors.employmentType = "Select W2 or 1099 for EOR placements.";
    }
    if (requiresWorkflow && !workflowId) {
      errors.workflowId = "A matching published workflow is required.";
    }
  }

  if (isMsp && !input.placementType) {
    errors.placementType = "Select Recruit & Release or Recruit & EOR.";
  }

  Object.assign(errors, validateJobCompensationFields(input, { requireComplete: true }));

  return errors;
}

export type ValidateJobCompensationOptions = {
  /** Require pay type and min/max before wizard advance or publish. */
  requireComplete?: boolean;
};

/** Compensation validation shared by wizard steps, draft saves, and publishing. */
export function validateJobCompensationFields(
  input: JobRequisitionInput,
  options?: ValidateJobCompensationOptions
): FieldErrors {
  const errors: FieldErrors = {};
  if (options?.requireComplete) {
    const payPeriod = input.payRatePeriod?.trim() || input.compensationType?.trim() || "";
    if (!payPeriod) {
      errors.compensationType = "Compensation type is required.";
    }
    const showPayBy = input.showPayBy?.trim() || "Exact amount";
    const isRange = showPayBy === "Range";
    if (input.payRateMin == null || !Number.isFinite(input.payRateMin)) {
      errors.payRateMin = isRange ? "Minimum pay rate is required." : "Pay rate is required.";
    }
    if (isRange && (input.payRateMax == null || !Number.isFinite(input.payRateMax))) {
      errors.payRateMax = "Maximum pay rate is required.";
    }
  }
  if (input.payRateMin != null && input.payRateMax != null && input.payRateMin > input.payRateMax) {
    errors.payRateMax = "Maximum pay rate must be greater than or equal to minimum pay rate.";
  }
  const checks: Array<[keyof JobRequisitionInput, number | null | undefined, string]> = [
    ["payRateMin", input.payRateMin, "Pay rate cannot be negative."],
    ["payRateMax", input.payRateMax, "Maximum pay rate cannot be negative."],
    ["suggestedPayRate", input.suggestedPayRate, "Suggested pay rate cannot be negative."],
    ["billRate", input.billRate, "Bill rate cannot be negative."],
    ["hoursPerWeek", input.hoursPerWeek, "Hours per week cannot be negative."],
    ["commissionPercent", input.commissionPercent, "Commission percentage cannot be negative."],
    [
      "commissionFixedAmount",
      input.commissionFixedAmount,
      "Fixed commission amount cannot be negative.",
    ],
    ["numberOfPositions", input.numberOfPositions, "Number of positions cannot be negative."],
  ];
  for (const [key, value, message] of checks) {
    if (typeof value === "number" && Number.isFinite(value) && value < 0) {
      errors[key] = message;
    }
  }
  if (
    typeof input.commissionPercent === "number" &&
    Number.isFinite(input.commissionPercent) &&
    input.commissionPercent > 100
  ) {
    errors.commissionPercent = "Commission percentage must be between 0 and 100.";
  }
  return errors;
}

export function normalizeApplicantEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function workflowNoMatchMessage(
  professionName: string,
  key: Pick<WorkflowMatchKey, "employmentType" | "specialtyId" | "location" | "jobLocationType" | "yearsOfExperience">
): string {
  const employmentLabel = key.employmentType === "Contract" ? "RNR" : key.employmentType;
  const lines = [
    "No published workflow is configured for this job.",
    "",
    `Profession: ${professionName}`,
    `Employment Type: ${employmentLabel}`,
  ];
  if (key.specialtyId) lines.push(`Specialty: ${key.specialtyId}`);
  if (key.jobLocationType?.trim()) lines.push(`Location Type: ${key.jobLocationType.trim()}`);
  if (key.location?.trim()) lines.push(`Location: ${key.location.trim()}`);
  if (key.yearsOfExperience?.trim()) {
    lines.push(`Years of Experience: ${key.yearsOfExperience.trim()}`);
  }
  lines.push(
    "",
    "Ask an administrator to create a workflow mapping or employment-type default before publishing."
  );
  return lines.join("\n");
}
