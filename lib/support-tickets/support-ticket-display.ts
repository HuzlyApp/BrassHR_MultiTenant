/** Client-safe display helpers for support tickets (no Node.js imports). */

export function descriptionPreview(description: string | null, maxLength = 80): string {
  const text = (description ?? "").trim();
  if (!text) return "—";
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}
