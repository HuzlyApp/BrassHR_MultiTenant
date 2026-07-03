import { isEligibleForFinalApprovalView } from "@/lib/admin/final-approval";
import {
  isWorkerSkillAssessmentProgressComplete,
} from "@/lib/admin/worker-skill-assessment-progress";

export const CANDIDATE_PIPELINE_STEP_LABELS = [
  "Application Received",
  "Screening",
  "Assessment",
  "Interview",
  "Reference Check",
] as const;

export type CandidatePipelineStepLabel =
  | (typeof CANDIDATE_PIPELINE_STEP_LABELS)[number]
  | "Final Approval"
  | "Onboarded";

export type CandidatePipelineStep = {
  id: string;
  label: CandidatePipelineStepLabel;
  /** Secondary line under the label (e.g. Completed, Welcome Aboard!). */
  subtitle?: string;
  completed: boolean;
  /** When true the step label links to its detail page. */
  clickable: boolean;
  href?: string | null;
};

type ChecklistRow = {
  id: string;
  state?: string;
  checked?: boolean;
  callLogCompleted?: boolean;
};

type ChecklistSection = {
  id: string;
  rows: ChecklistRow[];
};

type SkillAssessments = {
  completed?: number;
  total?: number;
  rows?: Array<{ completed?: boolean }>;
};

type ProfileWorker = {
  id?: string;
  created_at?: string | null;
  status?: string | null;
};

/** Worker fields returned by the checklist API (also used by DetailedTabs). */
export type CandidatePipelineChecklistWorker = ProfileWorker & {
  status_label?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  job_role?: string | null;
  city?: string | null;
  state?: string | null;
  updated_at?: string | null;
  profile_photo_url?: string | null;
};

export type CandidatePipelineProfilePayload = {
  worker?: ProfileWorker;
  skillAssessments?: SkillAssessments;
  references?: unknown[];
  onboardingCompletion?: { percent?: number };
};

export type CandidatePipelineChecklistPayload = {
  worker?: CandidatePipelineChecklistWorker;
  sections?: ChecklistSection[];
  meta?: {
    skillAssessments?: SkillAssessments;
    daysInStage?: number;
    progressPercent?: number;
    completedItems?: number;
    totalItems?: number;
    verifiedDocuments?: { done: number; total: number };
  } & Record<string, unknown>;
  tracker?: { done?: boolean[] };
} & Record<string, unknown>;

function normalizeWorkerStatus(
  profile: CandidatePipelineProfilePayload,
  checklist: CandidatePipelineChecklistPayload
): string {
  const worker = profile.worker ?? {};
  return (worker.status ?? checklist.worker?.status ?? checklist.worker?.status_label ?? "new")
    .toString()
    .trim()
    .toLowerCase();
}

function findChecklistRow(
  sections: ChecklistSection[] | undefined,
  id: string
): ChecklistRow | null {
  for (const section of sections ?? []) {
    const row = section.rows.find((item) => item.id === id);
    if (row) return row;
  }
  return null;
}

function rowIsPassed(row: ChecklistRow | null): boolean {
  if (!row) return false;
  return (
    row.checked === true ||
    row.callLogCompleted === true ||
    row.state === "complete" ||
    row.state === "uploaded" ||
    row.state === "answered"
  );
}

function skillAssessmentsComplete(skillAssessments: SkillAssessments | undefined): boolean {
  return isWorkerSkillAssessmentProgressComplete(
    skillAssessments
      ? {
          completed: skillAssessments.completed ?? 0,
          total: skillAssessments.total ?? 0,
          rows: skillAssessments.rows ?? [],
        }
      : undefined
  );
}

export function isFinalApprovalDecisionMade(status: string | null | undefined): boolean {
  const statusNorm = (status ?? "").trim().toLowerCase();
  return statusNorm === "approved" || statusNorm === "converted" || statusNorm === "disapproved";
}

