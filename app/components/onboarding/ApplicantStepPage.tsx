"use client";

import type {
  ApplicantStepStatus,
  PublishedWorkflowStep,
} from "@/lib/onboarding/applicant-workflow-types";
import { DynamicStepRenderer } from "@/app/components/onboarding/DynamicStepRenderer";

type Props = {
  step: PublishedWorkflowStep;
  status?: ApplicantStepStatus | null;
  onContinue?: () => void;
  onSkip?: () => void;
};

function isStepComplete(status?: ApplicantStepStatus | null): boolean {
  return status?.status === "completed" || status?.status === "skipped";
}

export default function ApplicantStepPage({ step, status, onContinue, onSkip }: Props) {
  const required = step.required;
  const complete = isStepComplete(status);
  const canContinue = Boolean(onContinue) || !required || complete;
  const canSkip = !required && !complete && Boolean(onSkip);

  return (
    <div className="space-y-6">
      <DynamicStepRenderer step={step} status={status} />

      <div className="flex items-center justify-end gap-3">
        {canSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Skip
          </button>
        ) : null}
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
