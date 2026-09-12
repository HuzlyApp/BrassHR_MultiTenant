"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { CalendarDays, ChevronRight, ChevronUp } from "lucide-react";
import PostHireJourney from "./PostHireJourney";

type HireTab = "pre_hire" | "post_hire";
type StageUiStatus = "completed" | "current" | "locked";

type StaticTask = {
  id: string;
  title: string;
  statusLabel: string;
  done?: boolean;
  showSchedule?: boolean;
  iconSrc: string;
  /** Figma cream icon tile (Intake steps); default navy square */
  iconTone?: "figma" | "navy";
};

type StageDef = {
  id: string;
  name: string;
  iconSrc: string;
  completedSummary: string;
  activeSummary: string;
  completedTasks: StaticTask[];
  activeTasks: StaticTask[];
};

type ResolvedStage = StageDef & {
  status: StageUiStatus;
  summary: string;
  tasks: StaticTask[];
  completed: boolean;
  locked: boolean;
  current: boolean;
};

/** Figma assets from public/icons/Hire-icons/pre-hire-icons */
const PRE_HIRE_ICONS = {
  stageCheckFilled: "/icons/Hire-icons/pre-hire-icons/stage-check-filled.svg",
  /** Completed task check — matches number circle green */
  stageCheckFilledGreen: "/icons/Hire-icons/pre-hire-icons/stage-check-filled-green.svg",
  stageCheckOutline: "/icons/Hire-icons/pre-hire-icons/stage-check-outline.svg",
  /** Completed stage right-side check — matches number circle green */
  stageCheckOutlineGreen: "/icons/Hire-icons/pre-hire-icons/stage-check-outline-green.svg",
  stageCollapseMinus: "/icons/Hire-icons/pre-hire-icons/stage-collapse-minus.svg",
  doubleCheck: "/icons/Hire-icons/pre-hire-icons/double-check.svg",
  stepperCurrent: "/icons/Hire-icons/pre-hire-icons/stepper-current.svg",
  phasePeople: "/icons/Hire-icons/pre-hire-icons/phase-people.svg",
  templateSearch: "/icons/Hire-icons/pre-hire-icons/template-search.svg",
  calendarDate: "/icons/Hire-icons/pre-hire-icons/calendar-date.svg",
  /** 24×24 incomplete / in-progress task indicator */
  taskIncomplete: "/icons/Hire-icons/pre-hire-icons/task-incomplete.svg",
  /** 14×14 clock next to “Pending previous step” */
  pendingClock: "/icons/Hire-icons/pre-hire-icons/pending-clock.svg",
  /** 32×32 locked stage status (right side) */
  stageLocked: "/icons/Hire-icons/pre-hire-icons/stage-locked.svg",
} as const;

/** Shared title style for Pre-hire stage names and inner step titles */
const PRE_HIRE_TITLE_STYLE = {
  color: "#000000",
  fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif",
  fontSize: 21.12,
  fontWeight: 600,
  lineHeight: "30px",
} as const;

function PreHireIcon({
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
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      draggable={false}
    />
  );
}

const DONE = "Completed on 07/20/2026";
const IN_PROGRESS = "In Progress";

