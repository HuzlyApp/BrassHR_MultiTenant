import { describe, expect, it } from "vitest";
import { nullableCount } from "@/lib/analytics/recruiter-productivity-kpis";

describe("recruiter productivity kpi helpers", () => {
  it("returns null for zero counts so UI can show N/A", () => {
    expect(nullableCount(0)).toBeNull();
    expect(nullableCount(3)).toBe(3);
  });
});
