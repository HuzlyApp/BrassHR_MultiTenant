import { describe, expect, it } from "vitest";
import {
  PROFILE_MATCH_RING_GREEN,
  PROFILE_MATCH_RING_ORANGE,
  PROFILE_MATCH_RING_RED,
  formatMatchModelLabel,
  profileMatchRingColor,
} from "@/lib/jobs/match-analysis/display";

describe("profileMatchRingColor", () => {
  it("uses green-800 above 75%", () => {
    expect(profileMatchRingColor(76)).toBe(PROFILE_MATCH_RING_GREEN);
    expect(profileMatchRingColor(93)).toBe(PROFILE_MATCH_RING_GREEN);
  });

  it("uses orange from 50% through 75%", () => {
    expect(profileMatchRingColor(50)).toBe(PROFILE_MATCH_RING_ORANGE);
    expect(profileMatchRingColor(75)).toBe(PROFILE_MATCH_RING_ORANGE);
  });

  it("uses red below 50%", () => {
    expect(profileMatchRingColor(49)).toBe(PROFILE_MATCH_RING_RED);
    expect(profileMatchRingColor(0)).toBe(PROFILE_MATCH_RING_RED);
  });
});

describe("formatMatchModelLabel", () => {
  it("formats Gemini and Grok Deep Match ids", () => {
    expect(formatMatchModelLabel("gemini-3.1-pro-preview")).toBe("Gemini 3.1 Pro");
    expect(formatMatchModelLabel("grok-4.6")).toBe("Grok 4.6");
    expect(formatMatchModelLabel("grok-4.3")).toBe("Grok 4.3");
    expect(formatMatchModelLabel("grok-4-fast")).toBe("Grok 4 Fast");
  });
});
