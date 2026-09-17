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

/** Align with Figma Post-hire board (Payroll · Access · Training · Welcome). */
export const POST_HIRE_FIGMA_STAGES = [
  "Payroll & Tax",
  "Access & Systems",
  "Training & Policy",
  "Welcome & Complete",
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

/**
 * Exact library step keys → Figma Pre-Hire stages (Steps Library order).
 * Preferred over regex so SSN stays in Compliance, Interview/Submission appear correctly.
 */
const PRE_HIRE_LIBRARY_STAGE: Record<string, (typeof PRE_HIRE_FIGMA_STAGES)[number]> = {
  "resume-basic-profile": "Intake",
  "parameterized-job-application": "Intake",
  "collect-extra-files": "Intake",
  "references-collection": "Intake",
  "collect-references": "Intake",
  "custom-form": "Intake",
  "custom-application-form": "Intake",
  "document-upload": "Intake",
  "recruiter-screening": "Screening",
  "skill-qualification-assessment": "Screening",
  "reference-verification": "Screening",
  "interview-qualification": "Interview",
  "internal-select": "Interview",
  "candidate-selection": "Interview",
  "release-to-client": "Submission",
  "client-review": "Submission",
  "background-check": "Compliance",
  "drug-test-screening": "Compliance",
  "oig-exclusion-check": "Compliance",
  "credential-license-verification": "Compliance",
  "ssn-identity-verification": "Compliance",
  "adverse-action-process": "Compliance",
  "pay-and-start-date": "Offer & Agreement",
  "pay-rate-hire-date": "Offer & Agreement",
  "offer-acceptance": "Offer & Agreement",
  "offer-accepted": "Offer & Agreement",
  "employee-agreement": "Offer & Agreement",
  "agreement-esign": "Offer & Agreement",
  "i9-section-1": "Offer & Agreement",
  "manager-facility-approval": "Approvals",
  "hr-final-approval": "Approvals",
  "completion-milestone": "Approvals",
};

/** Match Figma W2 Pre-hire board: Intake → … → Approvals. */
const PRE_HIRE_RULES: Array<{ stage: (typeof PRE_HIRE_FIGMA_STAGES)[number]; patterns: RegExp[] }> = [
  {
    stage: "Intake",
    patterns: [
      /intake/,
      /collect.?extra.?file/,
      /extra.?file/,
      /collect.?file/,
      /document.?upload/,
      /collect.?reference/,
      /references.?collection/,
      /extra.?form/,
      /custom.?form/,
      /custom.?application/,
      /resume/,
      /basic.?profile/,
      /parameterized.?job/,
      /application.?receiv/,
    ],
  },
  {
    stage: "Screening",
    patterns: [
      /recruiter.?screen/,
      /skill.?qualification/,
      /skill.?assess/,
      /skill.?test/,
      /qualification.?assess/,
      /reference.?verif/,
      /verify.?reference/,
    ],
  },
  {
    stage: "Interview",
    patterns: [
      /interview/,
      /internal.?select/,
      /want.?to.?hire/,
      /hire.?intent/,
      /we.?want.?to.?hire/,
    ],
  },
  {
    stage: "Submission",
    patterns: [
      /submission/,
      /sent.?to.?client/,
      /msp/,
      /release.?to.?client/,
      /released.?to.?client/,
      /client.?review/,
      /submit.?to.?client/,
      /presented.?to.?client/,
      /profile.?ready/,
    ],
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
      /identity.?verif/,
      /adverse/,
    ],
  },
  {
    stage: "Offer & Agreement",
    patterns: [
      /offer/,
      /agreement/,
      /contract/,
      /placement/,
      /pay.?and.?start/,
      /pay.?rate/,
      /hire.?date/,
      /i-?9.?section.?1/,
    ],
  },
  {
    // Final Review / Completion milestones stay in Approvals when pre-hire.
    stage: "Approvals",
    patterns: [
      /manager.?facility.?approv/,
      /facility.?approv/,
      /hr.?final.?approv/,
      /final.?approval/,
      /final.?review/,
      /completion.?milestone/,
      /pre.?hire.?approv/,
      /approv/,
      /sign.?off/,
    ],
  },
];

const POST_HIRE_RULES: Array<{ stage: (typeof POST_HIRE_FIGMA_STAGES)[number]; patterns: RegExp[] }> = [
  {
    stage: "Payroll & Tax",
    patterns: [
      /payroll/,
      /tax/,
      /w-?4/,
      /w-?9/,
      /direct.?deposit/,
      /benefits.?enroll/,
      /401.?k/,
      /i-?9/,
      /everify/,
      /right.?to.?work/,
      /paychex/,
      /adp/,
    ],
  },
  {
    stage: "Access & Systems",
    patterns: [/equipment/, /badge/, /access/, /schedule.?assign/, /facility.?access/, /door/, /system/],
  },
  {
    stage: "Training & Policy",
    patterns: [
      /train/,
      /orient/,
      /policy/,
      /handbook/,
      /welcome.?packet/,
      /safety/,
      /certif/,
      /learning/,
      /quiz/,
    ],
  },
  {
    stage: "Welcome & Complete",
    patterns: [
      /welcome.?call/,
      /welcome.?email/,
      /manager.?welcome/,
      /final.?onboarding.?call/,
      /buddy/,
      /mentor/,
      /onboarding.?complete/,
      /completion.?milestone/,
      /day.?one/,
    ],
  },
];

function isCompleteStatus(status: WorkflowStepDisplayStatus): boolean {
  return (
    status === "completed" ||
    status === "approved" ||
    status === "submitted" ||
    status === "skipped" ||
    status === "not_applicable"
  );
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

  if (lifecycle === "pre_hire") {
    const keys = [step.stepKey, step.stepType]
      .map((value) => String(value ?? "").trim().toLowerCase())
      .filter(Boolean);
    for (const key of keys) {
      const mapped = PRE_HIRE_LIBRARY_STAGE[key];
      if (mapped) return mapped;
    }
  }

  const haystack = stepHaystack(step);
  const rules = lifecycle === "pre_hire" ? PRE_HIRE_RULES : POST_HIRE_RULES;
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) return rule.stage;
  }
  const canonical = lifecycle === "pre_hire" ? PRE_HIRE_FIGMA_STAGES : POST_HIRE_FIGMA_STAGES;
  return canonical[0];
}

function readExplicitStage(step: CandidateWorkflowStepView): string | null {
  const settings = step.settings;
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

/**
 * Steps where recruiters can open Schedule Interview from the Pre-Hire board.
 * Includes Interview stage library keys (Interview/Qualification, Internal Select, etc.).
 */
export function isInterviewScheduleStep(step: CandidateWorkflowStepView): boolean {
  if (isCompleteStatus(step.displayStatus)) return false;
  const haystack = stepHaystack(step);
  return (
    /interview/.test(haystack) ||
    /internal.?select/.test(haystack) ||
    /candidate.?selection/.test(haystack) ||
    /client.?review/.test(haystack)
  );
}

/** Show Schedule Interview while the Interview stage is the active Pre-Hire stage. */
export function shouldShowInterviewScheduleAction(
  stage: HireStageGroup,
  step: CandidateWorkflowStepView
): boolean {
  if (stage.name.toLowerCase() !== "interview") return false;
  if (stage.status !== "current" && stage.status !== "in_progress") return false;
  return isInterviewScheduleStep(step);
}
