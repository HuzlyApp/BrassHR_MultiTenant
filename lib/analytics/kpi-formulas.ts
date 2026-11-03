/**
 * Pure KPI formula helpers for Team Productivity analytics.
 * Never invent values: unavailable denominators / missing samples return null (N/A).
 */

export type MetricAvailability = "available" | "insufficient_sample" | "missing" | "zero_denominator";

export type MetricValue = {
  value: number | null;
  availability: MetricAvailability;
  numerator: number | null;
  denominator: number | null;
  explanation: string;
};

export type PeriodChange = {
  current: number | null;
  previous: number | null;
  changePct: number | null;
  direction: "up" | "down" | "flat" | "na";
};

export type AttainmentResult = {
  attainmentPct: number | null;
  availability: MetricAvailability;
  explanation: string;
};

export type WeightedScoreComponent = {
  key: string;
  weight: number;
  attainmentPct: number | null;
  available: boolean;
};

export type WeightedScoreResult = {
  score: number | null;
  components: Array<WeightedScoreComponent & { contribution: number | null }>;
  redistributed: boolean;
  explanation: string;
};

export type WeightRedistributionPolicy = "proportional" | "keep_gap" | "exclude_score";

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function safeRatio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  options?: {
    scale?: number;
    minimumSampleSize?: number;
    explanation?: string;
  },
): MetricValue {
  const scale = options?.scale ?? 1;
  const minSample = options?.minimumSampleSize ?? 0;
  const explanation = options?.explanation ?? "numerator / denominator";

  if (numerator == null || denominator == null) {
    return {
      value: null,
      availability: "missing",
      numerator: numerator ?? null,
      denominator: denominator ?? null,
      explanation,
    };
  }
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return {
      value: null,
      availability: "missing",
      numerator,
      denominator,
      explanation,
    };
  }
  if (denominator === 0) {
    return {
      value: null,
      availability: "zero_denominator",
      numerator,
      denominator,
      explanation,
    };
  }
  if (denominator < minSample) {
    return {
      value: null,
      availability: "insufficient_sample",
      numerator,
      denominator,
      explanation,
    };
  }
  return {
    value: round((numerator / denominator) * scale),
    availability: "available",
    numerator,
    denominator,
    explanation,
  };
}

/** Engaged session minutes / Valid session minutes × 100 */
export function engagementRatio(
  engagedMinutes: number | null,
  validSessionMinutes: number | null,
): MetricValue {
  return safeRatio(engagedMinutes, validSessionMinutes, {
    scale: 100,
    explanation: "Engaged session minutes / Valid session minutes × 100",
  });
}

/** Tasks completed during period / Tasks due during period × 100 */
export function taskCompletionRate(
  completed: number | null,
  due: number | null,
): MetricValue {
  return safeRatio(completed, due, {
    scale: 100,
    explanation: "Tasks completed during period / Tasks due during period × 100",
  });
}

/** Completed / Created — separate from due-based completion */
export function completedToCreatedRatio(
  completed: number | null,
  created: number | null,
): MetricValue {
  return safeRatio(completed, created, {
    scale: 100,
    explanation: "Tasks completed / Tasks created during period × 100",
  });
}

export function onTimeCompletionRate(
  completedOnTime: number | null,
  completedWithDeadline: number | null,
): MetricValue {
  return safeRatio(completedOnTime, completedWithDeadline, {
    scale: 100,
    explanation: "Tasks completed on or before deadline / Completed tasks with valid deadlines × 100",
  });
}

export function recruiterActivityRate(
  meaningfulActions: number | null,
  engagedHours: number | null,
): MetricValue {
  return safeRatio(meaningfulActions, engagedHours, {
    explanation: "Attributed meaningful recruiting actions / Engaged application hours",
  });
}

export function jobCoverage(
  jobsWithQualifyingWork: number | null,
  eligibleAssignedJobs: number | null,
): MetricValue {
  return safeRatio(jobsWithQualifyingWork, eligibleAssignedJobs, {
    scale: 100,
    explanation:
      "Distinct assigned jobs with at least one qualifying work event / Distinct eligible assigned jobs × 100",
  });
}

