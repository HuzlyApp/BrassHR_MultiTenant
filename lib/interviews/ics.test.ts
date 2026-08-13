import { describe, expect, it } from "vitest";
import {
  buildInterviewCalendarUid,
  buildInterviewIcs,
  escapeIcsText,
  formatIcsLocalDateTime,
} from "./ics";

describe("interview ics", () => {
  it("escapes special characters for iCalendar fields", () => {
    expect(escapeIcsText("Hello, world;\nline two")).toBe("Hello\\, world\\;\\nline two");
  });

  it("formats local date/time compact values", () => {
    expect(formatIcsLocalDateTime("2026-08-18", "10:00:00")).toBe("20260818T100000");
  });

  it("builds a stable UID from interview id", () => {
    expect(buildInterviewCalendarUid("abc-123")).toBe("brass-interview-abc-123@brasshr.com");
  });

  it("generates REQUEST invitation with attendees and organizer", () => {
    const ics = buildInterviewIcs({
      uid: "brass-interview-123@brasshr.com",
      sequence: 0,
      method: "REQUEST",
      status: "CONFIRMED",
      startDate: "2026-08-18",
      startTime: "10:00:00",
      endDate: "2026-08-18",
      endTime: "10:45:00",
      timezone: "America/Chicago",
      summary: "Interview with Priya Shah",
      description: "Technical interview",
      location: "https://meet.google.com/abc-defg-hij",
      organizer: { name: "Jane Recruiter", email: "jane@example.com" },
      attendees: [
        { name: "Priya Shah", email: "priya@example.com" },
        { name: "John Smith", email: "john@example.com" },
      ],
    });

    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("UID:brass-interview-123@brasshr.com");
    expect(ics).toContain("SEQUENCE:0");
    expect(ics).toContain("DTSTART;TZID=America/Chicago:20260818T100000");
    expect(ics).toContain("ORGANIZER;CN=Jane Recruiter:mailto:jane@example.com");
    expect(ics).toContain("ATTENDEE");
    expect(ics).toContain("mailto:priya@example.com");
  });

  it("generates CANCEL invitation with incremented sequence", () => {
    const ics = buildInterviewIcs({
      uid: "brass-interview-123@brasshr.com",
      sequence: 2,
      method: "CANCEL",
      status: "CANCELLED",
      startDate: "2026-08-18",
      startTime: "14:00:00",
      endDate: "2026-08-18",
      endTime: "14:45:00",
      timezone: "America/Chicago",
      summary: "Interview with Priya Shah",
      description: "Cancelled",
      organizer: { name: "Jane Recruiter", email: "jane@example.com" },
      attendees: [{ name: "Priya Shah", email: "priya@example.com" }],
    });

    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain("UID:brass-interview-123@brasshr.com");
  });
});
