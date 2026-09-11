"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";

type StageUiStatus = "completed" | "current" | "locked";

type PostTask = {
  id: string;
  title: string;
  statusLabel: string;
  done?: boolean;
  locked?: boolean;
  iconSrc: string;
};

type PostStageDef = {
  id: string;
  name: string;
  completedSummary: string;
  activeSummary: string;
  upcomingSummary: string;
  estimated?: string;
  unlockHint: string;
  remainingHint?: string;
  completedTasks: PostTask[];
  activeTasks: PostTask[];
};

type ResolvedPostStage = PostStageDef & {
  status: StageUiStatus;
  completed: boolean;
  locked: boolean;
  current: boolean;
  summary: string;
  tasks: PostTask[];
};

const ICONS = {
  stageCheckFilled: "/icons/Hire-icons/pre-hire-icons/stage-check-filled.svg",
  stageCheckOutline: "/icons/Hire-icons/pre-hire-icons/stage-check-outline.svg",
  doubleCheck: "/icons/Hire-icons/pre-hire-icons/double-check.svg",
  stepperCurrent: "/icons/Hire-icons/pre-hire-icons/stepper-current.svg",
  pendingClock: "/icons/Hire-icons/pre-hire-icons/pending-clock.svg",
  stageLocked: "/icons/Hire-icons/pre-hire-icons/stage-locked.svg",
  taskIncomplete: "/icons/Hire-icons/pre-hire-icons/task-incomplete.svg",
  calendarDate: "/icons/Hire-icons/pre-hire-icons/calendar-date.svg",
  /** 24×24 Overall Onboarding Progress header */
  clipboardTaskList: "/icons/Hire-icons/pre-hire-icons/clipboard-task-list.svg",
} as const;

const SUBMITTED = "Submitted on 07/20/2026";
const DONE = "Completed on 07/20/2026";
const IN_PROGRESS = "In Progress";

export const POST_HIRE_STEPPER = [
  "Payroll & Tax",
  "Access & Systems",
  "Training & Policy",
  "Welcome & Complete",
] as const;

/** Figma mid-journey: Payroll done → Access current. */
export const POST_HIRE_INITIAL_COMPLETED = [true, false, false, false];

