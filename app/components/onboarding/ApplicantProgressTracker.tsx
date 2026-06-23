"use client";

import type { PublishedWorkflow } from "@/lib/onboarding/applicant-workflow-types";
import { getApplicantWorkflowSteps } from "@/lib/onboarding/applicant-workflow";

type Props = {
  workflow: PublishedWorkflow;
  currentStepId?: string | null;
};

export default function ApplicantProgressTracker({ workflow, currentStepId }: Props) {
  const steps = getApplicantWorkflowSteps(workflow);

  return (
    <nav aria-label="Onboarding progress" className="flex flex-wrap gap-2">
      {steps.map((step) => {
        const active = currentStepId === step.id;
        return (
          <span
            key={step.id}
            data-active={active ? "true" : "false"}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {step.title}
          </span>
        );
      })}
    </nav>
  );
}
