export type IcsMethod = "REQUEST" | "CANCEL";
export type IcsStatus = "CONFIRMED" | "CANCELLED";

export type IcsAttendee = {
  name: string;
  email: string;
  role?: "REQ-PARTICIPANT" | "OPT-PARTICIPANT";
};

export type IcsOrganizer = {
  name: string;
  email: string;
};

export type BuildInterviewIcsInput = {
  uid: string;
  sequence: number;
  method: IcsMethod;
  status: IcsStatus;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
  summary: string;
  description: string;
  location?: string | null;
  organizer: IcsOrganizer;
  attendees: IcsAttendee[];
};

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function formatIcsUtcTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function formatIcsLocalDateTime(date: string, time: string): string {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const [hours, minutes, seconds] = normalizedTime.split(":");
  const compactDate = date.replace(/-/g, "");
  return `${compactDate}T${hours}${minutes}${(seconds ?? "00").padStart(2, "0")}`;
}

export function buildInterviewCalendarUid(interviewId: string): string {
  return `brass-interview-${interviewId}@brasshr.com`;
}

export function buildInterviewIcs(input: BuildInterviewIcsInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brass HR//Interview Scheduling//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${input.method}`,
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${formatIcsUtcTimestamp(new Date())}`,
    `DTSTART;TZID=${escapeIcsText(input.timezone)}:${formatIcsLocalDateTime(input.startDate, input.startTime)}`,
    `DTEND;TZID=${escapeIcsText(input.timezone)}:${formatIcsLocalDateTime(input.endDate, input.endTime)}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
  ];

  if (input.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(input.location.trim())}`);
  }

  lines.push(
    `ORGANIZER;CN=${escapeIcsText(input.organizer.name)}:mailto:${input.organizer.email}`
  );

  for (const attendee of input.attendees) {
    const email = attendee.email.trim().toLowerCase();
    if (!email) continue;
    lines.push(
      `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=${attendee.role ?? "REQ-PARTICIPANT"};PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${escapeIcsText(attendee.name)}:mailto:${email}`
    );
  }

  lines.push(`STATUS:${input.status}`, `SEQUENCE:${input.sequence}`, "END:VEVENT", "END:VCALENDAR");

  return `${lines.join("\r\n")}\r\n`;
}

export const COMMON_INTERVIEW_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
] as const;

export function formatTimezoneLabel(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longGeneric",
    }).formatToParts(new Date());
    const label = parts.find((part) => part.type === "timeZoneName")?.value;
    return label ? `${label} (${timezone})` : timezone;
  } catch {
    return timezone;
  }
}
