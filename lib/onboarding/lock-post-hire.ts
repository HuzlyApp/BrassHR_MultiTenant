import { isCompleteDisplayStatus } from "@/lib/onboarding/assigned-workflow-steps";
import type { WorkflowStepDisplayStatus } from "@/lib/onboarding/assigned-workflow-steps";
import type { OnboardingStepStatus } from "@/lib/onboarding/types";
import { isPlacementAcceptedStatus, parseApplicantLifecyclePhase, type ApplicantLifecyclePhase } from "@/lib/onboarding/workflow-phase";

/** Required Pre-Hire progress threshold for revealing Post-Hire after Selected. */
export const PRE_HIRE_ALMOST_COMPLETE_RATIO = 0.8;

export function isAuthoritativelyHired(status: string | null | undefined): boolean {
  return isPlacementAcceptedStatus(status);
}

/**
 * Post-Hire is visible after Approve as Worker conversion succeeds.
 * Hired/Approved application status alone is not enough for this path.
 */
export function canRevealPostHire(params: {
  workerStatus?: string | null;
  convertedAt?: string | null;
  convertedWorkerId?: string | null;
  conversionStatus?: string | null;
}): boolean {
  const status = String(params.workerStatus ?? "").trim().toLowerCase();
  if (status === "converted") return true;
  const conversionCompleted = String(params.conversionStatus ?? "").trim().toLowerCase() === "completed";
  return conversionCompleted && Boolean(params.convertedAt || params.convertedWorkerId);
}

type PreHireProgressStep = {
  required?: boolean;
  displayStatus?: WorkflowStepDisplayStatus | OnboardingStepStatus | null;
  status?: OnboardingStepStatus | string | null;
};

/**
 * Required Pre-Hire steps are "almost complete" when:
 * - there are no required steps, or
 * - all required steps are complete, or
 * - at most one required step remains (for lists of 2+), or
 * - completed required / total required >= 80%.
 */
export function areRequiredPreHireStepsAlmostComplete(steps: PreHireProgressStep[]): boolean {
  const required = steps.filter((step) => step.required !== false);
  if (!required.length) return true;

  const completed = required.filter((step) =>
    isCompleteDisplayStatus((step.displayStatus ?? step.status ?? "pending") as WorkflowStepDisplayStatus)
  ).length;

  if (completed >= required.length) return true;
  const remaining = required.length - completed;
  if (remaining <= 1 && required.length >= 2) return true;
  return completed / required.length >= PRE_HIRE_ALMOST_COMPLETE_RATIO;
}

/**
 * Staff hire-journey Post-Hire tab:
 * - after conversion (Approve as Worker), or
 * - after application is Selected (hired) and required Pre-Hire steps are nearly complete.
 */
export function canRevealPostHireForStaffJourney(params: {
  convertedVisible: boolean;
  applicationHired: boolean;
  preHireSteps: PreHireProgressStep[];
}): boolean {
  if (params.convertedVisible) return true;
  return (
    params.applicationHired && areRequiredPreHireStepsAlmostComplete(params.preHireSteps)
  );
}

export function shouldRejectPostHirePhaseRequest(
  phase: string | null | undefined,
  postHireVisible: boolean
): boolean {
  return String(phase ?? "").trim().toLowerCase() === "post_hire" && !postHireVisible;
}

export function isPostHireLockedForApplicant(params: {
  isHired: boolean;
  postHireSuspended?: boolean;
}): boolean {
  return !params.isHired || Boolean(params.postHireSuspended);
}

export function shouldSuspendPostHireAfterStatusChange(params: {
  previousStatus?: string | null;
  nextStatus: string;
  unchanged?: boolean;
}): boolean {
  if (params.unchanged) return false;
  return isPlacementAcceptedStatus(params.previousStatus) && !isPlacementAcceptedStatus(params.nextStatus);
}

export function hireGateFromApplications(
  rows: Array<{
    status?: string | null;
    workflow_phase?: string | null;
    post_hire_suspended_at?: string | null;
  }>
): {
  isHired: boolean;
  postHireSuspended: boolean;
  activePhase: ApplicantLifecyclePhase;
} {
  const hired = rows.find((row) => isPlacementAcceptedStatus(row.status));
  if (!hired) {
    return {
      isHired: false,
      postHireSuspended: false,
      activePhase: parseApplicantLifecyclePhase(rows[0]?.workflow_phase),
    };
  }
  const postHireSuspended = Boolean(hired.post_hire_suspended_at);
  return {
    isHired: !postHireSuspended,
    postHireSuspended,
    activePhase: parseApplicantLifecyclePhase(hired.workflow_phase),
  };
}
