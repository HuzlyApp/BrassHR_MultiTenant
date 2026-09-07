/**
 * Normalize free-text candidate search input before sending to the API/RPC.
 * Trims, collapses whitespace, and strips most punctuation (keeps @ + / . - for emails/phones).
 */
export function normalizeCandidateListSearchText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/[^\w\s@+/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits-only phone needle (empty if fewer than 3 digits). */
export function normalizeCandidateListSearchDigits(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 3 ? digits : "";
}
