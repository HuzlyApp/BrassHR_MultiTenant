import { describe, expect, it } from "vitest";
import {
  PROFILE_MATCH_RING_GREEN,
  PROFILE_MATCH_RING_ORANGE,
  PROFILE_MATCH_RING_RED,
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
