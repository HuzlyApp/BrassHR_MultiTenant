import type { CSSProperties } from "react";
import type { EmploymentType, JobRequisitionInput, SourceType } from "@/lib/jobs/types";

export type JobFormStep =
  | "setup"
  | "requisition"
  | "msp-details"
  | "compensation"
  | "description"
  | "review";

export const JOB_FORM_MSP_JOB_DETAIL_OPTIONS = [
  "Long-Term Care",
  "Contract Assignment",
  "Healthcare Staffing",
  "Travel Assignment",
  "Local Contract",
  "Per Diem",
  "Acute Care",
  "Permanent Placement",
] as const;

export const JOB_FORM_DURATION_OPTIONS = [
  "4 weeks",
  "8 weeks",
  "13 weeks",
  "26 weeks",
  "52 weeks",
] as const;

export type JobFormUiState = {
  numberOfPositions: number;
  yearsOfExperience: string;
  additionalLocations: string[];
  showInMultipleAreas: boolean;
  jobLocationType: string;
  employerOnRecord: "" | "yes" | "no";
  compensationType: string;
  currency: string;
  showPayBy: string;
  payRatePeriod: string;
  /** Expected hours display mode (stored in shift_details). */
  hoursShowBy: string;
  selectedBenefits: string[];
  /** User-created benefit chips (shown alongside presets). */
  customBenefits: string[];
};

export const JOB_FORM_BENEFIT_OPTIONS = [
  "Flexible schedule",
  "Dental Insurance",
  "401(k)",
  "Tuition reimbursement",
  "Retirement Plan",
  "Employee Assistance Program",
  "Referral Program",
  "Paid time off",
  "Health savings account",
  "Vision Insurance",
  "Flexible spending account",
  "Parental leave",
  "Employee Discount",
  "401(k) matching",
  "Life Insurance",
  "Health Insurance",
  "Professional development assistance",
] as const;

export const JOB_FORM_COMPENSATION_TYPES = ["Hourly", "Weekly", "Monthly", "Annually"] as const;
export const JOB_FORM_CURRENCIES = ["United States Dollar $"] as const;
export const JOB_FORM_SHOW_PAY_BY = ["Range", "Starting amount", "Exact amount"] as const;
export const JOB_FORM_PAY_PERIODS = ["Hourly", "Weekly", "Monthly", "Annually"] as const;
export const JOB_FORM_HOURS_SHOW_BY = ["Fixed Hours", "Flexible Hours"] as const;
export const JOB_FORM_LOCATION_TYPES = ["Remote", "Hybrid", "On-site", "Remote, Hybrid"] as const;
export const JOB_FORM_YEARS_OF_EXPERIENCE = [
  "1 yr",
  "2 yrs",
  "3 yrs",
  "4 yrs",
  "5 yrs",
  "6 yrs",
  "7 yrs",
  "8 yrs",
  "9 yrs",
  "10+",
] as const;
export const JOB_FORM_SHIFT_TYPES = ["Day", "Evening", "Night", "Rotating", "PRN"] as const;

/** Figma create-job "Employment Type" chips (stored in job_requisitions.shift_type). */
export const JOB_FORM_JOB_TYPES = [
  "Permanent",
  "Paid-time",
  "Full-time",
  "Part-time",
  "Fixed term",
] as const;

export type JobFormJobType = (typeof JOB_FORM_JOB_TYPES)[number];

/** Select options for Number of Positions (Figma MSP Job Source Details). */
export const JOB_FORM_NUMBER_OF_POSITION_OPTIONS = Array.from({ length: 20 }, (_, index) => index + 1);

export const JOB_FORM_SURFACE_CLASS =
  "rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#334155]";

/** Centered field column inside the full-bleed white create-job card (Figma). */
export const JOB_FORM_CENTER_COLUMN_CLASS =
  "mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 py-5 min-[700px]:max-w-[760px] min-[700px]:px-10 min-[700px]:py-8 lg:px-12";

export const JOB_FORM_PAGE_CARD_CLASS =
  "flex min-h-[calc(100dvh-6.5rem)] w-full flex-col rounded-lg border border-[#E5E7EB] bg-white shadow-sm";

export const JOB_FORM_INPUT_CLASS = `${JOB_FORM_SURFACE_CLASS} h-10 w-full cursor-pointer px-3 outline-none transition focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)] [&::-webkit-calendar-picker-indicator]:cursor-pointer`;

export const JOB_FORM_SELECT_CLASS = `${JOB_FORM_INPUT_CLASS} appearance-none bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pr-10 cursor-pointer`;

export const JOB_FORM_TEXTAREA_CLASS = `${JOB_FORM_SURFACE_CLASS} min-h-[280px] w-full cursor-pointer resize-y px-3 py-3 outline-none transition focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)]`;

