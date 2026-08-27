/** Synthetic applicant id used during admin draft preview (`?preview=draft`). */
export const DRAFT_PREVIEW_APPLICANT_ID = "draft-preview";

/** Placeholder signer email for Firma draft-preview signing sessions. */
export const DRAFT_PREVIEW_APPLICANT_EMAIL = "draft-preview@preview.brasshr.local";

/** Deliverable fallback when Firma rejects the placeholder draft preview address. */
export const DRAFT_PREVIEW_FIRMA_SIGNER_EMAIL_FALLBACK = "carl@taxequitypros.com";

export function isUndeliverableDraftPreviewEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (
    normalized.endsWith(".local") ||
    normalized === DRAFT_PREVIEW_APPLICANT_EMAIL.toLowerCase()
  );
}

/** Real inbox used for Firma draft-preview signing (override via env in non-prod). */
export function getDraftPreviewFirmaSignerEmailFallback(): string {
  const fromEnv =
    process.env.DRAFT_PREVIEW_FIRMA_SIGNER_EMAIL?.trim() ||
    process.env.FIRMA_DRAFT_PREVIEW_SIGNER_EMAIL?.trim();
  return fromEnv || DRAFT_PREVIEW_FIRMA_SIGNER_EMAIL_FALLBACK;
}

export function resolveDraftPreviewFirmaSignerEmail(override?: string | null): string {
  const trimmed = override?.trim();
  if (trimmed && !isUndeliverableDraftPreviewEmail(trimmed)) {
    return trimmed;
  }
  return getDraftPreviewFirmaSignerEmailFallback();
}

export function isDraftPreviewApplicantId(applicantId: string | null | undefined): boolean {
  return applicantId?.trim() === DRAFT_PREVIEW_APPLICANT_ID;
}

/** Synthetic resume ids from Test workflow uploads (`draft-preview-<uuid>`). */
export function isDraftPreviewResumeId(resumeId: string | null | undefined): boolean {
  const value = resumeId?.trim() ?? "";
  return value === DRAFT_PREVIEW_APPLICANT_ID || value.startsWith(`${DRAFT_PREVIEW_APPLICANT_ID}-`);
}

/**
 * Admin builder Test workflow / draft preview (`?preview=draft` or `?mode=test`).
 * No live applicant anonymous session or production worker is required.
 */
export function isOnboardingDraftPreview(search?: string | null): boolean {
  if (typeof search !== "string" || !search.trim()) {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("preview") === "draft" ||
      params.get("mode")?.trim().toLowerCase() === "test"
    );
  }
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  return (
    params.get("preview") === "draft" ||
    params.get("mode")?.trim().toLowerCase() === "test"
  );
}
