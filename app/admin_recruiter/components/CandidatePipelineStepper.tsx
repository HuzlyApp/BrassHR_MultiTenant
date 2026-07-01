"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import {
  CANDIDATE_PIPELINE_STEP_LABELS,
  pipelineConnectorFillPercent,
  type CandidatePipelineStep,
} from "@/lib/admin/candidate-pipeline-stepper";

type CandidatePipelineStepperProps = {
  steps?: CandidatePipelineStep[];
  className?: string;
  applicantId?: string;
};

const DEFAULT_STEPS: CandidatePipelineStep[] = CANDIDATE_PIPELINE_STEP_LABELS.map(
  (label, index) => ({
    id: label.toLowerCase().replace(/\s+/g, "_"),
    label,
    completed: index === 0,
  })
);

function StepIcon({ completed }: { completed: boolean }) {
  if (completed) {
    return (
      <span
        className="relative z-10 inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]"
        aria-hidden
      >
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
      </span>
    );
  }

  return (
    <span
      className="relative z-10 inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border border-[#D7DEE8] bg-white"
      aria-hidden
    >
      <span className="inline-flex h-[7px] w-[7px] rounded-full bg-[#D7DEE8]" />
    </span>
  );
}

export default function CandidatePipelineStepper({
  steps = DEFAULT_STEPS,
  className = "",
  applicantId,
}: CandidatePipelineStepperProps) {
  const visibleSteps = steps.length > 0 ? steps : DEFAULT_STEPS;
  const fillPercent = pipelineConnectorFillPercent(visibleSteps);
  const firstIncomplete = visibleSteps.findIndex((item) => !item.completed);
  const stepsCount = Math.max(visibleSteps.length, 1);
  const trackInsetPercent = 100 / (stepsCount * 2);
  const trackWidthPercent = 100 - trackInsetPercent * 2;

  return (
    <div
      className={`candidate-pipeline-stepper w-full ${className}`.trim()}
      role="list"
      aria-label="Recruitment progress"
    >
      <div className="relative mx-auto w-full max-w-[760px] px-2">
        <div
          className="pointer-events-none absolute top-[7px] h-0.5 bg-[#E8EDF4]"
          style={{
            left: `${trackInsetPercent}%`,
            right: `${trackInsetPercent}%`,
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-[7px] h-0.5 bg-[color:var(--brand-primary)] transition-all duration-300"
          style={{
            left: `${trackInsetPercent}%`,
            width: `${trackWidthPercent * (fillPercent / 100)}%`,
          }}
          aria-hidden
        />

        <div
          className="relative grid gap-1 sm:gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.max(visibleSteps.length, 1)}, minmax(0, 1fr))` }}
        >
          {visibleSteps.map((step, index) => {
            const isCurrent =
              firstIncomplete === -1
                ? index === visibleSteps.length - 1
                : index === firstIncomplete;
            const finalApprovalHref =
              step.id === "final_approval" && applicantId
                ? `/admin_recruiter/new/final-approval/${encodeURIComponent(applicantId)}`
                : null;

            return (
              <div key={step.id} role="listitem" className="flex min-w-0 flex-col items-center text-center">
                {finalApprovalHref ? (
                  <Link
                    href={finalApprovalHref}
                    className="flex min-w-0 flex-col items-center text-center"
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <StepIcon completed={step.completed} />
                    <span
                      className={`mt-2 w-full px-0.5 text-[10px] leading-3 font-medium hover:underline sm:text-[11px] sm:leading-4 ${
                        step.completed ? "text-[#111827]" : "text-[#6B7280]"
                      }`}
                    >
                      {step.label}
                    </span>
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-col items-center text-center" aria-current={isCurrent ? "step" : undefined}>
                    <StepIcon completed={step.completed} />
                    <span
                      className={`mt-2 w-full px-0.5 text-[10px] leading-3 font-medium sm:text-[11px] sm:leading-4 ${
                        step.completed ? "text-[#111827]" : "text-[#6B7280]"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
