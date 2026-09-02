/**
 * Postgres text and jsonb reject U+0000 (SQLSTATE 22P05:
 * "unsupported Unicode escape sequence" / "\\u0000 cannot be converted to text").
 * PDF extractors (pdf-parse) commonly embed NULs in resume text.
 */
export function stripNullBytes(text: string): string {
  return text.replace(/\u0000/g, "")
}

export function sanitizePostgresJson<T>(value: T): T {
  if (typeof value === "string") return stripNullBytes(value) as T
  if (Array.isArray(value)) return value.map((item) => sanitizePostgresJson(item)) as T
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[stripNullBytes(key)] = sanitizePostgresJson(nested)
    }
    return out as T
  }
  return value
}
