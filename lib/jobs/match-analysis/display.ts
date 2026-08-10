import {
  MATCH_CATEGORY_LABELS,
  RECOMMENDED_ACTION_LABELS,
  type MatchCategory,
  type RecommendedAction,
} from "@/lib/jobs/match-analysis/schema";

export function matchScoreBadgeClassName(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) {
    return "bg-[#F1F5F9] text-[#64748B]";
  }
  const n = Number(score);
  if (n >= 90) return "bg-[#DCFCE7] text-[#166534]";
  if (n >= 75) return "bg-[#E0F2FE] text-[#075985]";
  if (n >= 60) return "bg-[#FEF9C3] text-[#854D0E]";
  if (n >= 40) return "bg-[#FFEDD5] text-[#9A3412]";
  return "bg-[#FEE2E2] text-[#991B1B]";
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