/** Renders stage summary: “In Progress” navy; “Current Step” + rest brand gold. */
function StageSummaryText({
  summary,
  locked,
}: {
  summary: string;
  locked: boolean;
}) {
  if (locked) {
    return <span>{summary}</span>;
  }

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

const PRE_HIRE_STEPPER = [
  "Intake",
  "Screening",
  "Interview",
  "Submission",
  "Compliance",
  "Offer & Agreement",
  "Approvals",
] as const;

/** Figma Stage-1 start: only Intake completed → later steps lock until toggled complete. */
const PRE_HIRE_INITIAL_COMPLETED = [true, false, false, false, false, false, false];

const INTAKE_ICONS = {
  collectExtraFiles: "/icons/Hire-icons/pre-hire-icons/intake-icons/collect-extra-files.svg",
  collectReferences: "/icons/Hire-icons/pre-hire-icons/intake-icons/collect-references.svg",
  extraForm: "/icons/Hire-icons/pre-hire-icons/intake-icons/extra-form.svg",
} as const;

const SCREENING_ICONS = {
  recruiterScreening: "/icons/Hire-icons/pre-hire-icons/screening-icons/recruiter-screening.svg",
  skillAssessment: "/icons/Hire-icons/pre-hire-icons/screening-icons/skill-qualification-assessment.svg",
  referenceVerification: "/icons/Hire-icons/pre-hire-icons/screening-icons/reference-verification.svg",
} as const;

const INTERVIEW_ICONS = {
  interviewQualification: "/icons/Hire-icons/pre-hire-icons/Interview-icons/interview-qualification.svg",
  internalSelect: "/icons/Hire-icons/pre-hire-icons/Interview-icons/internal-select.svg",
} as const;

const SUBMISSION_ICONS = {
  sentToClientMsp: "/icons/Hire-icons/pre-hire-icons/submission-icons/sent-to-client-msp.svg",
  releasedToClient: "/icons/Hire-icons/pre-hire-icons/submission-icons/released-to-client.svg",
} as const;

const COMPLIANCE_ICONS = {
  backgroundCheck: "/icons/Hire-icons/pre-hire-icons/Compliance-icons/background-check.svg",
  drugTest: "/icons/Hire-icons/pre-hire-icons/Compliance-icons/drug-test.svg",
  oigExclusion: "/icons/Hire-icons/pre-hire-icons/Compliance-icons/oig-exclusion.svg",
  licenseCheck: "/icons/Hire-icons/pre-hire-icons/Compliance-icons/license-check.svg",
  ssnId: "/icons/Hire-icons/pre-hire-icons/Compliance-icons/ssn-id.svg",
  adverseAction: "/icons/Hire-icons/pre-hire-icons/Compliance-icons/adverse-action.svg",
} as const;

const OFFER_ICONS = {
  offerLetterSent: "/icons/Hire-icons/pre-hire-icons/Offer-and-agreement-icons/offer-letter-sent.svg",
  agreementSigned: "/icons/Hire-icons/pre-hire-icons/Offer-and-agreement-icons/agreement-signed.svg",
  compensationConfirmed: "/icons/Hire-icons/pre-hire-icons/Offer-and-agreement-icons/compensation-confirmed.svg",
  startDateAgreed: "/icons/Hire-icons/pre-hire-icons/Offer-and-agreement-icons/start-date-agreed.svg",
} as const;

const APPROVAL_ICONS = {
  managerApproval: "/icons/Hire-icons/pre-hire-icons/Approval-icons/manager-approval.svg",
  finalApproval: "/icons/Hire-icons/pre-hire-icons/Approval-icons/final-approval.svg",
} as const;

const PRE_HIRE_DEFS: StageDef[] = [
  {
    id: "intake",
    name: "Intake",
    iconSrc: "/icons/Hire-icons/ic5.png",
    completedSummary: "3 Completed",
    activeSummary: "2 Completed • 1 In Progress",
    completedTasks: [
      {
        id: "files",
        title: "Collect Extra Files",
        statusLabel: DONE,
        done: true,
        iconSrc: INTAKE_ICONS.collectExtraFiles,
        iconTone: "figma",
      },
      {
        id: "refs",
        title: "Collect References",
        statusLabel: DONE,
        done: true,
        iconSrc: INTAKE_ICONS.collectReferences,
        iconTone: "figma",
      },
      {
        id: "form",
        title: "Extra form",
        statusLabel: DONE,
        done: true,
        iconSrc: INTAKE_ICONS.extraForm,
        iconTone: "figma",
      },
    ],
    activeTasks: [
      {
        id: "files",
        title: "Collect Extra Files",
        statusLabel: DONE,
        done: true,
        iconSrc: INTAKE_ICONS.collectExtraFiles,
        iconTone: "figma",
      },
      {
        id: "refs",
        title: "Collect References",
        statusLabel: DONE,
        done: true,
        iconSrc: INTAKE_ICONS.collectReferences,
        iconTone: "figma",
      },
      {
        id: "form",
        title: "Extra form",
        statusLabel: IN_PROGRESS,
        done: false,
        iconSrc: INTAKE_ICONS.extraForm,
        iconTone: "figma",
      },
    ],
  },
  {
    id: "screening",
    name: "Screening",
    iconSrc: "/icons/Hire-icons/ic6.png",
    completedSummary: "3 Completed",
    activeSummary: "2 Completed • 1 In Progress",
    completedTasks: [
      {
        id: "recruiter-screening",
        title: "Recruiter Screening",
        statusLabel: DONE,
        done: true,
        iconSrc: SCREENING_ICONS.recruiterScreening,
        iconTone: "figma",
      },
      {
        id: "skill-assessment",
        title: "Skill / Qualification Assessment",
        statusLabel: DONE,
        done: true,
        iconSrc: SCREENING_ICONS.skillAssessment,
        iconTone: "figma",
      },
      {
        id: "reference-verification",
        title: "Reference Verification",
        statusLabel: DONE,
        done: true,
        iconSrc: SCREENING_ICONS.referenceVerification,
        iconTone: "figma",
      },
    ],
    activeTasks: [
      {
        id: "recruiter-screening",
        title: "Recruiter Screening",
        statusLabel: DONE,
        done: true,
        iconSrc: SCREENING_ICONS.recruiterScreening,
        iconTone: "figma",
      },
      {
        id: "skill-assessment",
        title: "Skill / Qualification Assessment",
        statusLabel: DONE,
        done: true,
        iconSrc: SCREENING_ICONS.skillAssessment,
        iconTone: "figma",
      },
      {
        id: "reference-verification",
        title: "Reference Verification",
        statusLabel: IN_PROGRESS,
        done: false,
        iconSrc: SCREENING_ICONS.referenceVerification,
        iconTone: "figma",
      },
    ],
  },
  {
    id: "interview",
    name: "Interview",
    iconSrc: "/icons/Hire-icons/ic7.png",
    completedSummary: "2 Completed",
    activeSummary: "1 Completed • 1 In Progress",
    completedTasks: [
      {
        id: "interview-qualification",
        title: "Interview/Qualification",
        statusLabel: DONE,
        done: true,
        iconSrc: INTERVIEW_ICONS.interviewQualification,
        iconTone: "figma",
      },
      {
        id: "internal-select",
        title: "Internal Select",
        statusLabel: DONE,
        done: true,
        iconSrc: INTERVIEW_ICONS.internalSelect,
        iconTone: "figma",
      },
    ],
    activeTasks: [
      {
        id: "interview-qualification",
        title: "Interview/Qualification",
        statusLabel: DONE,
        done: true,
        iconSrc: INTERVIEW_ICONS.interviewQualification,
        iconTone: "figma",
      },
      {
        id: "internal-select",
        title: "Internal Select",
        statusLabel: IN_PROGRESS,
        done: false,
        showSchedule: true,
        iconSrc: INTERVIEW_ICONS.internalSelect,
        iconTone: "figma",
      },
    ],
  },
  {
    id: "submission",
    name: "Submission",
    iconSrc: "/icons/Hire-icons/ic8.png",
    completedSummary: "2 Completed",
    activeSummary: "1 Completed • 1 In Progress",
    completedTasks: [
      {
        id: "sent-msp",
        title: "Sent to client / MSP",
        statusLabel: DONE,
        done: true,
        iconSrc: SUBMISSION_ICONS.sentToClientMsp,
        iconTone: "figma",
      },
      {
        id: "released",
        title: "Released to Client",
        statusLabel: DONE,
        done: true,
        iconSrc: SUBMISSION_ICONS.releasedToClient,
        iconTone: "figma",
      },
    ],
    activeTasks: [
      {
        id: "sent-msp",
        title: "Sent to client / MSP",
        statusLabel: DONE,
        done: true,
        iconSrc: SUBMISSION_ICONS.sentToClientMsp,
        iconTone: "figma",
      },
      {
        id: "released",
        title: "Released to Client",
        statusLabel: IN_PROGRESS,
        done: false,
        iconSrc: SUBMISSION_ICONS.releasedToClient,
        iconTone: "figma",
      },
    ],
  },
  {
    id: "compliance",
    name: "Compliance",
    iconSrc: "/icons/Hire-icons/ic9.png",
    completedSummary: "6 Completed",
    activeSummary: "4 Completed • 2 In Progress",
    completedTasks: [
      {
        id: "bg",
        title: "Background Check",
        statusLabel: DONE,
        done: true,
        iconSrc: COMPLIANCE_ICONS.backgroundCheck,
        iconTone: "figma",
      },
      {
        id: "drug",
        title: "Drug Test",
        statusLabel: DONE,
        done: true,
        iconSrc: COMPLIANCE_ICONS.drugTest,
        iconTone: "figma",
      },
      {
        id: "oig",
        title: "OIG / Exclusion",
        statusLabel: DONE,
        done: true,
        iconSrc: COMPLIANCE_ICONS.oigExclusion,
        iconTone: "figma",
      },
      {
        id: "license",
        title: "License Check",
        statusLabel: DONE,
        done: true,
        iconSrc: COMPLIANCE_ICONS.licenseCheck,
        iconTone: "figma",
      },
      {
        id: "ssn-id",
        title: "SSN / ID",
        statusLabel: DONE,
        done: true,
        iconSrc: COMPLIANCE_ICONS.ssnId,
        iconTone: "figma",
      },
      {
        id: "adverse-action",
        title: "Adverse Action (auto if BG fails)",
        statusLabel: DONE,
        done: true,
        iconSrc: COMPLIANCE_ICONS.adverseAction,
        iconTone: "figma",
      },
    ],
    activeTasks: [
      {
        id: "bg",
        title: "Background Check",
        statusLabel: DONE,
        done: true,
        iconSrc: COMPLIANCE_ICONS.backgroundCheck,
        iconTone: "figma",
      },
      {
        id: "drug",
        title: "Drug Test",
        statusLabel: DONE,
        done: true,
        iconSrc: COMPLIANCE_ICONS.drugTest,
        iconTone: "figma",
      },
      {
        id: "oig",
        title: "OIG / Exclusion",
        statusLabel: DONE,
        done: true,
        iconSrc: COMPLIANCE_ICONS.oigExclusion,
        iconTone: "figma",
      },
      {
        id: "license",
        title: "License Check",
        statusLabel: DONE,
        done: true,
        iconSrc: COMPLIANCE_ICONS.licenseCheck,
        iconTone: "figma",
      },
      {
        id: "ssn-id",
        title: "SSN / ID",
        statusLabel: IN_PROGRESS,
        done: false,
        iconSrc: COMPLIANCE_ICONS.ssnId,
        iconTone: "figma",
      },
      {
        id: "adverse-action",
        title: "Adverse Action (auto if BG fails)",
        statusLabel: IN_PROGRESS,
        done: false,
        iconSrc: COMPLIANCE_ICONS.adverseAction,
        iconTone: "figma",
      },
    ],
  },
  {
    id: "offer",
    name: "Offer & Agreement",
    iconSrc: "/icons/Hire-icons/ic11.png",
    completedSummary: "4 Completed",
    activeSummary: "2 Completed • 2 In Progress",
    completedTasks: [
      {
        id: "offer-letter",
        title: "Offer Letter Sent",
        statusLabel: DONE,
        done: true,
        iconSrc: OFFER_ICONS.offerLetterSent,
        iconTone: "figma",
      },
      {
        id: "agreement",
        title: "Agreement Signed",
        statusLabel: DONE,
        done: true,
        iconSrc: OFFER_ICONS.agreementSigned,
        iconTone: "figma",
      },
      {
        id: "comp-confirmed",
        title: "Compensation Confirmed",
        statusLabel: DONE,
        done: true,
        iconSrc: OFFER_ICONS.compensationConfirmed,
        iconTone: "figma",
      },
      {
        id: "start-date",
        title: "Start Date Agreed",
        statusLabel: DONE,
        done: true,
        iconSrc: OFFER_ICONS.startDateAgreed,
        iconTone: "figma",
      },
    ],
    activeTasks: [
      {
        id: "offer-letter",
        title: "Offer Letter Sent",
        statusLabel: DONE,
        done: true,
        iconSrc: OFFER_ICONS.offerLetterSent,
        iconTone: "figma",
      },
      {
        id: "agreement",
        title: "Agreement Signed",
        statusLabel: DONE,
        done: true,
        iconSrc: OFFER_ICONS.agreementSigned,
        iconTone: "figma",
      },
      {
        id: "comp-confirmed",
        title: "Compensation Confirmed",
        statusLabel: IN_PROGRESS,
        done: false,
        iconSrc: OFFER_ICONS.compensationConfirmed,
        iconTone: "figma",
      },
      {
        id: "start-date",
        title: "Start Date Agreed",
        statusLabel: IN_PROGRESS,
        done: false,
        iconSrc: OFFER_ICONS.startDateAgreed,
        iconTone: "figma",
      },
    ],
  },
  {
    id: "approvals",
    name: "Approvals",
    iconSrc: "/icons/Hire-icons/ic12.png",
    completedSummary: "2 Completed",
    activeSummary: "1 Completed • 1 In Progress",
    completedTasks: [
      {
        id: "mgr-approval",
        title: "Manager Approval",
        statusLabel: DONE,
        done: true,
        iconSrc: APPROVAL_ICONS.managerApproval,
        iconTone: "figma",
      },
      {
        id: "final-approval",
        title: "Final Approval",
        statusLabel: DONE,
        done: true,
        iconSrc: APPROVAL_ICONS.finalApproval,
        iconTone: "figma",
      },
    ],
    activeTasks: [
      {
        id: "mgr-approval",
        title: "Manager Approval",
        statusLabel: DONE,
        done: true,
        iconSrc: APPROVAL_ICONS.managerApproval,
        iconTone: "figma",
      },
      {
        id: "final-approval",
        title: "Final Approval",
        statusLabel: IN_PROGRESS,
        done: false,
        iconSrc: APPROVAL_ICONS.finalApproval,
        iconTone: "figma",
      },
    ],
  },
];

function buildCurrentStageSummary(tasks: StaticTask[]): string {
  const doneCount = tasks.filter((t) => t.done).length;
  const inProgressCount = tasks.filter((t) => !t.done).length;
  const parts: string[] = [];
  if (doneCount > 0) parts.push(`${doneCount} Completed`);
  if (inProgressCount > 0) parts.push(`${inProgressCount} In Progress`);
  if (!parts.length) parts.push("In Progress");
  return `${parts.join(" • ")} • Current Step`;
}

function resolveStages(defs: StageDef[], completedFlags: boolean[]): ResolvedStage[] {
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
        ? "Pending previous step."
        : completed
          ? def.completedSummary
          : buildCurrentStageSummary(def.activeTasks),
      tasks: locked ? [] : completed ? def.completedTasks : def.activeTasks,
    };
  });
}

