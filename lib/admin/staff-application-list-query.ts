import {
  CANDIDATE_MATCH_SCORE_RANGE_OPTIONS,
  isCustomMatchScoreFilter,
  parseCustomMatchScoreRange,
} from "@/lib/admin/candidate-match-score-filter";
import { normalizeApplicationStatus } from "@/lib/jobs/application-status";

export type ApplicationListBucket = {
  statusId: string | null;
  systemKey: string | null;
  status: string | null;
  statusName?: string | null;
  pipeline?: string | null;
  atMsp?: boolean;
  onboarding?: boolean;
  count: number;
};

type StatusOptionRef = { id: string; systemKey?: string | null };

/** Same tab badges as the applications list, from grouped status buckets. */
export function tabCountsFromBuckets(
  buckets: ApplicationListBucket[],
  statusOptions: StatusOptionRef[]
): Record<string, number> {
  const counts: Record<string, number> = { all: 0 };
  for (const option of statusOptions) counts[option.id] = 0;

  for (const bucket of buckets) {
    const n = Number(bucket.count) || 0;
    if (n <= 0) continue;
    counts.all += n;

    const statusId = String(bucket.statusId ?? "").trim();
    const archived =
      bucket.systemKey === "archived" ||
      String(bucket.status ?? "").trim().toLowerCase() === "archived" ||
      bucket.pipeline === "archived";

    if (statusId && statusId in counts) {
      counts[statusId] += n;
      continue;
    }

    const byKey = statusOptions.find(
      (option) =>
        option.systemKey &&
        option.systemKey ===
          (archived ? "archived" : normalizeApplicationStatus(String(bucket.status ?? "")))
    );
    if (byKey) counts[byKey.id] += n;
  }

  return counts;
}

/** Status id with the most closed or in-process rows, for ?tab= redirects. */
export function bestPipelineStatusId(
  buckets: ApplicationListBucket[],
  kind: "closed" | "in_process"
): string {
  const keys =
    kind === "closed"
      ? new Set(["rejected", "undecided", "archived"])
      : new Set(["reviewing", "shortlisted", "interviewing"]);
  const totals = new Map<string, number>();

  for (const bucket of buckets) {
    if (bucket.atMsp || bucket.onboarding) continue;
    if (!keys.has(String(bucket.pipeline ?? ""))) continue;
    const statusId = String(bucket.statusId ?? "").trim();
    if (!statusId) continue;
    totals.set(statusId, (totals.get(statusId) ?? 0) + (Number(bucket.count) || 0));
  }

  let bestId = "";
  let bestCount = 0;
  for (const [id, count] of totals) {
    if (count > bestCount) {
      bestId = id;
      bestCount = count;
    }
  }
  return bestId;
}

export type MatchScoreBounds = {
  apply: boolean;
  noScore: boolean;
  min: number | null;
  max: number | null;
  maxInclusive: boolean;
};

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** Translate the applications match-score filter into SQL bounds. */
export function matchScoreBounds(matchScoreFilter: string): MatchScoreBounds {
  const trimmed = matchScoreFilter.trim();
  const none: MatchScoreBounds = {
    apply: false,
    noScore: false,
    min: null,
    max: null,
    maxInclusive: true,
  };
  if (!trimmed) return none;

  if (trimmed === "no_score") {
    return { apply: true, noScore: true, min: null, max: null, maxInclusive: true };
  }
  if (trimmed === "90_plus") {
    return { apply: true, noScore: false, min: 90, max: null, maxInclusive: true };
  }
  if (trimmed === "70_89") {
    return { apply: true, noScore: false, min: 70, max: 90, maxInclusive: false };
  }
  if (trimmed === "50_69") {
    return { apply: true, noScore: false, min: 50, max: 70, maxInclusive: false };
  }
  if (trimmed === "under_50") {
    return { apply: true, noScore: false, min: null, max: 50, maxInclusive: false };
  }

  if (isCustomMatchScoreFilter(trimmed)) {
    const { min, max } = parseCustomMatchScoreRange(trimmed);
    const minValue = min.trim() ? Number(min) : null;
    const maxValue = max.trim() ? Number(max) : null;
    if (minValue == null || maxValue == null || !Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return none;
    }
    return {
      apply: true,
      noScore: false,
      min: clampScore(Math.min(minValue, maxValue)),
      max: clampScore(Math.max(minValue, maxValue)),
      maxInclusive: true,
    };
  }

  const option = CANDIDATE_MATCH_SCORE_RANGE_OPTIONS.find((row) => row.id === trimmed);
  if (!option) return none;
  return {
    apply: true,
    noScore: false,
    min: option.min,
    max: option.max,
    maxInclusive: option.maxInclusive,
  };
}

export type AppliedDateWindow = {
  from: string | null;
  to: string | null;
  before: string | null;
};

/**
 * Browser-local date window. `tzOffsetMinutes` is `Date.getTimezoneOffset()`
 * (minutes to add to local time to get UTC).
 */
export function appliedDateWindow(
  dateAppliedFilter: string,
  tzOffsetMinutes: number,
  now = new Date()
): AppliedDateWindow {
  const empty: AppliedDateWindow = { from: null, to: null, before: null };
  if (!dateAppliedFilter) return empty;

  const shifted = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  const startOfLocalDayUtc =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) +
    tzOffsetMinutes * 60_000;

  const daysAgo = (days: number) => new Date(startOfLocalDayUtc - days * 86_400_000).toISOString();
  const start = new Date(startOfLocalDayUtc).toISOString();

  switch (dateAppliedFilter) {
    case "today":
      return { from: start, to: null, before: null };
    case "last_7":
      return { from: daysAgo(7), to: null, before: null };
    case "last_14":
      return { from: daysAgo(14), to: null, before: null };
    case "last_30":
      return { from: daysAgo(30), to: null, before: null };
    case "last_90":
      return { from: daysAgo(90), to: null, before: null };
    case "older_90":
      return { from: null, to: null, before: daysAgo(90) };
    default:
      return empty;
  }
}
