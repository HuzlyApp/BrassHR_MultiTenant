"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Minus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { EmploymentType, JobRequisitionInput, SourceType } from "@/lib/jobs/types";
import { JobDescriptionEditor } from "./JobDescriptionEditor";
import {
  employmentTypeFromLabel,
  employmentTypeLabel,
  JOB_FORM_BENEFIT_OPTIONS,
  JOB_FORM_COMPENSATION_TYPES,
  JOB_FORM_CURRENCIES,
  JOB_FORM_DURATION_OPTIONS,
  JOB_FORM_INPUT_CLASS,
  JOB_FORM_LABEL_CLASS,
  JOB_FORM_LOCATION_TYPES,
  JOB_FORM_MSP_JOB_DETAIL_OPTIONS,
  JOB_FORM_OUTLINE_BUTTON_CLASS,
  JOB_FORM_PAY_PERIODS,
  JOB_FORM_PRIMARY_BUTTON_CLASS,
  JOB_FORM_SELECT_CHEVRON,
  JOB_FORM_SELECT_CLASS,
  JOB_FORM_SHOW_PAY_BY,
  JOB_FORM_TEXTAREA_CLASS,
  JOB_FORM_YEARS_OF_EXPERIENCE,
  type JobFormOption,
  type JobFormSpecialtyOption,
  type JobFormUiState,
} from "./job-form-shared";

export type ReviewEditFieldId =
  | "jobId"
  | "jobTitle"
  | "profession"
  | "specialty"
  | "jobLocation"
  | "additionalLocation"
  | "jobLocationType"
  | "numberOfPositions"
  | "yearsOfExperience"
  | "employmentType"
  | "employerOnRecord"
  | "employerOfRecord"
  | "jobSource"
  | "mspName"
  | "mspClient"
  | "sourceJobId"
  | "sourceJobTitle"
  | "facilityLocation"
  | "sourceJobUrl"
  | "billRate"
  | "payRate"
  | "jobDuration"
  | "startDate"
  | "credentials"
  | "specialRequirements"
  | "sourceJobDetails"
  | "internalNotes"
  | "compensation"
  | "benefits"
  | "jobDescription";

type DraftState = {
  job: JobRequisitionInput;
  ui: JobFormUiState;
};

type Props = {
  open: boolean;
  field: ReviewEditFieldId | null;
  job: JobRequisitionInput;
  ui: JobFormUiState;
  brandStyle: CSSProperties;
  /** CSS vars for portal (Radix mounts outside tenant branding wrapper). */
  brandVars?: CSSProperties;
  professions: JobFormOption[];
  specialties: JobFormSpecialtyOption[];
  employmentTypes: EmploymentType[];
  sourceTypes: SourceType[];
  employerOfRecordOptions: JobFormOption[];
  onOpenChange: (open: boolean) => void;
  onUpdate: (next: { job: JobRequisitionInput; ui: JobFormUiState }) => void;
};

function ModalRadio({
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
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#E5E7EB] px-4 py-3 text-sm text-[#334155] transition hover:bg-[#F8FAFC]">
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
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#CBD5E1] bg-white transition peer-checked:opacity-0"
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
      <span>{label}</span>
    </label>
  );
}

function cloneDraft(job: JobRequisitionInput, ui: JobFormUiState): DraftState {
  return {
    job: { ...job },
    ui: {
      ...ui,
      additionalLocations: [...ui.additionalLocations],
      selectedBenefits: [...ui.selectedBenefits],
      customBenefits: [...ui.customBenefits],
    },
  };
}

