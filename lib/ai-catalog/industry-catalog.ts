/**
 * Authoritative user-facing industry catalog and industry → AI pack mapping.
 *
 * This module is the single application mapping source. Runtime prompt
 * resolution also reads the same mapping from the database; tests require
 * the two to stay identical.
 *
 * Do not duplicate these keys or pack mappings in unrelated files.
 */

export const USER_FACING_INDUSTRY_KEYS = [
  "healthcare",
  "home_care",
  "allied_health",
  "senior_care",
  "hospitality",
  "retail",
  "technology",
  "trades",
  "cleaning",
  "childcare",
  "nonprofit",
  "warehouse",
  "transportation",
  "professional",
  "beauty",
  "fitness",
  "other",
] as const;

export type UserFacingIndustryKey = (typeof USER_FACING_INDUSTRY_KEYS)[number];

export const AI_PACK_KEYS = [
  "global",
  "technology",
  "healthcare",
  "home_care",
  "hospitality",
  "childcare",
  "warehouse",
  "staffing",
  "msp",
] as const;

export type AiPackKey = (typeof AI_PACK_KEYS)[number];

/** Packs that may have dedicated Candidate Match prompt bodies. */
export const CANDIDATE_MATCH_PACK_KEYS = [
  "global",
  "technology",
  "healthcare",
  "home_care",
  "hospitality",
  "childcare",
  "warehouse",
] as const;

export type CandidateMatchPackKey = (typeof CANDIDATE_MATCH_PACK_KEYS)[number];

/** Delivery-only packs. Never used as Candidate Match industry fallbacks. */
export const DELIVERY_ONLY_PACK_KEYS = ["staffing", "msp"] as const;

export const INDUSTRY_TO_AI_PACK = {
  healthcare: "healthcare",
  home_care: "home_care",
  allied_health: "healthcare",
  senior_care: "healthcare",
  hospitality: "hospitality",
  retail: "hospitality",
  technology: "technology",
  trades: "global",
  cleaning: "warehouse",
  childcare: "childcare",
  nonprofit: "global",
  warehouse: "warehouse",
  transportation: "warehouse",
  professional: "global",
  beauty: "global",
  fitness: "hospitality",
  other: "global",
  global: "global",
} as const satisfies Record<UserFacingIndustryKey | "global", AiPackKey>;

export type IndustryMapKey = keyof typeof INDUSTRY_TO_AI_PACK;

export type IndustryCatalogEntry = {
  key: UserFacingIndustryKey;
  label: string;
  aiPackKey: (typeof INDUSTRY_TO_AI_PACK)[UserFacingIndustryKey];
  sortOrder: number;
  isActive: boolean;
  isUserFacing: boolean;
};

export const INDUSTRY_CATALOG: readonly IndustryCatalogEntry[] = [
  { key: "healthcare", label: "Healthcare", aiPackKey: "healthcare", sortOrder: 10, isActive: true, isUserFacing: true },
  { key: "home_care", label: "Home Care / Home Health", aiPackKey: "home_care", sortOrder: 20, isActive: true, isUserFacing: true },
  { key: "allied_health", label: "Allied Health", aiPackKey: "healthcare", sortOrder: 30, isActive: true, isUserFacing: true },
  { key: "senior_care", label: "Senior Care / Assisted Living", aiPackKey: "healthcare", sortOrder: 40, isActive: true, isUserFacing: true },
  { key: "hospitality", label: "Hospitality / Food Service", aiPackKey: "hospitality", sortOrder: 50, isActive: true, isUserFacing: true },
  { key: "retail", label: "Retail & Convenience Stores", aiPackKey: "hospitality", sortOrder: 60, isActive: true, isUserFacing: true },
  { key: "technology", label: "Technology / IT Services", aiPackKey: "technology", sortOrder: 70, isActive: true, isUserFacing: true },
  { key: "trades", label: "Construction & Trades", aiPackKey: "global", sortOrder: 80, isActive: true, isUserFacing: true },
  { key: "cleaning", label: "Cleaning & Janitorial Services", aiPackKey: "warehouse", sortOrder: 90, isActive: true, isUserFacing: true },
  { key: "childcare", label: "Education / Childcare / Daycare", aiPackKey: "childcare", sortOrder: 100, isActive: true, isUserFacing: true },
  { key: "nonprofit", label: "Nonprofit / Community Organizations", aiPackKey: "global", sortOrder: 110, isActive: true, isUserFacing: true },
  { key: "warehouse", label: "Manufacturing / Warehouse / Distribution", aiPackKey: "warehouse", sortOrder: 120, isActive: true, isUserFacing: true },
  { key: "transportation", label: "Transportation & Logistics", aiPackKey: "warehouse", sortOrder: 130, isActive: true, isUserFacing: true },
  { key: "professional", label: "Professional Services", aiPackKey: "global", sortOrder: 140, isActive: true, isUserFacing: true },
  { key: "beauty", label: "Beauty / Salon / Spa", aiPackKey: "global", sortOrder: 150, isActive: true, isUserFacing: true },
  { key: "fitness", label: "Fitness / Wellness / Gyms", aiPackKey: "hospitality", sortOrder: 160, isActive: true, isUserFacing: true },
  { key: "other", label: "Other", aiPackKey: "global", sortOrder: 170, isActive: true, isUserFacing: true },
] as const;

