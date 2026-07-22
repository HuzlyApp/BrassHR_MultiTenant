import type { CSSProperties } from "react";
import type { EmploymentType, JobRequisitionInput, SourceType } from "@/lib/jobs/types";

export type JobFormStep = "requisition" | "msp-details" | "compensation" | "review";

export const JOB_FORM_MSP_JOB_DETAIL_OPTIONS = [
  "Travel",
  "Local",
  "Contract",
  "Permanent",
  "Per Diem",
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
  employerOnRecord: "yes" | "no";
  compensationType: string;
  currency: string;
  showPayBy: string;
  payRatePeriod: string;
  selectedBenefits: string[];
};

export const JOB_FORM_BENEFIT_OPTIONS = [
  "Health Insurance",
  "Life Insurance",
  "401(k)",
  "Paid time off",
  "403(b)",
  "Dental Insurance",
  "Vision Insurance",
] as const;

export const JOB_FORM_COMPENSATION_TYPES = ["Annually", "Hourly"] as const;
export const JOB_FORM_CURRENCIES = ["United States Dollar $"] as const;
export const JOB_FORM_SHOW_PAY_BY = ["Range", "Starting amount", "Exact amount"] as const;
export const JOB_FORM_PAY_PERIODS = ["Per month", "Per hour", "Per year"] as const;
export const JOB_FORM_LOCATION_TYPES = ["Remote", "Hybrid", "On-site", "Remote, Hybrid"] as const;
export const JOB_FORM_YEARS_OF_EXPERIENCE = ["1 yr", "2 yrs", "3 yrs", "5 yrs", "7 yrs", "10+ yrs"] as const;
export const JOB_FORM_SHIFT_TYPES = ["Day", "Evening", "Night", "Rotating", "PRN"] as const;

export const JOB_FORM_SURFACE_CLASS =
  "rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#334155]";

/** Centered field column inside the full-bleed white create-job card (Figma). */
export const JOB_FORM_CENTER_COLUMN_CLASS =
  "mx-auto flex w-full max-w-[720px] flex-1 flex-col px-5 py-6 sm:max-w-[760px] sm:px-10 sm:py-8 lg:px-12";

export const JOB_FORM_PAGE_CARD_CLASS =
  "flex min-h-[calc(100dvh-6.5rem)] w-full flex-col rounded-lg border border-[#E5E7EB] bg-white shadow-sm";

export const JOB_FORM_INPUT_CLASS = `${JOB_FORM_SURFACE_CLASS} h-10 w-full cursor-pointer px-3 outline-none transition focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)]`;

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
  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#334155]";

export const JOB_FORM_SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2394A3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export function employmentTypeLabel(type: EmploymentType): string {
  if (type === "Contract") return "R&R";
  return type;
}

export function employmentTypeFromLabel(label: string): EmploymentType {
  if (label === "R&R") return "Contract";
  if (label === "1099" || label === "W2" || label === "Contract") return label;
  return "W2";
}

export function defaultJobFormUiState(): JobFormUiState {
  return {
    numberOfPositions: 1,
    yearsOfExperience: "5 yrs",
    additionalLocations: [],
    showInMultipleAreas: false,
    jobLocationType: "Remote, Hybrid",
    employerOnRecord: "yes",
    compensationType: "Annually",
    currency: "United States Dollar $",
    showPayBy: "Range",
    payRatePeriod: "Per month",
    selectedBenefits: ["Health Insurance", "Life Insurance", "401(k)"],
  };
}

export function jobFormUiFromJob(job: JobRequisitionInput): JobFormUiState {
  const ui = defaultJobFormUiState();
  ui.numberOfPositions = Math.max(1, Math.trunc(job.numberOfPositions ?? ui.numberOfPositions));
  ui.yearsOfExperience = job.yearsOfExperience?.trim() || ui.yearsOfExperience;
  ui.additionalLocations = Array.isArray(job.additionalLocations)
    ? [...job.additionalLocations]
    : [];
  ui.showInMultipleAreas = Boolean(job.showInMultipleAreas);
  ui.jobLocationType =
    job.jobLocationType?.trim() || job.schedule?.trim() || ui.jobLocationType;
  if (typeof job.isEmployerOnRecord === "boolean") {
    ui.employerOnRecord = job.isEmployerOnRecord ? "yes" : "no";
  } else {
    const employer = job.employerOfRecord?.trim().toLowerCase();
    if (employer === "no") ui.employerOnRecord = "no";
    else if (employer === "yes") ui.employerOnRecord = "yes";
  }
  ui.compensationType = job.compensationType?.trim() || ui.compensationType;
  ui.currency = job.currency?.trim() || ui.currency;
  ui.showPayBy = job.showPayBy?.trim() || ui.showPayBy;
  ui.payRatePeriod = job.payRatePeriod?.trim() || ui.payRatePeriod;
  if (job.benefits?.trim()) {
    const parsed = job.benefits
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (parsed.length) ui.selectedBenefits = parsed;
  }
  return ui;
}

export function applyUiToJob(job: JobRequisitionInput, ui: JobFormUiState): JobRequisitionInput {
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
    isEmployerOnRecord: ui.employerOnRecord === "yes",
    compensationType: ui.compensationType,
    currency: ui.currency,
    showPayBy: ui.showPayBy,
    payRatePeriod: ui.payRatePeriod,
    benefits: ui.selectedBenefits.join(", "),
    publicTitle: job.publicTitle?.trim() || job.publicTitle,
  };
}

export function formatPaySummary(
  job: JobRequisitionInput,
  ui: JobFormUiState
): string {
  const min = job.payRateMin;
  const max = job.payRateMax;
  if (min == null && max == null) return "—";
  const period = ui.payRatePeriod.toLowerCase();
  if (min != null && max != null) {
    return `$${min} to $${max} ${period}`;
  }
  if (min != null) return `$${min} ${period}`;
  if (max != null) return `$${max} ${period}`;
  return "—";
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
  employmentTypes: EmploymentType[];
  sourceTypes: SourceType[];
  canManageWorkflows: boolean;
};
