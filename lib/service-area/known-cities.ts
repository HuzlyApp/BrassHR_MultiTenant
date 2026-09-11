import { US_CITIES_BY_STATE } from "@/lib/signup/us-cities-by-state";
import { NYC_CITY_ALIASES } from "@/lib/service-area/nyc";
import { normalizeCityKey, normalizeStateCode } from "@/lib/service-area/normalize";

export const PHASE1_RESTRICTED_STATES = ["CA", "IL", "CT"] as const;
export type Phase1RestrictedState = (typeof PHASE1_RESTRICTED_STATES)[number];

const GARBAGE_CITY_RE =
  /^(asdf+|qwer+|zxcv+|qwerty|foo|bar|baz|test|testing|xxx+|n\/a|n a|na|unknown|string|null|undefined|city|tbd|none|nope|lorem|ipsum|placeholder|sample|fake|zzz+|asdf)$/i;

/** New York State cities that are not NYC (Phase 1 allowed worksites). */
const NY_OUTSIDE_NYC = [
  "albany",
  "buffalo",
  "rochester",
  "syracuse",
  "yonkers",
  "new rochelle",
  "mount vernon",
  "schenectady",
  "utica",
  "ithaca",
  "binghamton",
  "niagara falls",
  "troy",
  "saratoga springs",
  "poughkeepsie",
  "white plains",
  "newburgh",
  "kingston",
  "plattsburgh",
  "watertown",
  "elmira",
  "jamestown",
  "rome",
  "auburn",
  "cortland",
  "oneonta",
  "geneva",
  "canandaigua",
  "lockport",
  "hempstead",
  "brookhaven",
  "islip",
  "oyster bay",
  "huntington",
  "smithtown",
  "southampton",
  "babylon",
  "north hempstead",
  "freeport",
  "valley stream",
  "uniondale",
  "hicksville",
  "levittown",
  "west seneca",
  "cheektowaga",
  "amherst",
  "tonawanda",
  "north tonawanda",
  "colonie",
  "guilderland",
  "bethlehem",
  "clay",
  "greece",
  "irondequoit",
  "henrietta",
  "hamburg",
];

const KNOWN_CITIES_BY_STATE: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(US_CITIES_BY_STATE).map(([state, cities]) => [
    state,
    new Set(cities.map((city) => normalizeCityKey(city))),
  ])
);

for (const city of NY_OUTSIDE_NYC) {
  KNOWN_CITIES_BY_STATE.NY?.add(normalizeCityKey(city));
}

export function isPhase1RestrictedState(state: string | null | undefined): boolean {
  const code = normalizeStateCode(state);
  return (PHASE1_RESTRICTED_STATES as readonly string[]).includes(code);
}

export function isPlausibleCityName(raw: string | null | undefined): boolean {
  const trimmed = String(raw ?? "").trim();
  const key = normalizeCityKey(trimmed);
  if (key.length < 2) return false;
  if (GARBAGE_CITY_RE.test(key) || GARBAGE_CITY_RE.test(key.replace(/\s+/g, ""))) return false;
  const letters = key.replace(/[^a-z]/g, "");
  if (letters.length < 2) return false;
  if (!/[aeiouy]/.test(letters)) return false;
  if (/(.)\1{4,}/.test(key)) return false;
  return /^[a-z][a-z0-9 .'-]*$/i.test(trimmed);
}

export function isKnownUsCity(city: string | null | undefined, state: string | null | undefined): boolean {
  const code = normalizeStateCode(state);
  const key = normalizeCityKey(city);
  if (!code || !key) return false;
  return Boolean(KNOWN_CITIES_BY_STATE[code]?.has(key));
}

export function isKnownNyOutsideNyc(city: string | null | undefined): boolean {
  const key = normalizeCityKey(city);
  if (!key || NYC_CITY_ALIASES.has(key)) return false;
  return Boolean(KNOWN_CITIES_BY_STATE.NY?.has(key));
}

/**
 * Onsite/hybrid city that cannot be classified as a real worksite.
 * Restricted whole states skip this (the hold applies regardless of city quality).
 * Empty city is handled as incomplete elsewhere so remote state-only eval can run.
 */
export function isUnverifiableWorkCity(input: {
  city?: string | null;
  state?: string | null;
}): boolean {
  const state = normalizeStateCode(input.state);
  const city = String(input.city ?? "").trim();
  if (!state || !city) return false;
  if (isPhase1RestrictedState(state)) return false;
  if (state === "NY") {
    if (NYC_CITY_ALIASES.has(normalizeCityKey(city))) return false;
    if (isKnownNyOutsideNyc(city)) return false;
    return true;
  }
  if (isKnownUsCity(city, state)) return false;
  return !isPlausibleCityName(city);
}
