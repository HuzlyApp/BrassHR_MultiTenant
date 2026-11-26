/** Preserve last four characters; short identifiers must not be revealed in full. */
export function maskSensitiveIdentifier(value: unknown, lastFour?: unknown): string | null {
  if (typeof lastFour === "string" && lastFour.length === 4) return `\u2022\u2022\u2022\u2022${lastFour}`;
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  return text.length <= 4 ? "••••" : `••••${text.slice(-4)}`;
}
