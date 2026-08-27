"use client";

import {
  EMPLOYMENT_JOURNEY_STAGES,
  type EmploymentJourneyStage,
} from "@/lib/onboarding/workflow-phase-groups";

function formatDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CandidateEmploymentJourney({
  currentStage,
  currentWorkflowName,
  currentStepTitle,
  phaseProgressLabel,
  phaseStartedAt,
  hiredAt,
  completedSteps,
  pendingSteps,
  blockedSteps,
  postHireVisible = false,
}: {
  currentStage: EmploymentJourneyStage;
  currentWorkflowName?: string | null;
  currentStepTitle?: string | null;
  phaseProgressLabel?: string | null;
  phaseStartedAt?: string | null;
  hiredAt?: string | null;
  completedSteps?: number;
  pendingSteps?: number;
  blockedSteps?: number;
  postHireVisible?: boolean;
}) {
  const stages = postHireVisible
    ? EMPLOYMENT_JOURNEY_STAGES
    : EMPLOYMENT_JOURNEY_STAGES.filter((stage) => stage.id !== "post_hire");
  const currentIndex = stages.findIndex((stage) => stage.id === currentStage);

  return (
    <section
      className="mb-4 rounded-md border border-[#D1D5DB] bg-white px-3 py-3"
      aria-label="Employment journey"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Employment journey
        </p>
        {phaseProgressLabel ? (
          <p className="text-xs font-medium text-slate-600">{phaseProgressLabel}</p>
        ) : null}
      </div>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 sm:flex-nowrap sm:gap-0">
        {stages.map((stage, index) => {
          const reached = currentIndex >= index;
          const current = stage.id === currentStage;
          return (
            <li key={stage.id} className="flex min-w-0 items-center">
              {index > 0 ? (
                <span className="mx-1 hidden text-slate-300 sm:inline" aria-hidden>
                  →
                </span>
              ) : null}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold sm:text-xs ${
                  current
                    ? "bg-[color:var(--brand-primary)] text-white"
                    : reached
                      ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] text-[#111827]"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-medium text-slate-500">Current workflow</dt>
          <dd className="text-slate-800">{currentWorkflowName?.trim() || "None assigned"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Current step</dt>
          <dd className="text-slate-800">{currentStepTitle?.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Phase started</dt>
          <dd className="text-slate-800">{formatDate(phaseStartedAt) ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Date hired</dt>
          <dd className="text-slate-800">{formatDate(hiredAt) ?? "—"}</dd>
        </div>
      </dl>
      {completedSteps != null || pendingSteps != null || blockedSteps != null ? (
        <p className="mt-2 text-[11px] text-slate-500">
          {completedSteps ?? 0} completed · {pendingSteps ?? 0} pending
          {blockedSteps ? ` · ${blockedSteps} blocked` : ""}
        </p>
      ) : null}
    </section>
  );
}
