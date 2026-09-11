import type { CandidateWorkflowStepView } from "@/lib/onboarding/candidate-workflow-phase-view";
import type { WorkflowStepDisplayStatus } from "@/lib/onboarding/assigned-workflow-steps";

export const PRE_HIRE_FIGMA_STAGES = [
  "Intake",
  "Screening",
  "Interview",
  "Submission",
  "Compliance",
  "Offer & Agreement",
  "Approvals",
] as const;

export const POST_HIRE_FIGMA_STAGES = [
  "Kickoff",
  "Paperwork",
  "Payroll & Pay",
  "Policies",
  "Access & Equipment",
  "Training",
  "Day One Ready",
] as const;

export type HireStageLifecycle = "pre_hire" | "post_hire";

export type HireStageStatus = "completed" | "current" | "in_progress" | "locked" | "upcoming";

export type HireStageGroup = {
  id: string;
  name: string;
  index: number;
  steps: CandidateWorkflowStepView[];
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  status: HireStageStatus;
  summaryLabel: string;
};

const PRE_HIRE_RULES: Array<{ stage: (typeof PRE_HIRE_FIGMA_STAGES)[number]; patterns: RegExp }> = [
  {
    stage: "Intake",
    patterns: [/intake/, /resume/, /basic.?profile/, /profile/, /application.?receiv/, /welcome/],
  },
  {
    stage: "Screening",
    patterns: [
      /screen/,
      /skill.?test/,
      /assess/,
      /extra.?file/,
      /extra.?form/,
      /collect.?file/,
      /collect.?reference/,
      /references?/,
      /verify.?reference/,
    ],
  },
  {
    stage: "Interview",
    patterns: [/interview/, /schedule/, /want.?to.?hire/, /hire.?intent/, /we.?want.?to.?hire/],
  },
  {
    stage: "Submission",
    patterns: [/submission/, /sent.?to.?client/, /msp/, /release.?to.?client/, /submit.?to.?client/],
  },
  {
    stage: "Compliance",
    patterns: [
      /compliance/,
      /background/,
      /drug/,
      /oig/,
      /exclusion/,
      /license/,
      /credential/,
      /ssn/,
      /identity/,
      /adverse/,
    ],
  },
  {
    stage: "Offer & Agreement",
    patterns: [/offer/, /agreement/, /contract/, /placement/],
  },
  {
    stage: "Approvals",
    patterns: [/approv/, /final.?approval/, /sign.?off/],
  },
];

const POST_HIRE_RULES: Array<{ stage: (typeof POST_HIRE_FIGMA_STAGES)[number]; patterns: RegExp }> = [
  { stage: "Kickoff", patterns: [/kickoff/, /welcome/, /intro/, /start/] },
  {
    stage: "Paperwork",
    patterns: [/i-?9/, /tax/, /w-?4/, /w-?9/, /right.?to.?work/, /paperwork/, /form/],
  },
  { stage: "Payroll & Pay", patterns: [/direct.?deposit/, /payroll/, /payment/, /bank/] },
  { stage: "Policies", patterns: [/policy/, /handbook/, /acknowledg/] },
  {
    stage: "Access & Equipment",
    patterns: [/equipment/, /badge/, /access/, /laptop/, /credential.?kit/],
  },
  { stage: "Training", patterns: [/train/, /orient/, /learning/] },
  { stage: "Day One Ready", patterns: [/day.?one/, /ready/, /complete/, /onboard/] },
];

function isCompleteStatus(status: WorkflowStepDisplayStatus): boolean {
  return status === "completed" || status === "approved" || status === "skipped" || status === "not_applicable";
}

function isInProgressStatus(status: WorkflowStepDisplayStatus): boolean {
  return (
    status === "in_progress" ||
    status === "submitted" ||
    status === "under_review" ||
    status === "needs_revision"
  );
}

function stepHaystack(step: CandidateWorkflowStepView): string {
  return `${step.stepKey} ${step.stepType} ${step.onboardingType} ${step.title}`.toLowerCase();
}

function resolveStageName(
  step: CandidateWorkflowStepView,
  lifecycle: HireStageLifecycle,
  explicitStage: string | null
): string {
  if (explicitStage) return explicitStage;
  const haystack = stepHaystack(step);
  const rules = lifecycle === "pre_hire" ? PRE_HIRE_RULES : POST_HIRE_RULES;
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) return rule.stage;
  }
  const canonical = lifecycle === "pre_hire" ? PRE_HIRE_FIGMA_STAGES : POST_HIRE_FIGMA_STAGES;
  return canonical[0];
}

