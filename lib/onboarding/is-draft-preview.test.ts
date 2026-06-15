import { describe, expect, it } from "vitest";
import { isOnboardingDraftPreview } from "./is-draft-preview";

describe("isOnboardingDraftPreview", () => {
  it("detects draft preview query param", () => {
    expect(isOnboardingDraftPreview("?tenant=remotecompany&preview=draft")).toBe(true);
    expect(isOnboardingDraftPreview("tenant=acme&preview=published")).toBe(false);
    expect(isOnboardingDraftPreview("")).toBe(false);
  });
});
