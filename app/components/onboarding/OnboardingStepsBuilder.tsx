"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
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

const builderInputStyle = {
  color: "#0f172a",
  backgroundColor: "#ffffff",
  WebkitTextFillColor: "#0f172a",
} as const;

const builderInputClass =
  "tenant-onboarding-input rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] outline-none";

const builderInputSmClass =
  "tenant-onboarding-input rounded border border-[#cbd5e1] bg-white px-2 py-1.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] outline-none";

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

function BuilderCheckbox({
  checked,
  disabled = false,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={`flex items-center gap-1.5 text-xs text-[#0f172a] ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`relative flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border ${
          checked
            ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]"
            : "border-[#cbd5e1] bg-white"
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
        {checked ? <Check className="h-[14px] w-[14px] text-white" strokeWidth={3} /> : null}
      </span>
      {label}
    </label>
  );
}

type Props = {
  steps: OnboardingStepDraft[];
  onChange: (steps: OnboardingStepDraft[]) => void;
};

export function createInitialBuilderSteps(): OnboardingStepDraft[] {
  return createDefaultOnboardingStepDrafts();
}

export default function OnboardingStepsBuilder({ steps, onChange }: Props) {
  const [newStepType, setNewStepType] = useState<OnboardingStepType>("document_upload");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const update = (next: OnboardingStepDraft[]) => {
    setDeleteError(null);
    onChange(reindexStepSortOrders(next));
  };

  const patchStep = (index: number, patch: Partial<OnboardingStepDraft>) => {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    update(next);
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    update(next);
  };

  const removeStep = (index: number) => {
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

  return (
    <div className="tenant-onboarding-light space-y-4 text-[#0f172a]">
      <p className="text-sm text-[#0f172a]">
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

      {steps.map((step, index) => (
        <div
          key={step.step_key}
          className={`rounded-xl border p-4 ${step.is_enabled ? "border-[#cbd5e1] bg-white" : "border-[#e2e8f0] bg-[#f8fafc] opacity-80"}`}
        >
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded border border-[#cbd5e1] bg-white p-1 text-[#0f172a] disabled:opacity-30"
                aria-label="Move step up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={index === steps.length - 1}
                onClick={() => move(index, 1)}
                className="rounded border border-[#cbd5e1] bg-white p-1 text-[#0f172a] disabled:opacity-30"
                aria-label="Move step down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium text-[#0f172a]">
                  {STEP_TYPE_LABELS[step.step_type]}
                </span>
                <BuilderCheckbox
                  checked={step.is_enabled}
                  label="Enabled"
                  onChange={(checked) => patchStep(index, { is_enabled: checked })}
                />
                <BuilderCheckbox
                  checked={step.is_required}
                  disabled={!step.is_enabled}
                  label="Required"
                  onChange={(checked) => patchStep(index, { is_required: checked })}
                />
              </div>

              <input
                value={step.title}
                onChange={(e) => patchStep(index, { title: e.target.value })}
                className={`w-full font-medium ${builderInputClass}`}
                style={builderInputStyle}
                placeholder="Step title"
              />

              <input
                value={step.description}
                onChange={(e) => patchStep(index, { description: e.target.value })}
                className={`w-full ${builderInputClass}`}
                style={builderInputStyle}
                placeholder="Short description (optional)"
              />

              {step.step_type === "resume_upload" ? (
                <BuilderCheckbox
                  checked={step.metadata.parsing_enabled !== false}
                  label="Enable resume parsing"
                  onChange={(checked) =>
                    patchStep(index, {
                      metadata: { ...step.metadata, parsing_enabled: checked },
                    })
                  }
                />
              ) : null}

              {step.step_type === "references" ? (
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
                    className={`w-14 ${builderInputSmClass}`}
                    style={builderInputStyle}
                  />
                </label>
              ) : null}

              {showsDocuments(step) ? (
                <div className="space-y-2 rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3">
                  <p className="text-xs font-medium text-[#0f172a]">Required documents</p>
                  {step.required_documents.length === 0 ? (
                    <p className="text-xs text-muted text-[#475569]">No documents yet — add at least one below.</p>
                  ) : null}
                  {step.required_documents.map((doc, docIdx) => (
                    <div key={docIdx} className="flex gap-2">
                      <input
                        value={doc.title}
                        onChange={(e) => {
                          const docs = [...step.required_documents];
                          docs[docIdx] = { ...docs[docIdx], title: e.target.value };
                          patchStep(index, { required_documents: docs });
                        }}
                        className={`flex-1 ${builderInputSmClass}`}
                        style={builderInputStyle}
                        placeholder='e.g. "Upload Government ID"'
                      />
                      <button
                        type="button"
                        className="rounded border border-[#cbd5e1] bg-white p-2 text-[#64748b] hover:text-red-600"
                        onClick={() => {
                          const docs = step.required_documents.filter((_, i) => i !== docIdx);
                          patchStep(index, { required_documents: docs });
                        }}
                        aria-label="Remove document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-medium text-[color:var(--brand-primary)] underline"
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
                    <Plus className="h-3 w-3" /> Add document requirement
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              disabled={steps.length <= 1}
              className="text-[#64748b] hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => removeStep(index)}
              aria-label="Delete step"
              title={steps.length <= 1 ? "At least one step is required" : "Delete step"}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-[#0f172a]">Step type</span>
          <select
            value={newStepType}
            onChange={(e) => setNewStepType(e.target.value as OnboardingStepType)}
            className={builderInputClass}
            style={builderInputStyle}
          >
            {ADDABLE_STEP_TYPES.map((t) => (
              <option key={t} value={t}>
                {STEP_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={addStep}
          className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
        >
          <Plus className="h-4 w-4" />
          Add step
        </button>
      </div>

      <button
        type="button"
        onClick={() => update(createDefaultOnboardingStepDrafts())}
        className="text-xs text-[#475569] underline"
      >
        Reset to default 6-step flow
      </button>
    </div>
  );
}