function readExplicitStage(step: CandidateWorkflowStepView): string | null {
  // Reserved for future settings.stage / settings.stageName from workflow builder.
  const anyStep = step as CandidateWorkflowStepView & {
    settings?: Record<string, unknown> | null;
  };
  const settings = anyStep.settings;
  if (!settings || typeof settings !== "object") return null;
  for (const key of ["stageName", "stage", "group", "section"] as const) {
    const value = settings[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function stageSortIndex(name: string, lifecycle: HireStageLifecycle): number {
  const canonical = lifecycle === "pre_hire" ? PRE_HIRE_FIGMA_STAGES : POST_HIRE_FIGMA_STAGES;
  const idx = canonical.findIndex((item) => item.toLowerCase() === name.toLowerCase());
  return idx >= 0 ? idx : canonical.length + 1;
}

function summarizeStage(steps: CandidateWorkflowStepView[]): {
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  summaryLabel: string;
} {
  let completedCount = 0;
  let inProgressCount = 0;
  let pendingCount = 0;
  for (const step of steps) {
    if (isCompleteStatus(step.displayStatus)) completedCount += 1;
    else if (isInProgressStatus(step.displayStatus)) inProgressCount += 1;
    else pendingCount += 1;
  }
  const parts: string[] = [];
  if (completedCount) parts.push(`${completedCount} Completed`);
  if (inProgressCount) parts.push(`${inProgressCount} In Progress`);
  if (pendingCount && !completedCount && !inProgressCount) parts.push(`${pendingCount} Pending`);
  else if (pendingCount && (completedCount || inProgressCount)) parts.push(`${pendingCount} Upcoming`);
  return {
    completedCount,
    inProgressCount,
    pendingCount,
    summaryLabel: parts.join(" • ") || "No steps",
  };
}

/**
 * Groups assigned workflow steps into Figma-style recruiter stages.
 * Uses explicit settings.stage* when present; otherwise keyword heuristics
 * aligned to the Pre-Hire / Post-Hire Figma boards.
 */
export function groupStepsIntoHireStages(
  steps: CandidateWorkflowStepView[],
  lifecycle: HireStageLifecycle
): HireStageGroup[] {
  const buckets = new Map<string, CandidateWorkflowStepView[]>();
  for (const step of steps) {
    const name = resolveStageName(step, lifecycle, readExplicitStage(step));
    const list = buckets.get(name) ?? [];
    list.push(step);
    buckets.set(name, list);
  }

  const orderedNames = Array.from(buckets.keys()).sort((a, b) => {
    const ai = stageSortIndex(a, lifecycle);
    const bi = stageSortIndex(b, lifecycle);
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });

  const groups: HireStageGroup[] = orderedNames.map((name, index) => {
    const stageSteps = buckets.get(name) ?? [];
    const stats = summarizeStage(stageSteps);
    return {
      id: `stage-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      index,
      steps: stageSteps,
      ...stats,
      status: "upcoming",
    };
  });

  let foundCurrent = false;
  for (const group of groups) {
    const allComplete =
      group.steps.length > 0 && group.completedCount === group.steps.length;
    if (allComplete) {
      group.status = "completed";
      group.summaryLabel = `${group.completedCount} Completed`;
      continue;
    }
    if (!foundCurrent) {
      foundCurrent = true;
      group.status = group.inProgressCount > 0 ? "current" : "current";
      if (group.inProgressCount > 0) {
        group.summaryLabel = [
          group.completedCount ? `${group.completedCount} Completed` : null,
          `${group.inProgressCount} In Progress`,
          "Current Step",
        ]
          .filter(Boolean)
          .join(" • ");
      } else {
        group.summaryLabel = "Current Step";
      }
      continue;
    }
    group.status = "locked";
    group.summaryLabel = "Pending previous step.";
  }

  return groups;
}

export function hireStageProgressMeta(groups: HireStageGroup[]): {
  inProgress: number;
  upcoming: number;
  completedStages: number;
  totalStages: number;
  percent: number;
  label: string;
} {
  const totalSteps = groups.reduce((sum, g) => sum + g.steps.length, 0);
  const completedSteps = groups.reduce((sum, g) => sum + g.completedCount, 0);
  const inProgress = groups.reduce((sum, g) => sum + g.inProgressCount, 0);
  const upcoming = groups.reduce((sum, g) => sum + g.pendingCount, 0);
  const completedStages = groups.filter((g) => g.status === "completed").length;
  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const parts: string[] = [];
  if (inProgress) parts.push(`${inProgress} In Progress`);
  if (upcoming) parts.push(`${upcoming} Upcoming`);
  if (!parts.length && percent === 100) parts.push("Completed");
  if (!parts.length) parts.push("Not started");
  return {
    inProgress,
    upcoming,
    completedStages,
    totalStages: groups.length,
    percent,
    label: parts.join(" • "),
  };
}

export function isInterviewScheduleStep(step: CandidateWorkflowStepView): boolean {
  const haystack = stepHaystack(step);
  return /interview/.test(haystack) && !isCompleteStatus(step.displayStatus);
}
