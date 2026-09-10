import { parseCityStateLocation } from "@/lib/location/city-state";
import { getStateCodeFromName, getStateNameFromCode } from "@/lib/us-state-names";

const ZIP_RE = /^(\d{5})(?:-\d{4})?$/;

export function normalizeStateCode(raw: string | null | undefined): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const code = trimmed.toUpperCase();
    return getStateNameFromCode(code) ? code : "";
  }
  return getStateCodeFromName(trimmed) ?? "";
}

export function normalizeCityKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizePostalCode(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(0, 5);
  const match = String(raw ?? "").trim().match(ZIP_RE);
  return match?.[1] ?? "";
}

export function normalizeRemoteStates(states: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  for (const item of states ?? []) {
    const code = normalizeStateCode(item);
    if (code) seen.add(code);
  }
  return Array.from(seen);
}

export function locationFromFreeText(
  raw: string | null | undefined,
  postalCode?: string | null
): { city: string; state: string; postalCode: string } {
  const parsed = parseCityStateLocation(raw);
  return {
    city: parsed.city,
    state: parsed.stateCode,
    postalCode: normalizePostalCode(postalCode) || parsed.zipCode || "",
  };
}
