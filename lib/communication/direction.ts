export type CommunicationDirection = "inbound" | "outbound";

export function communicationDirectionFromRow(row: {
  direction?: string | null;
  sent_by_user_id?: string | null;
  subject?: string | null;
  channel?: string | null;
}): CommunicationDirection {
  const stored = row.direction?.trim().toLowerCase();
  if (stored === "inbound" || stored === "outbound") return stored;

  if (row.sent_by_user_id) return "outbound";

  const subject = row.subject?.trim().toLowerCase() ?? "";
  if (subject.startsWith("inbound")) return "inbound";

  return "inbound";
}
