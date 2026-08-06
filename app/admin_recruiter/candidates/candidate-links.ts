export function candidateProfileHref(workerId: string) {
  return `/admin_recruiter/new/profile/${encodeURIComponent(workerId)}`;
}

/** Opens Mail compose with the candidate pre-selected in the dropdown. */
export function candidateMailHref(workerId: string) {
  const params = new URLSearchParams({
    workerId,
    compose: "1",
  });
  return `/admin_recruiter/mail?${params.toString()}`;
}

/** AI / Final Approval review for a linked worker candidate. */
export function candidateFinalApprovalHref(workerId: string) {
  return `/admin_recruiter/new/final-approval/${encodeURIComponent(workerId)}`;
}
