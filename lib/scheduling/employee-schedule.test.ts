import { describe, expect, it } from "vitest";
import { formatShiftRange, parseEmployeeScheduleShiftInput } from "./employee-schedule";

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
