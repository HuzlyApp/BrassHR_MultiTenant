import { describe, expect, it } from "vitest";
import { splitRegularAndOvertimeMinutes } from "./sync-from-attendance";

describe("splitRegularAndOvertimeMinutes", () => {
  it("keeps a short day entirely regular", () => {
    expect(splitRegularAndOvertimeMinutes(7 * 60)).toEqual({
      regular_minutes: 420,
      overtime_minutes: 0,
    });
  });

  it("splits anything over 8 hours into overtime", () => {
    expect(splitRegularAndOvertimeMinutes(9 * 60 + 15)).toEqual({
      regular_minutes: 480,
      overtime_minutes: 75,
    });
  });

  it("clamps invalid or oversized values", () => {
    expect(splitRegularAndOvertimeMinutes(-10)).toEqual({
      regular_minutes: 0,
      overtime_minutes: 0,
    });
    expect(splitRegularAndOvertimeMinutes(2000)).toEqual({
      regular_minutes: 480,
      overtime_minutes: 960,
    });
  });
});
