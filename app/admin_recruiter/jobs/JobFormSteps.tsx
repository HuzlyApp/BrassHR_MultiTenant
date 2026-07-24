"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Check,
  Copy,
  Eye,
  GitBranch,
  MapPin,
  Minus,
  Pencil,
  Plus,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import type { EmploymentType, JobRequisitionInput, SourceType } from "@/lib/jobs/types";
import {
  JobDescriptionEditor,
  JobDescriptionHtml,
  jobDescriptionPlainText,
} from "./JobDescriptionEditor";
import type { ReviewEditFieldId } from "./JobReviewEditModal";
import {
  JOB_FORM_BENEFIT_OPTIONS,
  JOB_FORM_COMPENSATION_TYPES,
  JOB_FORM_CURRENCIES,
  JOB_FORM_DURATION_OPTIONS,
  JOB_FORM_ICON_BUTTON_CLASS,
  JOB_FORM_INPUT_CLASS,
  JOB_FORM_LABEL_CLASS,
  JOB_FORM_LOCATION_TYPES,
  JOB_FORM_MSP_JOB_DETAIL_OPTIONS,
  JOB_FORM_OUTLINE_BUTTON_CLASS,
  JOB_FORM_PAY_PERIODS,
  JOB_FORM_PRIMARY_BUTTON_CLASS,
  JOB_FORM_SECTION_SUBTITLE_CLASS,
  JOB_FORM_SECTION_TITLE_CLASS,
  JOB_FORM_SELECT_CHEVRON,
  JOB_FORM_SELECT_CLASS,
  // JOB_FORM_SHIFT_TYPES, // TODO(future): Internal job configuration
  JOB_FORM_SHOW_PAY_BY,
  JOB_FORM_SURFACE_CLASS,
  JOB_FORM_TEXTAREA_CLASS,
  JOB_FORM_YEARS_OF_EXPERIENCE,
  employmentTypeFromLabel,
  employmentTypeLabel,
  formatPaySummary,
  type JobFormOption,
  type JobFormSpecialtyOption,
  type JobFormStep,
  type JobFormUiState,
} from "./job-form-shared";

function BrandedCheckbox({
  checked,
  onChange,
  label,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`inline-flex cursor-pointer items-start gap-2.5 text-sm text-[#334155] ${className}`}
    >
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border-2 border-[#CBD5E1] bg-white transition-colors checked:border-[color:var(--brand-secondary)] checked:bg-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_30%,transparent)]"
        />
        <Check
          className="pointer-events-none absolute inset-0 m-auto hidden h-3 w-3 text-white peer-checked:block"
          strokeWidth={3}
          aria-hidden
        />
      </span>
      <span className="min-w-0">{label}</span>
    </label>
  );
}

function BrandedRadio({
  checked,
  name,
  label,
  onChange,
}: {
  checked: boolean;
  name: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#334155]">
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={onChange}
          className="peer absolute inset-0 z-10 h-5 w-5 cursor-pointer opacity-0"
        />
        {/* Inactive ring */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#CBD5E1] bg-white transition peer-focus-visible:ring-2 peer-focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_30%,transparent)] peer-checked:opacity-0"
        />
        {/* Active icon — brand secondary */}
        <svg
          width={20}
          height={20}
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="pointer-events-none absolute inset-0 h-5 w-5 text-[color:var(--brand-secondary)] opacity-0 transition peer-checked:opacity-100 peer-focus-visible:rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_30%,transparent)]"
          aria-hidden
        >
          <rect width="20" height="20" rx="10" fill="currentColor" />
          <circle cx="10" cy="10" r="4" fill="white" />
        </svg>
      </span>
      <span>{label}</span>
    </label>
  );
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="mt-1 block text-xs text-rose-600">{error}</span>;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Application deadline picker: today through the next 6 months. */
function applicationDeadlineBounds() {
  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  const maxDate = new Date(minDate);
  maxDate.setMonth(maxDate.getMonth() + 6);
  return {
    min: toDateInputValue(minDate),
    max: toDateInputValue(maxDate),
  };
}

/* TODO(future): restore with Internal job configuration section
function InternalField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-normal text-[#64748B]">
        {label}
        <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
          Internal
        </span>
      </span>
      {children}
      <FieldError error={error} />
    </label>
  );
}
*/

function PublicField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={JOB_FORM_LABEL_CLASS}>{label}</span>
      {children}
      <FieldError error={error} />
    </label>
  );
}