const POST_HIRE_DEFS: PostStageDef[] = [
  {
    id: "payroll-tax",
    name: "Payroll & Tax",
    completedSummary: "6 Completed",
    activeSummary: "3 Completed • 3 In Progress",
    upcomingSummary: "Upcoming",
    unlockHint: "Available after completing prior steps",
    estimated: "30-40 mins",
    completedTasks: [
      { id: "w4", title: "W-4 / State Tax", statusLabel: SUBMITTED, done: true, iconSrc: "/icons/Hire-icons/ic3.png" },
      { id: "deposit", title: "Direct Deposit", statusLabel: SUBMITTED, done: true, iconSrc: "/icons/Hire-icons/ic8.png" },
      { id: "payroll-profile", title: "Create Payroll Profile", statusLabel: SUBMITTED, done: true, iconSrc: "/icons/Hire-icons/ic5.png" },
      { id: "benefits", title: "Benefits", statusLabel: SUBMITTED, done: true, iconSrc: "/icons/Hire-icons/ic1.png" },
      { id: "401k", title: "401k", statusLabel: SUBMITTED, done: true, iconSrc: "/icons/Hire-icons/ic11.png" },
      { id: "i9", title: "I-9 section 2 / eVerify", statusLabel: SUBMITTED, done: true, iconSrc: "/icons/Hire-icons/ic10.png" },
    ],
    activeTasks: [
      { id: "w4", title: "W-4 / State Tax", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic3.png" },
      { id: "deposit", title: "Direct Deposit", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic8.png" },
      { id: "payroll-profile", title: "Create Payroll Profile", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic5.png" },
      { id: "benefits", title: "Benefits", statusLabel: IN_PROGRESS, done: false, iconSrc: "/icons/Hire-icons/ic1.png" },
      { id: "401k", title: "401k", statusLabel: IN_PROGRESS, done: false, iconSrc: "/icons/Hire-icons/ic11.png" },
      { id: "i9", title: "I-9 section 2 / eVerify", statusLabel: IN_PROGRESS, done: false, iconSrc: "/icons/Hire-icons/ic10.png" },
    ],
  },
  {
    id: "access-systems",
    name: "Access & Systems",
    completedSummary: "3 Completed",
    activeSummary: "1 Completed • 1 In Progress",
    upcomingSummary: "Upcoming",
    unlockHint: "Available after completing the Payroll & Tax",
    estimated: "25-35 mins",
    remainingHint: "1 required task remaining",
    completedTasks: [
      { id: "door", title: "System / Door Access", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic2.png" },
      { id: "badge", title: "Badge and Equipment", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic4.png" },
      { id: "schedule", title: "First Schedule", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic9.png" },
    ],
    activeTasks: [
      { id: "door", title: "System / Door Access", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic2.png" },
      { id: "badge", title: "Badge and Equipment", statusLabel: IN_PROGRESS, done: false, iconSrc: "/icons/Hire-icons/ic4.png" },
      {
        id: "schedule",
        title: "First Schedule",
        statusLabel: "Locked until access setup",
        locked: true,
        iconSrc: "/icons/Hire-icons/ic9.png",
      },
    ],
  },
  {
    id: "training-policy",
    name: "Training & Policy",
    completedSummary: "7 Completed",
    activeSummary: "2 Completed • 1 In Progress",
    upcomingSummary: "Upcoming",
    unlockHint: "Available after completing the Access & Systems",
    estimated: "40-50 mins",
    remainingHint: "1 required task remaining",
    completedTasks: [
      { id: "handbook", title: "Handbook", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic3.png" },
      { id: "welcome-packet", title: "Welcome Packet", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic1.png" },
      { id: "safety", title: "Safety Training", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic10.png" },
      { id: "compliance", title: "Compliance Training", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic12.png" },
      { id: "modules", title: "Training Modules", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic6.png" },
      { id: "orientation", title: "Orientation Video", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic7.png" },
      { id: "cert", title: "Cert Upload", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic5.png" },
    ],
    activeTasks: [
      { id: "handbook", title: "Handbook", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic3.png" },
      { id: "welcome-packet", title: "Welcome Packet", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic1.png" },
      { id: "safety", title: "Safety Training", statusLabel: IN_PROGRESS, done: false, iconSrc: "/icons/Hire-icons/ic10.png" },
      {
        id: "compliance",
        title: "Compliance Training",
        statusLabel: "Locked until training starts",
        locked: true,
        iconSrc: "/icons/Hire-icons/ic12.png",
      },
      {
        id: "modules",
        title: "Training Modules",
        statusLabel: "Locked until training starts",
        locked: true,
        iconSrc: "/icons/Hire-icons/ic6.png",
      },
      {
        id: "orientation",
        title: "Orientation Video",
        statusLabel: "Locked until training starts",
        locked: true,
        iconSrc: "/icons/Hire-icons/ic7.png",
      },
      {
        id: "cert",
        title: "Cert Upload",
        statusLabel: "Locked until training starts",
        locked: true,
        iconSrc: "/icons/Hire-icons/ic5.png",
      },
    ],
  },
  {
    id: "welcome-complete",
    name: "Welcome & Complete",
    completedSummary: "5 Completed",
    activeSummary: "1 Completed • 1 In Progress",
    upcomingSummary: "Upcoming",
    unlockHint: "Complete prior steps to continue",
    estimated: "20-30 mins",
    remainingHint: "1 required task remaining",
    completedTasks: [
      { id: "message", title: "Send Message", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic7.png" },
      { id: "mgr-call", title: "Manager Welcome Call", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic1.png" },
      { id: "final-call", title: "Final Onboarding Call", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic11.png" },
      { id: "buddy", title: "Buddy / Mentor Assignment", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic4.png" },
      { id: "complete", title: "Onboarding Complete", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic12.png" },
    ],
    activeTasks: [
      { id: "message", title: "Send Message", statusLabel: DONE, done: true, iconSrc: "/icons/Hire-icons/ic7.png" },
      { id: "mgr-call", title: "Manager Welcome Call", statusLabel: IN_PROGRESS, done: false, iconSrc: "/icons/Hire-icons/ic1.png" },
      {
        id: "final-call",
        title: "Final Onboarding Call",
        statusLabel: "Locked until welcome call",
        locked: true,
        iconSrc: "/icons/Hire-icons/ic11.png",
      },
      {
        id: "buddy",
        title: "Buddy / Mentor Assignment",
        statusLabel: "Locked until welcome call",
        locked: true,
        iconSrc: "/icons/Hire-icons/ic4.png",
      },
      {
        id: "complete",
        title: "Onboarding Complete",
        statusLabel: "Locked until welcome call",
        locked: true,
        iconSrc: "/icons/Hire-icons/ic12.png",
      },
    ],
  },
];

function Icon({
  src,
  width,
  height,
  alt = "",
  className,
}: {
  src: string;
  width: number;
  height: number;
  alt?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Figma SVG assets need exact pixel sizes
    <img src={src} alt={alt} width={width} height={height} className={className} draggable={false} />
  );
}

function SummaryText({ summary }: { summary: string }) {
  const parts = summary.split(/(•)/);
  return (
    <>
      {parts.map((part, i) => {
        const isInProgress = /\bIn Progress\b/i.test(part);
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

function resolveStages(defs: PostStageDef[], completedFlags: boolean[]): ResolvedPostStage[] {
  const firstIncomplete = completedFlags.findIndex((done) => !done);

  return defs.map((def, index) => {
    const prevIncomplete = completedFlags.slice(0, index).some((done) => !done);
    const locked = prevIncomplete;
    const completed = !locked && completedFlags[index];
    const current = !locked && !completed && index === firstIncomplete;
    const status: StageUiStatus = locked ? "locked" : completed ? "completed" : "current";

    return {
      ...def,
      status,
      completed,
      locked,
      current,
      summary: locked
        ? def.upcomingSummary
        : completed
          ? def.completedSummary
          : def.activeSummary,
      tasks: locked ? def.completedTasks : completed ? def.completedTasks : def.activeTasks,
    };
  });
}

function PostHireStepper({ completedFlags }: { completedFlags: boolean[] }) {
  const ICON_PX = 20;
  const LINE_W = 124;
  const LINE_H = 2;
  const firstIncomplete = completedFlags.findIndex((done) => !done);

  return (
    <nav aria-label="Post-hire stage progress" className="w-full overflow-x-auto pb-8">
      <div className="mx-auto flex w-max items-start justify-center px-4">
        {POST_HIRE_STEPPER.map((label, index) => {
          const isLast = index === POST_HIRE_STEPPER.length - 1;
          const done = completedFlags[index];
          const current = !done && index === firstIncomplete;
          const upcoming = !done && !current;

          return (
            <div key={label} className="flex items-start">
              <div className="relative shrink-0" style={{ width: ICON_PX, height: ICON_PX }}>
                {done ? (
                  <Icon src={ICONS.stageCheckFilled} width={ICON_PX} height={ICON_PX} className="relative z-10 block" />
                ) : current ? (
                  <Icon src={ICONS.stepperCurrent} width={ICON_PX} height={ICON_PX} className="relative z-10 block" />
                ) : (
                  <span
                    className="relative z-10 block rounded-full border-2 border-[#D1D5DB] bg-white"
                    style={{ width: ICON_PX, height: ICON_PX }}
                    aria-hidden
                  />
                )}
                <span
                  className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-center text-[11px] font-medium leading-tight sm:text-xs"
                  style={{ color: upcoming ? "#9CA3AF" : "var(--brand-primary)" }}
                >
                  {label}
                </span>
              </div>
              {!isLast ? (
                <div
                  className="shrink-0"
                  style={{
                    width: LINE_W,
                    height: LINE_H,
                    marginTop: (ICON_PX - LINE_H) / 2,
                    backgroundColor: done ? "var(--brand-primary)" : "#E5E7EB",
                  }}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function PostHireSummaryBanner({
  percent,
  completedCount,
  total,
}: {
  percent: number;
  completedCount: number;
  total: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E8ECF0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        {/* Left 50% — candidate */}
        <div className="flex w-full items-center gap-4 p-4 sm:gap-5 sm:p-5 lg:w-1/2">
          <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border-2 border-[#E8ECF0] bg-[#EEF2FF] sm:h-[88px] sm:w-[88px]">
            <Image
              src="/icons/Hire-icons/ic5.png"
              alt="James Michael Aragon"
              fill
              className="object-cover object-top p-2"
              sizes="88px"
            />
          </div>
          <div className="min-w-0">
            <span
              className="inline-flex rounded-md text-[11px] font-semibold"
              style={{
                color: "#0050AA",
                backgroundColor: "color-mix(in srgb, #0050AA 12%, white)",
                padding: "4px 8px",
              }}
            >
              Onboarding / Worker Created
            </span>
            <p
              className="mt-2 truncate font-semibold"
              style={{ color: "#012352", fontSize: 18, lineHeight: "28px" }}
            >
              James Michael Aragon
            </p>
            <p className="mt-0.5 text-sm text-[#6B7280]">
              Agreement Signed • Worker record created
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[#94A3B8]">
              <Icon src={ICONS.calendarDate} width={14} height={14} />
              Hire date: May 12, 2026
            </p>
          </div>
        </div>

        {/* Vertical divider — inset so it does not touch card edges */}
        <div
          className="mx-4 h-px shrink-0 bg-[#E5E7EB] lg:mx-0 lg:my-5 lg:h-auto lg:w-px lg:self-stretch"
          aria-hidden
        />

        {/* Right 50% — progress */}
        <div className="flex w-full flex-col justify-center p-4 sm:p-5 lg:w-1/2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Icon
                src={ICONS.clipboardTaskList}
                width={24}
                height={24}
                className="shrink-0"
              />
              <h3 className="truncate text-sm font-semibold" style={{ color: "var(--brand-secondary)" }}>
                Overall Onboarding Progress
              </h3>
            </div>
            <span className="shrink-0 text-sm font-semibold" style={{ color: "var(--brand-secondary)" }}>
              {percent}%
            </span>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#E5E7EB]">
            <div
              className="h-full rounded-full bg-[#22C55E] transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
            <span className="font-medium">
              {completedCount} of {total} Completed
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#94A3B8]">
              <Icon src={ICONS.calendarDate} width={14} height={14} />
              Last Updated: May 12, 2026
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PostTaskCard({ task }: { task: PostTask }) {
  const locked = Boolean(task.locked);
  const done = Boolean(task.done) && !locked;
  const inProgress = !done && !locked;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
        locked
          ? "border-[#E5E7EB] bg-[#F9FAFB] opacity-70"
          : "border-[#E8ECF0] bg-white"
      }`}
    >
      <span
        className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{
          backgroundColor: locked
            ? "#E5E7EB"
            : inProgress
              ? "var(--brand-secondary)"
              : "color-mix(in srgb, var(--brand-primary) 18%, white)",
        }}
      >
        <Image
          src={task.iconSrc}
          alt=""
          width={22}
          height={22}
          className={`object-contain ${locked ? "opacity-50 grayscale" : ""}`}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="truncate"
          style={{
            color: locked ? "#9CA3AF" : "#000000",
            fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            lineHeight: "20px",
          }}
        >
          {task.title}
        </p>
        <p
          className="mt-0.5 text-xs"
          style={{
            color: locked ? "#9CA3AF" : inProgress ? "var(--brand-secondary)" : "#6B7280",
          }}
        >
          {task.statusLabel}
        </p>
      </div>

      {done ? (
        <Icon src={ICONS.stageCheckOutline} width={22} height={22} className="shrink-0" />
      ) : null}
      {inProgress ? (
        <Icon src={ICONS.taskIncomplete} width={24} height={24} className="shrink-0" />
      ) : null}
      {locked ? (
        <Icon src={ICONS.stageLocked} width={24} height={24} className="shrink-0 opacity-70" />
      ) : null}
    </div>
  );
}

function LockedStageBody({
  stage,
  showTasks,
}: {
  stage: ResolvedPostStage;
  showTasks: boolean;
}) {
  if (showTasks) {
    return (
      <div className="flex flex-col gap-2.5 px-3 pb-3">
        {stage.completedTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 opacity-60"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E5E7EB]">
              <Image src={task.iconSrc} alt="" width={22} height={22} className="object-contain grayscale" />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="truncate"
                style={{
                  color: "#9CA3AF",
                  fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: "20px",
                }}
              >
                {task.title}
              </p>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">Locked</p>
            </div>
            <Icon src={ICONS.stageLocked} width={24} height={24} className="shrink-0 opacity-60" />
          </div>
        ))}
      </div>
    );
  }

  const isFullyLocked = stage.locked && stage.id === "welcome-complete";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F3F4F6]">
        {isFullyLocked ? (
          <Icon src={ICONS.stageLocked} width={32} height={32} />
        ) : (
          <Icon src={ICONS.pendingClock} width={28} height={28} />
        )}
      </div>
      {isFullyLocked ? (
        <>
          <p className="text-base font-semibold text-[#374151]">Locked</p>
          <p className="mt-1 max-w-[200px] text-sm text-[#6B7280]">{stage.unlockHint}</p>
        </>
      ) : (
        <>
          <p className="max-w-[220px] text-sm font-medium text-[#374151]">{stage.unlockHint}</p>
          {stage.estimated ? (
            <p className="mt-2 text-xs text-[#6B7280]">Estimated: {stage.estimated}</p>
          ) : null}
        </>
      )}
      <p className="mt-3 text-sm font-semibold" style={{ color: "var(--brand-secondary)" }}>
        {stage.completedTasks.length} Tasks Total
      </p>
    </div>
  );
}

function PostStageColumn({
  stage,
  index,
  onToggleComplete,
}: {
  stage: ResolvedPostStage;
  index: number;
  onToggleComplete: (index: number) => void;
}) {
  const [viewTasks, setViewTasks] = useState(false);
  const { locked, completed, current, tasks } = stage;

  return (
    <section
      className={`flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-[#E8ECF0] ${
        locked ? "bg-[#F8FAFC]" : current ? "bg-[#FBF7F2]" : "bg-[#FAFBFC]"
      }`}
    >
      <header className="flex items-start gap-3 border-b border-[#E8ECF0]/60 px-3 py-3.5 sm:px-4">
        <button
          type="button"
          title={
            locked
              ? "Complete previous step first"
              : completed
                ? "Mark as not complete"
                : "Mark as completed"
          }
          disabled={locked}
          onClick={() => {
            if (!locked) onToggleComplete(index);
          }}
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white transition ${
            locked ? "cursor-not-allowed bg-[#E5E7EB] text-[#9CA3AF]" : "cursor-pointer hover:opacity-90"
          }`}
          style={
            locked
              ? undefined
              : completed
                ? { backgroundColor: "var(--brand-primary)" }
                : current
                  ? { backgroundColor: "var(--brand-secondary)" }
                  : undefined
          }
          aria-pressed={completed}
        >
          {index + 1}
        </button>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold sm:text-base" style={{ color: "var(--brand-secondary)" }}>
            {stage.name}
          </h3>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium sm:text-sm">
            {completed ? (
              <Icon src={ICONS.doubleCheck} width={14} height={14} className="shrink-0" />
            ) : null}
            {locked ? (
              <Icon src={ICONS.pendingClock} width={14} height={14} className="shrink-0" />
            ) : null}
            {locked ? (
              <span className="text-[#9CA3AF]">{stage.summary}</span>
            ) : (
              <SummaryText summary={stage.summary} />
            )}
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col">
        {locked ? (
          <LockedStageBody stage={stage} showTasks={viewTasks} />
        ) : (
          <div className="flex flex-col gap-2.5 px-3 py-3">
            {tasks.map((task) => (
              <PostTaskCard key={task.id} task={task} />
            ))}
            {current && stage.remainingHint ? (
              <div
                className="mt-1 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium"
                style={{
                  borderColor: "color-mix(in srgb, var(--brand-secondary) 35%, white)",
                  color: "var(--brand-secondary)",
                  backgroundColor: "color-mix(in srgb, var(--brand-secondary) 6%, white)",
                }}
              >
                <Icon src={ICONS.stageLocked} width={18} height={18} />
                {stage.remainingHint}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {locked ? (
        <button
          type="button"
          onClick={() => setViewTasks((v) => !v)}
          className="mt-auto flex items-center justify-center gap-1 border-t border-[#E8ECF0] bg-white/70 px-3 py-3 text-sm font-semibold text-[#64748B] transition hover:bg-white"
        >
          View Tasks
          {viewTasks ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      ) : null}
    </section>
  );
}

export default function PostHireJourney() {
  const [completedFlags, setCompletedFlags] = useState<boolean[]>(() => [
    ...POST_HIRE_INITIAL_COMPLETED,
  ]);

  const stages = useMemo(() => resolveStages(POST_HIRE_DEFS, completedFlags), [completedFlags]);
  const completedCount = completedFlags.filter(Boolean).length;
  const percent = Math.round((completedCount / POST_HIRE_DEFS.length) * 100);

  function toggleStageComplete(index: number) {
    setCompletedFlags((prev) => {
      const next = [...prev];
      const turningOff = next[index];
      next[index] = !turningOff;
      if (turningOff) {
        for (let i = index + 1; i < next.length; i++) next[i] = false;
      }
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <PostHireStepper completedFlags={completedFlags} />

      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--brand-secondary)" }}>
          Post-hire
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Track every step before someone becomes part of your team.
        </p>
        <p className="mt-2 text-xs text-[#94A3B8]">
          Tip: click a stage number to mark it completed / not complete (mock).
        </p>
      </header>

      <PostHireSummaryBanner
        percent={percent}
        completedCount={completedCount}
        total={POST_HIRE_DEFS.length}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage, index) => (
          <PostStageColumn
            key={stage.id}
            stage={stage}
            index={index}
            onToggleComplete={toggleStageComplete}
          />
        ))}
      </div>

      <p className="flex items-center justify-center gap-2 pb-2 text-center text-xs text-[#94A3B8]">
        <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Your data is secured and protected. BrassHR follows industry-standard security and compliance
      </p>
    </div>
  );
}
