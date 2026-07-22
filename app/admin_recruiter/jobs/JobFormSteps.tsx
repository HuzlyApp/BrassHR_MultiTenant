"use client";

import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Copy,
  Eye,
  MapPin,
  Minus,
  Pencil,
  Plus,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { EmploymentType, JobRequisitionInput, SourceType } from "@/lib/jobs/types";
import {
  JobDescriptionEditor,
  JobDescriptionHtml,
  jobDescriptionPlainText,
} from "./JobDescriptionEditor";
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
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#334155]">
      <span className="relative inline-flex h-5 w-5 shrink-0">
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
      <span>{label}</span>
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
      <span className="relative inline-flex h-5 w-5 shrink-0">
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={onChange}
          className="peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-[#CBD5E1] bg-white transition checked:border-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_30%,transparent)]"
        />
        <span className="pointer-events-none absolute inset-0 m-auto hidden h-2.5 w-2.5 rounded-full bg-[color:var(--brand-secondary)] peer-checked:block" />
      </span>
      <span>{label}</span>
    </label>
  );
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="mt-1 block text-xs text-rose-600">{error}</span>;
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
      <span className="mb-1.5 flex items-center gap-2 text-sm font-normal text-[#64748B]">
        {label}
        <span className="rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-primary)]">
          Public
        </span>
      </span>
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
  onJobChange: <K extends keyof JobRequisitionInput>(key: K, value: JobRequisitionInput[K]) => void;
  onUiChange: (patch: Partial<JobFormUiState>) => void;
}) {
  const employmentLabels = employmentTypes.map((type) => employmentTypeLabel(type));

  return (
    <div className="space-y-5">
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
          <span className={JOB_FORM_LABEL_CLASS}>Employment Type</span>
          <div className="mt-2 flex flex-wrap gap-5">
            {employmentLabels.map((label) => (
              <BrandedRadio
                key={label}
                name="employment-type"
                label={label}
                checked={employmentTypeLabel(job.employmentType) === label}
                onChange={() => onJobChange("employmentType", employmentTypeFromLabel(label))}
              />
            ))}
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
          <BrandedCheckbox
            checked={ui.showInMultipleAreas}
            onChange={(checked) => onUiChange({ showInMultipleAreas: checked })}
            label="I want to show my job in multiple areas"
          />
        </div>

        {ui.additionalLocations.map((location, index) => (
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
        ))}

        <div>
          <label className={JOB_FORM_LABEL_CLASS} htmlFor="job-location-type">
            Job Location Type
          </label>
          <select
            id="job-location-type"
            className={JOB_FORM_SELECT_CLASS}
            style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
            value={ui.jobLocationType}
            onChange={(event) => onUiChange({ jobLocationType: event.target.value })}
          >
            {JOB_FORM_LOCATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={JOB_FORM_LABEL_CLASS}>Number of Positions</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} h-10 w-10 px-0`}
                onClick={() =>
                  onUiChange({
                    numberOfPositions: Math.max(1, ui.numberOfPositions - 1),
                  })
                }
                aria-label="Decrease positions"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className={`${JOB_FORM_INPUT_CLASS} flex h-10 items-center justify-center px-0`}>
                {ui.numberOfPositions}
              </div>
              <button
                type="button"
                className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} h-10 w-10 px-0`}
                onClick={() => onUiChange({ numberOfPositions: ui.numberOfPositions + 1 })}
                aria-label="Increase positions"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="years-experience">
              Years of Experience
            </label>
            <select
              id="years-experience"
              className={JOB_FORM_SELECT_CLASS}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={ui.yearsOfExperience}
              onChange={(event) => onUiChange({ yearsOfExperience: event.target.value })}
            >
              {JOB_FORM_YEARS_OF_EXPERIENCE.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className={JOB_FORM_LABEL_CLASS}>Are you the employer on Record</span>
          <div className="mt-2 flex flex-wrap gap-5">
            <BrandedRadio
              name="employer-on-record"
              label="Yes"
              checked={ui.employerOnRecord === "yes"}
              onChange={() => onUiChange({ employerOnRecord: "yes" })}
            />
            <BrandedRadio
              name="employer-on-record"
              label="No"
              checked={ui.employerOnRecord === "no"}
              onChange={() => onUiChange({ employerOnRecord: "no" })}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <PublicField label="Application Deadline">
            <input
              id="application-deadline"
              type="date"
              className={JOB_FORM_INPUT_CLASS}
              value={job.applicationDeadline ?? ""}
              onChange={(event) => onJobChange("applicationDeadline", event.target.value || null)}
            />
          </PublicField>

          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="job-source">
              Job Source
            </label>
            <select
              id="job-source"
              className={JOB_FORM_SELECT_CLASS}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={job.sourceType}
              onChange={(event) => onJobChange("sourceType", event.target.value as SourceType)}
            >
              {sourceTypes.map((value) => (
                <option key={value} value={value}>
                  {value === "Internal" ? "Internal/List of MSPs" : value}
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
            className={JOB_FORM_SELECT_CLASS}
            style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
            value={ui.compensationType}
            onChange={(event) => onUiChange({ compensationType: event.target.value })}
            aria-label="Suggested pay rate period"
          >
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
  return (
    <div className="space-y-8">
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
              className={JOB_FORM_SELECT_CLASS}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={ui.compensationType}
              onChange={(event) => onUiChange({ compensationType: event.target.value })}
            >
              {JOB_FORM_COMPENSATION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={JOB_FORM_LABEL_CLASS}>Currency</label>
            <select
              className={JOB_FORM_SELECT_CLASS}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={ui.currency}
              onChange={(event) => onUiChange({ currency: event.target.value })}
            >
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
              className={JOB_FORM_SELECT_CLASS}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={ui.showPayBy}
              onChange={(event) => onUiChange({ showPayBy: event.target.value })}
            >
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
              className={JOB_FORM_SELECT_CLASS}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={ui.payRatePeriod}
              onChange={(event) => onUiChange({ payRatePeriod: event.target.value })}
            >
              {JOB_FORM_PAY_PERIODS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={JOB_FORM_SECTION_TITLE_CLASS}>Benefits</h2>
        <div className="flex flex-wrap gap-2">
          {JOB_FORM_BENEFIT_OPTIONS.map((benefit) => {
            const selected = ui.selectedBenefits.includes(benefit);
            return (
              <button
                key={benefit}
                type="button"
                onClick={() => {
                  onUiChange({
                    selectedBenefits: selected
                      ? ui.selectedBenefits.filter((item) => item !== benefit)
                      : [...ui.selectedBenefits, benefit],
                  });
                }}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                  selected
                    ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] text-[#334155]"
                    : "border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {benefit}
              </button>
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

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
}) {
  return (
    <div className="grid gap-2 border-b border-[#E5E7EB] py-4 md:grid-cols-[220px_1fr_auto] md:items-start">
      <div className="text-sm font-medium text-[#64748B]">{label}</div>
      <div className="text-sm text-[#1D2739]">{value || "—"}</div>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className={JOB_FORM_ICON_BUTTON_CLASS}
          aria-label={`Edit ${label}`}
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
  onGoToStep,
}: {
  job: JobRequisitionInput;
  ui: JobFormUiState;
  professionName: string;
  specialtyName: string;
  onGoToStep: (step: JobFormStep) => void;
}) {
  const descriptionHtml = job.publicDescription?.trim() || "";
  const descriptionPlain = jobDescriptionPlainText(descriptionHtml) || "—";
  const shortDescription =
    descriptionPlain.length > 180
      ? `${descriptionPlain.slice(0, 180).trim()}…`
      : descriptionPlain;
  const isTruncated = descriptionPlain.length > 180;

  return (
    <section className="space-y-1">
      <div className="mb-4">
        <h2 className={JOB_FORM_SECTION_TITLE_CLASS}>Review</h2>
        <p className={JOB_FORM_SECTION_SUBTITLE_CLASS}>Job Details</p>
      </div>

      <ReviewRow label="Job Title" value={job.publicTitle ?? ""} onEdit={() => onGoToStep("requisition")} />
      <ReviewRow label="Profession" value={professionName} onEdit={() => onGoToStep("requisition")} />
      <ReviewRow label="Specialty" value={specialtyName} onEdit={() => onGoToStep("requisition")} />
      <ReviewRow label="Job Location" value={job.location ?? ""} onEdit={() => onGoToStep("requisition")} />
      <ReviewRow label="Job Location Type" value={ui.jobLocationType} onEdit={() => onGoToStep("requisition")} />
      <ReviewRow
        label="Number of Positions"
        value={String(ui.numberOfPositions)}
        onEdit={() => onGoToStep("requisition")}
      />
      <ReviewRow
        label="Years of Experience"
        value={ui.yearsOfExperience}
        onEdit={() => onGoToStep("requisition")}
      />
      <ReviewRow
        label="Employment Type"
        value={employmentTypeLabel(job.employmentType)}
        onEdit={() => onGoToStep("requisition")}
      />
      <ReviewRow
        label="Employer on Record"
        value={
          job.employerOfRecord?.trim() &&
          !["yes", "no"].includes(job.employerOfRecord.trim().toLowerCase())
            ? job.employerOfRecord
            : ui.employerOnRecord === "yes"
              ? "Yes"
              : "No"
        }
        onEdit={() => onGoToStep("requisition")}
      />
      <ReviewRow
        label="Job Source"
        value={job.sourceType === "Internal" ? "Internal/List of MSPs" : job.sourceType}
        onEdit={() => onGoToStep("requisition")}
      />
      {job.sourceType === "MSP" ? (
        <>
          <ReviewRow
            label="MSP (Job Source)"
            value={job.mspName ?? ""}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="MSP Client Name"
            value={job.mspClient ?? ""}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Source Job Req#"
            value={job.externalRequisitionId ?? ""}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Source Job Title"
            value={job.sourceJobTitle ?? ""}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Facility/Location"
            value={job.facility?.trim() || job.location?.trim() || ""}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Source Job URL"
            value={job.sourceJobUrl ?? ""}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Bill Rate"
            value={formatReviewMoney(job.billRate)}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Pay Rate"
            value={formatReviewMoney(job.suggestedPayRate)}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Job Duration"
            value={job.duration ?? ""}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Start Date"
            value={formatReviewDate(job.targetStartDate)}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Required Credentials / Certifications"
            value={job.requiredCredentials ?? ""}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Special Requirement / Restrictions"
            value={job.specialRequirements ?? ""}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Job Details"
            value={job.sourceJobDetails ?? ""}
            onEdit={() => onGoToStep("msp-details")}
          />
          <ReviewRow
            label="Internal Notes"
            value={job.internalNotes ?? ""}
            onEdit={() => onGoToStep("msp-details")}
          />
        </>
      ) : null}
      {/* TODO(future): restore Internal job configuration review rows
      <ReviewRow
        label="Internal Requisition #"
        value={job.internalRequisitionNumber ?? ""}
        onEdit={() => onGoToStep("requisition")}
      />
      <ReviewRow
        label="Department"
        value={job.department ?? ""}
        onEdit={() => onGoToStep("requisition")}
      />
      <ReviewRow
        label="Facility"
        value={job.facility ?? ""}
        onEdit={() => onGoToStep("requisition")}
      />
      <ReviewRow
        label="Shift Type"
        value={job.shiftType ?? ""}
        onEdit={() => onGoToStep("requisition")}
      />
      <ReviewRow
        label="Target Start Date"
        value={job.targetStartDate ?? ""}
        onEdit={() => onGoToStep("requisition")}
      />
      <ReviewRow
        label="Duration"
        value={job.duration ?? ""}
        onEdit={() => onGoToStep("requisition")}
      />
      */}
      <ReviewRow label="Pay" value={formatPaySummary(job, ui)} onEdit={() => onGoToStep("compensation")} />
      <ReviewRow
        label="Benefits"
        value={ui.selectedBenefits.join(", ")}
        onEdit={() => onGoToStep("compensation")}
      />
      <div className="grid gap-2 border-b border-[#E5E7EB] py-4 md:grid-cols-[220px_1fr_auto] md:items-start">
        <div className="text-sm font-medium text-[#64748B]">Job Description</div>
        <div>
          <p className="text-sm font-medium text-[#1D2739]">About the Role</p>
          {isTruncated ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">{shortDescription}</p>
          ) : (
            <JobDescriptionHtml
              html={descriptionHtml}
              className="mt-1"
              emptyLabel="—"
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
        </div>
        <button
          type="button"
          onClick={() => onGoToStep("compensation")}
          className={JOB_FORM_ICON_BUTTON_CLASS}
          aria-label="Edit Job Description"
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
  brandStyle,
  onBack,
  onNext,
  onPreview,
  onSaveDraft,
  onPublish,
}: {
  step: JobFormStep;
  saving: boolean;
  canPublish: boolean;
  showPublishActions: boolean;
  brandStyle: CSSProperties;
  onBack: () => void;
  onNext: () => void;
  onPreview: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="mt-8 border-t border-[#E5E7EB] pt-5">
      {step === "review" ? (
        <p className="mb-4 text-xs leading-5 text-[#64748B]">
          By selecting Confirm, you agree that this job post reflects your requirements, and agree it
          will be posted and applications will be processed following applicable terms and privacy
          policies.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={JOB_FORM_OUTLINE_BUTTON_CLASS} onClick={onBack} disabled={saving}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {step === "compensation" || step === "review" ? (
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
                disabled={saving || !canPublish}
                onClick={onPublish}
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
  mappingLink,
  canManageWorkflows,
  fieldError,
}: {
  workflowName?: string;
  workflowWarning: string;
  mappingLink: string;
  canManageWorkflows: boolean;
  fieldError?: string;
}) {
  const hasWorkflow = Boolean(workflowName);
  return (
    <div
      className={`mt-5 rounded-lg border p-4 ${
        hasWorkflow
          ? "border-[color:color-mix(in_srgb,var(--brand-primary)_20%,white)] bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)]"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <p className="text-sm font-semibold text-[#1D2739]">Assigned workflow</p>
      {hasWorkflow ? (
        <p className="mt-1 text-sm font-medium text-[color:var(--brand-primary)]">{workflowName}</p>
      ) : (
        <p className="mt-1 whitespace-pre-line text-sm text-amber-800">
          {workflowWarning || "Select profession and employment type to resolve a workflow."}
        </p>
      )}
      {fieldError ? <p className="mt-1 text-xs text-rose-600">{fieldError}</p> : null}
      {canManageWorkflows ? (
        <Link
          href={mappingLink}
          className="mt-2 inline-block text-sm font-medium text-[color:var(--brand-primary)] underline-offset-2 hover:underline"
        >
          {hasWorkflow ? "Manage workflow mappings" : "Create workflow mapping"}
        </Link>
      ) : null}
    </div>
  );
}
