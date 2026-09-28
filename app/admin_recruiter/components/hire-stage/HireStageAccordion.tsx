"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleDashed,
  Lock,
} from "lucide-react";
import type { CandidateWorkflowStepView } from "@/lib/onboarding/candidate-workflow-phase-view";
import {
  type HireStageGroup,
  isInterviewScheduleStep,
} from "@/lib/onboarding/hire-stage-groups";
import { displayStatusLabel } from "@/lib/onboarding/assigned-workflow-steps";
import { HireStepTypeIcon } from "./HireStepTypeIcon";

function formatCompletedOn(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `Completed on ${mm}/${dd}/${yyyy}`;
}

function StepStatusIcon({
  step,
  locked,
}: {
  step: CandidateWorkflowStepView;
  locked: boolean;
}) {
  if (locked) return <Lock className="h-4 w-4 text-[#9CA3AF]" aria-hidden />;
  const done =
    step.displayStatus === "completed" ||
    step.displayStatus === "approved" ||
    step.displayStatus === "skipped" ||
    step.displayStatus === "not_applicable";
  if (done) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  return <CircleDashed className="h-5 w-5 text-[#9CA3AF]" aria-hidden />;
}

function defaultOpenIds(stages: HireStageGroup[]): Set<string> {
  const ids = new Set<string>();
  const current = stages.find((s) => s.status === "current" || s.status === "in_progress");
  if (current) ids.add(current.id);
  const currentIdx = current ? stages.findIndex((s) => s.id === current.id) : -1;
  if (currentIdx > 0) ids.add(stages[currentIdx - 1]!.id);
  return ids;
}

export function HireStageAccordion({
  stages,
  onInspectStep,
  onScheduleInterview,
}: {
  stages: HireStageGroup[];
  onInspectStep: (step: CandidateWorkflowStepView) => void;
  onScheduleInterview?: (step: CandidateWorkflowStepView) => void;
}) {
  const seed = useMemo(() => defaultOpenIds(stages), [stages]);
  const [openIds, setOpenIds] = useState<Set<string>>(seed);

  useEffect(() => {
    setOpenIds(defaultOpenIds(stages));
  }, [stages]);

  function toggle(id: string, locked: boolean) {
    if (locked) return;
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!stages.length) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-8 text-sm text-[#64748B]">
        No workflow steps are assigned for this phase yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage) => {
        const locked = stage.status === "locked";
        const current = stage.status === "current" || stage.status === "in_progress";
        const completed = stage.status === "completed";
        const open = openIds.has(stage.id) && !locked;

        return (
          <section
            key={stage.id}
            className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
              current
                ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/40"
                : locked
                  ? "border-[#E5E7EB] opacity-80"
                  : "border-[#E5E7EB]"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(stage.id, locked)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              aria-expanded={open}
              disabled={locked}
            >
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  completed || current
                    ? "bg-[var(--brand-primary)] text-white"
                    : locked
                      ? "bg-[#F3F4F6] text-[#9CA3AF]"
                      : "bg-[#E8EEF7] text-[var(--brand-secondary)]"
                }`}
              >
                {locked ? <Lock className="h-3.5 w-3.5" /> : stage.index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--brand-secondary)]">{stage.name}</h3>
                  {current ? (
                    <span className="rounded-full bg-[color-mix(in srgb, var(--brand-primary) 18%, white)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
                      Current Step
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-[#64748B]">{stage.summaryLabel}</p>
              </div>
              {completed ? (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              ) : locked ? (
                <Lock className="h-4 w-4 text-[#9CA3AF]" />
              ) : (
                <ChevronDown
                  className={`h-4 w-4 text-[#64748B] transition ${open ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {open ? (
              <ul className="divide-y divide-[#F1F5F9] border-t border-[#F1F5F9]">
                {stage.steps.map((step) => {
                  const completedLabel = formatCompletedOn(step.completedAt);
                  const showSchedule =
                    Boolean(onScheduleInterview) && isInterviewScheduleStep(step);
                  return (
                    <li key={step.id}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onInspectStep(step)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
                        >
                          <HireStepTypeIcon step={step} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--brand-secondary)]">
                              {step.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[#64748B]">
                              {completedLabel || displayStatusLabel(step.displayStatus)}
                              {step.required ? "" : " · Optional"}
                            </p>
                          </div>
                        </button>
                        {showSchedule ? (
                          <button
                            type="button"
                            onClick={() => onScheduleInterview?.(step)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                            style={{ backgroundColor: "var(--brand-primary)" }}
                          >
                            <CalendarDays className="h-3.5 w-3.5" />
                            Schedule Interview
                          </button>
                        ) : null}
                        <StepStatusIcon step={step} locked={false} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