export const JOB_FORM_LABEL_CLASS = "mb-1.5 block cursor-pointer text-sm font-normal text-[#64748B]";

export const JOB_FORM_SECTION_TITLE_CLASS = "text-lg font-semibold text-[#1D2739]";

export const JOB_FORM_SECTION_SUBTITLE_CLASS = "mt-1 text-sm text-[#64748B]";

export const JOB_FORM_PRIMARY_BUTTON_CLASS =
  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50";

export const JOB_FORM_OUTLINE_BUTTON_CLASS =
  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50";

export const JOB_FORM_ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] hover:opacity-90";

/** Radio option row: 24px gap on mobile, 40px on web (≥700px). */
export const JOB_FORM_RADIO_OPTIONS_CLASS = "job-form-radio-options flex flex-wrap";

/** Figma Neutral/500 — highlighted setup field surface. */
export const JOB_FORM_NEUTRAL_500_BG = "#F1F5F9";

/** Figma: MSP setup question block (620×135, 20px padding, 16px label-to-options gap). */
export const JOB_FORM_SETUP_MSP_FIELD_CLASS = "job-form-setup-msp-field";

/** Figma vertical field spacing: 30px between field groups. */
export const JOB_FORM_FIELDS_CLASS = "job-form-fields";

/** Figma: 12px between Job Location and Add Additional Location row. */
export const JOB_FORM_LOCATION_CLUSTER_CLASS = "job-form-fields--location-cluster";

export const JOB_FORM_SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2394A3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export function normalizePayRatePeriod(value?: string | null): string {
  const raw = value?.trim() || "";
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower.includes("hour")) return "Hourly";
  if (lower.includes("week")) return "Weekly";
  if (lower.includes("month")) return "Monthly";
  if (lower.includes("year") || lower.includes("annual")) return "Annually";
  if ((JOB_FORM_PAY_PERIODS as readonly string[]).includes(raw)) return raw;
  return raw;
}

export function employmentTypeLabel(type: EmploymentType): string {
  if (type === "Contract") return "R&R";
  return type;
}

export function employmentTypeFromLabel(label: string): EmploymentType {
  if (label === "R&R") return "Contract";
  if (label === "1099" || label === "W2" || label === "Contract") return label;
  return "W2";
}

/** Review step: employment type is locked because it drives workflow routing. */
export const REVIEW_LOCKED_EMPLOYMENT_TYPE_TOOLTIP =
  "Employment type is set in Job Details and determines which onboarding workflow is assigned to applicants for this job. To change it, go back to the Job Details step.";

/** Placeholder label for the specialty dropdown on job create/edit. */
export function specialtySelectPlaceholder(
  professionId: string | null | undefined,
  specialtyCount: number
): string {
  if (!professionId?.trim()) return "Select Specialty";
  if (specialtyCount === 0) return "Not found";
  return "Select Specialty";
}

export function defaultJobFormUiState(): JobFormUiState {
  return {
    numberOfPositions: 1,
    yearsOfExperience: "",
    additionalLocations: [],
    showInMultipleAreas: false,
    jobLocationType: "",
    employerOnRecord: "",
    compensationType: "",
    currency: "",
    showPayBy: "Exact amount",
    payRatePeriod: "",
    hoursShowBy: "",
    selectedBenefits: [],
    customBenefits: [],
  };
}

export function jobFormUiFromJob(job: JobRequisitionInput): JobFormUiState {
  const ui = defaultJobFormUiState();
  ui.numberOfPositions = Math.max(1, Math.trunc(job.numberOfPositions ?? ui.numberOfPositions));
  ui.yearsOfExperience = (() => {
    const raw = job.yearsOfExperience?.trim() || "";
    if (raw === "10+ yrs" || raw === "10+ yr") return "10+";
    return raw;
  })();
  ui.additionalLocations = Array.isArray(job.additionalLocations)
    ? [...job.additionalLocations]
    : [];
  ui.showInMultipleAreas = Boolean(job.showInMultipleAreas);
  ui.jobLocationType = job.jobLocationType?.trim() || job.schedule?.trim() || "";
  if (typeof job.isEmployerOnRecord === "boolean") {
    ui.employerOnRecord = job.isEmployerOnRecord ? "yes" : "no";
  } else {
    const employer = job.employerOfRecord?.trim().toLowerCase();
    if (employer === "no") ui.employerOnRecord = "no";
    else if (employer === "yes") ui.employerOnRecord = "yes";
    else if (job.employerOfRecord?.trim()) ui.employerOnRecord = "yes";
  }
  ui.compensationType = (() => {
    const raw = job.compensationType?.trim() || "";
    if (raw === "Yearly" || raw === "Annually" || raw.toLowerCase() === "annual") return "Annually";
    return raw;
  })();
  ui.currency = job.currency?.trim() || "";
  ui.showPayBy = (() => {
    const raw = job.showPayBy?.trim() || "";
    if (raw && (JOB_FORM_SHOW_PAY_BY as readonly string[]).includes(raw)) return raw;
    if (
      job.payRateMin != null &&
      job.payRateMax != null &&
      job.payRateMin !== job.payRateMax
    ) {
      return "Range";
    }
    return "Exact amount";
  })();
  ui.payRatePeriod = normalizePayRatePeriod(job.payRatePeriod);
  const shiftDetails = job.shiftDetails?.trim() || "";
  if ((JOB_FORM_HOURS_SHOW_BY as readonly string[]).includes(shiftDetails)) {
    ui.hoursShowBy = shiftDetails;
  } else if (job.hoursPerWeek != null) {
    ui.hoursShowBy = "Fixed Hours";
  }
  if (job.benefits?.trim()) {
    const parsed = job.benefits
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (parsed.length) {
      ui.selectedBenefits = parsed;
      ui.customBenefits = parsed.filter(
        (item) =>
          !(JOB_FORM_BENEFIT_OPTIONS as readonly string[]).includes(item)
      );
    }
  }
  return ui;
}

