import { describe, expect, it } from "vitest";
import {
  combineLocalDateAndTime,
  isoToScheduleFields,
  localDateString,
  localTimeString,
  scheduleRowToIso,
} from "@/lib/interviews/schedule-fields";

describe("schedule-fields", () => {
  it("round-trips local date and time fields", () => {
    const start = new Date(2026, 5, 12, 8, 0, 0);
    const end = new Date(2026, 5, 12, 8, 30, 0);
    const fields = isoToScheduleFields(start, end, "Asia/Manila");

    expect(fields.scheduled_date).toBe("2026-06-12");
    expect(fields.start_time).toBe("08:00:00");
    expect(fields.end_time).toBe("08:30:00");

    const { startsAt, endsAt } = scheduleRowToIso(
      fields.scheduled_date,
      fields.start_time,
      fields.end_time
    );
    expect(new Date(startsAt).getHours()).toBe(8);
    expect(new Date(endsAt!).getHours()).toBe(8);
    expect(new Date(endsAt!).getMinutes()).toBe(30);
  });

  it("formats local date and time strings", () => {
    const d = new Date(2026, 0, 5, 14, 5, 9);
    expect(localDateString(d)).toBe("2026-01-05");
    expect(localTimeString(d)).toBe("14:05:09");
    expect(combineLocalDateAndTime("2026-01-05", "14:05").getMinutes()).toBe(5);
  });
});
