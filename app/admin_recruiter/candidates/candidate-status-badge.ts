/** Hardcoded status colors — shared by card and list views. */
export function candidateStatusBadgeClassName(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "pending") return "border border-[#F59E0B] bg-[#F59E0B] text-white";
  if (s === "approved") return "border border-[#22C55E] bg-[#22C55E] text-white";
  if (s === "disapproved" || s === "rejected") return "border border-[#EF4444] bg-[#EF4444] text-white";
  return "border border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]";
}
