import {
  JOB_STATUSES,
  type JobStatus,
} from "@/lib/jobs/types";

const JOB_STATUS_SET = new Set<string>(JOB_STATUSES);

/** Canonical job_requisitions.status for recruiter + public job board logic. */
export function normalizeJobRequisitionStatus(
  status: string | null | undefined
): JobStatus {
  const raw = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  switch (raw) {
    case "published":
    case "open":
    case "active":
      return "open";
    case "paused":
      return "paused";
    case "filled":
      return "filled";
    case "closed":
    case "cancelled":
      return "closed";
    case "archived":
      return "archived";
    case "draft":
    case "pending_approval":
    case "approved":
    default:
      return "draft";
  }
}

export function isArchivedJobStatus(status: string | null | undefined): boolean {
  return normalizeJobRequisitionStatus(status) === "archived";
}

/** Open jobs accept public applications (not paused/filled/closed). */
export function isOpenJobRequisitionStatus(
  status: string | null | undefined
): boolean {
  return normalizeJobRequisitionStatus(status) === "open";
}

/** Live board presence: Open or Paused (paused still shows admin banner; public list hides paused). */
export function isLiveJobRequisitionStatus(
  status: string | null | undefined
): boolean {
  const normalized = normalizeJobRequisitionStatus(status);
  return normalized === "open" || normalized === "paused";
}

export function isJobStatus(value: string | null | undefined): value is JobStatus {
  return JOB_STATUS_SET.has(String(value ?? "").trim().toLowerCase());
}

const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  draft: ["open", "closed", "archived"],
  open: ["paused", "filled", "closed", "archived", "draft"],
  paused: ["open", "filled", "closed", "archived", "draft"],
  filled: ["open", "closed", "archived"],
  closed: ["open", "archived", "draft"],
  archived: ["draft"],
};

export function allowedJobStatusTransitions(
  from: string | null | undefined
): JobStatus[] {
  return [...ALLOWED_TRANSITIONS[normalizeJobRequisitionStatus(from)]];
}

export function canTransitionJobStatus(
  from: string | null | undefined,
  to: string | null | undefined
): boolean {
  const target = normalizeJobRequisitionStatus(to);
  if (normalizeJobRequisitionStatus(from) === target) return true;
  return allowedJobStatusTransitions(from).includes(target);
}

export function jobStatusDisplayLabel(status: string | null | undefined): string {
  switch (normalizeJobRequisitionStatus(status)) {
    case "open":
      return "Open";
    case "paused":
      return "Paused";
    case "filled":
      return "Filled";
    case "draft":
      return "Draft";
    case "closed":
      return "Closed";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}

/** Editing job content does not reopen or unpublish a closed/filled/archived job. */
export function jobLifecycleForSave(existing: Record<string, unknown> | null, publish: boolean, now: string) {
  const status = normalizeJobRequisitionStatus(String(existing?.status ?? "draft"));
  const date = (key: string): string | null => existing?.[key] ? String(existing[key]) : null;
  if (!publish && existing && ["closed", "filled", "archived"].includes(status)) {
    return { status, published_at: date("published_at"), closed_at: date("closed_at"), archived_at: date("archived_at") };
  }
  return { status: (publish ? "open" : "draft") as JobStatus, published_at: publish ? date("published_at") ?? now : null, closed_at: null, archived_at: null };
}
