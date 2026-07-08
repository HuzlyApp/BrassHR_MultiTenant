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

const DEFAULT_STEPS: CandidatePipelineStep[] = [
  ...CANDIDATE_PIPELINE_STEP_LABELS.map((label, index) => ({
    id: label.toLowerCase().replace(/\s+/g, "_"),
    label,
    subtitle: index === 0 ? "Completed" : undefined,
    completed: index === 0,
    clickable: false,
    href: null,
  })),
  {
    id: "final_approval",
    label: "Final Approval",
    completed: false,
    clickable: false,
    href: null,
  },
];

function StepIcon({ completed, withinFill }: { completed: boolean; withinFill: boolean }) {
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

  if (withinFill) {
    return (
      <span
        className="relative z-10 inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-primary)] bg-white"
        aria-hidden
      >
        <span className="inline-flex h-[7px] w-[7px] rounded-full bg-[color:var(--brand-primary)]" />
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

function StepLabel({
  step,
  isCurrent,
}: {
  step: CandidatePipelineStep;
  isCurrent: boolean;
}) {
  const titleClass = step.completed ? "text-[#111827]" : "text-[#6B7280]";
  const subtitleClass = step.id === "onboarded" ? "text-[#111827]" : "text-[#6B7280]";

  return (
    <span className="mt-2 flex w-full min-w-0 flex-col items-center px-0.5">
      <span
        className={`w-full text-[10px] leading-3 font-medium sm:text-[11px] sm:leading-4 ${titleClass}`}
      >
        {step.label}
      </span>
      {step.subtitle ? (
        <span className={`mt-0.5 w-full text-[9px] leading-3 font-medium sm:text-[10px] ${subtitleClass}`}>
          {step.subtitle}
        </span>
      ) : null}
      {isCurrent && !step.completed ? (
        <span className="sr-only">Current step</span>
      ) : null}
    </span>
  );
}

export default function CandidatePipelineStepper({
  steps = DEFAULT_STEPS,
  className = "",
  applicantId: _applicantId,
}: CandidatePipelineStepperProps) {
  const visibleSteps = steps.length > 0 ? steps : DEFAULT_STEPS;
  const fillPercent = pipelineConnectorFillPercent(visibleSteps);
  const firstIncomplete = visibleSteps.findIndex((item) => !item.completed);
  let lastCompletedIndex = -1;
  visibleSteps.forEach((item, index) => {
    if (item.completed) lastCompletedIndex = index;
  });
  const stepsCount = Math.max(visibleSteps.length, 1);
  const trackInsetPercent = 100 / (stepsCount * 2);
  const trackWidthPercent = 100 - trackInsetPercent * 2;

  return (
    <div
      className={`candidate-pipeline-stepper w-full ${className}`.trim()}
      role="list"
      aria-label="Recruitment progress"
    >
      <div className="relative mx-auto w-full max-w-[980px] px-2">
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
          className="relative grid gap-1 sm:gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(visibleSteps.length, 1)}, minmax(0, 1fr))` }}
        >
          {visibleSteps.map((step, index) => {
            const isCurrent =
              firstIncomplete === -1
                ? index === visibleSteps.length - 1
                : index === firstIncomplete;
            const withinFill = !step.completed && index < lastCompletedIndex;
            const canNavigate = step.clickable && step.href;

            return (
              <div key={step.id} role="listitem" className="flex min-w-0 flex-col items-center text-center">
                {canNavigate ? (
                  <Link
                    href={step.href!}
                    className="flex min-w-0 flex-col items-center text-center hover:opacity-90"
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <StepIcon completed={step.completed} withinFill={withinFill} />
                    <StepLabel step={step} isCurrent={isCurrent} />
                  </Link>
                ) : (
                  <div
                    className="flex min-w-0 flex-col items-center text-center"
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <StepIcon completed={step.completed} withinFill={withinFill} />
                    <StepLabel step={step} isCurrent={isCurrent} />
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
