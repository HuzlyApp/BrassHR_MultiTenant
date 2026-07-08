import { canPromoteToForApproval } from "@/lib/workers/candidate-status-label";
import { isWorkerSkillAssessmentProgressComplete } from "@/lib/admin/worker-skill-assessment-progress";

type SkillAssessments = {
  completed?: number;
  total?: number;
  rows?: Array<{ completed?: boolean }>;
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

export type PromoteToForApprovalInput = {
  workerId: string;
  currentStatus: string | null | undefined;
  prerequisitesComplete: boolean;
  finalApprovalReady: boolean;
};

/**
 * When pipeline prerequisites are done and Final Approval is ready to act on,
 * candidates still in early statuses are promoted to `for_approval`.
 */
export function shouldPromoteToForApproval(input: PromoteToForApprovalInput): boolean {
  if (!input.prerequisitesComplete || !input.finalApprovalReady) return false;
  return canPromoteToForApproval(input.currentStatus);
}

export function rowIsPipelineComplete(row: ChecklistRow | null | undefined): boolean {
  if (!row) return false;
  return (
    row.checked === true ||
    row.callLogCompleted === true ||
    row.state === "complete" ||
    row.state === "uploaded" ||
    row.state === "answered"
  );
}

export function findChecklistRowById(
  sections: ChecklistSection[] | undefined,
  id: string
): ChecklistRow | null {
  for (const section of sections ?? []) {
    const row = section.rows.find((item) => item.id === id);
    if (row) return row;
  }
  return null;
}

export function skillAssessmentsAreComplete(skillAssessments: SkillAssessments | undefined): boolean {
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

export function areFinalApprovalPrerequisitesMet(params: {
  hasWorker: boolean;
  sections?: ChecklistSection[];
  skillAssessments?: SkillAssessments;
  referencesCount: number;
}): boolean {
  if (!params.hasWorker) return false;
  const screeningDone = rowIsPipelineComplete(findChecklistRowById(params.sections, "call_1"));
  const interviewDone = rowIsPipelineComplete(findChecklistRowById(params.sections, "call_2"));
  const assessmentDone = skillAssessmentsAreComplete(params.skillAssessments);
  const referenceDone = params.referencesCount > 0;
  return screeningDone && assessmentDone && interviewDone && referenceDone;
}
