"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
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
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
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
          className={`rounded-xl border p-4 ${step.is_enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-80"}`}
        >
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded border border-slate-200 p-1 disabled:opacity-30"
                aria-label="Move step up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={index === steps.length - 1}
                onClick={() => move(index, 1)}
                className="rounded border border-slate-200 p-1 disabled:opacity-30"
                aria-label="Move step down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {STEP_TYPE_LABELS[step.step_type]}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={step.is_enabled}
                    onChange={(e) => patchStep(index, { is_enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={step.is_required}
                    disabled={!step.is_enabled}
                    onChange={(e) => patchStep(index, { is_required: e.target.checked })}
                  />
                  Required
                </label>
              </div>

              <input
                value={step.title}
                onChange={(e) => patchStep(index, { title: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"
                placeholder="Step title"
              />

              <input
                value={step.description}
                onChange={(e) => patchStep(index, { description: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Short description (optional)"
              />

              {step.step_type === "resume_upload" ? (
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={step.metadata.parsing_enabled !== false}
                    onChange={(e) =>
                      patchStep(index, {
                        metadata: { ...step.metadata, parsing_enabled: e.target.checked },
                      })
                    }
                  />
                  Enable resume parsing
                </label>
              ) : null}

              {step.step_type === "references" ? (
                <label className="flex items-center gap-2 text-xs text-slate-700">
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
                    className="w-14 rounded border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
              ) : null}

              {showsDocuments(step) ? (
                <div className="space-y-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-xs font-medium text-slate-700">Required documents</p>
                  {step.required_documents.length === 0 ? (
                    <p className="text-xs text-slate-500">No documents yet — add at least one below.</p>
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
                        className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm"
                        placeholder='e.g. "Upload Government ID"'
                      />
                      <button
                        type="button"
                        className="rounded border border-slate-200 p-2 text-slate-500 hover:text-red-600"
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
                    className="flex items-center gap-1 text-xs font-medium text-slate-700 underline"
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
              className="text-slate-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => removeStep(index)}
              aria-label="Delete step"
              title={steps.length <= 1 ? "At least one step is required" : "Delete step"}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Step type</span>
          <select
            value={newStepType}
            onChange={(e) => setNewStepType(e.target.value as OnboardingStepType)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
          className="inline-flex items-center gap-2 rounded-xl bg-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e]"
        >
          <Plus className="h-4 w-4" />
          Add step
        </button>
      </div>

      <button
        type="button"
        onClick={() => update(createDefaultOnboardingStepDrafts())}
        className="text-xs text-slate-500 underline"
      >
        Reset to default 6-step flow
      </button>
    </div>
  );
}


