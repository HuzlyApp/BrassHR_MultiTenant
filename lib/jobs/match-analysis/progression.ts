/**
 * Recruiter-facing AI match progression (FS-AI-MATCH-001).
 * Visual order: Quick Match → Verifications → 2nd Follow-up → Deep Match → Submission.
 *
 * Later paid steps do not unlock from application status. The recruiter must
 * push a strong/review candidate forward. Low fit exits to Talent Pool.
 */

import type { MatchStage } from "./match-stage";
import { parseMatchStage } from "./match-stage";
import type { QualificationOutcomeCounts } from "./workspace";

export const MATCH_PROGRESSION_STEPS = [
  {
    id: "quick",
    stage: "quick",
    stepNumber: 1,
    label: "Quick Match",
    subtitle: "Checklist · no %",
    hint: "Step 1 · Quick Match. Checklist only. Ring empty. Low match → Talent Pool. Review / strong → Verifications.",
    sectionId: "match-step-quick",
  },
  {
    id: "verifications",
    stage: "call_pack",
    stepNumber: 2,
    label: "Verifications",
    subtitle: "Call pack · no %",
    hint: "Step 2 · Verifications unlocked. Strengths, gaps, and call questions added. Still no %.",
    sectionId: "match-step-verifications",
  },
  {
    id: "follow_up",
    stage: "follow_up",
    stepNumber: 3,
    label: "2nd Follow-up",
    subtitle: "Notes / Email · no %",
    hint: "Step 3 · 2nd follow-up. Screening questions are generated from the Qualification Checklist and recruiter notes. Apply notes or upload the email. Still no %.",
    sectionId: "match-step-follow-up",
  },
  {
    id: "deep",
    stage: "deep",
    stepNumber: 4,
    label: "Deep Match",
    subtitle: "Fills the ring",
    hint: "Step 4 · Deep Match (paid). Confirm Run Deep Match to open this step. Ring fills after the paid run.",
    sectionId: "match-step-deep",
  },
  {
    id: "submission",
    stage: "submission",
    stepNumber: 5,
    label: "Submission",
    subtitle: "Enriched Resume",
    hint: "Step 5 · Submission. Draft the optimized résumé PDF here, then email MSP / upload the portal.",
    sectionId: "match-step-submission",
  },
] as const;

export type MatchProgressionStep = (typeof MATCH_PROGRESSION_STEPS)[number];
export type MatchProgressionStepId = MatchProgressionStep["id"];
export type QuickMatchFitBand = "strong" | "review" | "low";

export type MatchProgressionState = {
  isAnalyzed: boolean;
  stage?: string | null;
  hasDeepMatch: boolean;
  parkedInTalentPool?: boolean;
  fitBand?: QuickMatchFitBand;
};

export const MATCH_PROGRESSION_INTRO =
  "Recruiter steps. Continue unlocks Verifications and Follow-up. Deep Match asks you to confirm the paid run before that step opens. A low-fit exit at any diamond goes to Talent Pool — it does not fill the ring.";

export const FLOW_DIAMOND_COPY =
  "LOW_MATCH if any skill blocker or weighted < 0.40. STRONG if no blocker, weighted ≥ 0.70, mand_met ≥ 0.60, and confirmed/M ≥ 0.50. Else REVIEW. Do not run Deep Match on LOW_MATCH.";

export const DEEP_MATCH_BLOCKED_LOW_FIT =
  "Low match — do not run Deep Match. Move this candidate to Talent Pool.";

export const DEEP_MATCH_BLOCKED_NOT_READY =
  "Finish Verifications and 2nd Follow-up before Run Deep Match.";

export function matchProgressionIndexFromStage(stage: unknown): number {
  const parsed = parseMatchStage(stage);
  if (parsed === "call_pack") return 1;
  if (parsed === "follow_up") return 2;
  if (parsed === "deep") return 3;
  if (parsed === "submission") return 4;
  return 0;
}

export function matchProgressionStageFromIndex(index: number): MatchStage {
  return MATCH_PROGRESSION_STEPS[index]?.stage ?? "quick";
}

export function quickMatchFitBand(
  counts: Pick<QualificationOutcomeCounts, "mandatory" | "confirmed" | "notMet" | "blocking">
): QuickMatchFitBand {
  if (counts.blocking > 0 || counts.notMet >= 2) return "low";
  if (counts.notMet === 0 && counts.blocking === 0 && counts.mandatory > 0) {
    const confirmedShare = counts.confirmed / Math.max(counts.mandatory, 1);
    if (confirmedShare >= 0.7) return "strong";
  }
  return "review";
}

/** Review becomes Strong once the recruiter reaches Deep Match (step 4). Low stays Low. */
export function displayFitBand(args: {
  fitBand: QuickMatchFitBand;
  stage?: string | null;
  hasDeepMatch?: boolean;
}): QuickMatchFitBand {
  if (args.fitBand === "low") return "low";
  const atDeep =
    Boolean(args.hasDeepMatch) || args.stage === "deep" || args.stage === "submission";
  if (args.fitBand === "review" && atDeep) return "strong";
  return args.fitBand;
}

