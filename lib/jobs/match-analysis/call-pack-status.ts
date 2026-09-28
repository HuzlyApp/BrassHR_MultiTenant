/**
 * Step 2 Call pack unlocks when the recruiter moves the candidate into screening.
 * Catalog: Screening Complete (reviewing). Also Attempted Contact / Follow-up Needed.
 */
export function isMatchCallPackStatus(args: {
  statusName?: string | null;
  systemKey?: string | null;
}): boolean {
  const name = (args.statusName ?? "").trim().toLowerCase();
  const key = (args.systemKey ?? "").trim().toLowerCase();
  if (key === "reviewing") return true;
  if (name.includes("screen")) return true;
  if (name.includes("attempted contact")) return true;
  if (name.includes("follow-up") || name.includes("follow up")) return true;
  return false;
}
