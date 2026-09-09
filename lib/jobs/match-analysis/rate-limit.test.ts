import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  matchAnalysisRateLimitMessage,
  matchAnalysisRateLimitedResponse,
} from "./rate-limit";

describe("matchAnalysisRateLimitMessage", () => {
  it("rounds wait time up to whole minutes", () => {
    expect(matchAnalysisRateLimitMessage(1)).toBe(
      "Too many match analyses right now. Try again in 1 minute."
    );
    expect(matchAnalysisRateLimitMessage(61)).toBe(
      "Too many match analyses right now. Try again in 2 minutes."
    );
    expect(matchAnalysisRateLimitMessage(1621)).toBe(
      "Too many match analyses right now. Try again in 28 minutes."
    );
  });

  it("falls back to one hour when retry-after is missing", () => {
    expect(matchAnalysisRateLimitMessage(Number.NaN)).toBe(
      "Too many match analyses right now. Try again in 60 minutes."
    );
  });
});

describe("matchAnalysisRateLimitedResponse", () => {
  it("keeps non-429 limiter failures unchanged", () => {
    const unavailable = NextResponse.json({ error: "Rate limit unavailable" }, { status: 503 });
    expect(matchAnalysisRateLimitedResponse(unavailable)).toBe(unavailable);
  });
});
