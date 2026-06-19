import type { FirmaTemplate } from "@/lib/firma/types";

/** Refresh Firma signed document URLs before they expire in the embed editor. */
export const FIRMA_DOCUMENT_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export function isFirmaDocumentUrlStale(
  firmaTemplate: Pick<FirmaTemplate, "document_url" | "document_url_expires_at">,
  nowMs = Date.now()
): boolean {
  if (!firmaTemplate.document_url) return true;

  const expiresAt = firmaTemplate.document_url_expires_at;
  if (!expiresAt) return false;

  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return true;

  return expiresMs <= nowMs + FIRMA_DOCUMENT_URL_REFRESH_BUFFER_MS;
}
