import {
  MATCH_CATEGORY_LABELS,
  RECOMMENDED_ACTION_LABELS,
  type MatchCategory,
  type RecommendedAction,
} from "@/lib/jobs/match-analysis/schema";

/** AI match % at or above this is a Strong match on jobs listing and score badges. */
export const STRONG_MATCH_MIN_SCORE = 90;

export function isStrongAiMatchScore(score: unknown): boolean {
  const n = Number(score);
  return Number.isFinite(n) && n >= STRONG_MATCH_MIN_SCORE;
}

/** Soft badges for detail panels (not the ranking table). */
export function matchScoreBadgeClassName(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) {
    return "bg-[#F1F5F9] text-[#64748B]";
  }
  const n = Number(score);
  if (n >= STRONG_MATCH_MIN_SCORE) return "bg-[#DCFCE7] text-[#166534]";
  if (n >= 75) return "bg-[#E0F2FE] text-[#075985]";
  if (n >= 60) return "bg-[#FEF9C3] text-[#854D0E]";
  if (n >= 40) return "bg-[#FFEDD5] text-[#9A3412]";
  return "bg-[#FEE2E2] text-[#991B1B]";
}

/** Candidate profile AI confidence ring: Figma Analytics/icon/green-800, orange, red. */
export const PROFILE_MATCH_RING_GREEN = "#166534";
export const PROFILE_MATCH_RING_ORANGE = "#F97316";
export const PROFILE_MATCH_RING_RED = "#EF4444";

export function profileMatchRingColor(score: number | null | undefined): string {
  const n = Number(score);
  if (!Number.isFinite(n)) return "#E5E7EB";
  if (n > 75) return PROFILE_MATCH_RING_GREEN;
  if (n >= 50) return PROFILE_MATCH_RING_ORANGE;
  return PROFILE_MATCH_RING_RED;
}

/** Ranking-list tiers aligned with Figma Match Score (BEST / GOOD / WEAK). */
export type ListMatchScoreTier = "best" | "good" | "weak";

export function listMatchScoreTier(score: number | null | undefined): ListMatchScoreTier | null {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const n = Number(score);
  if (n >= 75) return "best";
  if (n >= 50) return "good";
  return "weak";
}

/** Solid pill colors for candidates ranking table (white % text). */
export function listMatchScorePillClassName(score: number | null | undefined): string {
  const tier = listMatchScoreTier(score);
  if (!tier) return "bg-[#F1F5F9] text-[#64748B]";
  if (tier === "best") return "bg-[#22C55E] text-white";
  if (tier === "good") return "bg-[#3B82F6] text-white";
  return "bg-[#FB7185] text-white";
}

export function formatListMatchScoreLabel(score: number | null | undefined): string {
  const tier = listMatchScoreTier(score);
  if (!tier) return "";
  if (tier === "best") return "BEST MATCH";
  if (tier === "good") return "GOOD MATCH";
  return "WEAK MATCH";
}

export function matchCategoryBadgeClassName(category: string | null | undefined): string {
  switch (category) {
    case "STRONG_MATCH":
      return "bg-[#DCFCE7] text-[#166534]";
    case "GOOD_MATCH":
      return "bg-[#E0F2FE] text-[#075985]";
    case "POSSIBLE_MATCH":
      return "bg-[#FEF9C3] text-[#854D0E]";
    case "WEAK_MATCH":
      return "bg-[#FFEDD5] text-[#9A3412]";
    case "NOT_A_MATCH":
    case "NOT_CURRENTLY_SUBMITTABLE":
      return "bg-[#FEE2E2] text-[#991B1B]";
    case "NEEDS_MORE_INFORMATION":
      return "bg-[#F1F5F9] text-[#475569]";
    default:
      return "bg-[#F1F5F9] text-[#64748B]";
  }
}

export function formatMatchCategory(category: string | null | undefined): string {
  if (!category) return "Not analyzed";
  if (category in MATCH_CATEGORY_LABELS) {
    return MATCH_CATEGORY_LABELS[category as MatchCategory];
  }
  return category.replace(/_/g, " ");
}

export function formatRecommendedAction(action: string | null | undefined): string {
  if (!action) return "";
  if (action in RECOMMENDED_ACTION_LABELS) {
    return RECOMMENDED_ACTION_LABELS[action as RecommendedAction];
  }
  return action.replace(/_/g, " ");
}

export function formatMatchScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) return "—";
  return `${Math.round(Number(score))}%`;
}

/** Higher = stronger qualification/relevance for secondary ranking when Match % ties. */
export function matchCategoryRelevanceRank(category: string | null | undefined): number {
  switch (category) {
    case "STRONG_MATCH":
      return 7;
    case "GOOD_MATCH":
      return 6;
    case "POSSIBLE_MATCH":
      return 5;
    case "NEEDS_MORE_INFORMATION":
      return 4;
    case "WEAK_MATCH":
      return 3;
    case "NOT_A_MATCH":
      return 2;
    case "NOT_CURRENTLY_SUBMITTABLE":
      return 1;
    default:
      return 0;
  }
}
