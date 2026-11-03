import { describe, expect, it } from "vitest";
import { parsePreset, resolvePeriod } from "@/lib/analytics/period";

describe("period", () => {
  it("defaults unknown presets to last_7_days", () => {
    expect(parsePreset("nope")).toBe("last_7_days");
  });

  it("resolves last_7_days with previous equivalent window", () => {
    const now = new Date("2026-11-04T15:00:00.000Z");
    const period = resolvePeriod("last_7_days", { now });
    expect(period.preset).toBe("last_7_days");
    expect(period.previousEnd.getTime()).toBeLessThan(period.start.getTime());
    expect(period.end.getTime()).toBeGreaterThan(period.start.getTime());
  });
});
