export const CANDIDATE_MATCH_SCORE_RANGE_OPTIONS = [
  { id: "90_100", label: "90 to 100%", min: 90, max: 100, maxInclusive: true },
  { id: "80_90", label: "80 to 90%", min: 80, max: 90, maxInclusive: false },
  { id: "70_80", label: "70 to 80%", min: 70, max: 80, maxInclusive: false },
  { id: "60_70", label: "60 to 70%", min: 60, max: 70, maxInclusive: false },
  { id: "50_60", label: "50 to 60%", min: 50, max: 60, maxInclusive: false },
  { id: "40_50", label: "40 to 50%", min: 40, max: 50, maxInclusive: false },
  { id: "30_40", label: "30 to 40%", min: 30, max: 40, maxInclusive: false },
  { id: "20_30", label: "20 to 30%", min: 20, max: 30, maxInclusive: false },
  { id: "10_20", label: "10 to 20%", min: 10, max: 20, maxInclusive: false },
  { id: "0_10", label: "0 to 10%", min: 0, max: 10, maxInclusive: false },
] as const;

export const MATCH_SCORE_CUSTOM_PREFIX = "custom:";

export function isCustomMatchScoreFilter(value: string): boolean {
  return value === "custom" || value.startsWith(MATCH_SCORE_CUSTOM_PREFIX);
}

export function parseCustomMatchScoreRange(value: string): { min: string; max: string } {
  if (!value.startsWith(MATCH_SCORE_CUSTOM_PREFIX)) return { min: "", max: "" };
  const raw = value.slice(MATCH_SCORE_CUSTOM_PREFIX.length);
  const [min = "", max = ""] = raw.split("-");
  return { min, max };
}

export function encodeCustomMatchScoreRange(min: string, max: string): string {
  return `${MATCH_SCORE_CUSTOM_PREFIX}${min}-${max}`;
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function parseScoreInput(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? clampScore(n) : null;
}

export function candidateMatchesMatchScoreFilter(
  score: number | null | undefined,
  matchScoreFilter: string
): boolean {
  if (!matchScoreFilter) return true;

  if (isCustomMatchScoreFilter(matchScoreFilter)) {
    const { min, max } = parseCustomMatchScoreRange(matchScoreFilter);
    const minValue = parseScoreInput(min);
    const maxValue = parseScoreInput(max);
    if (minValue == null || maxValue == null) return true;
    if (score == null || !Number.isFinite(Number(score))) return false;
    const value = Number(score);
    const low = Math.min(minValue, maxValue);
    const high = Math.max(minValue, maxValue);
    return value >= low && value <= high;
  }

  const option = CANDIDATE_MATCH_SCORE_RANGE_OPTIONS.find((row) => row.id === matchScoreFilter);
  if (!option) return true;
  if (score == null || !Number.isFinite(Number(score))) return false;
  const value = Number(score);
  if (option.maxInclusive) return value >= option.min && value <= option.max;
  return value >= option.min && value < option.max;
}
