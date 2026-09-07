import {
  US_STATE_CODE_TO_NAME,
  US_STATE_NAME_TO_CODE,
} from "@/lib/us-state-names";

export type ParsedCityStateLocation = {
  city: string;
  /** Two-letter US state/territory code when recognized. */
  stateCode: string;
  stateName: string;
  /** Extracted ZIP when present in the free-text string (not part of display). */
  zipCode: string | null;
  /** Canonical picklist / card label: "City, ST". */
  display: string;
  /** Case-insensitive dedupe key. */
  key: string;
};

const WORK_TYPE_FRAGMENT_RE =
  /\b(?:on[\s-]?site|in[\s-]?person|remote|hybrid)\b/gi;

const WORK_TYPE_PAREN_RE =
  /\s*[([].*?\b(?:on[\s-]?site|in[\s-]?person|remote|hybrid)\b.*?[)\]]\s*/gi;

const ZIP_RE = /\b(\d{5})(?:-\d{4})?\b/;

const STATE_NAME_TO_CODE_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_NAME_TO_CODE).map(([name, code]) => [name.toLowerCase(), code])
);

function titleCaseCity(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z]{2,}$/.test(word) && word.length <= 3) return word;
      if (/^[A-Za-z]\.[A-Za-z]\.?$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Strip bullets, colons, parens, and other decorative prefixes/suffixes from free-text places. */
function stripDecorativeNoise(raw: string): string {
  return raw
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .replace(/[^\p{L}\p{N}.]+$/gu, "")
    .trim();
}

function cleanLocationPart(part: string): string {
  return stripDecorativeNoise(
    part
      .replace(/^[^\p{L}\p{N}]+/gu, "")
      .replace(/[^\p{L}\p{N}.]+$/gu, "")
      .trim()
  );
}

function stripWorkTypeNoise(raw: string): string {
  return stripDecorativeNoise(
    raw
      .replace(WORK_TYPE_PAREN_RE, " ")
      .replace(WORK_TYPE_FRAGMENT_RE, " ")
      .replace(/[-–—|/]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/\s*,\s*,+/g, ",")
      .trim()
      .replace(/^[,.\s·•●◦:;\-–—|/\\([{<"']+|[,.\s·•●◦:;\-–—|/\\)}\]>"']+$/gu, "")
      .trim()
  );
}

function normalizeCountryKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function isCountryPart(value: string): boolean {
  const key = normalizeCountryKey(value);
  return (
    key === "us" ||
    key === "usa" ||
    key === "united states" ||
    key === "united states of america"
  );
}

function resolveState(value: string): { code: string; name: string } | null {
  const cleaned = value.trim().replace(/\./g, "");
  if (!cleaned) return null;

  if (/^[A-Za-z]{2}$/.test(cleaned)) {
    const code = cleaned.toUpperCase();
    const name = US_STATE_CODE_TO_NAME[code];
    if (name) return { code, name };
  }

  const byName = STATE_NAME_TO_CODE_LOWER[cleaned.toLowerCase()];
  if (byName) {
    return { code: byName, name: US_STATE_CODE_TO_NAME[byName] ?? cleaned };
  }

  return null;
}

function emptyParsed(): ParsedCityStateLocation {
  return {
    city: "",
    stateCode: "",
    stateName: "",
    zipCode: null,
    display: "",
    key: "",
  };
}

/**
 * Parse free-text job/candidate place strings into City + State (+ optional ZIP).
 * Strips country suffixes (USA / United States) and work-type noise (Remote / Hybrid / On-site).
 */
export function parseCityStateLocation(
  raw: string | null | undefined
): ParsedCityStateLocation {
  if (!raw?.trim()) return emptyParsed();

  let text = stripWorkTypeNoise(raw.trim());
  if (!text) return emptyParsed();

  let zipCode: string | null = null;
  const zipMatch = text.match(ZIP_RE);
  if (zipMatch?.[1]) {
    zipCode = zipMatch[1];
    text = text.replace(ZIP_RE, " ").replace(/\s{2,}/g, " ").trim();
  }

  const parts = text
    .split(",")
    .map((part) => cleanLocationPart(part))
    .filter(Boolean)
    .filter((part) => !isCountryPart(part));

  if (!parts.length) {
    return {
      ...emptyParsed(),
      zipCode,
    };
  }

  let stateCode = "";
  let stateName = "";
  let cityParts = [...parts];

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const state = resolveState(parts[i] ?? "");
    if (!state) continue;
    stateCode = state.code;
    stateName = state.name;
    // Prefer the segment immediately before the state as city (drop street/area prefixes).
    cityParts = i > 0 ? [parts[i - 1] ?? ""] : [];
    break;
  }

  // "Richmond Texas" without comma, or leftover "TX" glued to city token.
  if (!stateCode && cityParts.length === 1) {
    const tokens = (cityParts[0] ?? "").split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const maybeState = resolveState(tokens[tokens.length - 1] ?? "");
      if (maybeState) {
        stateCode = maybeState.code;
        stateName = maybeState.name;
        cityParts = [tokens.slice(0, -1).join(" ")];
      }
    }
  }

  const city = titleCaseCity(cleanLocationPart(cityParts.join(", ").trim()));
  const display =
    city && stateCode
      ? `${city}, ${stateCode}`
      : city
        ? city
        : stateCode
          ? stateCode
          : "";

  return {
    city,
    stateCode,
    stateName,
    zipCode,
    display,
    key: display.toLowerCase().replace(/[^a-z0-9,]+/g, " ").replace(/\s+/g, " ").trim(),
  };
}

/** Canonical "City, ST" label for picklists and cards. */
export function formatCityState(raw: string | null | undefined): string {
  return parseCityStateLocation(raw).display;
}

export function cityStateMatchKey(raw: string | null | undefined): string {
  return parseCityStateLocation(raw).key;
}

export function locationsMatchCityState(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = cityStateMatchKey(left);
  const b = cityStateMatchKey(right);
  if (!a || !b) return false;
  return a === b;
}

/** Deduped, sorted City/ST options for location filters. */
export function uniqueCityStateOptions(
  rawLocations: Array<string | null | undefined>
): string[] {
  const byKey = new Map<string, string>();
  for (const raw of rawLocations) {
    const parsed = parseCityStateLocation(raw);
    if (!parsed.display || !parsed.key) continue;
    if (!byKey.has(parsed.key)) byKey.set(parsed.key, parsed.display);
  }
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Normalize a location for persistence: City, ST only.
 * ZIP is returned separately so callers can store it on a dedicated field.
 * Prefer this for list/filter display helpers; job create/edit uses
 * {@link normalizeJobFormLocationForStorage} to keep street/area + full state name.
 */
export function normalizeLocationForStorage(raw: string | null | undefined): {
  location: string | null;
  zipCode: string | null;
} {
  const parsed = parseCityStateLocation(raw);
  return {
    location: parsed.display || null,
    zipCode: parsed.zipCode,
  };
}

/**
 * Job create/edit location: keep street/area + city + full state name.
 * Strips ZIP (returned separately) and country (United States / USA / US).
 * Example: "Old Dekalb Pike, King of Prussia, Pennsylvania 19406, United States"
 *        → location "Old Dekalb Pike, King of Prussia, Pennsylvania", zip "19406"
 */
export function normalizeJobFormLocationForStorage(
  raw: string | null | undefined
): {
  location: string | null;
  zipCode: string | null;
} {
  if (!raw?.trim()) return { location: null, zipCode: null };

  let text = stripWorkTypeNoise(raw.trim());
  if (!text) return { location: null, zipCode: null };

  let zipCode: string | null = null;
  const zipMatch = text.match(ZIP_RE);
  if (zipMatch?.[1]) {
    zipCode = zipMatch[1];
    text = text.replace(ZIP_RE, " ").replace(/\s{2,}/g, " ").trim();
  }

  const parts = text
    .split(",")
    .map((part) => cleanLocationPart(part))
    .filter(Boolean)
    .filter((part) => !isCountryPart(part));

  if (!parts.length) {
    return { location: null, zipCode };
  }

  let stateName = "";
  let beforeState = [...parts];

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const state = resolveState(parts[i] ?? "");
    if (!state) continue;
    stateName = state.name;
    beforeState = parts.slice(0, i);
    break;
  }

  // "Dallas Texas" without comma
  if (!stateName && beforeState.length === 1) {
    const tokens = (beforeState[0] ?? "").split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const maybeState = resolveState(tokens[tokens.length - 1] ?? "");
      if (maybeState) {
        stateName = maybeState.name;
        beforeState = [tokens.slice(0, -1).join(" ")];
      }
    }
  }

  const locationParts = [
    ...beforeState.map((part) => part.trim()).filter(Boolean),
    ...(stateName ? [stateName] : []),
  ];
  const location = locationParts.join(", ").replace(/\s{2,}/g, " ").trim();

  return {
    location: location || null,
    zipCode,
  };
}

/** Format structured city + state (+ optional zip kept out of the label). */
export function formatCityStateFromParts(
  city: string | null | undefined,
  state: string | null | undefined
): string {
  const cityPart = (city ?? "").trim();
  const statePart = (state ?? "").trim();
  if (!cityPart && !statePart) return "";
  if (!statePart) return titleCaseCity(cityPart);
  const resolved = resolveState(statePart);
  const code = resolved?.code ?? (statePart.length === 2 ? statePart.toUpperCase() : statePart);
  if (!cityPart) return code;
  return `${titleCaseCity(cityPart)}, ${code}`;
}
