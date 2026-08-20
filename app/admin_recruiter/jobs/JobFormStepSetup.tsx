"use client";

import { ExistingJobPickerPanel, type ExistingJobPickerOption, type ExistingJobSourceTypeFilter } from "./ExistingJobPickerPanel";
import {
  JOB_FORM_SETUP_MSP_FIELD_CLASS,
  JOB_FORM_RADIO_OPTIONS_CLASS,
} from "./job-form-shared";
import { JobFormRequiredMark } from "./JobFormRequiredMark";
import type { PlacementType } from "@/lib/jobs/types";
import { PLACEMENT_TYPE_LABELS } from "@/lib/jobs/placement";

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
    <label className="inline-flex min-w-0 cursor-pointer items-center gap-2 text-sm font-normal text-[#64748B]">
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={onChange}
          className="peer absolute inset-0 z-10 h-5 w-5 cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#CBD5E1] bg-white transition peer-focus-visible:ring-2 peer-focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_30%,transparent)] peer-checked:opacity-0"
        />
        <svg
          width={20}
          height={20}
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="pointer-events-none absolute inset-0 h-5 w-5 text-[color:var(--brand-secondary)] opacity-0 transition peer-checked:opacity-100"
          aria-hidden
        >
          <rect width="20" height="20" rx="10" fill="currentColor" />
          <circle cx="10" cy="10" r="4" fill="white" />
        </svg>
      </span>
      <span className="min-w-0">{label}</span>
    </label>
  );
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="mt-1 block text-xs text-rose-600">{error}</span>;
}

type JobFormStepSetupProps = {
  mspSourcedByClient: boolean | null;
  onMspSourcedByClientChange: (value: boolean) => void;
  mspPlacementType: PlacementType | null;
  onMspPlacementTypeChange: (value: PlacementType) => void;
  jobs: ExistingJobPickerOption[];
  jobsLoading: boolean;
  selectedReferenceJobId: string | null;
  onSelectReferenceJob: (jobId: string | null) => void;
  fieldErrors: Record<string, string>;
};

export function JobFormStepSetup({
  mspSourcedByClient,
  onMspSourcedByClientChange,
  mspPlacementType,
  onMspPlacementTypeChange,
  jobs,
  jobsLoading,
  selectedReferenceJobId,
  onSelectReferenceJob,
  fieldErrors,
}: JobFormStepSetupProps) {
  const sourceTypeFilter: ExistingJobSourceTypeFilter =
    mspSourcedByClient === true ? "MSP" : "Internal";

  function handleSourceTypeFilterChange(value: ExistingJobSourceTypeFilter) {
    onMspSourcedByClientChange(value === "MSP");
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className={JOB_FORM_SETUP_MSP_FIELD_CLASS}>
        <p className="text-sm font-normal leading-5 text-[#64748B]">
          Is this job being source by client (MSP)?
          <JobFormRequiredMark />
        </p>
        <div className={JOB_FORM_RADIO_OPTIONS_CLASS}>
          <BrandedRadio
            name="msp-sourced"
            label="Yes"
            checked={mspSourcedByClient === true}
            onChange={() => onMspSourcedByClientChange(true)}
          />
          <BrandedRadio
            name="msp-sourced"
            label="No"
            checked={mspSourcedByClient === false}
            onChange={() => onMspSourcedByClientChange(false)}
          />
        </div>
        <FieldError error={fieldErrors.mspSourcedByClient} />
      </div>

      {mspSourcedByClient === true ? (
        <div className={JOB_FORM_SETUP_MSP_FIELD_CLASS}>
          <p className="text-sm font-normal leading-5 text-[#64748B]">
            Are you the Employer of Record (EOR) for this MSP job?
            <JobFormRequiredMark />
          </p>
          <div className={JOB_FORM_RADIO_OPTIONS_CLASS}>
            <BrandedRadio
              name="msp-placement-type"
              label={PLACEMENT_TYPE_LABELS.Recruit_and_Release}
              checked={mspPlacementType === "Recruit_and_Release"}
              onChange={() => onMspPlacementTypeChange("Recruit_and_Release")}
            />
            <BrandedRadio
              name="msp-placement-type"
              label={PLACEMENT_TYPE_LABELS.Recruit_and_EOR}
              checked={mspPlacementType === "Recruit_and_EOR"}
              onChange={() => onMspPlacementTypeChange("Recruit_and_EOR")}
            />
          </div>
          <FieldError error={fieldErrors.mspPlacementType} />
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <h2 className="text-base font-semibold text-[#1E293B]">New job or existing job?</h2>
        <ExistingJobPickerPanel
          jobs={jobs}
          loading={jobsLoading}
          selectedJobId={selectedReferenceJobId}
          onSelectJob={onSelectReferenceJob}
          sourceTypeFilter={sourceTypeFilter}
          onSourceTypeFilterChange={handleSourceTypeFilterChange}
          placementTypeFilter={mspSourcedByClient === true ? mspPlacementType : null}
        />
        <p className="text-xs text-[#64748B]">
          Optional — select an existing job to pre-fill details as a reference for this new posting.
        </p>
      </div>
    </div>
  );
}
