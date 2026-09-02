/** `YYYY-MM-DD` in local time for candidate `created_at` filtering. */
export function toCandidateAppliedDateYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Inclusive applied-date range match (`dateFrom` / `dateTo` are `YYYY-MM-DD`). */
export function matchesCandidateAppliedDateRange(
  iso: string | null | undefined,
  dateFrom: string,
  dateTo: string
): boolean {
  const from = dateFrom.trim();
  const to = dateTo.trim();
  if (!from && !to) return true;

  const ymd = toCandidateAppliedDateYmd(iso);
  if (!ymd) return false;

  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
}
