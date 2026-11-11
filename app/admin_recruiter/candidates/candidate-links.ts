export function candidateProfileHref(workerId: string) {
  return `/admin_recruiter/new/profile/${encodeURIComponent(workerId)}`;
}

/**
 * Legacy applicant overview under /admin_recruiter/candidates/[id].
 * Used from the candidate-detail header name link.
 */
export function candidateLegacyProfileHref(
  workerId: string,
  opts?: { from?: string; jobId?: string; tab?: string }
) {
  const params = new URLSearchParams();
  if (opts?.from?.trim()) params.set("from", opts.from.trim());
  if (opts?.jobId?.trim()) params.set("jobId", opts.jobId.trim());
  if (opts?.tab?.trim()) params.set("tab", opts.tab.trim());
  const query = params.toString();
  return `/admin_recruiter/candidates/${encodeURIComponent(workerId)}${
    query ? `?${query}` : ""
  }`;
}

/**
 * Recruiter candidate detail screen (shared header + tabs under /admin_recruiter/new).
 * Applicant name / profile links should land here — not the legacy /candidates/[id] page.
 */
export function candidateApplicantProfileHref(
  workerId: string,
  opts?: { from?: string; jobId?: string; tab?: string }
) {
  const id = encodeURIComponent(workerId);
  const tab = opts?.tab?.trim().toLowerCase() || "";
  const path =
    tab === "applications"
      ? `/admin_recruiter/new/applications/${id}`
      : `/admin_recruiter/new/profile/${id}`;

  const params = new URLSearchParams();
  if (opts?.from?.trim()) params.set("from", opts.from.trim());
  if (opts?.jobId?.trim()) params.set("jobId", opts.jobId.trim());
  const query = params.toString();
  return query ? `${path}?${query}` : path;
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

/** Pre-Hire tab on the recruiter candidate detail screen. Shows the hiring journey. */
export function candidateDetailPreHireHref(workerId: string) {
  return `/admin_recruiter/new/pre-hire/${encodeURIComponent(workerId)}`;
}

/** AI Analysis tab on the recruiter candidate detail screen (new/profile flow). */
export function candidateDetailAiAnalysisHref(
  workerId: string,
  opts?: { applicationId?: string | null }
) {
  const params = new URLSearchParams();
  if (opts?.applicationId?.trim()) params.set("applicationId", opts.applicationId.trim());
  const query = params.toString();
  return `/admin_recruiter/new/ai-analysis/${encodeURIComponent(workerId)}${
    query ? `?${query}` : ""
  }`;
}

/** AI Analysis Overview for a worker's job application (defaults to best analyzed match). */
export function candidateAiAnalysisHref(
  workerId: string,
  opts?: { applicationId?: string | null }
) {
  const params = new URLSearchParams();
  if (opts?.applicationId?.trim()) params.set("applicationId", opts.applicationId.trim());
  const query = params.toString();
  return `/admin_recruiter/candidates/ai-analysis/${encodeURIComponent(workerId)}${
    query ? `?${query}` : ""
  }`;
}

/** Figma hire journey board (Pre-Hire + Post-Hire tabs). */
export function candidateHireJourneyHref(
  workerId: string,
  opts?: { tab?: "pre_hire" | "post_hire" }
) {
  const params = new URLSearchParams();
  if (opts?.tab === "post_hire") params.set("tab", "post_hire");
  const query = params.toString();
  return `/admin_recruiter/candidates/${encodeURIComponent(workerId)}/hire-journey${
    query ? `?${query}` : ""
  }`;
}

/** @deprecated Prefer candidateHireJourneyHref for the Figma hire board. */
export function candidatePreHireHref(workerId: string) {
  return candidateHireJourneyHref(workerId, { tab: "pre_hire" });
}

/** @deprecated Prefer candidateHireJourneyHref for the Figma hire board. */
export function candidatePostHireHref(workerId: string) {
  return candidateHireJourneyHref(workerId, { tab: "post_hire" });
}
