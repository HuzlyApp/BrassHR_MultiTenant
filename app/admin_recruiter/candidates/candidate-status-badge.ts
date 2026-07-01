function normalizeCandidateStatus(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Human-readable label for candidate status (e.g. under_review → Under Review). */
export function formatCandidateStatusLabel(s: string | null | undefined): string {
  const v = (s || "").trim();
  if (!v) return "New";
  return v
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Hardcoded status colors — shared by card and list views. */
export function candidateStatusBadgeClassName(status: string): string {
  const s = normalizeCandidateStatus(status);
  if (s === "pending") return "border border-[#F59E0B] bg-[#F59E0B] text-white";
  if (s === "approved") return "border border-[#22C55E] bg-[#22C55E] text-white";
  if (s === "disapproved" || s === "rejected") return "border border-[#EF4444] bg-[#EF4444] text-white";
  return "border border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]";
}