/** Map a job_requisitions API row into form state (create-from-reference or edit). */
export function jobRequisitionInputFromApiRow(row: Record<string, unknown>): JobRequisitionInput {
  const additionalRaw = row.additional_locations;
  const additionalLocations = Array.isArray(additionalRaw)
    ? additionalRaw.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

  const employmentRaw = String(row.employment_type ?? "").trim();
  const employmentType: JobRequisitionInput["employmentType"] =
    employmentRaw === "1099" || employmentRaw === "W2" || employmentRaw === "Contract"
      ? employmentRaw
      : (employmentRaw as JobRequisitionInput["employmentType"]) || "W2";

  const payRateMin = row.pay_rate_min == null ? null : Number(row.pay_rate_min);
  const suggestedPayRate = row.pay_rate == null ? null : Number(row.pay_rate);

  return {
    internalRequisitionNumber: String(row.internal_requisition_number ?? ""),
    externalRequisitionId: String(row.external_requisition_id ?? ""),
    sourceType: row.source_type as JobRequisitionInput["sourceType"],
    mspClient: String(row.msp_client ?? ""),
    professionId: String(row.profession_id ?? ""),
    specialtyId: row.specialty_id ? String(row.specialty_id) : null,
    employmentType,
    employerOfRecord: String(row.employer_of_record ?? ""),
    department: String(row.department ?? ""),
    facility: String(row.facility ?? ""),
    billRate: row.bill_rate == null ? null : Number(row.bill_rate),
    payRateMin: payRateMin ?? suggestedPayRate,
    payRateMax: row.pay_rate_max == null ? null : Number(row.pay_rate_max),
    targetStartDate: row.target_start_date ? String(row.target_start_date) : null,
    duration: String(row.duration ?? ""),
    shiftType: String(row.shift_type ?? ""),
    shiftDetails: String(row.shift_details ?? ""),
    hoursPerWeek: row.hours_per_week == null ? null : Number(row.hours_per_week),
    publicTitle: String(row.public_title ?? ""),
    publicDescription: String(row.public_description ?? ""),
    location: String(row.location ?? ""),
    schedule: String(row.schedule ?? ""),
    qualifications: String(row.qualifications ?? ""),
    responsibilities: String(row.responsibilities ?? ""),
    benefits: String(row.benefits ?? ""),
    applicationDeadline: row.application_deadline ? String(row.application_deadline) : null,
    numberOfPositions:
      row.positions_count == null ? 1 : Math.max(1, Number(row.positions_count) || 1),
    yearsOfExperience: row.years_of_experience
      ? String(row.years_of_experience)
      : row.years_experience_required != null
        ? `${row.years_experience_required} yrs`
        : null,
    additionalLocations,
    showInMultipleAreas: Boolean(row.show_in_multiple_areas),
    jobLocationType: row.location_type
      ? String(row.location_type)
      : row.schedule
        ? String(row.schedule)
        : null,
    isEmployerOnRecord:
      typeof row.is_employer_on_record === "boolean" ? row.is_employer_on_record : true,
    compensationType: row.compensation_type ? String(row.compensation_type) : null,
    currency: row.currency ? String(row.currency) : null,
    showPayBy: row.show_pay_by ? String(row.show_pay_by) : null,
    payRatePeriod: row.pay_rate_period
      ? String(row.pay_rate_period)
      : row.rate_unit
        ? String(row.rate_unit)
        : null,
    mspName: row.msp_name ? String(row.msp_name) : null,
    sourceJobTitle: row.source_job_title ? String(row.source_job_title) : null,
    sourceJobUrl: row.source_job_url ? String(row.source_job_url) : null,
    sourceJobDetails: row.source_job_details ? String(row.source_job_details) : null,
    suggestedPayRate,
    requiredCredentials: Array.isArray(row.required_credentials)
      ? row.required_credentials
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
          .join(", ")
      : row.required_credentials
        ? String(row.required_credentials)
        : null,
    specialRequirements: row.special_requirements ? String(row.special_requirements) : null,
    internalNotes: row.internal_notes ? String(row.internal_notes) : null,
  };
}

