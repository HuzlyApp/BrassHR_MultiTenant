import { normalizeCandidateStatus } from "@/lib/admin/convert-candidate-to-worker";

/** Candidate approved for hire but not yet converted to a W-2/1099 employment record. */
export function isApprovedPendingConversion(
  status: string | null | undefined,
  hasEmploymentRecord: boolean
): boolean {
  if (hasEmploymentRecord) return false;
  return normalizeCandidateStatus(status) === "approved";
}

/** Exclude from approved-applicant lists once converted or linked to employment. */
export function shouldExcludeFromApprovedCandidates(
  status: string | null | undefined,
  hasEmploymentRecord: boolean
): boolean {
  const normalized = normalizeCandidateStatus(status);
  return normalized === "converted" || hasEmploymentRecord;
}

/** Exclude converted workers from the Candidates module (All + status tabs). */
export function shouldExcludeFromCandidateLists(
  status: string | null | undefined,
  hasEmploymentRecord: boolean
): boolean {
  return shouldExcludeFromApprovedCandidates(status, hasEmploymentRecord);
}