export function JobFormStepRequisition({
  job,
  ui,
  fieldErrors,
  professions,
  specialties,
  employmentTypes,
  sourceTypes,
  employerOfRecordOptions,
  onJobChange,
  onUiChange,
}: {
  job: JobRequisitionInput;
  ui: JobFormUiState;
  fieldErrors: Record<string, string>;
  professions: JobFormOption[];
  specialties: JobFormSpecialtyOption[];
  employmentTypes: EmploymentType[];
  sourceTypes: SourceType[];
  employerOfRecordOptions: JobFormOption[];
  onJobChange: <K extends keyof JobRequisitionInput>(key: K, value: JobRequisitionInput[K]) => void;
  onUiChange: (patch: Partial<JobFormUiState>) => void;
}) {
  const employmentLabels = employmentTypes.map((type) => employmentTypeLabel(type));
  const selectedEor = job.employerOfRecord?.trim() || "";
  const eorOptions =
    selectedEor &&
    !employerOfRecordOptions.some((item) => item.name === selectedEor || item.id === selectedEor)
      ? [...employerOfRecordOptions, { id: selectedEor, name: selectedEor }]
      : employerOfRecordOptions;
  const deadlineBounds = applicationDeadlineBounds();

  return (
    <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="job-id">
              Job ID
            </label>
            <input
              id="job-id"
              className={JOB_FORM_INPUT_CLASS}
              value={job.internalRequisitionNumber ?? ""}
              onChange={(event) => onJobChange("internalRequisitionNumber", event.target.value)}
              placeholder="e.g. JR-1024"
            />
            <FieldError error={fieldErrors.internalRequisitionNumber} />
          </div>
          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="job-title">
              Job Title
            </label>
            <input
              id="job-title"
              className={JOB_FORM_INPUT_CLASS}
              value={job.publicTitle ?? ""}
              onChange={(event) => onJobChange("publicTitle", event.target.value)}
            />
            <FieldError error={fieldErrors.publicTitle} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="profession">
              Profession
            </label>
            <select
              id="profession"
              className={JOB_FORM_SELECT_CLASS}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={job.professionId}
              onChange={(event) => {
                onJobChange("professionId", event.target.value);
                onJobChange("specialtyId", null);
              }}
            >
              <option value="">Select Profession</option>
              {professions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <FieldError error={fieldErrors.professionId} />
          </div>
          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="specialty">
              Specialty
            </label>
            <select
              id="specialty"
              className={JOB_FORM_SELECT_CLASS}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={job.specialtyId ?? ""}
              disabled={!job.professionId}
              onChange={(event) => onJobChange("specialtyId", event.target.value || null)}
            >
              <option value="">Select Specialty</option>
              {specialties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <FieldError error={fieldErrors.specialtyId} />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-x-[40px] gap-y-3">
            <span className={`${JOB_FORM_LABEL_CLASS} mb-0 shrink-0`}>Employment Type</span>
            <div className="flex flex-wrap gap-x-[120px] gap-y-3">
              {employmentLabels.map((label) => (
                <BrandedRadio
                  key={label}
                  name="employment-type"
                  label={label}
                  checked={Boolean(job.employmentType) && employmentTypeLabel(job.employmentType) === label}
                  onChange={() => onJobChange("employmentType", employmentTypeFromLabel(label))}
                />
              ))}
            </div>
          </div>
          <FieldError error={fieldErrors.employmentType} />
        </div>

        <div>
          <label className={JOB_FORM_LABEL_CLASS} htmlFor="job-location">
            Job Location
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              id="job-location"
              className={`${JOB_FORM_INPUT_CLASS} pl-9`}
              value={job.location ?? ""}
              onChange={(event) => onJobChange("location", event.target.value)}
              placeholder="Enter job location"
            />
          </div>
          <FieldError error={fieldErrors.location} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {ui.showInMultipleAreas ? (
            <button
              type="button"
              className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} w-fit`}
              onClick={() =>
                onUiChange({
                  additionalLocations: [...ui.additionalLocations, ""],
                })
              }
            >
              <Plus className="h-4 w-4" />
              Add Additional Location
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <BrandedCheckbox
            checked={ui.showInMultipleAreas}
            onChange={(checked) =>
              onUiChange({
                showInMultipleAreas: checked,
                additionalLocations: checked ? ui.additionalLocations : [],
              })
            }
            label="I want to show my job in multiple areas"
          />
        </div>

        {ui.showInMultipleAreas
          ? ui.additionalLocations.map((location, index) => (
              <div key={`extra-location-${index}`} className="flex gap-2">
                <input
                  className={JOB_FORM_INPUT_CLASS}
                  value={location}
                  placeholder="Additional location"
                  onChange={(event) => {
                    const next = [...ui.additionalLocations];
                    next[index] = event.target.value;
                    onUiChange({ additionalLocations: next });
                  }}
                />
                <button
                  type="button"
                  className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} shrink-0 px-3`}
                  onClick={() =>
                    onUiChange({
                      additionalLocations: ui.additionalLocations.filter((_, i) => i !== index),
                    })
                  }
                  aria-label="Remove location"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            ))
          : null}

        <div>
          <label className={JOB_FORM_LABEL_CLASS} htmlFor="job-location-type">
            Job Location Type
          </label>
          <select
            id="job-location-type"
            className={`${JOB_FORM_SELECT_CLASS} ${ui.jobLocationType ? "text-[#334155]" : "text-[#94A3B8]"}`}
            style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
            value={ui.jobLocationType}
            onChange={(event) => onUiChange({ jobLocationType: event.target.value })}
          >
            <option value="">Select Job Location Type</option>
            {JOB_FORM_LOCATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="number-of-positions">
              Number of Positions
            </label>
            <div className={`${JOB_FORM_SURFACE_CLASS} flex h-10 w-full overflow-hidden`}>
              <input
                id="number-of-positions"
                type="number"
                min={1}
                inputMode="numeric"
                className="h-full min-w-0 flex-1 cursor-pointer border-0 bg-transparent px-3 text-sm text-[#334155] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={ui.numberOfPositions}
                onChange={(event) => {
                  const next = Math.max(1, Math.trunc(Number(event.target.value) || 1));
                  onUiChange({ numberOfPositions: next });
                }}
                aria-label="Number of Positions"
              />
              <div className="flex shrink-0 border-l border-[#CBD5E1]">
                <button
                  type="button"
                  className="inline-flex h-full w-10 cursor-pointer items-center justify-center bg-[#EEF2F6] text-[#64748B] transition hover:bg-[#E2E8F0] hover:text-[#334155]"
                  onClick={() =>
                    onUiChange({
                      numberOfPositions: Math.max(1, ui.numberOfPositions - 1),
                    })
                  }
                  aria-label="Decrease positions"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-full w-10 cursor-pointer items-center justify-center border-l border-[#CBD5E1] bg-white text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#334155]"
                  onClick={() => onUiChange({ numberOfPositions: ui.numberOfPositions + 1 })}
                  aria-label="Increase positions"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="years-experience">
              Years of Experience
            </label>
            <select
              id="years-experience"
              className={`${JOB_FORM_SELECT_CLASS} ${ui.yearsOfExperience ? "text-[#334155]" : "text-[#94A3B8]"}`}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={ui.yearsOfExperience}
              onChange={(event) => onUiChange({ yearsOfExperience: event.target.value })}
            >
              <option value="">Select Years of Experience</option>
              {JOB_FORM_YEARS_OF_EXPERIENCE.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              {ui.yearsOfExperience &&
              !JOB_FORM_YEARS_OF_EXPERIENCE.includes(
                ui.yearsOfExperience as (typeof JOB_FORM_YEARS_OF_EXPERIENCE)[number]
              ) ? (
                <option value={ui.yearsOfExperience}>{ui.yearsOfExperience}</option>
              ) : null}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-[40px] gap-y-3">
          <span className={`${JOB_FORM_LABEL_CLASS} mb-0 shrink-0`}>
            Are you the employer on Record
          </span>
          <div className="flex flex-wrap gap-x-[120px] gap-y-3">
            <BrandedRadio
              name="employer-on-record"
              label="Yes"
              checked={ui.employerOnRecord === "yes"}
              onChange={() => {
                onUiChange({ employerOnRecord: "yes" });
                onJobChange("sourceType", "Internal");
              }}
            />
            <BrandedRadio
              name="employer-on-record"
              label="No"
              checked={ui.employerOnRecord === "no"}
              onChange={() => {
                onUiChange({ employerOnRecord: "no" });
                onJobChange("employerOfRecord", null);
                onJobChange("sourceType", "MSP");
              }}
            />
          </div>
        </div>

        {ui.employerOnRecord === "yes" ? (
          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="employer-of-record">
              Employer on Record
            </label>
            <select
              id="employer-of-record"
              className={`${JOB_FORM_SELECT_CLASS} ${selectedEor ? "text-[#334155]" : "text-[#94A3B8]"}`}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={selectedEor}
              onChange={(event) => onJobChange("employerOfRecord", event.target.value || null)}
            >
              <option value="">Pick List of EORs (includes the tenant)</option>
              {eorOptions.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            <FieldError error={fieldErrors.employerOfRecord} />
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <PublicField label="Application Deadline">
            <div className="relative">
              <input
                id="application-deadline"
                type="date"
                min={deadlineBounds.min}
                max={deadlineBounds.max}
                className={`${JOB_FORM_INPUT_CLASS} pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-10 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
                value={job.applicationDeadline ?? ""}
                onChange={(event) => {
                  const next = event.target.value || null;
                  if (
                    next &&
                    (next < deadlineBounds.min || next > deadlineBounds.max)
                  ) {
                    return;
                  }
                  onJobChange("applicationDeadline", next);
                }}
              />
              <Calendar
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                aria-hidden
              />
            </div>
          </PublicField>

          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="job-source">
              Job Source
            </label>
            <select
              id="job-source"
              className={`${JOB_FORM_SELECT_CLASS} ${job.sourceType ? "text-[#334155]" : "text-[#94A3B8]"}`}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={job.sourceType || ""}
              onChange={(event) =>
                onJobChange("sourceType", event.target.value as SourceType)
              }
            >
              <option value="">Select Job Source</option>
              {sourceTypes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            {job.sourceType === "MSP" ? (
              <p className="mt-1.5 text-xs text-[#64748B]">
                MSP source details will open on the next step.
              </p>
            ) : null}
          </div>
        </div>
    </div>
  );
}

/** Figma: Job Source Details — only when Job Source = MSP. Avoids duplicating Job Location / public pay range. */
export function JobFormStepMspDetails({
  job,
  ui,
  fieldErrors,
  onJobChange,
  onUiChange,
}: {
  job: JobRequisitionInput;
  ui: JobFormUiState;
  fieldErrors: Record<string, string>;
  onJobChange: <K extends keyof JobRequisitionInput>(key: K, value: JobRequisitionInput[K]) => void;
  onUiChange: (patch: Partial<JobFormUiState>) => void;
}) {
  const facilityValue = job.facility?.trim() || job.location?.trim() || "";

  async function copySourceJobId() {
    const value = job.externalRequisitionId?.trim();
    if (!value || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* ignore clipboard errors */
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="msp-name">
          MSP (Job Source)
        </label>
        <input
          id="msp-name"
          className={JOB_FORM_INPUT_CLASS}
          value={job.mspName ?? ""}
          onChange={(event) => onJobChange("mspName", event.target.value)}
          placeholder="e.g. Aya Healthcare"
        />
      </div>

      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="msp-client-name">
          MSP Client Name
        </label>
        <input
          id="msp-client-name"
          className={JOB_FORM_INPUT_CLASS}
          value={job.mspClient ?? ""}
          onChange={(event) => onJobChange("mspClient", event.target.value)}
          placeholder="e.g. Novant"
        />
        <FieldError error={fieldErrors.mspClient} />
      </div>

      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="source-job-id">
          Source Job ID
        </label>
        <div className="relative">
          <input
            id="source-job-id"
            className={`${JOB_FORM_INPUT_CLASS} pr-10`}
            value={job.externalRequisitionId ?? ""}
            onChange={(event) => onJobChange("externalRequisitionId", event.target.value)}
            placeholder="e.g. 122ZO3892"
          />
          <button
            type="button"
            onClick={() => void copySourceJobId()}
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#334155]"
            aria-label="Copy Source Job ID"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <FieldError error={fieldErrors.externalRequisitionId} />
      </div>

      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="source-job-title">
          Source Job Title
        </label>
        <input
          id="source-job-title"
          className={JOB_FORM_INPUT_CLASS}
          value={job.sourceJobTitle ?? ""}
          onChange={(event) => onJobChange("sourceJobTitle", event.target.value)}
          placeholder="e.g. Registered Nurse - Acute Care"
        />
      </div>

      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="source-job-url">
          Source Job URL
        </label>
        <input
          id="source-job-url"
          className={JOB_FORM_INPUT_CLASS}
          value={job.sourceJobUrl ?? ""}
          onChange={(event) => onJobChange("sourceJobUrl", event.target.value)}
          placeholder="https://"
        />
      </div>

      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="msp-facility">
          Facility/Location
        </label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            id="msp-facility"
            className={`${JOB_FORM_INPUT_CLASS} appearance-none bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pl-9 pr-10`}
            style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
            value={facilityValue}
            onChange={(event) => onJobChange("facility", event.target.value)}
            placeholder="Facility or location"
            list="msp-facility-suggestions"
          />
          <datalist id="msp-facility-suggestions">
            {job.location?.trim() ? <option value={job.location.trim()} /> : null}
          </datalist>
        </div>
      </div>

      {/* Figma: Bill Rate | Suggested Pay Rate | Annually — 3 equal columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        <div>
          <label className={JOB_FORM_LABEL_CLASS} htmlFor="bill-rate">
            Bill Rate
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">
              $
            </span>
            <input
              id="bill-rate"
              type="number"
              min="0"
              step="0.01"
              className={`${JOB_FORM_INPUT_CLASS} pl-7`}
              value={job.billRate ?? ""}
              onChange={(event) =>
                onJobChange("billRate", event.target.value ? Number(event.target.value) : null)
              }
            />
          </div>
        </div>

        <div>
          <label className={JOB_FORM_LABEL_CLASS} htmlFor="suggested-pay-rate">
            Suggested Pay Rate
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">
              $
            </span>
            <input
              id="suggested-pay-rate"
              type="number"
              min="0"
              step="0.01"
              className={`${JOB_FORM_INPUT_CLASS} pl-7`}
              value={job.suggestedPayRate ?? ""}
              onChange={(event) =>
                onJobChange(
                  "suggestedPayRate",
                  event.target.value ? Number(event.target.value) : null
                )
              }
            />
          </div>
        </div>

        <div>
          <label className={`${JOB_FORM_LABEL_CLASS} sm:invisible`} htmlFor="suggested-pay-period">
            Period
          </label>
          <select
            id="suggested-pay-period"
            className={`${JOB_FORM_SELECT_CLASS} ${ui.compensationType ? "text-[#334155]" : "text-[#94A3B8]"}`}
            style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
            value={ui.compensationType}
            onChange={(event) => onUiChange({ compensationType: event.target.value })}
            aria-label="Suggested pay rate period"
          >
            <option value="">Select Compensation</option>
            {JOB_FORM_COMPENSATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={JOB_FORM_LABEL_CLASS} htmlFor="job-duration">
            Job Duration
          </label>
          <select
            id="job-duration"
            className={JOB_FORM_SELECT_CLASS}
            style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
            value={job.duration ?? ""}
            onChange={(event) => onJobChange("duration", event.target.value || null)}
          >
            <option value="">Eg: 13 weeks</option>
            {JOB_FORM_DURATION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            {job.duration &&
            !JOB_FORM_DURATION_OPTIONS.includes(
              job.duration as (typeof JOB_FORM_DURATION_OPTIONS)[number]
            ) ? (
              <option value={job.duration}>{job.duration}</option>
            ) : null}
          </select>
        </div>

        <div>
          <label className={JOB_FORM_LABEL_CLASS} htmlFor="msp-start-date">
            Start Date
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              id="msp-start-date"
              type="date"
              className={`${JOB_FORM_INPUT_CLASS} pl-9`}
              value={job.targetStartDate ?? ""}
              onChange={(event) => onJobChange("targetStartDate", event.target.value || null)}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="required-credentials">
          Required Credentials / Certifications
        </label>
        <input
          id="required-credentials"
          className={JOB_FORM_INPUT_CLASS}
          value={job.requiredCredentials ?? ""}
          onChange={(event) => onJobChange("requiredCredentials", event.target.value)}
          placeholder="Required Credentials / Certifications"
        />
      </div>

      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="special-requirements">
          Special Requirement / Restrictions
        </label>
        <input
          id="special-requirements"
          className={JOB_FORM_INPUT_CLASS}
          value={job.specialRequirements ?? ""}
          onChange={(event) => onJobChange("specialRequirements", event.target.value)}
          placeholder="Special Requirement / Restrictions"
        />
      </div>

      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="source-job-details">
          Job Details
        </label>
        <select
          id="source-job-details"
          className={JOB_FORM_SELECT_CLASS}
          style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
          value={job.sourceJobDetails ?? ""}
          onChange={(event) => onJobChange("sourceJobDetails", event.target.value || null)}
        >
          <option value="">Select</option>
          {JOB_FORM_MSP_JOB_DETAIL_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
          {job.sourceJobDetails &&
          !JOB_FORM_MSP_JOB_DETAIL_OPTIONS.includes(
            job.sourceJobDetails as (typeof JOB_FORM_MSP_JOB_DETAIL_OPTIONS)[number]
          ) ? (
            <option value={job.sourceJobDetails}>{job.sourceJobDetails}</option>
          ) : null}
        </select>
      </div>

      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="internal-notes">
          Internal Notes
        </label>
        <textarea
          id="internal-notes"
          className={`${JOB_FORM_TEXTAREA_CLASS} min-h-[140px]`}
          value={job.internalNotes ?? ""}
          onChange={(event) => onJobChange("internalNotes", event.target.value)}
        />
      </div>
    </div>
  );
}

export function JobFormStepCompensation({
  job,
  ui,
  fieldErrors,
  onJobChange,
  onUiChange,
}: {
  job: JobRequisitionInput;
  ui: JobFormUiState;
  fieldErrors: Record<string, string>;
  onJobChange: <K extends keyof JobRequisitionInput>(key: K, value: JobRequisitionInput[K]) => void;
  onUiChange: (patch: Partial<JobFormUiState>) => void;
}) {
  const hidePaySection = job.sourceType === "MSP";
  const [creatingBenefit, setCreatingBenefit] = useState(false);
  const [newBenefitName, setNewBenefitName] = useState("");

  const benefitOptions = [
    ...JOB_FORM_BENEFIT_OPTIONS,
    ...ui.customBenefits.filter(
      (item) => !(JOB_FORM_BENEFIT_OPTIONS as readonly string[]).includes(item)
    ),
  ];

  function toggleBenefit(benefit: string) {
    const selected = ui.selectedBenefits.includes(benefit);
    onUiChange({
      selectedBenefits: selected
        ? ui.selectedBenefits.filter((item) => item !== benefit)
        : [...ui.selectedBenefits, benefit],
    });
  }

  function addCustomBenefit() {
    const name = newBenefitName.trim();
    if (!name) return;
    const exists = benefitOptions.some(
      (item) => item.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      if (!ui.selectedBenefits.some((item) => item.toLowerCase() === name.toLowerCase())) {
        const match =
          benefitOptions.find((item) => item.toLowerCase() === name.toLowerCase()) ?? name;
        onUiChange({ selectedBenefits: [...ui.selectedBenefits, match] });
      }
      setNewBenefitName("");
      setCreatingBenefit(false);
      return;
    }
    onUiChange({
      customBenefits: [...ui.customBenefits, name],
      selectedBenefits: [...ui.selectedBenefits, name],
    });
    setNewBenefitName("");
    setCreatingBenefit(false);
  }

  return (
    <div className="space-y-8">
      {!hidePaySection ? (
        <section className="space-y-5">
          <div>
            <h2 className={JOB_FORM_SECTION_TITLE_CLASS}>Compensation</h2>
            <p className={JOB_FORM_SECTION_SUBTITLE_CLASS}>
              Review the pay we estimated for your job and adjust as needed. Check your local minimum
              wage.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={JOB_FORM_LABEL_CLASS}>Compensation</label>
              <select
                className={`${JOB_FORM_SELECT_CLASS} ${ui.compensationType ? "text-[#334155]" : "text-[#94A3B8]"}`}
                style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                value={ui.compensationType}
                onChange={(event) => onUiChange({ compensationType: event.target.value })}
              >
                <option value="">Select Compensation</option>
                {JOB_FORM_COMPENSATION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
                {ui.compensationType &&
                !JOB_FORM_COMPENSATION_TYPES.includes(
                  ui.compensationType as (typeof JOB_FORM_COMPENSATION_TYPES)[number]
                ) ? (
                  <option value={ui.compensationType}>{ui.compensationType}</option>
                ) : null}
              </select>
            </div>
            <div>
              <label className={JOB_FORM_LABEL_CLASS}>Currency</label>
              <select
                className={`${JOB_FORM_SELECT_CLASS} ${ui.currency ? "text-[#334155]" : "text-[#94A3B8]"}`}
                style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                value={ui.currency}
                onChange={(event) => onUiChange({ currency: event.target.value })}
              >
                <option value="">Select Currency</option>
                {JOB_FORM_CURRENCIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr_1fr_1fr] md:items-end">
            <div>
              <label className={JOB_FORM_LABEL_CLASS}>Show pay by</label>
              <select
                className={`${JOB_FORM_SELECT_CLASS} ${ui.showPayBy ? "text-[#334155]" : "text-[#94A3B8]"}`}
                style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                value={ui.showPayBy}
                onChange={(event) => onUiChange({ showPayBy: event.target.value })}
              >
                <option value="">Select Show pay by</option>
                {JOB_FORM_SHOW_PAY_BY.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <span className="hidden pb-2 text-sm text-[#64748B] md:block">to</span>
            <div>
              <label className={JOB_FORM_LABEL_CLASS}>Minimum</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${JOB_FORM_INPUT_CLASS} pl-7`}
                  value={job.payRateMin ?? ""}
                  onChange={(event) =>
                    onJobChange("payRateMin", event.target.value ? Number(event.target.value) : null)
                  }
                />
              </div>
            </div>
            <div>
              <label className={JOB_FORM_LABEL_CLASS}>Maximum</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${JOB_FORM_INPUT_CLASS} pl-7`}
                  value={job.payRateMax ?? ""}
                  onChange={(event) =>
                    onJobChange("payRateMax", event.target.value ? Number(event.target.value) : null)
                  }
                />
              </div>
              <FieldError error={fieldErrors.payRateMax} />
            </div>
            <div>
              <label className={JOB_FORM_LABEL_CLASS}>Rate</label>
              <select
                className={`${JOB_FORM_SELECT_CLASS} ${ui.payRatePeriod ? "text-[#334155]" : "text-[#94A3B8]"}`}
                style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                value={ui.payRatePeriod}
                onChange={(event) => onUiChange({ payRatePeriod: event.target.value })}
              >
                <option value="">Select Rate</option>
                {JOB_FORM_PAY_PERIODS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={JOB_FORM_SECTION_TITLE_CLASS}>Benefits</h2>
          {!creatingBenefit ? (
            <button
              type="button"
              onClick={() => setCreatingBenefit(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-[color:var(--brand-primary)] transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Create Benefit
            </button>
          ) : null}
        </div>

        {creatingBenefit ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              className={`${JOB_FORM_INPUT_CLASS} max-w-xs`}
              value={newBenefitName}
              onChange={(event) => setNewBenefitName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomBenefit();
                }
                if (event.key === "Escape") {
                  setCreatingBenefit(false);
                  setNewBenefitName("");
                }
              }}
              placeholder="Enter benefit name"
              aria-label="New benefit name"
            />
            <button
              type="button"
              onClick={addCustomBenefit}
              className={JOB_FORM_PRIMARY_BUTTON_CLASS}
              style={{
                backgroundColor: "var(--brand-primary)",
                borderColor: "var(--brand-primary)",
              }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatingBenefit(false);
                setNewBenefitName("");
              }}
              className={JOB_FORM_OUTLINE_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {benefitOptions.map((benefit) => {
            const selected = ui.selectedBenefits.includes(benefit);
            const isCustom = ui.customBenefits.includes(benefit);
            const chipClass = `inline-flex items-center gap-2 rounded-full border text-sm transition ${
              selected
                ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] text-[#334155]"
                : "border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
            }`;

            if (!isCustom) {
              return (
                <button
                  key={benefit}
                  type="button"
                  onClick={() => toggleBenefit(benefit)}
                  className={`${chipClass} cursor-pointer px-3 py-1.5`}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {benefit}
                </button>
              );
            }

            return (
              <div key={benefit} className={`${chipClass} pl-3 pr-1.5 py-1`}>
                <button
                  type="button"
                  onClick={() => toggleBenefit(benefit)}
                  className="inline-flex cursor-pointer items-center gap-2 py-0.5"
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {benefit}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${benefit}`}
                  className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-[#94A3B8] transition hover:bg-[#E2E8F0] hover:text-[#64748B]"
                  onClick={() => {
                    onUiChange({
                      customBenefits: ui.customBenefits.filter((item) => item !== benefit),
                      selectedBenefits: ui.selectedBenefits.filter((item) => item !== benefit),
                    });
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={JOB_FORM_SECTION_TITLE_CLASS}>Job Description</h2>
        <JobDescriptionEditor
          value={job.publicDescription ?? ""}
          onChange={(next) => onJobChange("publicDescription", next)}
          error={fieldErrors.publicDescription}
        />
      </section>

      {/* TODO(future): Additional public details — Qualifications / Responsibilities
      <section className="space-y-4">
        <h2 className={JOB_FORM_SECTION_TITLE_CLASS}>Additional public details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <PublicField label="Qualifications">
            <textarea
              className={`${JOB_FORM_TEXTAREA_CLASS} min-h-[120px]`}
              value={job.qualifications ?? ""}
              onChange={(event) => onJobChange("qualifications", event.target.value)}
            />
          </PublicField>
          <PublicField label="Responsibilities">
            <textarea
              className={`${JOB_FORM_TEXTAREA_CLASS} min-h-[120px]`}
              value={job.responsibilities ?? ""}
              onChange={(event) => onJobChange("responsibilities", event.target.value)}
            />
          </PublicField>
        </div>
      </section>
      */}
    </div>
  );
}

function formatReviewMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "";
  return `$${value}`;
}

function formatReviewDate(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return raw;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function isReviewValueEmpty(value: string | null | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return !trimmed || trimmed === "—" || trimmed === "-";
}

function reviewAddLabel(label: string, addLabel?: string): string {
  if (addLabel?.trim()) return addLabel.trim();
  return label.trim().toLowerCase();
}

function ReviewAddPlusIcon() {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary)] text-white"
      aria-hidden
    >
      <Plus className="h-3 w-3" strokeWidth={2.75} />
    </span>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
  addLabel,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
  /** Custom text after “Add” when empty (defaults to lowercased label). */
  addLabel?: string;
}) {
  const empty = isReviewValueEmpty(value);

  return (
    <div className="grid gap-2 border-b border-[#E5E7EB] py-4 md:grid-cols-[220px_1fr_auto] md:items-start">
      <div className="text-sm font-medium text-[#64748B]">{label}</div>
      <div className="min-w-0 text-sm text-[#1D2739]">
        {empty ? (
          onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[color:var(--brand-primary)] transition hover:opacity-90"
            >
              <ReviewAddPlusIcon />
              Add {reviewAddLabel(label, addLabel)}
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 font-medium text-[color:var(--brand-primary)]">
              <ReviewAddPlusIcon />
              Add {reviewAddLabel(label, addLabel)}
            </span>
          )
        ) : (
          <div className="whitespace-pre-line">{value}</div>
        )}
      </div>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className={JOB_FORM_ICON_BUTTON_CLASS}
          aria-label={empty ? `Add ${reviewAddLabel(label, addLabel)}` : `Edit ${label}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <span className="hidden md:block" />
      )}
    </div>
  );
}

export function JobFormStepReview({
  job,
  ui,
  professionName,
  specialtyName,
  onEditField,
}: {
  job: JobRequisitionInput;
  ui: JobFormUiState;
  professionName: string;
  specialtyName: string;
  onEditField: (field: ReviewEditFieldId) => void;
}) {
  const descriptionHtml = job.publicDescription?.trim() || "";
  const descriptionPlain = jobDescriptionPlainText(descriptionHtml);
  const hasDescription = Boolean(descriptionPlain.trim());
  const shortDescription =
    descriptionPlain.length > 180
      ? `${descriptionPlain.slice(0, 180).trim()}…`
      : descriptionPlain;
  const isTruncated = descriptionPlain.length > 180;
  const additionalLocationsValue = ui.additionalLocations.map((item) => item.trim()).filter(Boolean).join(", ");
  const employmentTypeValue = job.employmentType
    ? employmentTypeLabel(job.employmentType)
    : "";
  const compensationValue =
    job.sourceType === "MSP"
      ? ""
      : (() => {
          const paySummary = formatPaySummary(job, ui);
          const payLine = [
            ui.showPayBy,
            paySummary !== "—" ? paySummary : "",
          ]
            .filter(Boolean)
            .join(", ");
          return [[ui.compensationType, ui.currency].filter(Boolean).join(", "), payLine]
            .filter(Boolean)
            .join("\n");
        })();
  const mspPayRateValue = [
    formatReviewMoney(job.suggestedPayRate),
    ui.compensationType,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="space-y-1">
      <div className="mb-4">
        <h2 className={JOB_FORM_SECTION_TITLE_CLASS}>Job Details</h2>
      </div>

      <ReviewRow
        label="Job ID"
        value={job.internalRequisitionNumber ?? ""}
        onEdit={() => onEditField("jobId")}
      />
      <ReviewRow label="Job Title" value={job.publicTitle ?? ""} onEdit={() => onEditField("jobTitle")} />
      <ReviewRow label="Profession" value={professionName} onEdit={() => onEditField("profession")} />
      <ReviewRow
        label="Specialty"
        value={specialtyName}
        addLabel="specialty"
        onEdit={() => onEditField("specialty")}
      />
      <ReviewRow label="Job Location" value={job.location ?? ""} onEdit={() => onEditField("jobLocation")} />
      <ReviewRow
        label="Add Additional Location"
        value={additionalLocationsValue}
        addLabel="optional job information"
        onEdit={() => onEditField("additionalLocation")}
      />
      <ReviewRow label="Job Location Type" value={ui.jobLocationType} onEdit={() => onEditField("jobLocationType")} />
      <ReviewRow
        label="Number of Positions"
        value={ui.numberOfPositions > 0 ? String(ui.numberOfPositions) : ""}
        onEdit={() => onEditField("numberOfPositions")}
      />
      <ReviewRow
        label="Years of Experience"
        value={ui.yearsOfExperience}
        onEdit={() => onEditField("yearsOfExperience")}
      />
      <ReviewRow
        label="Employment Type"
        value={employmentTypeValue}
        onEdit={() => onEditField("employmentType")}
      />
      <ReviewRow
        label="Are you the employer on Record"
        value={
          ui.employerOnRecord === "yes" ? "Yes" : ui.employerOnRecord === "no" ? "No" : ""
        }
        addLabel="employer on record"
        onEdit={() => onEditField("employerOnRecord")}
      />
      {ui.employerOnRecord === "yes" ? (
        <ReviewRow
          label="Employer on Record"
          value={job.employerOfRecord ?? ""}
          onEdit={() => onEditField("employerOfRecord")}
        />
      ) : null}
      <ReviewRow
        label="Job Source"
        value={job.sourceType || ""}
        onEdit={() => onEditField("jobSource")}
      />
      {job.sourceType === "MSP" ? (
        <>
          <ReviewRow
            label="MSP (Job Source)"
            value={job.mspName ?? ""}
            addLabel="MSP"
            onEdit={() => onEditField("mspName")}
          />
          <ReviewRow
            label="MSP Client Name"
            value={job.mspClient ?? ""}
            onEdit={() => onEditField("mspClient")}
          />
          <ReviewRow
            label="Source Job Req#"
            value={job.externalRequisitionId ?? ""}
            addLabel="source job ID"
            onEdit={() => onEditField("sourceJobId")}
          />
          <ReviewRow
            label="Source Job Title"
            value={job.sourceJobTitle ?? ""}
            onEdit={() => onEditField("sourceJobTitle")}
          />
          <ReviewRow
            label="Facility/Location"
            value={job.facility?.trim() || job.location?.trim() || ""}
            onEdit={() => onEditField("facilityLocation")}
          />
          <ReviewRow
            label="Source Job URL"
            value={job.sourceJobUrl ?? ""}
            onEdit={() => onEditField("sourceJobUrl")}
          />
          <ReviewRow
            label="Bill Rate"
            value={formatReviewMoney(job.billRate)}
            onEdit={() => onEditField("billRate")}
          />
          <ReviewRow
            label="Pay Rate"
            value={mspPayRateValue}
            onEdit={() => onEditField("payRate")}
          />
          <ReviewRow
            label="Job Duration"
            value={job.duration ?? ""}
            onEdit={() => onEditField("jobDuration")}
          />
          <ReviewRow
            label="Start Date"
            value={formatReviewDate(job.targetStartDate)}
            onEdit={() => onEditField("startDate")}
          />
          <ReviewRow
            label="Required Credentials / Certifications"
            value={job.requiredCredentials ?? ""}
            addLabel="credentials"
            onEdit={() => onEditField("credentials")}
          />
          <ReviewRow
            label="Special Requirement / Restrictions"
            value={job.specialRequirements ?? ""}
            addLabel="special requirements"
            onEdit={() => onEditField("specialRequirements")}
          />
          <ReviewRow
            label="Job Details"
            value={job.sourceJobDetails ?? ""}
            onEdit={() => onEditField("sourceJobDetails")}
          />
          <ReviewRow
            label="Internal Notes"
            value={job.internalNotes ?? ""}
            onEdit={() => onEditField("internalNotes")}
          />
        </>
      ) : null}
      {job.sourceType !== "MSP" ? (
        <ReviewRow
          label="Compensation"
          value={compensationValue}
          onEdit={() => onEditField("compensation")}
        />
      ) : null}
      <ReviewRow
        label="Benefits"
        value={ui.selectedBenefits.join(", ")}
        onEdit={() => onEditField("benefits")}
      />
      <div className="grid gap-2 border-b border-[#E5E7EB] py-4 md:grid-cols-[220px_1fr_auto] md:items-start">
        <div className="text-sm font-medium text-[#64748B]">Job Description</div>
        <div className="min-w-0">
          {!hasDescription ? (
            <button
              type="button"
              onClick={() => onEditField("jobDescription")}
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[color:var(--brand-primary)] transition hover:opacity-90"
            >
              <ReviewAddPlusIcon />
              Add job description
            </button>
          ) : (
            <>
              <p className="text-sm font-medium text-[#1D2739]">About the Role</p>
              {isTruncated ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">{shortDescription}</p>
              ) : (
                <JobDescriptionHtml
                  html={descriptionHtml}
                  className="mt-1"
                  emptyLabel=""
                />
              )}
              {isTruncated ? (
                <button
                  type="button"
                  className="mt-2 cursor-pointer text-sm font-medium text-[color:var(--brand-primary)]"
                >
                  Show full description
                </button>
              ) : null}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => onEditField("jobDescription")}
          className={JOB_FORM_ICON_BUTTON_CLASS}
          aria-label={hasDescription ? "Edit Job Description" : "Add job description"}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

export function JobFormFooter({
  step,
  saving,
  canPublish,
  showPublishActions,
  termsAccepted,
  brandStyle,
  onBack,
  onNext,
  onPreview,
  onSaveDraft,
  onPublish,
  onTermsChange,
}: {
  step: JobFormStep;
  saving: boolean;
  canPublish: boolean;
  showPublishActions: boolean;
  termsAccepted: boolean;
  brandStyle: CSSProperties;
  onBack: () => void;
  onNext: () => void;
  onPreview: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onTermsChange: (accepted: boolean) => void;
}) {
  const isReview = step === "review";
  const isCompensation = step === "compensation";

  return (
    <div className="mt-8 border-t border-[#E5E7EB] pt-5">
      {isReview ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <BrandedCheckbox
            checked={termsAccepted}
            onChange={onTermsChange}
            className="max-w-2xl text-xs leading-5 text-[#64748B]"
            label={
              <>
                By selecting Confirm, you agree that this job post reflects your requirements, and
                agree it will be posted and applications will be processed following applicable{" "}
                <span className="font-medium text-[color:var(--brand-primary)]">Terms</span>,{" "}
                <span className="font-medium text-[color:var(--brand-primary)]">Cookie</span>, and{" "}
                <span className="font-medium text-[color:var(--brand-primary)]">Privacy</span>{" "}
                Policies.
              </>
            }
          />
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 self-start text-sm font-medium text-[color:var(--brand-primary)] transition hover:opacity-90"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={JOB_FORM_OUTLINE_BUTTON_CLASS} onClick={onBack} disabled={saving}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {isCompensation ? (
            <button type="button" className={JOB_FORM_OUTLINE_BUTTON_CLASS} onClick={onPreview}>
              <Eye className="h-4 w-4" />
              Preview
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {step === "requisition" || step === "msp-details" ? (
            <button
              type="button"
              className={JOB_FORM_PRIMARY_BUTTON_CLASS}
              style={brandStyle}
              onClick={onNext}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : isCompensation ? (
            <button
              type="button"
              className={JOB_FORM_PRIMARY_BUTTON_CLASS}
              style={brandStyle}
              onClick={onNext}
            >
              Continue to Review
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : showPublishActions ? (
            <>
              <button
                type="button"
                className={JOB_FORM_PRIMARY_BUTTON_CLASS}
                style={brandStyle}
                disabled={saving}
                onClick={onSaveDraft}
              >
                Save
              </button>
              <button
                type="button"
                className={JOB_FORM_PRIMARY_BUTTON_CLASS}
                style={brandStyle}
                disabled={saving || !canPublish || !termsAccepted}
                onClick={onPublish}
                title={!termsAccepted ? "Accept terms to publish" : undefined}
              >
                Save and Publish
              </button>
            </>
          ) : (
            <button
              type="button"
              className={JOB_FORM_PRIMARY_BUTTON_CLASS}
              style={brandStyle}
              disabled={saving}
              onClick={onSaveDraft}
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function JobFormWorkflowBanner({
  workflowName,
  workflowWarning,
  mappingCriteria,
  mappingLink,
  canManageWorkflows,
  fieldError,
}: {
  workflowName?: string;
  workflowWarning: string;
  mappingCriteria?: string;
  mappingLink: string;
  canManageWorkflows: boolean;
  fieldError?: string;
}) {
  const hasWorkflow = Boolean(workflowName);

  return (
    <div
      className={`mt-6 overflow-hidden rounded-xl border ${
        hasWorkflow
          ? "border-[color:color-mix(in_srgb,var(--brand-primary)_22%,#E5E7EB)] bg-[color:color-mix(in_srgb,var(--brand-primary)_7%,white)]"
          : "border-amber-200/90 bg-gradient-to-br from-amber-50 to-[#FFFBF5]"
      }`}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5 sm:p-5">
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              hasWorkflow
                ? "bg-[color:var(--brand-secondary)] text-white shadow-sm"
                : "bg-amber-100 text-amber-700"
            }`}
            aria-hidden
          >
            {hasWorkflow ? <GitBranch className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[#1D2739]">Assigned workflow</p>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                  hasWorkflow
                    ? "bg-[color:color-mix(in_srgb,var(--brand-secondary)_12%,white)] text-[color:var(--brand-secondary)]"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {hasWorkflow ? "Matched" : "Action needed"}
              </span>
            </div>

            {hasWorkflow ? (
              <>
                <p className="mt-2 text-base font-semibold tracking-tight text-[color:var(--brand-primary)]">
                  {workflowName}
                </p>
                {mappingCriteria ? (
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Matched on{" "}
                    <span className="font-medium text-[#475569]">{mappingCriteria}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Applicants for this job will follow this workflow.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-amber-900/90">
                {workflowWarning ||
                  "Select profession and employment type to resolve a workflow."}
              </p>
            )}

            {fieldError ? <p className="mt-2 text-xs text-rose-600">{fieldError}</p> : null}
          </div>
        </div>

        {canManageWorkflows ? (
          <Link
            href={mappingLink}
            className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg px-3.5 text-sm font-medium transition ${
              hasWorkflow
                ? "border border-[color:color-mix(in_srgb,var(--brand-primary)_35%,#CBD5E1)] bg-white text-[color:var(--brand-primary)] hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]"
                : "bg-[color:var(--brand-primary)] text-white hover:opacity-95"
            }`}
          >
            {hasWorkflow ? "Manage mappings" : "Create mapping"}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