export function isApplicantReadyForFinalApproval(
  profile: CandidatePipelineProfilePayload,
  checklist: CandidatePipelineChecklistPayload
): boolean {
  const sections = checklist.sections ?? [];
  const statusNorm = normalizeWorkerStatus(profile, checklist);
  if (statusNorm === "disapproved") return false;

  const assessmentDone =
    skillAssessmentsComplete(profile.skillAssessments) ||
    skillAssessmentsComplete(checklist.meta?.skillAssessments);
  const referencesCount = Array.isArray(profile.references) ? profile.references.length : 0;
  const worker = profile.worker ?? {};

  const applicationReceived = Boolean(worker.id || worker.created_at);
  const screeningDone = rowIsPassed(findChecklistRow(sections, "call_1"));
  const interviewDone = rowIsPassed(findChecklistRow(sections, "call_2"));
  const referenceDone = referencesCount > 0;

  const prerequisiteStepsDone =
    applicationReceived && screeningDone && assessmentDone && interviewDone && referenceDone;
  if (!prerequisiteStepsDone) return false;

  const checklistProgressPercent = Number(checklist.meta?.progressPercent ?? 0);
  const onboardingCompletionPercent = Number(profile.onboardingCompletion?.percent ?? 0);
  const trackerDoneCount = (checklist.tracker?.done ?? []).filter(Boolean).length;

  return isEligibleForFinalApprovalView({
    workerStatus: statusNorm,
    checklistProgressPercent,
    onboardingCompletionPercent,
    trackerDoneCount,
  });
}

export function buildCandidatePipelineSteps(
  profile: CandidatePipelineProfilePayload,
  checklist: CandidatePipelineChecklistPayload,
  applicantId?: string
): CandidatePipelineStep[] {
  const sections = checklist.sections ?? [];
  const worker = profile.worker ?? {};
  const statusNorm = normalizeWorkerStatus(profile, checklist);

  const assessmentDone =
    skillAssessmentsComplete(profile.skillAssessments) ||
    skillAssessmentsComplete(checklist.meta?.skillAssessments);

  const referencesCount = Array.isArray(profile.references) ? profile.references.length : 0;

  const applicationReceived = Boolean(worker.id || worker.created_at);
  const screeningDone = rowIsPassed(findChecklistRow(sections, "call_1"));
  const interviewDone = rowIsPassed(findChecklistRow(sections, "call_2"));
  const referenceDone = referencesCount > 0;

  const finalApprovalCompleted = isFinalApprovalDecisionMade(statusNorm);
  const applicantReady = isApplicantReadyForFinalApproval(profile, checklist);
  const showOnboardedStep =
    statusNorm === "approved" || statusNorm === "converted";
  const onboardedCompleted = showOnboardedStep;

  const baseStepCompletion = [
    applicationReceived,
    screeningDone,
    assessmentDone,
    interviewDone,
    referenceDone,
  ];

  const steps: CandidatePipelineStep[] = CANDIDATE_PIPELINE_STEP_LABELS.map((label, index) => {
    const completed = baseStepCompletion[index] ?? false;
    return {
      id: label.toLowerCase().replace(/\s+/g, "_"),
      label,
      subtitle: completed ? "Completed" : undefined,
      completed,
      clickable: false,
      href: null,
    };
  });

  const finalApprovalHref = applicantId
    ? `/admin_recruiter/new/final-approval/${encodeURIComponent(applicantId)}`
    : null;
  const onboardedHref = applicantId
    ? `/admin_recruiter/new/onboard-applicant/${encodeURIComponent(applicantId)}`
    : null;

  steps.push({
    id: "final_approval",
    label: "Final Approval",
    subtitle: finalApprovalCompleted ? "Completed" : undefined,
    completed: finalApprovalCompleted,
    clickable: Boolean(finalApprovalHref) && applicantReady && !finalApprovalCompleted,
    href: finalApprovalHref,
  });

  if (showOnboardedStep) {
    steps.push({
      id: "onboarded",
      label: "Onboarded",
      subtitle: "Welcome Aboard!",
      completed: onboardedCompleted,
      clickable: Boolean(onboardedHref),
      href: onboardedHref,
    });
  }

  return steps;
}

export function pipelineConnectorFillPercent(steps: CandidatePipelineStep[]): number {
  if (steps.length <= 1) return 0;
  let lastCompletedIndex = -1;
  steps.forEach((step, index) => {
    if (step.completed) lastCompletedIndex = index;
  });
  if (lastCompletedIndex < 0) return 0;
  if (lastCompletedIndex >= steps.length - 1) return 100;
  return (lastCompletedIndex / (steps.length - 1)) * 100;
}
