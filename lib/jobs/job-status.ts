import type { JobStatus } from "@/lib/jobs/types";

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
      return "published";
    case "closed":
    case "filled":
    case "cancelled":
      return "closed";
    case "archived":
      return "archived";
    case "draft":
    case "pending_approval":
    case "approved":
    case "paused":
    default:
      return "draft";
  }
}

export function isArchivedJobStatus(status: string | null | undefined): boolean {
  return normalizeJobRequisitionStatus(status) === "archived";
}
