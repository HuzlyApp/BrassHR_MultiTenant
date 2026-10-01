import { describe, expect, it } from "vitest";
import { analysisPromptIsStale, storedAnalysisPromptStamp } from "./prompt-stamp";

describe("stored analysis prompt stamp", () => {
  it("reads the hash saved with an analysis and ignores unknown variants", () => {
    expect(
      storedAnalysisPromptStamp({
        prompt_content_hash: "abc123",
        prompt_variant_key: "quick",
      })
    ).toEqual({ contentHash: "abc123", variantKey: "quick" });
    expect(
      storedAnalysisPromptStamp({
        prompt_content_hash: "abc123",
        prompt_variant_key: "not-a-variant",
      }).variantKey
    ).toBeNull();
    expect(storedAnalysisPromptStamp(null)).toEqual({ contentHash: null, variantKey: null });
  });

  it("treats a changed hash as stale and leaves rows that predate the hash", () => {
    expect(analysisPromptIsStale("old-hash", "new-hash")).toBe(true);
    expect(analysisPromptIsStale("same", "same")).toBe(false);
    expect(analysisPromptIsStale(null, "new-hash")).toBe(false);
    expect(analysisPromptIsStale("old-hash", null)).toBe(false);
  });
});