function StageProgressStepper({
  labels,
  completedFlags,
}: {
  labels: readonly string[];
  completedFlags: boolean[];
}) {
  const ICON_PX = 20;
  const LINE_W = 124;
  const LINE_H = 2;
  const firstIncomplete = completedFlags.findIndex((done) => !done);

  return (
    <nav aria-label="Hire stage progress" className="w-full overflow-x-auto pb-8">
      <div className="mx-auto flex w-max items-start justify-center px-4">
        {labels.map((label, index) => {
          const isLast = index === labels.length - 1;
          const done = completedFlags[index];
          const current = !done && index === firstIncomplete;
          const upcoming = !done && !current;
          const connectorFilled = completedFlags[index];

          return (
            <div key={label} className="flex items-start">
              <div className="relative shrink-0" style={{ width: ICON_PX, height: ICON_PX }}>
                {done ? (
                  <PreHireIcon
                    src={PRE_HIRE_ICONS.stageCheckFilled}
                    width={ICON_PX}
                    height={ICON_PX}
                    className="relative z-10 block"
                  />
                ) : current ? (
                  <PreHireIcon
                    src={PRE_HIRE_ICONS.stepperCurrent}
                    width={ICON_PX}
                    height={ICON_PX}
                    className="relative z-10 block"
                  />
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
                    backgroundColor: connectorFilled
                      ? "var(--brand-primary)"
                      : "#E5E7EB",
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

function TaskRow({ task }: { task: StaticTask }) {
  const done = Boolean(task.done);
  const figmaIcon = task.iconTone === "figma";

  return (
    <div
      className="mx-4 mb-3 flex items-center gap-3 rounded-xl border bg-white px-3 py-3 last:mb-4 sm:mx-5 sm:px-4"
      style={{
        borderColor: done
          ? "#E8ECF0"
          : "color-mix(in srgb, var(--brand-primary) 40%, #E8ECF0)",
      }}
    >
      <span
        className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${
          figmaIcon ? "h-10 w-10 rounded-[10px] border-2" : "h-11 w-11 rounded-xl"
        }`}
        style={
          figmaIcon
            ? done
              ? {
                  backgroundColor: "color-mix(in srgb, var(--brand-primary) 8%, white)",
                  borderColor: "color-mix(in srgb, var(--brand-primary) 70%, white)",
                }
              : {
                  backgroundColor: "var(--brand-secondary)",
                  borderColor: "var(--brand-secondary)",
                }
            : { backgroundColor: "var(--brand-secondary)" }
        }
      >
        {figmaIcon ? (
          <PreHireIcon
            src={task.iconSrc}
            width={20}
            height={20}
            className={done ? undefined : "brightness-0 invert"}
          />
        ) : (
          <Image src={task.iconSrc} alt="" width={28} height={28} className="object-contain" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="truncate"
          style={{
            color: "#000000",
            fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif",
            fontSize: 16.1,
            fontWeight: 600,
            lineHeight: "22px",
          }}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-[#64748B]">{task.statusLabel}</p>
      </div>
      {task.showSchedule ? (
        <button
          type="button"
          className="inline-flex min-w-[191px] shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold leading-5 text-white"
          style={{
            backgroundColor: "var(--brand-primary)",
            fontFamily: "Inter, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            lineHeight: "20px",
            height: 36,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <CalendarDays className="h-4 w-4 shrink-0" strokeWidth={2} />
          Schedule Interview
        </button>
      ) : null}
      {done ? (
        <PreHireIcon src={PRE_HIRE_ICONS.stageCheckFilledGreen} width={20} height={20} />
      ) : (
        <PreHireIcon src={PRE_HIRE_ICONS.taskIncomplete} width={24} height={24} />
      )}
    </div>
  );
}

function StageAccordion({
  stages,
  onToggleComplete,
}: {
  stages: ResolvedStage[];
  onToggleComplete: (index: number) => void;
}) {
  const defaultOpen = useMemo(() => {
    const ids = new Set<string>();
    for (const stage of stages) {
      if (stage.current) ids.add(stage.id);
    }
    return ids;
  }, [stages]);

  const [openIds, setOpenIds] = useState<Set<string>>(defaultOpen);

  useEffect(() => {
    setOpenIds(defaultOpen);
  }, [defaultOpen]);

  function toggleOpen(id: string, locked: boolean) {
    if (locked) return;
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage, index) => {
        const { locked, completed, current, tasks } = stage;
        const hasTasks = Boolean(tasks.length);
        const open = hasTasks && openIds.has(stage.id) && !locked;

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
              {/* Number circle — mock toggle complete / incomplete */}
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
                onClick={(e) => {
                  e.stopPropagation();
                  if (!locked) onToggleComplete(index);
                }}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                  locked
                    ? "cursor-not-allowed bg-[#E5E7EB] text-[#9CA3AF]"
                    : completed || current
                      ? "cursor-pointer text-white hover:opacity-90"
                      : "cursor-pointer bg-[#E8EEF7] text-[color:var(--brand-secondary)]"
                }`}
                style={
                  !locked && completed
                    ? { backgroundColor: "#12AA00" }
                    : !locked && current
                      ? { backgroundColor: "var(--brand-primary)" }
                      : undefined
                }
                aria-pressed={completed}
              >
                {index + 1}
              </button>

              <button
                type="button"
                onClick={() => toggleOpen(stage.id, locked || !hasTasks)}
                disabled={locked || !hasTasks}
                className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
                aria-expanded={open}
              >
                <div className="relative h-[70px] w-[70px] shrink-0">
                  <Image src={stage.iconSrc} alt="" fill className="object-contain" sizes="70px" />
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
                      <PreHireIcon
                        src={PRE_HIRE_ICONS.doubleCheck}
                        width={14}
                        height={14}
                        className="shrink-0"
                      />
                    ) : null}
                    {locked ? (
                      <PreHireIcon
                        src={PRE_HIRE_ICONS.pendingClock}
                        width={14}
                        height={14}
                        className="shrink-0"
                      />
                    ) : null}
                    <StageSummaryText summary={stage.summary} locked={locked} />
                  </p>
                </div>

                {/* Status + expand icons (Figma) */}
                {open ? (
                  <>
                    {completed ? (
                      <PreHireIcon
                        src={PRE_HIRE_ICONS.stageCheckOutlineGreen}
                        width={22}
                        height={22}
                        className="shrink-0"
                      />
                    ) : (
                      <PreHireIcon
                        src={PRE_HIRE_ICONS.stageCollapseMinus}
                        width={22}
                        height={22}
                        className="shrink-0"
                      />
                    )}
                    {/* Close / collapse arrow */}
                    <ChevronUp className="h-[18px] w-[18px] shrink-0 text-[#94A3B8]" aria-hidden />
                  </>
                ) : (
                  <>
                    {completed ? (
                      <PreHireIcon
                        src={PRE_HIRE_ICONS.stageCheckOutlineGreen}
                        width={22}
                        height={22}
                        className="shrink-0"
                      />
                    ) : null}
                    {locked ? (
                      <PreHireIcon
                        src={PRE_HIRE_ICONS.stageLocked}
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

            {open && tasks.length ? (
              <div
                className="pt-3"
                style={{
                  borderTop: current
                    ? "1px solid color-mix(in srgb, var(--brand-primary) 55%, white)"
                    : "1px solid #F1F5F9",
                }}
              >
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function CandidateProfileCard() {
  return (
    <section
      className="flex w-full flex-col rounded-2xl border border-[#E8ECF0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      style={{ width: "100%", minHeight: 464 }}
    >
      <h2
        className="text-center font-semibold"
        style={{ color: "#000000", fontSize: 16, lineHeight: "24px", fontWeight: 600 }}
      >
        Candidate Profile
      </h2>

      <div className="mt-6 flex justify-center">
        <div className="relative h-[88px] w-[88px] overflow-hidden rounded-full border-2 border-[#E8ECF0] bg-[#EEF2FF]">
          <Image
            src="/icons/Hire-icons/ic5.png"
            alt="James Michael Aragon"
            fill
            className="object-cover object-top p-2"
            sizes="88px"
          />
        </div>
      </div>

      <div className="mt-4 text-center">
        <p
          className="font-semibold"
          style={{ color: "#012352", fontSize: 18, lineHeight: "28px", fontWeight: 600 }}
        >
          James Michael Aragon
        </p>
        <p
          className="mt-1 font-normal"
          style={{ color: "#6B7280", fontSize: 14, lineHeight: "20px", fontWeight: 400 }}
        >
          Customer Success Manager
        </p>
      </div>

      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="shrink-0 font-semibold text-black">Work Type</dt>
          <dd>
            <span
              className="inline-flex rounded-md text-[11px] font-semibold"
              style={{
                color: "#12AA00",
                backgroundColor: "color-mix(in srgb, #12AA00 12%, white)",
                padding: "4px 6px",
              }}
            >
              W-2 Employee
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="shrink-0 font-semibold text-black">Department</dt>
          <dd className="text-right text-[#6B7280]">Customer Success</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="shrink-0 font-semibold text-black">Location</dt>
          <dd className="max-w-[160px] text-right text-[#6B7280]">Broadway, Arizona, USA</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="shrink-0 font-semibold text-black">Source</dt>
          <dd className="text-right text-[#6B7280]">LinkedIn</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="shrink-0 font-semibold text-black">Date Applied</dt>
          <dd className="text-right text-[#6B7280]">May 20, 2026</dd>
        </div>
      </dl>

      <div className="mt-auto flex justify-center pt-5">
        <span
          className="inline-flex rounded-md text-[11px] font-semibold"
          style={{
            color: "#0050AA",
            backgroundColor: "color-mix(in srgb, #0050AA 12%, white)",
            padding: "4px 6px",
          }}
        >
          Selected
        </span>
      </div>
    </section>
  );
}

function SidebarIconTile({
  src,
  alt,
  iconWidth,
  iconHeight,
}: {
  src: string;
  alt: string;
  iconWidth: number;
  iconHeight: number;
}) {
  return (
    <span
      className="relative inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-xl"
      style={{ backgroundColor: "var(--brand-secondary)" }}
    >
      <PreHireIcon src={src} alt={alt} width={iconWidth} height={iconHeight} />
    </span>
  );
}

function PhaseProgressCard({
  tab,
  percent,
  progressHint,
  showProceed,
  onProceed,
}: {
  tab: HireTab;
  percent: number;
  progressHint: string;
  showProceed: boolean;
  onProceed?: () => void;
}) {
  const phaseLabel = tab === "pre_hire" ? "Pre-hire" : "Post-hire";

  return (
    <div className="flex w-full flex-col gap-4">
      <section className="w-full rounded-2xl border border-[#E8ECF0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SidebarIconTile
              src={PRE_HIRE_ICONS.phasePeople}
              alt="Phase"
              iconWidth={25}
              iconHeight={22}
            />
            <div className="min-w-0">
              <p
                style={{
                  color: "var(--Text-caption-subtitles, #6B7280)",
                  fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif",
                  fontSize: 14,
                  fontStyle: "normal",
                  fontWeight: 600,
                  lineHeight: "20px",
                }}
              >
                Phase
              </p>
              <p className="text-sm font-semibold" style={{ color: "var(--brand-secondary)" }}>
                {phaseLabel}
              </p>
            </div>
          </div>

          <div className="border-t border-[#F1F5F9]" />

          <div className="flex items-center gap-3">
            <SidebarIconTile
              src={PRE_HIRE_ICONS.templateSearch}
              alt="Template"
              iconWidth={29}
              iconHeight={29}
            />
            <div className="min-w-0">
              <p
                style={{
                  color: "var(--Text-caption-subtitles, #6B7280)",
                  fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif",
                  fontSize: 14,
                  fontStyle: "normal",
                  fontWeight: 600,
                  lineHeight: "20px",
                }}
              >
                Template
              </p>
              <p className="truncate text-sm font-semibold" style={{ color: "var(--brand-secondary)" }}>
                Nursing W2 Internal
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-[#F1F5F9] pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span
              style={{
                color: "var(--Text-labels, #374151)",
                fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif",
                fontSize: 16,
                fontStyle: "normal",
                fontWeight: 600,
                lineHeight: "24px",
              }}
            >
              Progress
            </span>
            <span
              className="text-right"
              style={{
                color: "var(--Text-labels, #374151)",
                fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif",
                fontSize: 12,
                fontStyle: "normal",
                fontWeight: 600,
                lineHeight: "16px",
              }}
            >
              {percent}% Completed
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#E5E7EB]">
            <div
              className="h-full rounded-full bg-[#22C55E] transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-[#64748B]">{progressHint}</p>
          <p
            className="mt-4 flex items-center justify-center gap-1.5 text-center"
            style={{
              color: "var(--Text-labels, #374151)",
              fontFamily: "var(--font-tenant-branding-inter), Inter, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: "16px",
            }}
          >
            <PreHireIcon src={PRE_HIRE_ICONS.calendarDate} width={16} height={16} />
            Last Updated: May 12, 2026
          </p>
        </div>
      </section>

      {showProceed ? (
        <section
          className="w-full rounded-2xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          style={{
            borderColor: "color-mix(in srgb, var(--brand-primary) 35%, white)",
            backgroundColor: "color-mix(in srgb, var(--brand-primary) 10%, white)",
          }}
        >
          <h3 className="text-sm font-semibold" style={{ color: "var(--brand-primary)" }}>
            Ready to move forward?
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
            Start the pre-boarding process and prepare everything for new hire needs before day
            one.
          </p>
          <button
            type="button"
            onClick={onProceed}
            className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            Proceed to Post-hire process →
          </button>
        </section>
      ) : null}
    </div>
  );
}

export default function HireJourneyClient({ workerId: _workerId }: { workerId: string }) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "post_hire" ? "post_hire" : "pre_hire";
  const [tab, setTab] = useState<HireTab>(initialTab);

  const [preCompleted, setPreCompleted] = useState<boolean[]>(() => [...PRE_HIRE_INITIAL_COMPLETED]);

  const stages = useMemo(
    () => resolveStages(PRE_HIRE_DEFS, preCompleted),
    [preCompleted],
  );

  const completedCount = preCompleted.filter(Boolean).length;
  const percent = Math.round((completedCount / Math.max(PRE_HIRE_DEFS.length, 1)) * 100);
  const inProgress = stages.some((s) => s.current) ? 1 : 0;
  const upcoming = stages.filter((s) => s.locked).length;
  const allComplete = completedCount === PRE_HIRE_DEFS.length;
  const progressHint = allComplete
    ? "Completed"
    : `${inProgress} In Progress • ${upcoming} Upcoming`;

  function toggleStageComplete(index: number) {
    setPreCompleted((prev) => {
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
    <div className="admin-recruiter-page-pad bg-[#F5F6F8]">
      <div className="admin-recruiter-content-width space-y-5">
        <div className="flex justify-center">
          <div
            className="inline-flex rounded-full border border-[#E5E7EB] bg-white p-1 shadow-sm"
            role="tablist"
            aria-label="Hire phase"
          >
            {(
              [
                { id: "pre_hire" as const, label: "Pre Hire" },
                { id: "post_hire" as const, label: "Post Hire" },
              ] as const
            ).map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                    active ? "text-white shadow-sm" : "text-[#64748B]"
                  }`}
                  style={active ? { backgroundColor: "var(--brand-primary)" } : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "post_hire" ? (
          <PostHireJourney />
        ) : (
          <>
            <StageProgressStepper labels={PRE_HIRE_STEPPER} completedFlags={preCompleted} />

            <header>
              <h1
                className="text-3xl font-bold tracking-tight"
                style={{ color: "var(--brand-secondary)" }}
              >
                Pre-hire
              </h1>
              <p className="mt-1 text-sm text-[#64748B]">
                Track every step before someone becomes part of your team.
              </p>
              <p className="mt-2 text-xs text-[#94A3B8]">
                Tip: click a stage number to mark it completed / not complete (mock).
              </p>
            </header>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1">
                <StageAccordion stages={stages} onToggleComplete={toggleStageComplete} />
              </div>

              <aside className="flex w-full max-w-[366px] flex-col gap-4 self-center lg:w-[366px] lg:shrink-0 lg:self-start">
                <CandidateProfileCard />
                <PhaseProgressCard
                  tab="pre_hire"
                  percent={percent}
                  progressHint={progressHint}
                  showProceed={allComplete}
                  onProceed={() => setTab("post_hire")}
                />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
