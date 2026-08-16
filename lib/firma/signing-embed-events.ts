import { getFirmaSigningAppUrl } from "@/lib/firma/signing-branding-proxy";

const COMPLETE_TYPES = new Set([
  "signing.completed",
  "firma:signing:completed",
]);

const DECLINE_TYPES = new Set([
  "signing.declined",
  "firma:signing:declined",
]);

export function isFirmaSigningCompletePath(pathname: string): boolean {
  return /\/signing\/[^/?#]+\/complete\/?$/i.test(pathname.trim());
}

export function isAllowedFirmaSigningMessageOrigin(
  origin: string,
  origins: { pageOrigin: string; firmaAppOrigin?: string }
): boolean {
  const incoming = origin.trim().replace(/\/$/, "");
  if (!incoming) return false;
  const page = origins.pageOrigin.trim().replace(/\/$/, "");
  const firma = (origins.firmaAppOrigin ?? getFirmaSigningAppUrl()).trim().replace(/\/$/, "");
  return incoming === page || incoming === firma;
}

function eventTypeFromData(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  if (typeof record.type === "string" && record.type.trim()) return record.type.trim();
  if (typeof record.event === "string" && record.event.trim()) return record.event.trim();
  return "";
}

export function isFirmaSigningCompletedMessage(data: unknown): boolean {
  return COMPLETE_TYPES.has(eventTypeFromData(data));
}

export function isFirmaSigningDeclinedMessage(data: unknown): boolean {
  return DECLINE_TYPES.has(eventTypeFromData(data));
}

export function parseFirmaSigningEmbedMessage(
  event: { origin: string; data: unknown },
  origins: { pageOrigin: string; firmaAppOrigin?: string }
): "completed" | "declined" | null {
  if (!isAllowedFirmaSigningMessageOrigin(event.origin, origins)) return null;
  if (isFirmaSigningCompletedMessage(event.data)) return "completed";
  if (isFirmaSigningDeclinedMessage(event.data)) return "declined";
  return null;
}
