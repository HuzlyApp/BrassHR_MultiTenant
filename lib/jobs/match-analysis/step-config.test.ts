import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_STEP1_MODEL,
  DEFAULT_STEP3_GROK_MODEL,
  DEFAULT_STEP3_MODEL,
  MATCH_CONFIG_KEYS,
  deepMatchModelForProvider,
  getMatchStepModels,
  isBlockedStep1Model,
  isBlockedStep3Model,
  matchConfigEnvName,
  sanitizeStep1Model,
  sanitizeStep3Model,
} from "./step-config";

const ENV_KEYS = [
  "AI_MATCH_STEP1_EXTRACT_MODEL",
  "AI_MATCH_STEP1_CLASSIFY_MODEL",
  "AI_MATCH_STEP2_QUESTION_MODEL",
  "AI_MATCH_STEP2_VISION_MODEL",
  "AI_MATCH_STEP3_DEEP_MODEL",
  "AI_MATCH_STEP3_REQUIRE_RECRUITER_CONFIRM",
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("match step config", () => {
  it("maps dotted keys to env names", () => {
    expect(matchConfigEnvName(MATCH_CONFIG_KEYS.step3Deep)).toBe("AI_MATCH_STEP3_DEEP_MODEL");
    expect(matchConfigEnvName(MATCH_CONFIG_KEYS.step1Classify)).toBe(
      "AI_MATCH_STEP1_CLASSIFY_MODEL"
    );
  });

  it("defaults Step 1 to Flash-Lite and Step 3 to gemini-3.1-pro-preview", () => {
    const models = getMatchStepModels();
    expect(models.step1Classify).toBe(DEFAULT_STEP1_MODEL);
    expect(models.step1Extract).toBe(DEFAULT_STEP1_MODEL);
    expect(models.step2Question).toBe(DEFAULT_STEP1_MODEL);
    expect(models.step3Deep).toBe(DEFAULT_STEP3_MODEL);
    expect(models.step3Deep).toBe("gemini-3.1-pro-preview");
    expect(models.requireRecruiterConfirm).toBe(true);
  });

  it("rejects flagship models on Step 1 and cheap models on Step 3", () => {
    expect(isBlockedStep1Model("gpt-5.4")).toBe(true);
    expect(isBlockedStep1Model("claude-sonnet-5")).toBe(true);
    expect(isBlockedStep1Model("gemini-3.1-pro-preview")).toBe(true);
    expect(isBlockedStep1Model("grok-4-fast")).toBe(false);
    expect(isBlockedStep1Model("gpt-5.4-nano")).toBe(false);
    expect(isBlockedStep3Model("gemini-3.5-flash-lite")).toBe(true);
    expect(isBlockedStep3Model("grok-4-fast")).toBe(true);
    expect(isBlockedStep3Model("gemini-3.1-pro-preview")).toBe(false);
    expect(isBlockedStep3Model("grok-4.6")).toBe(false);
    expect(sanitizeStep1Model("gpt-5.4")).toBe(DEFAULT_STEP1_MODEL);
    expect(sanitizeStep3Model("gemini-3.5-flash-lite")).toBe(DEFAULT_STEP3_MODEL);
    expect(sanitizeStep3Model("gemini-2.5-pro")).toBe(DEFAULT_STEP3_MODEL);
  });

  it("honors env overrides when the model is allowed for the step", () => {
    process.env.AI_MATCH_STEP1_CLASSIFY_MODEL = "gemini-2.5-flash-lite";
    process.env.AI_MATCH_STEP3_DEEP_MODEL = "gpt-5.4";
    process.env.AI_MATCH_STEP3_REQUIRE_RECRUITER_CONFIRM = "false";
    const models = getMatchStepModels();
    expect(models.step1Classify).toBe("gemini-2.5-flash-lite");
    expect(models.step3Deep).toBe("gpt-5.4");
    expect(models.requireRecruiterConfirm).toBe(false);
  });

  it("uses grok-4.6 for Deep Match when Grok is selected", () => {
    expect(deepMatchModelForProvider("grok")).toBe(DEFAULT_STEP3_GROK_MODEL);
    expect(deepMatchModelForProvider("grok")).toBe("grok-4.6");
    expect(deepMatchModelForProvider("gemini")).toBe(DEFAULT_STEP3_MODEL);
  });
});