const LABEL_TO_KEY = new Map<string, UserFacingIndustryKey>(
  INDUSTRY_CATALOG.map((entry) => [entry.label.toLowerCase(), entry.key])
);

const USER_FACING_KEY_SET = new Set<string>(USER_FACING_INDUSTRY_KEYS);

export function isUserFacingIndustryKey(value: string | null | undefined): value is UserFacingIndustryKey {
  return Boolean(value && USER_FACING_KEY_SET.has(value));
}

export function activeUserFacingIndustries(): IndustryCatalogEntry[] {
  return INDUSTRY_CATALOG.filter((entry) => entry.isActive && entry.isUserFacing);
}

/**
 * Resolve a user-facing industry key to an AI pack.
 * Unknown keys are never guessed from free text.
 */
export function mapIndustryKeyToAiPack(industryKey: string | null | undefined): AiPackKey | null {
  if (!industryKey) return null;
  if (industryKey === "global") return "global";
  if (!isUserFacingIndustryKey(industryKey)) return null;
  return INDUSTRY_TO_AI_PACK[industryKey];
}

export class InvalidIndustryKeyError extends Error {
  readonly code = "INVALID_INDUSTRY_KEY" as const;
  constructor(value: string) {
    super(`Unsupported industry key: ${value}`);
    this.name = "InvalidIndustryKeyError";
  }
}

/**
 * Validate a job/tenant industry key. Empty/null is allowed (legacy rows).
 * Unknown values throw — they are never silently mapped.
 */
export function parseIndustryKey(value: string | null | undefined): UserFacingIndustryKey | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === "global") return "other";
  if (!isUserFacingIndustryKey(trimmed)) {
    throw new InvalidIndustryKeyError(trimmed);
  }
  return trimmed;
}

export function industryKeyValidationMessage(value: string | null | undefined): string | null {
  try {
    parseIndustryKey(value);
    return null;
  } catch {
    return "Select a valid job industry.";
  }
}

/**
 * Map a stored display label (legacy tenants.industry) to a canonical key.
 * Used only for backfill / defaulting — never for runtime prompt selection.
 */
export function industryKeyFromLegacyLabel(label: string | null | undefined): UserFacingIndustryKey | null {
  const trimmed = label?.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "staffing & recruiting") return null;
  return LABEL_TO_KEY.get(trimmed.toLowerCase()) ?? null;
}

export function industryLabelForKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const normalized = key === "global" ? "other" : key;
  return INDUSTRY_CATALOG.find((entry) => entry.key === normalized)?.label ?? null;
}

export const AI_PACK_LABELS: Record<AiPackKey, string> = {
  global: "Global",
  technology: "Technology",
  healthcare: "Healthcare",
  home_care: "Home Care",
  hospitality: "Hospitality",
  childcare: "Childcare",
  warehouse: "Warehouse",
  staffing: "Staffing (delivery)",
  msp: "MSP (delivery)",
};

export function promptStatusLabelForIndustry(entry: IndustryCatalogEntry): string {
  const packLabel = AI_PACK_LABELS[entry.aiPackKey];
  if (entry.key === entry.aiPackKey) return `Uses ${packLabel} prompt`;
  return `Uses ${packLabel} prompt`;
}
