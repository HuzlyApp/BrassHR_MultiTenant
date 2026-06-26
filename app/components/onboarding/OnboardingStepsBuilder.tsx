"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Plus } from "lucide-react";
import BrandedDeleteIcon from "@/app/admin_recruiter/components/BrandedDeleteIcon";
import {
  createDefaultOnboardingStepDrafts,
  reindexStepSortOrders,
  type OnboardingStepDraft,
} from "@/lib/onboarding/default-onboarding-steps";
import {
  ADDABLE_STEP_TYPES,
  createStepDraftForType,
} from "@/lib/onboarding/create-step-draft";
import type { OnboardingStepType } from "@/lib/onboarding/types";
import {
  enforceUploadResumeFirstInDrafts,
  isUploadResumeStep,
  UPLOAD_RESUME_TITLE,
} from "@/lib/onboarding/enforce-upload-resume-first";

const builderInputStyle = {
  color: "#0f172a",
  backgroundColor: "#ffffff",
  WebkitTextFillColor: "#0f172a",
} as const;

const builderInputClass =
  "tenant-onboarding-input rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] outline-none";

const builderInputSmClass =
  "tenant-onboarding-input rounded border border-[#cbd5e1] bg-white px-2 py-1.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] outline-none";

const adminFieldClass =
  "h-11 w-full rounded-md border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color:var(--brand-primary)]";

const adminFieldSmClass =
  "h-9 w-full rounded-md border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color:var(--brand-primary)]";

const deleteButtonClass =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md p-1 transition hover:bg-[color:var(--brand-primary)]/10 disabled:cursor-not-allowed disabled:opacity-30";

const STEP_TYPE_LABELS: Record<OnboardingStepType, string> = {
  resume_upload: "Resume upload",
  document_upload: "Document uploads",
  skill_assessment: "Skill assessment",
  profile_information: "Profile information",
  custom_question: "Custom question",
  review_submit: "Review & submit",
  professional_license: "Professional license",
  references: "References",
  authorizations: "Authorizations & documents",
};

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-2 block text-sm text-[#6B7280]">{children}</span>;
}

