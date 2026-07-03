import { describe, expect, it } from "vitest";
import {
  isApprovedPendingConversion,
  shouldExcludeFromApprovedCandidates,
} from "@/lib/workers/candidate-conversion-filter";

describe("candidate conversion filter", () => {
  it("includes approved candidates without employment records", () => {
    expect(isApprovedPendingConversion("approved", false)).toBe(true);
  });

  it("excludes converted candidates from approved pending list", () => {
    expect(isApprovedPendingConversion("approved", true)).toBe(false);
    expect(isApprovedPendingConversion("converted", false)).toBe(false);
    expect(shouldExcludeFromApprovedCandidates("converted", false)).toBe(true);
    expect(shouldExcludeFromApprovedCandidates("approved", true)).toBe(true);
  });
});
