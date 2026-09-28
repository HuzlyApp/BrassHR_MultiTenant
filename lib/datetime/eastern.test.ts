import { describe, expect, it } from "vitest";
import {
  EASTERN_TIME_ZONE,
  easternDateString,
  easternTimeString,
  easternWallClockToDate,
  formatEastern,
} from "./eastern";

describe("eastern time", () => {
  it("converts a winter wall-clock time to UTC", () => {
    const date = easternWallClockToDate(2026, 1, 15, 10, 0, 0);
    expect(date.toISOString()).toBe("2026-01-15T15:00:00.000Z");
    expect(easternDateString(date)).toBe("2026-01-15");
    expect(easternTimeString(date)).toBe("10:00:00");
  });

  it("converts a summer wall-clock time to UTC", () => {
    const date = easternWallClockToDate(2026, 7, 15, 10, 0, 0);
    expect(date.toISOString()).toBe("2026-07-15T14:00:00.000Z");
    expect(easternTimeString(date)).toBe("10:00:00");
  });

  it("formats instants in Eastern Time regardless of the host zone", () => {
    const label = formatEastern("2026-09-28T17:04:00.000Z", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    expect(label).toBe("Sep 28, 2026, 1:04 PM");
    expect(EASTERN_TIME_ZONE).toBe("America/New_York");
  });

  it("keeps a calendar date on that date", () => {
    expect(
      formatEastern("2026-09-28", { month: "long", day: "numeric", year: "numeric" })
    ).toBe("September 28, 2026");
  });
});
