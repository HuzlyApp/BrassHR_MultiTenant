"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CalendarDays, ChevronRight, ChevronUp } from "lucide-react";
import type { CandidateWorkflowStepView } from "@/lib/onboarding/candidate-workflow-phase-view";
import { displayStatusLabel } from "@/lib/onboarding/assigned-workflow-steps";
import {
  type HireStageGroup,
  type HireStageLifecycle,
  shouldShowInterviewScheduleAction,
} from "@/lib/onboarding/hire-stage-groups";
import {
  HireFigmaIcon,
  PRE_HIRE_TITLE_STYLE,
  PRE_HIRE_UI_ICONS,
  resolveStageHeroIcon,
} from "./hire-figma-assets";
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

function isStepDone(step: CandidateWorkflowStepView): boolean {
  return (
    step.displayStatus === "completed" ||
    step.displayStatus === "approved" ||
    step.displayStatus === "submitted" ||
    step.displayStatus === "skipped" ||
    step.displayStatus === "not_applicable"
  );
}

function StageSummaryText({ summary, locked }: { summary: string; locked: boolean }) {
  if (locked) return <span>{summary}</span>;

  const parts = summary.split(/(•)/);
  return (
    <>
      {parts.map((part, i) => {
        const isInProgress = /\bIn Progress\b/i.test(part) && !/\bCurrent Step\b/i.test(part);
        return (
          <span
            key={`${i}-${part}`}
            style={{
              color: isInProgress ? "var(--brand-secondary)" : "var(--brand-primary)",
            }}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

function defaultOpenIds(stages: HireStageGroup[]): Set<string> {
  const ids = new Set<string>();
  const current = stages.find((s) => s.status === "current" || s.status === "in_progress");
  if (current) ids.add(current.id);
  return ids;
}

export function HireStageAccordion({
  stages,
  lifecycle = "pre_hire",
  onInspectStep,
  onScheduleInterview,
}: {
  stages: HireStageGroup[];
  lifecycle?: HireStageLifecycle;
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
      <div className="rounded-2xl border border-[#E8ECF0] bg-white px-5 py-8 text-sm text-[#64748B]">
        No workflow steps are assigned for this phase yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage, index) => {
        const locked = stage.status === "locked";
        const current = stage.status === "current" || stage.status === "in_progress";
        const completed = stage.status === "completed";
        const open = openIds.has(stage.id) && !locked;
        const heroSrc = resolveStageHeroIcon(stage.name, lifecycle);

        return (
          <section
            key={stage.id}
            className={`overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
              current
                ? "border-[color:var(--brand-primary)] ring-1 ring-[color:var(--brand-primary)]/30"
                : completed
                  ? "border-transparent bg-white"
                  : "border-[#E8ECF0] bg-white"
            } ${locked ? "opacity-80" : ""}`}
            style={
              current
                ? { backgroundColor: "color-mix(in srgb, var(--brand-primary) 10%, white)" }
                : undefined
            }
          >
            <div className="flex w-full items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  locked
                    ? "bg-[#E5E7EB] text-[#9CA3AF]"
                    : completed || current
                      ? "text-white"
                      : "bg-[#E8EEF7] text-[color:var(--brand-secondary)]"
                }`}
                style={
                  !locked && completed
                    ? { backgroundColor: "#12AA00" }
                    : !locked && current
                      ? { backgroundColor: "var(--brand-primary)" }
                      : undefined
                }
              >
                {index + 1}
              </span>

              <button
                type="button"
                onClick={() => toggle(stage.id, locked)}
                disabled={locked}
                className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
                aria-expanded={open}
              >
                <div className="relative h-[70px] w-[70px] shrink-0">
                  <Image src={heroSrc} alt="" fill className="object-contain" sizes="70px" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold" style={PRE_HIRE_TITLE_STYLE}>
                    {stage.name}
                  </h3>
                  <p
                    className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium"
                    style={{ color: locked ? "#9CA3AF" : undefined }}
                  >
                    {completed ? (
                      <HireFigmaIcon
                        src={PRE_HIRE_UI_ICONS.doubleCheck}
                        width={14}
                        height={14}
                        className="shrink-0"
                      />
                    ) : null}
                    {locked ? (
                      <HireFigmaIcon
                        src={PRE_HIRE_UI_ICONS.pendingClock}
                        width={14}
                        height={14}
                        className="shrink-0"
                      />
                    ) : null}
                    <StageSummaryText summary={stage.summaryLabel} locked={locked} />
                  </p>
                </div>

                {open ? (
                  <>
                    {completed ? (
                      <HireFigmaIcon
                        src={PRE_HIRE_UI_ICONS.stageCheckOutlineGreen}
                        width={22}
                        height={22}
                        className="shrink-0"
                      />
                    ) : (
                      <HireFigmaIcon
                        src={PRE_HIRE_UI_ICONS.stageCollapseMinus}
                        width={22}
                        height={22}
                        className="shrink-0"
                      />
                    )}
                    <ChevronUp className="h-[18px] w-[18px] shrink-0 text-[#94A3B8]" aria-hidden />
                  </>
                ) : (
                  <>
                    {completed ? (
                      <HireFigmaIcon
                        src={PRE_HIRE_UI_ICONS.stageCheckOutlineGreen}
                        width={22}
                        height={22}
                        className="shrink-0"
                      />
                    ) : null}
                    {locked ? (
                      <HireFigmaIcon
                        src={PRE_HIRE_UI_ICONS.stageLocked}
                        width={32}
                        height={32}
                        className="shrink-0"
                      />
                    ) : null}
                    <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#94A3B8]" aria-hidden />
                  </>
                )}
              </button>
            </div>

            {open ? (
              <div
                className="pt-3"
                style={{
                  borderTop: current
                    ? "1px solid color-mix(in srgb, var(--brand-primary) 55%, white)"
                    : "1px solid #F1F5F9",
                }}
              >
                {stage.steps.map((step) => {
                  const done = isStepDone(step);
                  const completedLabel = formatCompletedOn(step.completedAt);
                  const showSchedule =
                    Boolean(onScheduleInterview) &&
                    shouldShowInterviewScheduleAction(stage, step);

                  return (
                    <div
                      key={step.id}
                      className="mx-4 mb-3 flex items-center gap-3 rounded-xl border bg-white px-3 py-3 last:mb-4 sm:mx-5 sm:px-4"
                      style={{
                        borderColor: done
                          ? "#E8ECF0"
                          : "color-mix(in srgb, var(--brand-primary) 40%, #E8ECF0)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onInspectStep(step)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
                      >
                        <HireStepTypeIcon step={step} done={done} />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate"
                            style={{
                              color: "#000000",
                              fontFamily:
                                "var(--font-tenant-branding-inter), Inter, sans-serif",
                              fontSize: 16.1,
                              fontWeight: 600,
                              lineHeight: "22px",
                            }}
                          >
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
                          className="inline-flex min-w-[191px] shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold leading-5 text-white"
                          style={{
                            backgroundColor: "var(--brand-primary)",
                            height: 36,
                          }}
                        >
                          <CalendarDays className="h-4 w-4 shrink-0" strokeWidth={2} />
                          Schedule Interview
                        </button>
                      ) : null}

                      {done ? (
                        <HireFigmaIcon
                          src={PRE_HIRE_UI_ICONS.stageCheckFilledGreen}
                          width={20}
                          height={20}
                        />
                      ) : step.displayStatus === "under_review" ? (
                        <HireFigmaIcon
                          src={PRE_HIRE_UI_ICONS.pendingClock}
                          width={20}
                          height={20}
                        />
                      ) : (
                        <HireFigmaIcon
                          src={PRE_HIRE_UI_ICONS.taskIncomplete}
                          width={24}
                          height={24}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
