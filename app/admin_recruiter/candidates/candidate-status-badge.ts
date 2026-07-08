import { formatPipelineStatusLabel } from "@/lib/workers/candidate-status-label";

function normalizeCandidateStatus(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Human-readable label for candidate status (e.g. for_approval → For Approval). */
export function formatCandidateStatusLabel(s: string | null | undefined): string {
  return formatPipelineStatusLabel(s);
}

/** Hardcoded status colors — shared by card and list views. */
export function candidateStatusBadgeClassName(status: string): string {
  const s = normalizeCandidateStatus(status);
  if (s === "pending" || s === "under_review") {
    return "border border-[#F59E0B] bg-[#F59E0B] text-white";
  }
  if (s === "for_approval") {
    return "border border-[#F97316] bg-[#F97316] text-white";
  }
  if (s === "approved") return "border border-[#22C55E] bg-[#22C55E] text-white";
  if (s === "disapproved" || s === "rejected") {
    return "border border-[#EF4444] bg-[#EF4444] text-white";
  }
  if (s === "converted") {
    return "border border-[#6B7280] bg-[#6B7280] text-white";
  }
  return "border border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]";
}
