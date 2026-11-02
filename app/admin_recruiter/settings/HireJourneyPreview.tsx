"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { ChevronUp } from "lucide-react";
import {
  HireFigmaIcon,
  POST_HIRE_STAGE_HERO,
  PRE_HIRE_STAGE_HERO,
  PRE_HIRE_TITLE_STYLE,
  PRE_HIRE_UI_ICONS,
} from "@/app/admin_recruiter/components/hire-stage/hire-figma-assets";
import type { ResolvedHireJourneyTheme } from "@/lib/tenant/hire-journey-theme";
import { hireJourneyThemeCssVars } from "@/lib/tenant/hire-journey-theme";

type PreviewPhase = "pre_hire" | "post_hire";

type PreviewStage = {
  name: string;
  status: "completed" | "current" | "upcoming";
  summary: string;
  hero: string;
  steps?: Array<{
    title: string;
    subtitle: string;
    done: boolean;
    icon: string;
  }>;
};

const PRE_HIRE_STAGES: PreviewStage[] = [
  {
    name: "Intake",
    status: "completed",
    summary: "Completed • 2 of 2 steps",
    hero: PRE_HIRE_STAGE_HERO.Intake,
  },
  {
    name: "Screening",
    status: "current",
    summary: "In Progress • 1 of 3 steps",
    hero: PRE_HIRE_STAGE_HERO.Screening,
    steps: [
      {
        title: "Phone screen",
        subtitle: "Completed on 03/12/2026",
        done: true,
        icon: "/icons/Hire-icons/pre-hire-icons/clipboard-task-list.svg",
      },
      {
        title: "Skills assessment",
        subtitle: "In Progress",
        done: false,
        icon: "/icons/Hire-icons/pre-hire-icons/template-search.svg",
      },
      {
        title: "Reference check",
        subtitle: "Pending",
        done: false,
        icon: "/icons/Hire-icons/pre-hire-icons/task-incomplete.svg",
      },
    ],
  },
  {
    name: "Interview",
    status: "upcoming",
    summary: "Locked",
    hero: PRE_HIRE_STAGE_HERO.Interview,
  },
];

const POST_HIRE_STAGES: PreviewStage[] = [
  {
    name: "Payroll & Tax",
    status: "completed",
    summary: "Completed • 3 of 3 steps",
    hero: POST_HIRE_STAGE_HERO["Payroll & Tax"],
  },
  {
    name: "Access & Systems",
    status: "current",
    summary: "In Progress • 1 of 2 steps",
    hero: POST_HIRE_STAGE_HERO["Access & Systems"],
    steps: [
      {
        title: "Email / SSO access",
        subtitle: "Completed on 03/14/2026",
        done: true,
        icon: "/icons/Hire-icons/pre-hire-icons/clipboard-task-list.svg",
      },
      {
        title: "Time clock setup",
        subtitle: "In Progress",
        done: false,
        icon: "/icons/Hire-icons/pre-hire-icons/calendar-date.svg",
      },
    ],
  },
  {
    name: "Training & Policy",
    status: "upcoming",
    summary: "Locked",
    hero: POST_HIRE_STAGE_HERO["Training & Policy"],
  },
];

