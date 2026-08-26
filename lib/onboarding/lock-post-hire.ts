import { isPlacementAcceptedStatus, parseApplicantLifecyclePhase, type ApplicantLifecyclePhase } from "@/lib/onboarding/workflow-phase";

export function isAuthoritativelyHired(status: string | null | undefined): boolean {
  return isPlacementAcceptedStatus(status);
}

/**
 * Post-Hire is visible to staff only after Approve as Worker succeeds.
 * Hired/Approved application status, a mapped Post-Hire workflow, or a UI flag is not enough.
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