export function offerAcceptanceRate(
  accepted: number | null,
  decidedOffers: number | null,
): MetricValue {
  return safeRatio(accepted, decidedOffers, {
    scale: 100,
    explanation: "Accepted offers / Offers with final accepted-or-declined outcomes × 100",
  });
}

export function interviewToOfferConversion(
  offerStageCandidates: number | null,
  interviewStageCandidates: number | null,
): MetricValue {
  return safeRatio(offerStageCandidates, interviewStageCandidates, {
    scale: 100,
    explanation: "Candidates reaching offer stage / Candidates reaching interview stage × 100",
  });
}

export function slaCompliance(
  withinSla: number | null,
  eligibleCompleted: number | null,
): MetricValue {
  return safeRatio(withinSla, eligibleCompleted, {
    scale: 100,
    explanation: "Eligible cases completed within SLA / Eligible completed cases × 100",
  });
}

export function errorRate(
  erroneous: number | null,
  audited: number | null,
): MetricValue {
  return safeRatio(erroneous, audited, {
    scale: 100,
    explanation: "Verified erroneous completed items / Audited completed items × 100",
  });
}

/**
 * Target attainment.
 * higher-is-better: actual / target × 100
 * lower-is-better: configurable inverse with safe zero handling
 */
export function targetAttainment(
  actual: number | null,
  target: number | null,
  direction: "higher_is_better" | "lower_is_better" = "higher_is_better",
  options?: { inverseMode?: "target_over_actual" | "one_minus_ratio" },
): AttainmentResult {
  if (actual == null || target == null) {
    return {
      attainmentPct: null,
      availability: "missing",
      explanation: "Actual or target unavailable",
    };
  }
  if (!Number.isFinite(actual) || !Number.isFinite(target)) {
    return {
      attainmentPct: null,
      availability: "missing",
      explanation: "Actual or target is non-finite",
    };
  }

  if (direction === "higher_is_better") {
    if (target === 0) {
      return {
        attainmentPct: actual === 0 ? 100 : null,
        availability: actual === 0 ? "available" : "zero_denominator",
        explanation: "Actual / Target × 100 (zero target: 100% only when actual is also 0)",
      };
    }
    return {
      attainmentPct: round((actual / target) * 100),
      availability: "available",
      explanation: "Actual / Target × 100",
    };
  }

  const mode = options?.inverseMode ?? "target_over_actual";
  if (mode === "one_minus_ratio") {
    if (target === 0) {
      return {
        attainmentPct: actual === 0 ? 100 : null,
        availability: actual === 0 ? "available" : "zero_denominator",
        explanation: "Lower-is-better: 100% when actual and target are 0; otherwise N/A for zero target",
      };
    }
    const ratio = actual / target;
    return {
      attainmentPct: round(Math.max(0, (1 - ratio) * 100 + 100)),
      availability: "available",
      explanation: "Lower-is-better inverse attainment from actual/target",
    };
  }

  // target_over_actual: lower actual is better → target/actual × 100 when actual > 0
  if (actual === 0 && target === 0) {
    return {
      attainmentPct: 100,
      availability: "available",
      explanation: "Lower-is-better: both actual and target are 0 → 100%",
    };
  }
  if (actual === 0) {
    return {
      attainmentPct: null,
      availability: "zero_denominator",
      explanation: "Lower-is-better: actual is 0 while target is non-zero → N/A",
    };
  }
  return {
    attainmentPct: round((target / actual) * 100),
    availability: "available",
    explanation: "Lower-is-better: Target / Actual × 100",
  };
}

/** (Current - Previous) / Previous × 100; N/A when previous is 0 or missing */
export function periodOverPeriodChange(
  current: number | null,
  previous: number | null,
): PeriodChange {
  if (current == null || previous == null) {
    return { current, previous, changePct: null, direction: "na" };
  }
  if (previous === 0) {
    return {
      current,
      previous,
      changePct: null,
      direction: current === 0 ? "flat" : "na",
    };
  }
  const changePct = round(((current - previous) / previous) * 100);
  const direction = changePct > 0 ? "up" : changePct < 0 ? "down" : "flat";
  return { current, previous, changePct, direction };
}