export function JobReviewEditModal({
  open,
  field,
  job,
  ui,
  brandStyle,
  brandVars,
  professions,
  specialties,
  employmentTypes,
  sourceTypes,
  employerOfRecordOptions,
  onOpenChange,
  onUpdate,
}: Props) {
  const [draft, setDraft] = useState<DraftState>(() => cloneDraft(job, ui));
  const [customBenefitName, setCustomBenefitName] = useState("");

  useEffect(() => {
    if (open && field) {
      setDraft(cloneDraft(job, ui));
      setCustomBenefitName("");
    }
  }, [open, field, job, ui]);

  const filteredSpecialties = useMemo(
    () => specialties.filter((item) => item.profession_id === draft.job.professionId),
    [draft.job.professionId, specialties]
  );

  const employmentLabels = employmentTypes.map((type) => employmentTypeLabel(type));

  function patchJob<K extends keyof JobRequisitionInput>(key: K, value: JobRequisitionInput[K]) {
    setDraft((current) => ({ ...current, job: { ...current.job, [key]: value } }));
  }

  function patchUi(patch: Partial<JobFormUiState>) {
    setDraft((current) => ({ ...current, ui: { ...current.ui, ...patch } }));
  }

  function handleUpdate() {
    onUpdate(draft);
    onOpenChange(false);
  }

  if (!field) return null;

  const benefitOptions = [
    ...JOB_FORM_BENEFIT_OPTIONS,
    ...draft.ui.customBenefits.filter(
      (item) => !(JOB_FORM_BENEFIT_OPTIONS as readonly string[]).includes(item)
    ),
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[201] flex max-h-[92dvh] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl outline-none [&_input]:border-[#CBD5E1] [&_input]:outline-none [&_input]:focus:border-[color:var(--brand-primary)] [&_input]:focus:ring-2 [&_input]:focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)] [&_select]:border-[#CBD5E1] [&_select]:outline-none [&_select]:focus:border-[color:var(--brand-primary)] [&_select]:focus:ring-2 [&_select]:focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)] [&_textarea]:border-[#CBD5E1] [&_textarea]:outline-none [&_textarea]:focus:border-[color:var(--brand-primary)] [&_textarea]:focus:ring-2 [&_textarea]:focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"
          style={brandVars}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <Dialog.Title className="text-lg font-semibold text-[#1D2739]">
              Edit the job post
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Update this field and save changes to the job post review.
            </Dialog.Description>
            <Dialog.Close
              type="button"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#1D2739] text-white transition hover:opacity-90"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3">
            {field === "jobId" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-job-id">
                  Job ID
                </label>
                <input
                  id="review-edit-job-id"
                  className={JOB_FORM_INPUT_CLASS}
                  value={draft.job.internalRequisitionNumber ?? ""}
                  onChange={(event) => patchJob("internalRequisitionNumber", event.target.value)}
                />
              </div>
            ) : null}

            {field === "jobTitle" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-job-title">
                  Job title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="review-edit-job-title"
                  className={JOB_FORM_INPUT_CLASS}
                  value={draft.job.publicTitle ?? ""}
                  onChange={(event) => patchJob("publicTitle", event.target.value)}
                />
              </div>
            ) : null}

            {field === "profession" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-profession">
                  Which category best describes this job? <span className="text-rose-500">*</span>
                </label>
                <select
                  id="review-edit-profession"
                  className={JOB_FORM_SELECT_CLASS}
                  style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                  value={draft.job.professionId || ""}
                  onChange={(event) => {
                    patchJob("professionId", event.target.value);
                    patchJob("specialtyId", null);
                  }}
                >
                  <option value="">Select Profession</option>
                  {professions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {field === "specialty" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-specialty">
                  Specialty
                </label>
                <select
                  id="review-edit-specialty"
                  className={JOB_FORM_SELECT_CLASS}
                  style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                  value={draft.job.specialtyId || ""}
                  onChange={(event) => patchJob("specialtyId", event.target.value || null)}
                  disabled={!draft.job.professionId}
                >
                  <option value="">Select Specialty</option>
                  {filteredSpecialties.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {field === "jobLocation" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-location">
                  Job Location
                </label>
                <input
                  id="review-edit-location"
                  className={JOB_FORM_INPUT_CLASS}
                  value={draft.job.location ?? ""}
                  onChange={(event) => patchJob("location", event.target.value)}
                />
              </div>
            ) : null}

            {field === "additionalLocation" ? (
              <div className="space-y-3">
                <label className={JOB_FORM_LABEL_CLASS}>Additional Location</label>
                {(draft.ui.additionalLocations.length
                  ? draft.ui.additionalLocations
                  : [""]
                ).map((location, index) => (
                  <div key={`addl-${index}`} className="flex gap-2">
                    <input
                      className={JOB_FORM_INPUT_CLASS}
                      value={location}
                      placeholder="Enter additional location"
                      onChange={(event) => {
                        const next = [...draft.ui.additionalLocations];
                        if (!next.length) next.push("");
                        next[index] = event.target.value;
                        patchUi({
                          additionalLocations: next,
                          showInMultipleAreas: true,
                        });
                      }}
                    />
                    {draft.ui.additionalLocations.length > 1 ? (
                      <button
                        type="button"
                        className={JOB_FORM_OUTLINE_BUTTON_CLASS}
                        onClick={() =>
                          patchUi({
                            additionalLocations: draft.ui.additionalLocations.filter(
                              (_, i) => i !== index
                            ),
                          })
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-[color:var(--brand-primary)]"
                  onClick={() =>
                    patchUi({
                      additionalLocations: [...draft.ui.additionalLocations, ""],
                      showInMultipleAreas: true,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add another location
                </button>
              </div>
            ) : null}

            {field === "jobLocationType" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-location-type">
                  Job Location Type
                </label>
                <select
                  id="review-edit-location-type"
                  className={JOB_FORM_SELECT_CLASS}
                  style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                  value={draft.ui.jobLocationType}
                  onChange={(event) => patchUi({ jobLocationType: event.target.value })}
                >
                  <option value="">Select Job Location Type</option>
                  {JOB_FORM_LOCATION_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {field === "numberOfPositions" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS}>Number of Positions</label>
                <div className="flex h-10 items-center overflow-hidden rounded-lg border border-[#CBD5E1]">
                  <input
                    type="number"
                    min={1}
                    className="h-full min-w-0 flex-1 border-0 px-3 text-sm text-[#334155] outline-none"
                    value={draft.ui.numberOfPositions}
                    onChange={(event) =>
                      patchUi({
                        numberOfPositions: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="inline-flex h-full w-10 cursor-pointer items-center justify-center border-l border-[#CBD5E1] text-[#64748B] hover:bg-[#F8FAFC]"
                    onClick={() =>
                      patchUi({ numberOfPositions: Math.max(1, draft.ui.numberOfPositions - 1) })
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-full w-10 cursor-pointer items-center justify-center border-l border-[#CBD5E1] text-[#64748B] hover:bg-[#F8FAFC]"
                    onClick={() => patchUi({ numberOfPositions: draft.ui.numberOfPositions + 1 })}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}

            {field === "yearsOfExperience" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-years">
                  Years of Experience
                </label>
                <select
                  id="review-edit-years"
                  className={JOB_FORM_SELECT_CLASS}
                  style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                  value={draft.ui.yearsOfExperience}
                  onChange={(event) => patchUi({ yearsOfExperience: event.target.value })}
                >
                  <option value="">Select Years of Experience</option>
                  {JOB_FORM_YEARS_OF_EXPERIENCE.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {field === "employmentType" ? (
              <div className="space-y-2">
                {employmentLabels.map((label) => (
                  <ModalRadio
                    key={label}
                    name="review-edit-employment-type"
                    label={label}
                    checked={
                      Boolean(draft.job.employmentType) &&
                      employmentTypeLabel(draft.job.employmentType) === label
                    }
                    onChange={() => patchJob("employmentType", employmentTypeFromLabel(label))}
                  />
                ))}
              </div>
            ) : null}

            {field === "employerOnRecord" ? (
              <div className="space-y-2">
                <ModalRadio
                  name="review-edit-eor"
                  label="Yes"
                  checked={draft.ui.employerOnRecord === "yes"}
                  onChange={() => {
                    patchUi({ employerOnRecord: "yes" });
                    patchJob("sourceType", "Internal");
                  }}
                />
                <ModalRadio
                  name="review-edit-eor"
                  label="No"
                  checked={draft.ui.employerOnRecord === "no"}
                  onChange={() => {
                    patchUi({ employerOnRecord: "no" });
                    patchJob("employerOfRecord", null);
                    patchJob("sourceType", "MSP");
                  }}
                />
              </div>
            ) : null}

            {field === "employerOfRecord" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-eor-select">
                  Employer on Record
                </label>
                <select
                  id="review-edit-eor-select"
                  className={JOB_FORM_SELECT_CLASS}
                  style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                  value={draft.job.employerOfRecord ?? ""}
                  onChange={(event) => patchJob("employerOfRecord", event.target.value || null)}
                >
                  <option value="">Select Employer on Record</option>
                  {employerOfRecordOptions.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {field === "jobSource" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-job-source">
                  Job Source
                </label>
                <select
                  id="review-edit-job-source"
                  className={JOB_FORM_SELECT_CLASS}
                  style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                  value={draft.job.sourceType || ""}
                  onChange={(event) => patchJob("sourceType", event.target.value as SourceType)}
                >
                  <option value="">Select Job Source</option>
                  {sourceTypes.map((value) => (
                    <option key={value} value={value}>
                      {value === "Internal" ? "Internal" : value}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {field === "mspName" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-msp-name">
                  MSP (Job Source)
                </label>
                <input
                  id="review-edit-msp-name"
                  className={JOB_FORM_INPUT_CLASS}
                  value={draft.job.mspName ?? ""}
                  onChange={(event) => patchJob("mspName", event.target.value)}
                />
              </div>
            ) : null}

            {field === "mspClient" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-msp-client">
                  MSP Client Name
                </label>
                <input
                  id="review-edit-msp-client"
                  className={JOB_FORM_INPUT_CLASS}
                  value={draft.job.mspClient ?? ""}
                  onChange={(event) => patchJob("mspClient", event.target.value)}
                />
              </div>
            ) : null}

            {field === "sourceJobId" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-source-job-id">
                  Source Job ID
                </label>
                <input
                  id="review-edit-source-job-id"
                  className={JOB_FORM_INPUT_CLASS}
                  value={draft.job.externalRequisitionId ?? ""}
                  onChange={(event) => patchJob("externalRequisitionId", event.target.value)}
                />
              </div>
            ) : null}

            {field === "sourceJobTitle" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-source-job-title">
                  Source Job Title
                </label>
                <input
                  id="review-edit-source-job-title"
                  className={JOB_FORM_INPUT_CLASS}
                  value={draft.job.sourceJobTitle ?? ""}
                  onChange={(event) => patchJob("sourceJobTitle", event.target.value)}
                />
              </div>
            ) : null}

            {field === "facilityLocation" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-facility">
                  Facility/Location
                </label>
                <input
                  id="review-edit-facility"
                  className={JOB_FORM_INPUT_CLASS}
                  value={draft.job.facility ?? ""}
                  onChange={(event) => patchJob("facility", event.target.value)}
                />
              </div>
            ) : null}

            {field === "sourceJobUrl" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-source-url">
                  Source Job URL
                </label>
                <input
                  id="review-edit-source-url"
                  className={JOB_FORM_INPUT_CLASS}
                  value={draft.job.sourceJobUrl ?? ""}
                  onChange={(event) => patchJob("sourceJobUrl", event.target.value)}
                />
              </div>
            ) : null}

            {field === "billRate" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-bill-rate">
                  Bill Rate
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">
                    $
                  </span>
                  <input
                    id="review-edit-bill-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${JOB_FORM_INPUT_CLASS} pl-7`}
                    value={draft.job.billRate ?? ""}
                    onChange={(event) =>
                      patchJob("billRate", event.target.value ? Number(event.target.value) : null)
                    }
                  />
                </div>
              </div>
            ) : null}

            {field === "payRate" ? (
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <div>
                  <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-pay-rate">
                    Suggested Pay Rate
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">
                      $
                    </span>
                    <input
                      id="review-edit-pay-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${JOB_FORM_INPUT_CLASS} pl-7`}
                      value={draft.job.suggestedPayRate ?? ""}
                      onChange={(event) =>
                        patchJob(
                          "suggestedPayRate",
                          event.target.value ? Number(event.target.value) : null
                        )
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-pay-period">
                    Period
                  </label>
                  <select
                    id="review-edit-pay-period"
                    className={JOB_FORM_SELECT_CLASS}
                    style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                    value={draft.ui.compensationType}
                    onChange={(event) => patchUi({ compensationType: event.target.value })}
                  >
                    <option value="">Select</option>
                    {JOB_FORM_COMPENSATION_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {field === "jobDuration" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-duration">
                  Job Duration
                </label>
                <select
                  id="review-edit-duration"
                  className={JOB_FORM_SELECT_CLASS}
                  style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                  value={draft.job.duration ?? ""}
                  onChange={(event) => patchJob("duration", event.target.value || null)}
                >
                  <option value="">Eg: 13 weeks</option>
                  {JOB_FORM_DURATION_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {field === "startDate" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-start-date">
                  Start Date
                </label>
                <input
                  id="review-edit-start-date"
                  type="date"
                  className={JOB_FORM_INPUT_CLASS}
                  value={draft.job.targetStartDate ?? ""}
                  onChange={(event) => patchJob("targetStartDate", event.target.value || null)}
                />
              </div>
            ) : null}

            {field === "credentials" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-credentials">
                  Required Credentials / Certifications
                </label>
                <textarea
                  id="review-edit-credentials"
                  className={`${JOB_FORM_TEXTAREA_CLASS} min-h-[140px]`}
                  value={draft.job.requiredCredentials ?? ""}
                  onChange={(event) => patchJob("requiredCredentials", event.target.value)}
                />
              </div>
            ) : null}

            {field === "specialRequirements" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-special">
                  Special Requirement / Restrictions
                </label>
                <textarea
                  id="review-edit-special"
                  className={`${JOB_FORM_TEXTAREA_CLASS} min-h-[140px]`}
                  value={draft.job.specialRequirements ?? ""}
                  onChange={(event) => patchJob("specialRequirements", event.target.value)}
                />
              </div>
            ) : null}

            {field === "sourceJobDetails" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-job-details">
                  Job Details
                </label>
                <select
                  id="review-edit-job-details"
                  className={JOB_FORM_SELECT_CLASS}
                  style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                  value={draft.job.sourceJobDetails ?? ""}
                  onChange={(event) => patchJob("sourceJobDetails", event.target.value || null)}
                >
                  <option value="">Select Job Details</option>
                  {JOB_FORM_MSP_JOB_DETAIL_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {field === "internalNotes" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS} htmlFor="review-edit-notes">
                  Internal Notes
                </label>
                <textarea
                  id="review-edit-notes"
                  className={`${JOB_FORM_TEXTAREA_CLASS} min-h-[160px]`}
                  value={draft.job.internalNotes ?? ""}
                  onChange={(event) => patchJob("internalNotes", event.target.value)}
                />
              </div>
            ) : null}

            {field === "compensation" ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={JOB_FORM_LABEL_CLASS}>Compensation</label>
                    <select
                      className={JOB_FORM_SELECT_CLASS}
                      style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                      value={draft.ui.compensationType}
                      onChange={(event) => patchUi({ compensationType: event.target.value })}
                    >
                      <option value="">Select Compensation</option>
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
                      value={draft.ui.currency}
                      onChange={(event) => patchUi({ currency: event.target.value })}
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={JOB_FORM_LABEL_CLASS}>Show pay by</label>
                    <select
                      className={JOB_FORM_SELECT_CLASS}
                      style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                      value={draft.ui.showPayBy}
                      onChange={(event) => patchUi({ showPayBy: event.target.value })}
                    >
                      <option value="">Select Show pay by</option>
                      {JOB_FORM_SHOW_PAY_BY.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={JOB_FORM_LABEL_CLASS}>Rate</label>
                    <select
                      className={JOB_FORM_SELECT_CLASS}
                      style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                      value={draft.ui.payRatePeriod}
                      onChange={(event) => patchUi({ payRatePeriod: event.target.value })}
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
                <div className="grid gap-4 sm:grid-cols-2">
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
                        value={draft.job.payRateMin ?? ""}
                        onChange={(event) =>
                          patchJob(
                            "payRateMin",
                            event.target.value ? Number(event.target.value) : null
                          )
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
                        value={draft.job.payRateMax ?? ""}
                        onChange={(event) =>
                          patchJob(
                            "payRateMax",
                            event.target.value ? Number(event.target.value) : null
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {field === "benefits" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {benefitOptions.map((benefit) => {
                    const selected = draft.ui.selectedBenefits.includes(benefit);
                    return (
                      <button
                        key={benefit}
                        type="button"
                        onClick={() =>
                          patchUi({
                            selectedBenefits: selected
                              ? draft.ui.selectedBenefits.filter((item) => item !== benefit)
                              : [...draft.ui.selectedBenefits, benefit],
                          })
                        }
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
                <div className="flex flex-wrap gap-2">
                  <input
                    className={`${JOB_FORM_INPUT_CLASS} max-w-xs`}
                    value={customBenefitName}
                    placeholder="Create benefit"
                    onChange={(event) => setCustomBenefitName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const name = customBenefitName.trim();
                      if (!name) return;
                      if (
                        benefitOptions.some((item) => item.toLowerCase() === name.toLowerCase())
                      ) {
                        setCustomBenefitName("");
                        return;
                      }
                      patchUi({
                        customBenefits: [...draft.ui.customBenefits, name],
                        selectedBenefits: [...draft.ui.selectedBenefits, name],
                      });
                      setCustomBenefitName("");
                    }}
                  />
                  <button
                    type="button"
                    className={JOB_FORM_OUTLINE_BUTTON_CLASS}
                    onClick={() => {
                      const name = customBenefitName.trim();
                      if (!name) return;
                      if (
                        benefitOptions.some((item) => item.toLowerCase() === name.toLowerCase())
                      ) {
                        setCustomBenefitName("");
                        return;
                      }
                      patchUi({
                        customBenefits: [...draft.ui.customBenefits, name],
                        selectedBenefits: [...draft.ui.selectedBenefits, name],
                      });
                      setCustomBenefitName("");
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : null}

            {field === "jobDescription" ? (
              <div>
                <label className={JOB_FORM_LABEL_CLASS}>Job Description</label>
                <JobDescriptionEditor
                  value={draft.job.publicDescription ?? ""}
                  onChange={(next) => patchJob("publicDescription", next)}
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-5 py-4">
            <Dialog.Close type="button" className={JOB_FORM_OUTLINE_BUTTON_CLASS}>
              Close
            </Dialog.Close>
            <button
              type="button"
              className={JOB_FORM_PRIMARY_BUTTON_CLASS}
              style={brandStyle}
              onClick={handleUpdate}
            >
              Update
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