/** Listing Fit uses the same checklist band as overview when mandatory/blocking are present. */
export function listingDisplayFitBand(args: {
  analyzed: boolean;
  stage?: string | null;
  counts?: {
    confirmed?: number | null;
    verify?: number | null;
    notMet?: number | null;
    mandatory?: number | null;
    blocking?: number | null;
  } | null;
}): QuickMatchFitBand | null {
  if (!args.analyzed) return null;
  const confirmed = Number(args.counts?.confirmed ?? 0);
  const verify = Number(args.counts?.verify ?? 0);
  const notMet = Number(args.counts?.notMet ?? 0);
  const mandatory =
    args.counts?.mandatory == null || Number.isNaN(Number(args.counts.mandatory))
      ? null
      : Number(args.counts.mandatory);
  const blocking =
    args.counts?.blocking == null || Number.isNaN(Number(args.counts.blocking))
      ? null
      : Number(args.counts.blocking);

  let band: QuickMatchFitBand;
  if (mandatory != null && blocking != null) {
    band = quickMatchFitBand({ mandatory, confirmed, notMet, blocking });
  } else {
    const total = confirmed + verify + notMet;
    band = "review";
    if (notMet >= 2) band = "low";
    else if (notMet === 0 && total > 0 && confirmed / total >= 0.7) band = "strong";
  }
  return displayFitBand({ fitBand: band, stage: args.stage });
}

export function fitBandLabel(band: QuickMatchFitBand): string {
  if (band === "strong") return "Strong";
  if (band === "low") return "Low";
  return "Review";
}

export function fitBandTagClassName(band: QuickMatchFitBand): string {
  if (band === "strong") return "bg-[#00B135] text-white";
  if (band === "low") return "bg-[#FEE2E2] text-[#991B1B]";
  return "bg-[#FEF9C3] text-[#854D0E]";
}

export function fitBandSortRank(band: QuickMatchFitBand | null | undefined): number | null {
  if (band === "strong") return 3;
  if (band === "review") return 2;
  if (band === "low") return 1;
  return null;
}

export function canAdvanceMatchProgression(args: {
  isAnalyzed: boolean;
  fitBand: QuickMatchFitBand;
  parkedInTalentPool?: boolean;
}): boolean {
  if (args.parkedInTalentPool) return false;
  if (!args.isAnalyzed) return false;
  return args.fitBand !== "low";
}

export function canRunDeepMatch(args: {
  isAnalyzed: boolean;
  fitBand: QuickMatchFitBand;
  unlockedIndex: number;
  parkedInTalentPool?: boolean;
}): boolean {
  if (!canAdvanceMatchProgression(args)) return false;
  return args.unlockedIndex >= 2;
}

export function deepMatchBlockReason(args: {
  isAnalyzed: boolean;
  fitBand: QuickMatchFitBand;
  unlockedIndex: number;
  parkedInTalentPool?: boolean;
}): string | null {
  if (args.parkedInTalentPool) return DEEP_MATCH_BLOCKED_LOW_FIT;
  if (!args.isAnalyzed) return "Run Quick Match before Deep Match.";
  if (args.fitBand === "low") return DEEP_MATCH_BLOCKED_LOW_FIT;
  if (args.unlockedIndex < 2) return DEEP_MATCH_BLOCKED_NOT_READY;
  return null;
}

/** Highest step the recruiter has earned. Status changes do not skip ahead. */
export function matchProgressionFurthestIndex(state: MatchProgressionState): number {
  if (!state.isAnalyzed) return 0;
  const fromStage = matchProgressionIndexFromStage(state.stage);
  if (state.hasDeepMatch) return Math.max(fromStage, 3);
  return fromStage;
}

export function matchProgressionInitialIndex(state: MatchProgressionState): number {
  return matchProgressionFurthestIndex(state);
}

export function canSelectMatchProgressionStep(args: {
  index: number;
  unlockedIndex: number;
  canAdvance: boolean;
}): boolean {
  const { index, unlockedIndex, canAdvance } = args;
  if (!Number.isInteger(index) || index < 0 || index >= MATCH_PROGRESSION_STEPS.length) {
    return false;
  }
  if (index <= unlockedIndex) return true;
  return canAdvance && index === unlockedIndex + 1;
}

/** Step 4 is paid. Clicking it must confirm Deep Match, not preview the empty panel. */
export function matchProgressionStepRequiresDeepConfirm(args: {
  index: number;
  unlockedIndex: number;
}): boolean {
  return args.index === 3 && args.unlockedIndex < 3;
}

/** Ask before Follow-up if the Qualification Checklist still has items to confirm. */
export function matchProgressionFollowUpNeedsConfirm(verifyCount: number): boolean {
  return Number.isFinite(verifyCount) && verifyCount > 0;
}

export function matchProgressionStepAt(index: number): MatchProgressionStep | null {
  return MATCH_PROGRESSION_STEPS[index] ?? null;
}

export type MatchProgressionPrimaryAction =
  | { kind: "advance"; label: string; nextIndex: number }
  | { kind: "deep"; label: "Run Deep Match" }
  | { kind: "draft"; label: "Draft submission résumé" }
  | { kind: "msp"; label: "Email MSP / upload portal" };

export function matchProgressionPrimaryAction(
  viewedIndex: number,
  opts?: { hasSubmissionResume?: boolean }
): MatchProgressionPrimaryAction | null {
  if (viewedIndex <= 0) return { kind: "advance", label: "Continue to Verifications", nextIndex: 1 };
  if (viewedIndex === 1) return { kind: "advance", label: "Continue to Follow-up", nextIndex: 2 };
  if (viewedIndex === 2) return { kind: "deep", label: "Run Deep Match" };
  if (viewedIndex === 3) return { kind: "draft", label: "Draft submission résumé" };
  if (viewedIndex >= 4) {
    if (!opts?.hasSubmissionResume) return { kind: "draft", label: "Draft submission résumé" };
    return { kind: "msp", label: "Email MSP / upload portal" };
  }
  return null;
}

/** @deprecated Use matchProgressionPrimaryAction */
export function continueMatchProgressionLabel(viewedIndex: number): string | null {
  return matchProgressionPrimaryAction(viewedIndex)?.label ?? null;
}

export function nextMatchProgressionIndex(unlockedIndex: number): number | null {
  if (unlockedIndex >= MATCH_PROGRESSION_STEPS.length - 1) return null;
  return unlockedIndex + 1;
}
