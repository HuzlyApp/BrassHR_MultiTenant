/** Display labels for pipeline `worker.status` values in Admin Recruiter. */

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  pending: "Pending Review",
  under_review: "Pending Review",
  for_approval: "For Approval",
  approved: "Approved",
  disapproved: "Rejected",
  rejected: "Rejected",
  converted: "Converted",
};

export function formatPipelineStatusLabel(status: string | null | undefined): string {
  const key = (status ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!key) return "New";
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return key
    .split(/[_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Statuses that mean the candidate is still active in the Candidates module. */
export const ACTIVE_CANDIDATE_PIPELINE_STATUSES = [
  "new",
  "pending",
  "under_review",
  "for_approval",
  "approved",
  "disapproved",
] as const;

export function isConvertedPipelineStatus(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "converted";
}

/** Statuses that can be auto-promoted to for_approval when Final Approval is ready. */
export function canPromoteToForApproval(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "new" || s === "pending" || s === "under_review" || s === "";
}