function PreviewStepper({ stages }: { stages: PreviewStage[] }) {
  return (
    <div className="flex w-full items-start justify-between gap-1 overflow-hidden px-1 pb-5">
      {stages.map((stage, index) => {
        const done = stage.status === "completed";
        const current = stage.status === "current";
        const upcoming = stage.status === "upcoming";
        const isLast = index === stages.length - 1;
        return (
          <div key={stage.name} className="flex min-w-0 flex-1 items-start">
            <div className="flex min-w-0 flex-col items-center gap-1.5">
              {done ? (
                <HireFigmaIcon
                  src={PRE_HIRE_UI_ICONS.stageCheckFilled}
                  width={18}
                  height={18}
                  tint="var(--hj-stepper, var(--brand-primary))"
                />
              ) : current ? (
                <HireFigmaIcon
                  src={PRE_HIRE_UI_ICONS.stepperCurrent}
                  width={18}
                  height={18}
                  tint="var(--hj-stepper, var(--brand-primary))"
                />
              ) : (
                <span className="block size-[18px] rounded-full border-2 border-[#D1D5DB] bg-white" />
              )}
              <span
                className="max-w-full truncate text-center text-[9px] font-medium leading-tight"
                style={{ color: upcoming ? "#9CA3AF" : "var(--hj-stepper, var(--brand-primary))" }}
              >
                {stage.name}
              </span>
            </div>
            {!isLast ? (
              <div
                className="mt-[8px] h-0.5 min-w-3 flex-1"
                style={{
                  backgroundColor: done ? "var(--hj-stepper, var(--brand-primary))" : "#E5E7EB",
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PreviewStageCard({ stage, index }: { stage: PreviewStage; index: number }) {
  const current = stage.status === "current";
  const completed = stage.status === "completed";
  const locked = stage.status === "upcoming";
  const open = current;

  return (
    <section
      className={`overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        current ? "border-[color:var(--hj-progress-bg,var(--brand-primary))]" : "border-[#E8ECF0]"
      } ${locked ? "opacity-80" : ""}`}
      style={
        current
          ? {
              backgroundColor:
                "color-mix(in srgb, var(--hj-progress-bg, var(--brand-primary)) 10%, white)",
            }
          : completed
            ? { backgroundColor: "var(--hj-completed-bg, #FFFFFF)" }
            : { backgroundColor: "#FFFFFF" }
      }
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span
          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
            locked
              ? "bg-[#E5E7EB] text-[#9CA3AF]"
              : completed || current
                ? "text-white"
                : "bg-[#E8EEF7] text-[color:var(--hj-icon,var(--brand-secondary))]"
          }`}
          style={
            completed
              ? { backgroundColor: "var(--hj-complete, #12AA00)" }
              : current
                ? { backgroundColor: "var(--hj-progress-bg, var(--brand-primary))" }
                : undefined
          }
        >
          {index + 1}
        </span>

        <div className="relative size-11 shrink-0">
          <Image src={stage.hero} alt="" fill className="object-contain" sizes="44px" />
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-semibold"
            style={{ ...PRE_HIRE_TITLE_STYLE, fontSize: 13, lineHeight: "18px" }}
          >
            {stage.name}
          </h3>
          <p className="mt-0.5 text-[10px] font-medium leading-tight">
            {completed ? (
              <span className="inline-flex items-center gap-1">
                <HireFigmaIcon
                  src={PRE_HIRE_UI_ICONS.doubleCheck}
                  width={12}
                  height={12}
                  tint="var(--hj-complete, #12AA00)"
                />
                <span style={{ color: "var(--hj-complete, #12AA00)" }}>{stage.summary}</span>
              </span>
            ) : current ? (
              <span style={{ color: "var(--hj-progress-bg, var(--brand-primary))" }}>{stage.summary}</span>
            ) : (
              <span className="text-[#9CA3AF]">{stage.summary}</span>
            )}
          </p>
        </div>

        {completed ? (
          <HireFigmaIcon
            src={PRE_HIRE_UI_ICONS.stageCheckOutlineGreen}
            width={18}
            height={18}
            tint="var(--hj-complete, #12AA00)"
            tintGreen
          />
        ) : current ? (
          <HireFigmaIcon src={PRE_HIRE_UI_ICONS.pendingClock} width={18} height={18} />
        ) : (
          <HireFigmaIcon src={PRE_HIRE_UI_ICONS.stageLocked} width={22} height={22} />
        )}
        {open ? <ChevronUp className="size-4 shrink-0 text-[#94A3B8]" /> : null}
      </div>

      {open && stage.steps ? (
        <div
          className="space-y-2 px-3 pb-3 pt-1"
          style={{
            borderTop:
              "1px solid color-mix(in srgb, var(--hj-progress-bg, var(--brand-primary)) 55%, white)",
          }}
        >
          {stage.steps.map((step) => (
            <div
              key={step.title}
              className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
              style={{
                backgroundColor: step.done ? "var(--hj-completed-bg, #FFFFFF)" : "#FFFFFF",
                borderColor: "var(--hj-step-border, #E8ECF0)",
              }}
            >
              <span
                className="relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border-2"
                style={
                  step.done
                    ? {
                        backgroundColor:
                          "color-mix(in srgb, var(--hj-icon, var(--brand-secondary)) 12%, white)",
                        borderColor: "var(--hj-icon-border, var(--brand-secondary))",
                      }
                    : {
                        backgroundColor: "var(--hj-icon, var(--brand-secondary))",
                        borderColor: "var(--hj-icon-border, var(--brand-secondary))",
                      }
                }
              >
                <HireFigmaIcon
                  src={step.icon}
                  width={16}
                  height={16}
                  className={step.done ? undefined : "brightness-0 invert"}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-black">{step.title}</p>
                <p
                  className="mt-0.5 text-[9px]"
                  style={{
                    color: step.done
                      ? "var(--hj-complete, #12AA00)"
                      : step.subtitle === "Pending"
                        ? "#94A3B8"
                        : "var(--hj-progress-bg, var(--brand-primary))",
                  }}
                >
                  {step.subtitle}
                </p>
              </div>
              {step.done ? (
                <HireFigmaIcon
                  src={PRE_HIRE_UI_ICONS.stageCheckFilledGreen}
                  width={16}
                  height={16}
                  tint="var(--hj-complete, #12AA00)"
                  tintGreen
                />
              ) : (
                <HireFigmaIcon src={PRE_HIRE_UI_ICONS.pendingClock} width={16} height={16} />
              )}
            </div>
          ))}
          <button
            type="button"
            tabIndex={-1}
            className="flex h-8 w-full items-center justify-center rounded-md text-[10px] font-semibold text-white"
            style={{ backgroundColor: "var(--hj-modal-button, var(--brand-primary))" }}
          >
            Open step modal
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default function HireJourneyPreview({ theme }: { theme: ResolvedHireJourneyTheme }) {
  const [phase, setPhase] = useState<PreviewPhase>("pre_hire");
  const cssVars = hireJourneyThemeCssVars(theme) as CSSProperties;
  const stages = phase === "pre_hire" ? PRE_HIRE_STAGES : POST_HIRE_STAGES;

  return (
    <div className="pointer-events-none select-none" style={cssVars} aria-hidden>
      <div className="flex items-center justify-end gap-2 px-1 pb-2 pointer-events-auto">
        {(["pre_hire", "post_hire"] as const).map((next) => (
          <button
            key={next}
            type="button"
            onClick={() => setPhase(next)}
            className={`cursor-pointer text-[10px] leading-[15px] ${
              phase === next ? "font-semibold text-[#012352]" : "font-normal text-[#6B7280]"
            }`}
          >
            {next === "pre_hire" ? "Pre-hire" : "Post-hire"}
          </button>
        ))}
      </div>
      <div className="space-y-3 rounded-xl bg-[#F8FAFC] p-2.5">
        <PreviewStepper stages={stages} />
        <div className="space-y-2.5">
          {stages.map((stage, index) => (
            <PreviewStageCard key={`${phase}-${stage.name}`} stage={stage} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