/** Strip identifiers when cloning an existing job as a new requisition. */
export function jobRequisitionInputForNewFromReference(
  loaded: JobRequisitionInput,
  sourceType: SourceType
): JobRequisitionInput {
  return {
    ...loaded,
    sourceType,
    internalRequisitionNumber: "",
    externalRequisitionId: "",
    employerOfRecord: null,
    /** MSP → R&R (Contract); Internal → keep W2/1099 only. */
    employmentType:
      sourceType === "MSP"
        ? "Contract"
        : loaded.employmentType === "1099" || loaded.employmentType === "W2"
          ? loaded.employmentType
          : "W2",
  };
}

export function applyUiToJob(job: JobRequisitionInput, ui: JobFormUiState): JobRequisitionInput {
  const isYes = ui.employerOnRecord === "yes";
  const isNo = ui.employerOnRecord === "no";
  const showPayBy = ui.showPayBy.trim() || "Exact amount";
  const isRange = showPayBy === "Range";
  const compensationType =
    ui.compensationType === "Annually" ? "Yearly" : ui.compensationType;

  return {
    ...job,
    schedule: ui.jobLocationType,
    jobLocationType: ui.jobLocationType,
    numberOfPositions: Math.max(1, Math.trunc(ui.numberOfPositions || 1)),
    yearsOfExperience: ui.yearsOfExperience,
    additionalLocations: ui.additionalLocations
      .map((item) => item.trim())
      .filter(Boolean),
    showInMultipleAreas: ui.showInMultipleAreas,
    isEmployerOnRecord: isYes ? true : isNo ? false : null,
    employerOfRecord: isYes ? job.employerOfRecord ?? null : isNo ? null : job.employerOfRecord ?? null,
    /** MSP jobs always use R&R (Contract) for workflow routing. */
    employmentType: job.sourceType === "MSP" ? "Contract" : job.employmentType,
    compensationType,
    currency: ui.currency.trim() || "USD",
    showPayBy,
    payRatePeriod: ui.payRatePeriod,
    payRateMin: job.payRateMin,
    payRateMax: isRange ? job.payRateMax : null,
    suggestedPayRate: job.payRateMin ?? job.suggestedPayRate ?? null,
    hoursPerWeek: job.hoursPerWeek ?? null,
    shiftDetails: ui.hoursShowBy.trim() || job.shiftDetails || null,
    benefits: ui.selectedBenefits.join(", "),
    publicTitle: job.publicTitle?.trim() || job.publicTitle,
  };
}

function normalizeShowPayBy(value: string | null | undefined): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "range") return "Range";
  if (raw === "starting amount") return "Starting amount";
  if (raw === "exact amount") return "Exact amount";
  return "Exact amount";
}

export function formatPaySummary(
  job: JobRequisitionInput,
  ui: JobFormUiState
): string {
  const min = job.payRateMin;
  const max = job.payRateMax;
  const period = ui.payRatePeriod.trim().toLowerCase();
  const showPayBy = normalizeShowPayBy(ui.showPayBy || job.showPayBy);

  if (showPayBy === "Range") {
    if (min == null && max == null) return "—";
    if (min != null && max != null && min !== max) {
      return period ? `$${min} to $${max} ${period}` : `$${min} to $${max}`;
    }
    const amount = min ?? max;
    if (amount == null) return "—";
    return period ? `$${amount} ${period}` : `$${amount}`;
  }

  // Starting amount / Exact amount — always a single value (never "min to max").
  const amount = min ?? max;
  if (amount == null) return "—";
  return period ? `$${amount} ${period}` : `$${amount}`;
}

export function primaryButtonStyle(brandStyle: CSSProperties): CSSProperties {
  return {
    ...brandStyle,
    backgroundColor: "var(--brand-primary)",
    borderColor: "var(--brand-primary)",
  };
}

export type JobFormOption = { id: string; name: string };
export type JobFormSpecialtyOption = JobFormOption & { profession_id: string };

export type JobFormOptionsPayload = {
  professions: JobFormOption[];
  specialties: JobFormSpecialtyOption[];
  workflows?: JobFormOption[];
  employmentTypes: EmploymentType[];
  sourceTypes: SourceType[];
  employerOfRecordOptions: JobFormOption[];
  canManageWorkflows: boolean;
};
