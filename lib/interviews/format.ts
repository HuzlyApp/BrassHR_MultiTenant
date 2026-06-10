export type AppointmentStatus = "requested" | "confirmed" | "rescheduled" | "cancelled";
export type MeetingType = "online" | "phone" | "in_person";

export function interviewOrdinalTitle(sequence: number): string {
  if (sequence <= 1) return "Initial Interview";
  if (sequence === 2) return "2nd Interview";
  if (sequence === 3) return "3rd Interview";
  return `${sequence}th Interview`;
}

export function formatInterviewDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatInterviewTimeRange(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined
): string {
  if (!startsAt) return "—";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "—";
  const startLabel = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  if (!endsAt) return startLabel;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return startLabel;
  const endLabel = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${startLabel} - ${endLabel}`;
}

export function formatSlotLabel(startsAt: string, endsAt: string | null): string {
  return formatInterviewTimeRange(startsAt, endsAt);
}

export function applicantDisplayName(first: string | null, last: string | null): string {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name || "Unnamed applicant";
}
