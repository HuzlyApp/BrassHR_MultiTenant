import type { JobRequisitionStatus } from "@/lib/job-requisitions/types";
import { isPublishedJobStatus, normalizeJobStatus } from "@/lib/job-requisitions/types";

const TRANSITIONS: Record<JobRequisitionStatus, readonly JobRequisitionStatus[]> = {
  Draft: ["Pending_Approval", "Approved", "Published", "Cancelled"],
  Pending_Approval: ["Approved", "Draft", "Cancelled"],
  Approved: ["Published", "Draft", "Cancelled"],
  Published: ["Paused", "Closed", "Filled", "Cancelled"],
  Paused: ["Published", "Closed", "Cancelled"],
  Closed: ["Filled", "Published"],
  Filled: ["Closed"],
  Cancelled: [],
};

export function canTransitionJobStatus(
  from: string | null | undefined,
  to: string | null | undefined
): boolean {
  const fromNorm = normalizeJobStatus(from);
  const toNorm = normalizeJobStatus(to);
  if (!fromNorm || !toNorm) return false;
  if (fromNorm === toNorm) return true;
  return TRANSITIONS[fromNorm].includes(toNorm);
}

export function assertJobStatusTransition(
  from: string | null | undefined,
  to: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (canTransitionJobStatus(from, to)) return { ok: true };
  const fromNorm = normalizeJobStatus(from) ?? String(from ?? "unknown");
  const toNorm = normalizeJobStatus(to) ?? String(to ?? "unknown");
  return {
    ok: false,
    error: `Invalid job status transition from ${fromNorm} to ${toNorm}.`,
  };
}

export function jobAcceptsApplications(status: string | null | undefined): boolean {
  return isPublishedJobStatus(status);
}

export function isTerminalJobStatus(status: string | null | undefined): boolean {
  const s = normalizeJobStatus(status);
  return s === "Closed" || s === "Filled" || s === "Cancelled";
}

export function allowedNextStatuses(
  from: string | null | undefined
): JobRequisitionStatus[] {
  const fromNorm = normalizeJobStatus(from);
  if (!fromNorm) return [];
  return [...TRANSITIONS[fromNorm]];
}
