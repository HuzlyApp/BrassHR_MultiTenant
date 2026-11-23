import { describe, expect, it } from "vitest";
import {
  addDaysToIsoDate,
  formatEmployeeShiftOverlapMessage,
  formatShiftRange,
  parseEmployeeScheduleShiftInput,
  shiftsOverlap,
} from "./employee-schedule";

describe("parseEmployeeScheduleShiftInput", () => {
  const valid = {
    title: "Warehouse",
    workerId: "emp-1",
    workDate: "2026-11-09",
    startTime: "08:00",
    endTime: "17:00",
    facilityId: "fac-1",
    ratePerHour: "25.5",
    notes: "  Dock 2  ",
  };

  it("normalizes a week-view shift", () => {
    const parsed = parseEmployeeScheduleShiftInput(valid);
    expect(parsed).toEqual({
      ok: true,
      value: {
        workerId: "emp-1",
        facilityId: "fac-1",
        departmentId: null,
        workDate: "2026-11-09",
        startTime: "08:00:00",
        endTime: "17:00:00",
        title: "Warehouse",
        ratePerHour: 25.5,
        notes: "Dock 2",
      },
    });
  });

  it("rejects a shift with no employee", () => {
    const parsed = parseEmployeeScheduleShiftInput({ ...valid, workerId: " " });
    expect(parsed).toEqual({ ok: false, error: "Select an employee for this shift." });
  });

  it("allows an overnight range and rejects equal times", () => {
    const overnight = parseEmployeeScheduleShiftInput({
      ...valid,
      startTime: "22:00:00",
      endTime: "06:00",
    });
    expect(overnight.ok).toBe(true);

    const same = parseEmployeeScheduleShiftInput({ ...valid, startTime: "08:00", endTime: "08:00" });
    expect(same).toEqual({ ok: false, error: "Start and end times must be different." });
  });
});

describe("formatShiftRange", () => {
  it("renders the clock labels used on the week grid", () => {
    expect(formatShiftRange("08:00:00", "17:00:00")).toBe("8:00 AM - 5:00 PM");
    expect(formatShiftRange("22:00:00", "06:00:00")).toBe("10:00 PM - 6:00 AM");
  });
});

describe("shiftsOverlap", () => {
  it("detects partial same-day overlap (BUG-124)", () => {
    expect(
      shiftsOverlap(
        { workDate: "2026-11-17", startTime: "09:00:00", endTime: "13:00:00" },
        { workDate: "2026-11-17", startTime: "11:00:00", endTime: "15:00:00" }
      )
    ).toBe(true);
  });

  it("allows back-to-back shifts that only touch at the boundary", () => {
    expect(
      shiftsOverlap(
        { workDate: "2026-11-17", startTime: "09:00:00", endTime: "13:00:00" },
        { workDate: "2026-11-17", startTime: "13:00:00", endTime: "17:00:00" }
      )
    ).toBe(false);
  });

  it("detects overnight overlap into the next morning", () => {
    expect(
      shiftsOverlap(
        { workDate: "2026-11-17", startTime: "22:00:00", endTime: "06:00:00" },
        { workDate: "2026-11-18", startTime: "05:00:00", endTime: "09:00:00" }
      )
    ).toBe(true);
  });

  it("formats a clear conflict message", () => {
    expect(
      formatEmployeeShiftOverlapMessage({
        title: "QA-TEST-Overlap-A",
        workDate: "2026-11-17",
        startTime: "09:00:00",
        endTime: "13:00:00",
      })
    ).toContain('already booked for "QA-TEST-Overlap-A"');
  });

  it("adds calendar days in UTC", () => {
    expect(addDaysToIsoDate("2026-11-17", -1)).toBe("2026-11-16");
    expect(addDaysToIsoDate("2026-11-17", 1)).toBe("2026-11-18");
  });
});
