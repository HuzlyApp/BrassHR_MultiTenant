import { describe, expect, it } from "vitest";
import { buildClockInRows, clockInMetrics, type ClockInAttendanceLog, type ClockInScheduleShift } from "./clock-ins";

const now = new Date("2026-11-07T18:00:00.000Z");

function shift(overrides: Partial<ClockInScheduleShift> = {}): ClockInScheduleShift {
  return {
    id: "shift-1",
    workerId: "employee-1",
    candidateId: "candidate-1",
    workDate: "2026-11-07",
    startTime: "08:00:00",
    endTime: "17:00:00",
    facilityName: "North Dock",
    departmentName: "Warehouse",
    employeeName: "Priya Shah",
    email: "priya@example.com",
    jobRole: "Warehouse Staff",
    ...overrides,
  };
}

function log(overrides: Partial<ClockInAttendanceLog> = {}): ClockInAttendanceLog {
  return {
    id: "log-1",
    workerId: "candidate-1",
    attendanceDate: "2026-11-07",
    status: "clocked_in",
    clockInAt: "2026-11-07T13:00:00.000Z",
    clockOutAt: null,
    totalSeconds: null,
    breakStartedAt: null,
    breakSeconds: 0,
    ...overrides,
  };
}

describe("buildClockInRows", () => {
  it("marks a scheduled employee with no log as not clocked in", () => {
    const [row] = buildClockInRows([shift()], [], now);
    expect(row.computed_status).toBe("Not Clocked In");
    expect(row.scheduled_shift).toBe("8:00 AM - 5:00 PM");
    expect(row.facility_name).toBe("North Dock");
    expect(row.department_name).toBe("Warehouse");
    expect(row.clock_in_formatted).toBe("—");
    expect(row.hours_formatted).toBe("0m");
    expect(row.worker_id).toBe("candidate-1");
  });

  it("pairs a same-day attendance log with the scheduled shift", () => {
    const [row] = buildClockInRows(
      [shift()],
      [log({ status: "clocked_out", clockOutAt: "2026-11-07T21:00:00.000Z", totalSeconds: 28800 })],
      now
    );
    expect(row.computed_status).toBe("Completed");
    expect(row.hours_formatted).toBe("8h");
    expect(row.from_schedule).toBe(true);
    expect(row.id).toBe("shift-1");
  });

  it("keeps an attendance log that has no schedule", () => {
    const [row] = buildClockInRows(
      [],
      [log({ breakStartedAt: "2026-11-07T17:00:00.000Z", employeeName: "Ana Ruiz", jobRole: "Clerk" })],
      now
    );
    expect(row.computed_status).toBe("On Break");
    expect(row.applicant_name).toBe("Ana Ruiz");
    expect(row.scheduled_shift).toBeNull();
    expect(row.from_schedule).toBe(false);
  });

  it("counts cards from the merged rows", () => {
    const rows = buildClockInRows(
      [shift(), shift({ id: "shift-2", candidateId: "candidate-2", employeeName: "Ana Ruiz" })],
      [log({ breakStartedAt: "2026-11-07T17:00:00.000Z" })],
      now
    );
    expect(clockInMetrics(rows)).toEqual({
      clockedIn: 0,
      notClockedIn: 1,
      onBreak: 1,
      totalScheduled: 2,
    });
  });

  it("pairs each same-day log to the closest scheduled shift", () => {
    const rows = buildClockInRows(
      [
        shift({ id: "morning", startTime: "08:00:00", endTime: "12:00:00" }),
        shift({ id: "evening", startTime: "16:00:00", endTime: "20:00:00" }),
      ],
      [
        log({
          id: "evening-log",
          clockInAt: "2026-11-07T21:05:00.000Z", // 4:05 PM ET
          status: "clocked_out",
          clockOutAt: "2026-11-08T01:00:00.000Z",
          totalSeconds: 14100,
        }),
        log({
          id: "morning-log",
          clockInAt: "2026-11-07T13:10:00.000Z", // 8:10 AM ET
          status: "clocked_out",
          clockOutAt: "2026-11-07T17:00:00.000Z",
          totalSeconds: 13800,
        }),
      ],
      now
    );

    const morning = rows.find((row) => row.id === "morning");
    const evening = rows.find((row) => row.id === "evening");
    expect(morning?.attendance_log_id).toBe("morning-log");
    expect(evening?.attendance_log_id).toBe("evening-log");
    expect(morning?.from_schedule).toBe(true);
    expect(evening?.from_schedule).toBe(true);
  });

  it("exposes the attendance log id for scheduled and unscheduled rows", () => {
    const [scheduled] = buildClockInRows([shift()], [log()], now);
    const [unscheduled] = buildClockInRows([], [log({ id: "orphan-log" })], now);
    expect(scheduled.attendance_log_id).toBe("log-1");
    expect(unscheduled.attendance_log_id).toBe("orphan-log");
    expect(unscheduled.id).toBe("orphan-log");
  });
});
