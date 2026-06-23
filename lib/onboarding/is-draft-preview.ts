/** Synthetic applicant id used during admin draft preview (`?preview=draft`). */
export const DRAFT_PREVIEW_APPLICANT_ID = "draft-preview";

export function isDraftPreviewApplicantId(applicantId: string | null | undefined): boolean {
  return applicantId?.trim() === DRAFT_PREVIEW_APPLICANT_ID;
}

/** Admin builder draft preview (`?preview=draft`) — no applicant anonymous session needed. */
export function isOnboardingDraftPreview(search?: string | null): boolean {
  if (typeof search !== "string" || !search.trim()) {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("preview") === "draft";
  }
  const query = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(query).get("preview") === "draft";
}
