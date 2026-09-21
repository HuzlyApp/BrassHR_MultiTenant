import { describe, expect, it } from "vitest";
import {
  DEEP_MATCH_BLOCKED_LOW_FIT,
  DEEP_MATCH_BLOCKED_NOT_READY,
  MATCH_PROGRESSION_STEPS,
  canAdvanceMatchProgression,
  canRunDeepMatch,
  canSelectMatchProgressionStep,
  deepMatchBlockReason,
  matchProgressionFurthestIndex,
  matchProgressionPrimaryAction,
  matchProgressionFollowUpNeedsConfirm,
  matchProgressionStepRequiresDeepConfirm,
  quickMatchFitBand,
  displayFitBand,
  listingDisplayFitBand,
  fitBandLabel,
} from "./progression";

describe("match progression steps", () => {
  it("keeps recruiter order Quick Match → Verifications → 2nd Follow-up → Deep Match → Submission", () => {
    expect(MATCH_PROGRESSION_STEPS.map((step) => step.label)).toEqual([
      "Quick Match",
      "Verifications",
      "2nd Follow-up",
      "Deep Match",
      "Submission",
    ]);
  });

  it("does not skip ahead from Screening status — only saved stage counts", () => {
    expect(
      matchProgressionFurthestIndex({
        isAnalyzed: true,
        stage: "quick",
        hasDeepMatch: false,
      })
    ).toBe(0);
    expect(
      matchProgressionFurthestIndex({
        isAnalyzed: true,
        stage: "call_pack",
        hasDeepMatch: false,
      })
    ).toBe(1);
    expect(
      matchProgressionFurthestIndex({
        isAnalyzed: true,
        stage: "follow_up",
        hasDeepMatch: false,
      })
    ).toBe(2);
    expect(
      matchProgressionFurthestIndex({
        isAnalyzed: true,
        stage: "deep",
        hasDeepMatch: true,
      })
    ).toBe(3);
  });

  it("classifies strong / review / low from checklist counts without a match %", () => {
    expect(
      quickMatchFitBand({ mandatory: 7, confirmed: 6, notMet: 0, blocking: 0 })
    ).toBe("strong");
    expect(
      quickMatchFitBand({ mandatory: 7, confirmed: 3, notMet: 0, blocking: 0 })
    ).toBe("review");
    expect(
      quickMatchFitBand({ mandatory: 7, confirmed: 3, notMet: 2, blocking: 0 })
    ).toBe("low");
    expect(
      quickMatchFitBand({ mandatory: 7, confirmed: 5, notMet: 0, blocking: 1 })
    ).toBe("low");
  });

  it("promotes Review to Strong once the candidate reaches Deep Match", () => {
    expect(displayFitBand({ fitBand: "review", stage: "follow_up" })).toBe("review");
    expect(displayFitBand({ fitBand: "review", stage: "deep" })).toBe("strong");
    expect(displayFitBand({ fitBand: "review", stage: "submission" })).toBe("strong");
    expect(displayFitBand({ fitBand: "review", hasDeepMatch: true })).toBe("strong");
    expect(displayFitBand({ fitBand: "low", stage: "deep" })).toBe("low");
    expect(displayFitBand({ fitBand: "strong", stage: "quick" })).toBe("strong");
    expect(fitBandLabel("review")).toBe("Review");
  });

  it("lists Fit from checklist counts and promotes Review at Deep Match", () => {
    expect(
      listingDisplayFitBand({
        analyzed: true,
        stage: "follow_up",
        counts: { confirmed: 3, verify: 3, notMet: 0 },
      })
    ).toBe("review");
    expect(
      listingDisplayFitBand({
        analyzed: true,
        stage: "deep",
        counts: { confirmed: 3, verify: 3, notMet: 0 },
      })
    ).toBe("strong");
    expect(
      listingDisplayFitBand({
        analyzed: true,
        stage: "quick",
        counts: { confirmed: 6, verify: 0, notMet: 0, mandatory: 5, blocking: 0 },
      })
    ).toBe("strong");
    expect(
      listingDisplayFitBand({
        analyzed: true,
        stage: "follow_up",
        counts: { confirmed: 4, verify: 4, notMet: 0, mandatory: 5, blocking: 0 },
      })
    ).toBe("strong");
    expect(
      listingDisplayFitBand({
        analyzed: true,
        stage: "deep",
        counts: { confirmed: 1, verify: 1, notMet: 2 },
      })
    ).toBe("low");
    expect(listingDisplayFitBand({ analyzed: false, stage: "quick", counts: { confirmed: 6 } })).toBe(
      null
    );
  });

  it("blocks later steps for low fit or Talent Pool", () => {
    expect(
      canAdvanceMatchProgression({ isAnalyzed: true, fitBand: "review" })
    ).toBe(true);
    expect(
      canAdvanceMatchProgression({ isAnalyzed: true, fitBand: "low" })
    ).toBe(false);
    expect(
      canAdvanceMatchProgression({
        isAnalyzed: true,
        fitBand: "strong",
        parkedInTalentPool: true,
      })
    ).toBe(false);
    expect(
      canRunDeepMatch({
        isAnalyzed: true,
        fitBand: "review",
        unlockedIndex: 1,
      })
    ).toBe(false);
    expect(
      canRunDeepMatch({
        isAnalyzed: true,
        fitBand: "review",
        unlockedIndex: 2,
      })
    ).toBe(true);
    expect(
      deepMatchBlockReason({
        isAnalyzed: true,
        fitBand: "low",
        unlockedIndex: 2,
      })
    ).toBe(DEEP_MATCH_BLOCKED_LOW_FIT);
    expect(
      deepMatchBlockReason({
        isAnalyzed: true,
        fitBand: "review",
        unlockedIndex: 0,
      })
    ).toBe(DEEP_MATCH_BLOCKED_NOT_READY);
  });

  it("lets the recruiter open the next step only when they can advance", () => {
    expect(
      canSelectMatchProgressionStep({ index: 1, unlockedIndex: 0, canAdvance: true })
    ).toBe(true);
    expect(
      canSelectMatchProgressionStep({ index: 1, unlockedIndex: 0, canAdvance: false })
    ).toBe(false);
    expect(
      canSelectMatchProgressionStep({ index: 2, unlockedIndex: 0, canAdvance: true })
    ).toBe(false);
    expect(
      canSelectMatchProgressionStep({ index: 0, unlockedIndex: 2, canAdvance: false })
    ).toBe(true);
  });

  it("requires Deep Match confirm instead of previewing step 4 from follow-up", () => {
    expect(
      matchProgressionStepRequiresDeepConfirm({ index: 3, unlockedIndex: 2 })
    ).toBe(true);
    expect(
      matchProgressionStepRequiresDeepConfirm({ index: 3, unlockedIndex: 3 })
    ).toBe(false);
    expect(
      matchProgressionStepRequiresDeepConfirm({ index: 2, unlockedIndex: 1 })
    ).toBe(false);
  });

  it("asks before Follow-up when the Qualification Checklist still needs confirmation", () => {
    expect(matchProgressionFollowUpNeedsConfirm(3)).toBe(true);
    expect(matchProgressionFollowUpNeedsConfirm(1)).toBe(true);
    expect(matchProgressionFollowUpNeedsConfirm(0)).toBe(false);
    expect(matchProgressionFollowUpNeedsConfirm(Number.NaN)).toBe(false);
  });

  it("labels Continue with the next recruiter action", () => {
    expect(matchProgressionPrimaryAction(0)?.label).toBe("Continue to Verifications");
    expect(matchProgressionPrimaryAction(1)?.label).toBe("Continue to Follow-up");
    expect(matchProgressionPrimaryAction(2)?.label).toBe("Run Deep Match");
    expect(matchProgressionPrimaryAction(3)?.label).toBe("Draft submission résumé");
    expect(matchProgressionPrimaryAction(4)?.label).toBe("Draft submission résumé");
    expect(matchProgressionPrimaryAction(4, { hasSubmissionResume: true })?.label).toBe(
      "Email MSP / upload portal"
    );
  });
});