export function normalizeAttainment(
  attainmentPct: number | null,
  capPct: number | null | undefined,
): number | null {
  if (attainmentPct == null) return null;
  if (capPct == null) return attainmentPct;
  return Math.min(attainmentPct, capPct);
}

/**
 * Weighted KPI score = Sum(Normalized attainment × weight)
 * Weights should sum to 1 (100%). Unavailable KPIs follow redistribution policy.
 */
export function weightedKpiScore(
  components: WeightedScoreComponent[],
  policy: WeightRedistributionPolicy = "proportional",
): WeightedScoreResult {
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  if (components.length === 0 || Math.abs(totalWeight - 1) > 0.001 && Math.abs(totalWeight - 100) > 0.001) {
    // Allow either 0–1 or 0–100 weight scales by normalizing.
  }

  const scale = Math.abs(totalWeight - 100) <= Math.abs(totalWeight - 1) && totalWeight > 1 ? 100 : 1;
  const normalized = components.map((c) => ({
    ...c,
    weight: scale === 100 ? c.weight / 100 : c.weight,
  }));

  const available = normalized.filter((c) => c.available && c.attainmentPct != null);
  const unavailableWeight = normalized
    .filter((c) => !c.available || c.attainmentPct == null)
    .reduce((sum, c) => sum + c.weight, 0);
  const availableWeight = available.reduce((sum, c) => sum + c.weight, 0);

  if (available.length === 0 || availableWeight <= 0) {
    return {
      score: null,
      components: normalized.map((c) => ({ ...c, contribution: null })),
      redistributed: false,
      explanation: "No available KPI components with sufficient data",
    };
  }

  if (policy === "exclude_score" && unavailableWeight > 0) {
    return {
      score: null,
      components: normalized.map((c) => ({ ...c, contribution: null })),
      redistributed: false,
      explanation: "Score excluded because one or more weighted KPIs are unavailable",
    };
  }

  let redistributed = false;
  const effective = normalized.map((c) => {
    if (c.available && c.attainmentPct != null) {
      let weight = c.weight;
      if (policy === "proportional" && unavailableWeight > 0 && availableWeight > 0) {
        weight = c.weight + (c.weight / availableWeight) * unavailableWeight;
        redistributed = true;
      }
      const contribution = round((c.attainmentPct / 100) * weight * 100);
      return { ...c, weight, contribution };
    }
    return {
      ...c,
      contribution: policy === "keep_gap" ? 0 : null,
    };
  });

  const score = round(
    effective.reduce((sum, c) => sum + (c.contribution ?? 0), 0),
  );

  return {
    score,
    components: effective,
    redistributed,
    explanation:
      policy === "proportional" && redistributed
        ? "Weighted sum with unavailable KPI weights redistributed proportionally"
        : "Sum of (Normalized KPI attainment × KPI weight)",
  };
}

/** Deduplicate overlapping engaged intervals; returns total unique seconds. */
export function mergeEngagedSeconds(
  intervals: Array<{ startedAt: number; endedAt: number }>,
): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals]
    .filter((i) => Number.isFinite(i.startedAt) && Number.isFinite(i.endedAt) && i.endedAt > i.startedAt)
    .sort((a, b) => a.startedAt - b.startedAt);
  if (sorted.length === 0) return 0;

  let total = 0;
  let curStart = sorted[0].startedAt;
  let curEnd = sorted[0].endedAt;
  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i];
    if (next.startedAt <= curEnd) {
      curEnd = Math.max(curEnd, next.endedAt);
    } else {
      total += curEnd - curStart;
      curStart = next.startedAt;
      curEnd = next.endedAt;
    }
  }
  total += curEnd - curStart;
  return Math.floor(total / 1000);
}

export function formatMetricDisplay(value: number | null, availability: MetricAvailability): string {
  if (value == null || availability !== "available") return "N/A";
  return String(value);
}
