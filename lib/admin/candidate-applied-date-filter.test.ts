import { describe, expect, it } from "vitest";
import {
  matchesCandidateAppliedDateRange,
  toCandidateAppliedDateYmd,
} from "./candidate-applied-date-filter";

describe("toCandidateAppliedDateYmd", () => {
  it("formats valid ISO timestamps", () => {
    expect(toCandidateAppliedDateYmd("2026-09-01T12:00:00.000Z")).toMatch(/^2026-09-0[12]$/);
  });

  it("returns null for invalid values", () => {
    expect(toCandidateAppliedDateYmd(null)).toBeNull();
    expect(toCandidateAppliedDateYmd("invalid")).toBeNull();
  });
});

describe("matchesCandidateAppliedDateRange", () => {
  const iso = "2026-09-15T10:00:00.000Z";

  it("matches when inside inclusive range", () => {
    expect(matchesCandidateAppliedDateRange(iso, "2026-09-01", "2026-09-30")).toBe(true);
  });

  it("rejects dates before from", () => {
    expect(matchesCandidateAppliedDateRange(iso, "2026-09-20", "")).toBe(false);
  });

  it("rejects dates after to", () => {
    expect(matchesCandidateAppliedDateRange(iso, "", "2026-09-10")).toBe(false);
  });

  it("allows open-ended ranges", () => {
    expect(matchesCandidateAppliedDateRange(iso, "2026-09-01", "")).toBe(true);
    expect(matchesCandidateAppliedDateRange(iso, "", "2026-09-30")).toBe(true);
  });
});
