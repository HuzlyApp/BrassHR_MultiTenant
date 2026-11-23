type ErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

function sanitizeDbLeak(text: string, fallback: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("connect timeout")) {
    return "Could not reach the database. Check your internet connection and try again.";
  }
  if (lower.includes("fetch failed")) {
    return "Database request failed. Please try again in a moment.";
  }
  if (
    lower.includes("hours_per_week") ||
    lower.includes("pay_rate") ||
    (lower.includes("check constraint") && (lower.includes("pay") || lower.includes("hours")))
  ) {
    return "Pay rate and hours must be zero or greater.";
  }
  // Never surface raw Postgres/PostgREST internals (table, constraint, failing row).
  if (
    /violates\s+(check|unique|foreign key|not-null)\s+constraint/i.test(text) ||
    /\b(SQLSTATE|PGRST\d+)\b/i.test(text) ||
    /\bfailing row contains\b/i.test(text) ||
    /\b(relation|table|column)\s+"?[a-z0-9_]+"?/i.test(text)
  ) {
    return fallback;
  }
  return text;
}

/** Turn Supabase / network errors into a user-visible API message. */
export function formatApiError(err: unknown, fallback = "Unexpected error"): string {
  if (!err) return fallback;

  if (err instanceof Error) {
    const cause =
      err.cause instanceof Error ? err.cause.message : typeof err.cause === "string" ? err.cause : "";
    const combined = `${err.message} ${cause}`.trim();
    return sanitizeDbLeak(combined, fallback) || fallback;
  }

  if (typeof err === "object") {
    const row = err as ErrorLike;
    const parts = [row.message, row.details, row.hint].filter(
      (part) => typeof part === "string" && part.trim().length > 0
    ) as string[];
    if (parts.length) {
      return sanitizeDbLeak(parts.join(" — "), fallback);
    }
  }

  if (typeof err === "string") return sanitizeDbLeak(err, fallback);
  return fallback;
}
