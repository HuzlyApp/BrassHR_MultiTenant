/**
 * Build the stored ticket_number value from a UUID (no leading #).
 * Matches DB trigger / backfill: first 7 hex chars → XX-XXXXX.
 */
export function buildSupportTicketNumber(id: string): string {
  const compact = id.replace(/-/g, "").slice(0, 7).toUpperCase();
  if (compact.length < 3) {
    return id.replace(/-/g, "").slice(0, 8).toUpperCase();
  }
  return `${compact.slice(0, 2)}-${compact.slice(2)}`;
}

/** Display label with leading #. Falls back to UUID-derived code if missing. */
export function formatSupportTicketNumber(
  ticketNumber: string | null | undefined,
  fallbackId?: string | null
): string {
  const stored = ticketNumber?.trim();
  if (stored) {
    return stored.startsWith("#") ? stored.toUpperCase() : `#${stored.toUpperCase()}`;
  }
  if (fallbackId?.trim()) {
    return `#${buildSupportTicketNumber(fallbackId)}`;
  }
  return "—";
}
