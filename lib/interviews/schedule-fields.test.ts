import { describe, expect, it } from "vitest";
import { easternWallClockToDate } from "@/lib/datetime/eastern";
import {
  combineLocalDateAndTime,
  isoToScheduleFields,
  localDateString,
  localTimeString,
  scheduleRowToIso,
} from "@/lib/interviews/schedule-fields";

describe("schedule-fields", () => {
  it("stores interview times as Eastern wall-clock and round-trips the instant", () => {
    const start = easternWallClockToDate(2026, 1, 15, 10, 0, 0);
    const end = easternWallClockToDate(2026, 1, 15, 10, 30, 0);
    const fields = isoToScheduleFields(start, end, "Asia/Manila");

    expect(fields.timezone).toBe("America/New_York");
    expect(fields.scheduled_date).toBe("2026-01-15");
    expect(fields.start_time).toBe("10:00:00");
    expect(fields.end_time).toBe("10:30:00");

    const { startsAt, endsAt } = scheduleRowToIso(
      fields.scheduled_date,
      fields.start_time,
      fields.end_time
    );
    expect(startsAt).toBe(start.toISOString());
    expect(endsAt).toBe(end.toISOString());
  });

  it("formats eastern date and time strings from an absolute instant", () => {
    const d = new Date("2026-01-15T15:05:09.000Z");
    expect(localDateString(d)).toBe("2026-01-15");
    expect(localTimeString(d)).toBe("10:05:09");
    expect(combineLocalDateAndTime("2026-01-15", "14:05").toISOString()).toBe(
      "2026-01-15T19:05:00.000Z"
    );
  });
});