function BuilderCheckbox({
  checked,
  disabled = false,
  onChange,
  label,
  compact = false,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  compact?: boolean;
}) {
  const sizeClass = compact ? "h-4 w-4 rounded" : "h-[20px] w-[20px] rounded-[6px]";
  const iconSize = compact ? "h-3 w-3" : "h-[14px] w-[14px]";
  const textClass = compact ? "text-sm text-[#374151]" : "text-xs text-[#0f172a]";

  return (
    <label
      className={`flex items-center gap-2 ${textClass} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`relative flex shrink-0 items-center justify-center border ${sizeClass} ${
          checked
            ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]"
            : "border-[#D1D5DB] bg-white"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label={label}
        />
        {checked ? <Check className={`${iconSize} text-white`} strokeWidth={3} /> : null}
      </span>
      {label}
    </label>
  );
}

type Props = {
  steps: OnboardingStepDraft[];
  onChange: (steps: OnboardingStepDraft[]) => void;
  variant?: "tenant" | "admin";
};

export function createInitialBuilderSteps(): OnboardingStepDraft[] {
  return createDefaultOnboardingStepDrafts();
}

export default function OnboardingStepsBuilder({ steps, onChange, variant = "tenant" }: Props) {
  const isAdmin = variant === "admin";
  const [newStepType, setNewStepType] = useState<OnboardingStepType>("document_upload");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const inputClass = isAdmin ? adminFieldClass : builderInputClass;
  const inputSmClass = isAdmin ? adminFieldSmClass : builderInputSmClass;

  const update = (next: OnboardingStepDraft[]) => {
    setDeleteError(null);
    onChange(enforceUploadResumeFirstInDrafts(reindexStepSortOrders(next)).steps);
  };

  const patchStep = (index: number, patch: Partial<OnboardingStepDraft>) => {
    const step = steps[index];
    if (!step) return;
    if (isUploadResumeStep(step)) {
      const allowed: Partial<OnboardingStepDraft> = { ...patch };
      delete allowed.step_key;
      delete allowed.step_type;
      delete allowed.sort_order;
      delete allowed.is_enabled;
      delete allowed.is_required;
      const next = steps.map((s, i) => (i === index ? { ...s, ...allowed } : s));
      update(next);
      return;
    }
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    update(next);
  };

  const move = (index: number, dir: -1 | 1) => {
    const step = steps[index];
    if (!step || isUploadResumeStep(step)) return;
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    if (isUploadResumeStep(steps[target])) return;
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    update(next);
  };

  const removeStep = (index: number) => {
    const step = steps[index];
    if (step && isUploadResumeStep(step)) {
      setDeleteError(`${UPLOAD_RESUME_TITLE} is required and cannot be removed.`);
      return;
    }
    if (steps.length <= 1) {
      setDeleteError("At least one onboarding step is required.");
      return;
    }
    update(steps.filter((_, i) => i !== index));
  };

  const addStep = () => {
    update([...steps, createStepDraftForType(newStepType, steps)]);
  };

  const showsDocuments = (s: OnboardingStepDraft) =>
    s.step_type === "document_upload" ||
    s.step_type === "authorizations" ||
    s.step_type === "professional_license";

  const hasReviewStep = steps.some((s) => s.step_type === "review_submit");

  const reorderButtonClass = isAdmin
    ? "flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#64748B] transition hover:border-[#D1D5DB] hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-30"
    : "rounded border border-[#cbd5e1] bg-white p-1 text-[#0f172a] disabled:opacity-30";

  const getStepCardClass = (enabled: boolean) =>
    isAdmin
      ? `rounded-lg border p-5 ${
          enabled ? "border-[#E5E7EB] bg-white" : "border-[#E5E7EB] bg-[#F8FAFC] opacity-80"
        }`
      : `rounded-xl border p-4 ${
          enabled ? "border-[#cbd5e1] bg-white" : "border-[#e2e8f0] bg-[#f8fafc] opacity-80"
        }`;

  return (
    <div
      className={
        isAdmin ? "space-y-4 text-[#111827]" : "tenant-onboarding-light space-y-4 text-[#0f172a]"
      }
    >
      <p className={isAdmin ? "text-sm text-[#64748B]" : "text-sm text-[#0f172a]"}>
        Add, remove, and reorder steps. Edit titles and document requirements. Disabled steps are hidden
        from applicants.
      </p>

      {!hasReviewStep ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Tip: include a <strong>Review & submit</strong> step at the end so applicants can finish their
          application.
        </p>
      ) : null}

      {deleteError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {deleteError}
        </p>
      ) : null}

      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.step_key} className={getStepCardClass(step.is_enabled)}>
            <div className="flex gap-4">
              <div className={`flex shrink-0 flex-col gap-1 ${isAdmin ? "self-center" : ""}`}>
                <button
                  type="button"
                  disabled={index === 0 || isUploadResumeStep(step)}
                  onClick={() => move(index, -1)}
                  className={reorderButtonClass}
                  aria-label="Move step up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={index === steps.length - 1 || isUploadResumeStep(step)}
                  onClick={() => move(index, 1)}
                  className={reorderButtonClass}
                  aria-label="Move step down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <div className="min-w-0 flex-1 space-y-4">
                <div
                  className={
                    isAdmin
                      ? "flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4"
                      : "flex flex-wrap items-center gap-2"
                  }
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={
                        isAdmin
                          ? "rounded-md bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#374151]"
                          : "rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium text-[#0f172a]"
                      }
                    >
                      {STEP_TYPE_LABELS[step.step_type]}
                    </span>
                    {isUploadResumeStep(step) ? (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                        Locked first step
                      </span>
                    ) : null}
                    <BuilderCheckbox
                      checked={step.is_enabled}
                      label="Enabled"
                      compact={isAdmin}
                      disabled={isUploadResumeStep(step)}
                      onChange={(checked) => patchStep(index, { is_enabled: checked })}
                    />
                    <BuilderCheckbox
                      checked={step.is_required}
                      disabled={!step.is_enabled || isUploadResumeStep(step)}
                      label="Required"
                      compact={isAdmin}
                      onChange={(checked) => patchStep(index, { is_required: checked })}
                    />
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={steps.length <= 1 || isUploadResumeStep(step)}
                      className={`${deleteButtonClass} h-10 w-10`}
                      onClick={() => removeStep(index)}
                      aria-label="Delete step"
                      title={
                        isUploadResumeStep(step)
                          ? `${UPLOAD_RESUME_TITLE} cannot be removed`
                          : steps.length <= 1
                            ? "At least one step is required"
                            : "Delete step"
                      }
                    >
                      <BrandedDeleteIcon className="h-6 w-6" />
                    </button>
                  ) : null}
                </div>

                {isAdmin ? (
                  <label className="block">
                    <FieldLabel>Step title</FieldLabel>
                    <input
                      value={step.title}
                      onChange={(e) => patchStep(index, { title: e.target.value })}
                      className={inputClass}
                      placeholder="Step title"
                    />
                  </label>
                ) : (
                  <input
                    value={step.title}
                    onChange={(e) => patchStep(index, { title: e.target.value })}
                    className={`w-full font-medium ${inputClass}`}
                    style={builderInputStyle}
                    placeholder="Step title"
                  />
                )}

                {isAdmin ? (
                  <label className="block">
                    <FieldLabel>Description</FieldLabel>
                    <input
                      value={step.description}
                      onChange={(e) => patchStep(index, { description: e.target.value })}
                      className={inputClass}
                      placeholder="Short description (optional)"
                    />
                  </label>
                ) : (
                  <input
                    value={step.description}
                    onChange={(e) => patchStep(index, { description: e.target.value })}
                    className={`w-full ${inputClass}`}
                    style={builderInputStyle}
                    placeholder="Short description (optional)"
                  />
                )}

                {step.step_type === "resume_upload" ? (
                  <BuilderCheckbox
                    checked={step.metadata.parsing_enabled !== false}
                    label="Enable resume parsing"
                    compact={isAdmin}
                    onChange={(checked) =>
                      patchStep(index, {
                        metadata: { ...step.metadata, parsing_enabled: checked },
                      })
                    }
                  />
                ) : null}

                {step.step_type === "references" ? (
                  isAdmin ? (
                    <label className="block max-w-[200px]">
                      <FieldLabel>Minimum references</FieldLabel>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={Number(step.metadata.min_count ?? 2)}
                        onChange={(e) =>
                          patchStep(index, {
                            metadata: {
                              ...step.metadata,
                              min_count: Math.max(1, Number(e.target.value) || 2),
                            },
                          })
                        }
                        className={inputSmClass}
                      />
                    </label>
                  ) : (
                    <label className="flex items-center gap-2 text-xs text-[#0f172a]">
                      Minimum references:
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={Number(step.metadata.min_count ?? 2)}
                        onChange={(e) =>
                          patchStep(index, {
                            metadata: {
                              ...step.metadata,
                              min_count: Math.max(1, Number(e.target.value) || 2),
                            },
                          })
                        }
                        className={`w-14 ${inputSmClass}`}
                        style={builderInputStyle}
                      />
                    </label>
                  )
                ) : null}

                {showsDocuments(step) ? (
                  <div
                    className={
                      isAdmin
                        ? "space-y-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4"
                        : "space-y-2 rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3"
                    }
                  >
                    <p
                      className={
                        isAdmin
                          ? "text-sm font-medium text-[#374151]"
                          : "text-xs font-medium text-[#0f172a]"
                      }
                    >
                      Required documents
                    </p>
                    {step.required_documents.length === 0 ? (
                      <p className="text-xs text-[#64748B]">
                        No documents yet — add at least one below.
                      </p>
                    ) : null}
                    {step.required_documents.map((doc, docIdx) => (
                      <div key={docIdx} className="flex items-center gap-2">
                        <input
                          value={doc.title}
                          onChange={(e) => {
                            const docs = [...step.required_documents];
                            docs[docIdx] = { ...docs[docIdx], title: e.target.value };
                            patchStep(index, { required_documents: docs });
                          }}
                          className={`flex-1 ${inputSmClass}`}
                          style={isAdmin ? undefined : builderInputStyle}
                          placeholder='e.g. "Upload Government ID"'
                        />
                        <button
                          type="button"
                          className={`${deleteButtonClass} ${isAdmin ? "h-10 w-10" : "h-9 w-9"}`}
                          onClick={() => {
                            const docs = step.required_documents.filter((_, i) => i !== docIdx);
                            patchStep(index, { required_documents: docs });
                          }}
                          aria-label="Remove document"
                        >
                          <BrandedDeleteIcon className={isAdmin ? "h-6 w-6" : "h-5 w-5"} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
                      onClick={() =>
                        patchStep(index, {
                          required_documents: [
                            ...step.required_documents,
                            {
                              title: "",
                              description: "",
                              is_required: true,
                              sort_order: (step.required_documents.length + 1) * 10,
                            },
                          ],
                        })
                      }
                    >
                      <Plus className="h-4 w-4" /> Add document requirement
                    </button>
                  </div>
                ) : null}
              </div>

              {!isAdmin ? (
                <button
                  type="button"
                  disabled={steps.length <= 1 || isUploadResumeStep(step)}
                  className={`${deleteButtonClass} h-10 w-10`}
                  onClick={() => removeStep(index)}
                  aria-label="Delete step"
                  title={
                    isUploadResumeStep(step)
                      ? `${UPLOAD_RESUME_TITLE} cannot be removed`
                      : steps.length <= 1
                        ? "At least one step is required"
                        : "Delete step"
                  }
                >
                  <BrandedDeleteIcon className="h-6 w-6" />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div
        className={
          isAdmin
            ? "flex flex-wrap items-end gap-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4"
            : "flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4"
        }
      >
        <label className="block min-w-[200px] flex-1">
          {isAdmin ? <FieldLabel>Step type</FieldLabel> : <span className="mb-1 block text-sm font-medium text-[#0f172a]">Step type</span>}
          <select
            value={newStepType}
            onChange={(e) => setNewStepType(e.target.value as OnboardingStepType)}
            className={inputClass}
            style={isAdmin ? undefined : builderInputStyle}
          >
            {ADDABLE_STEP_TYPES.filter((t) => t !== "resume_upload").map((t) => (
              <option key={t} value={t}>
                {STEP_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={addStep}
          className={
            isAdmin
              ? "inline-flex h-11 items-center gap-2 rounded-full bg-[color:var(--brand-primary)] px-5 text-sm font-medium text-white transition hover:brightness-95"
              : "inline-flex items-center gap-2 rounded-xl bg-[color:var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
          }
        >
          <Plus className="h-4 w-4" />
          Add step
        </button>
      </div>

      <button
        type="button"
        onClick={() => update(createDefaultOnboardingStepDrafts())}
        className="text-xs text-[#64748B] underline hover:text-[#374151]"
      >
        Reset to default 6-step flow
      </button>
    </div>
  );
}
