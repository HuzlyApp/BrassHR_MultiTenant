type ErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

/** Turn Supabase / network errors into a user-visible API message. */
export function formatApiError(err: unknown): string {
  if (!err) return "Unexpected error";

  if (err instanceof Error) {
    const cause =
      err.cause instanceof Error ? err.cause.message : typeof err.cause === "string" ? err.cause : "";
    const combined = `${err.message} ${cause}`.trim();
    if (combined.toLowerCase().includes("connect timeout")) {
      return "Could not reach the database. Check your internet connection and try again.";
    }
    if (combined.toLowerCase().includes("fetch failed")) {
      return "Database request failed. Please try again in a moment.";
    }
    return combined || "Unexpected error";
  }

  if (typeof err === "object") {
    const row = err as ErrorLike;
    const parts = [row.message, row.details, row.hint].filter(
      (part) => typeof part === "string" && part.trim().length > 0
    ) as string[];
    if (parts.length) {
      const text = parts.join(" — ");
      if (text.toLowerCase().includes("connect timeout")) {
        return "Could not reach the database. Check your internet connection and try again.";
      }
      return text;
    }
  }

  return typeof err === "string" ? err : "Unexpected error";
}
