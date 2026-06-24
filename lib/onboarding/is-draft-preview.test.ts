import { describe, expect, it } from "vitest";
import {
  DRAFT_PREVIEW_APPLICANT_ID,
  DRAFT_PREVIEW_FIRMA_SIGNER_EMAIL_FALLBACK,
  getDraftPreviewFirmaSignerEmailFallback,
  isDraftPreviewApplicantId,
  isOnboardingDraftPreview,
  isUndeliverableDraftPreviewEmail,
  resolveDraftPreviewFirmaSignerEmail,
} from "./is-draft-preview";

describe("isOnboardingDraftPreview", () => {
  it("detects draft preview query param", () => {
    expect(isOnboardingDraftPreview("?tenant=remotecompany&preview=draft")).toBe(true);
    expect(isOnboardingDraftPreview("tenant=acme&preview=published")).toBe(false);
    expect(isOnboardingDraftPreview("")).toBe(false);
  });
});

describe("isDraftPreviewApplicantId", () => {
  it("recognizes the synthetic draft preview applicant id", () => {
    expect(isDraftPreviewApplicantId(DRAFT_PREVIEW_APPLICANT_ID)).toBe(true);
    expect(isDraftPreviewApplicantId("real-uuid")).toBe(false);
    expect(isDraftPreviewApplicantId(null)).toBe(false);
  });
});

describe("resolveDraftPreviewFirmaSignerEmail", () => {
  it("falls back from undeliverable placeholder to carl@taxequitypros.com", () => {
    expect(isUndeliverableDraftPreviewEmail("draft-preview@preview.brasshr.local")).toBe(true);
    expect(resolveDraftPreviewFirmaSignerEmail()).toBe(DRAFT_PREVIEW_FIRMA_SIGNER_EMAIL_FALLBACK);
    expect(resolveDraftPreviewFirmaSignerEmail("draft-preview@preview.brasshr.local")).toBe(
      DRAFT_PREVIEW_FIRMA_SIGNER_EMAIL_FALLBACK
    );
  });

  it("uses a deliverable override when provided", () => {
    expect(resolveDraftPreviewFirmaSignerEmail("preview@example.com")).toBe("preview@example.com");
  });

  it("respects DRAFT_PREVIEW_FIRMA_SIGNER_EMAIL env override", () => {
    process.env.DRAFT_PREVIEW_FIRMA_SIGNER_EMAIL = "custom@example.com";
    expect(getDraftPreviewFirmaSignerEmailFallback()).toBe("custom@example.com");
    delete process.env.DRAFT_PREVIEW_FIRMA_SIGNER_EMAIL;
  });
});
