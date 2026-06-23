import { describe, expect, it } from "vitest";
import {
  DRAFT_PREVIEW_APPLICANT_ID,
  isDraftPreviewApplicantId,
  isOnboardingDraftPreview,
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
