/**
 * Candidate Match AI model routing (FS-AI-MATCH-001 v1.7).
 *
 * Volume steps (1–3): Grok Fast primary, Gemini Flash-Lite fallback.
 * Paid steps (4–5): Grok 4.6 / Pro — never write % from Fast.
 *
 * Config keys:
 *   ai.match.step1.extract_model / classify_model
 *   ai.match.step2.question_model / vision_model / fallback_model
 *   ai.match.step3.deep_model
 *   ai.match.step3.require_recruiter_confirm
 *
 * Env overrides use the dotted key with dots → underscores, uppercased.
 * Example: AI_MATCH_STEP3_DEEP_MODEL=gemini-3.1-pro-preview
 */

export const MATCH_CONFIG_KEYS = {
  step1Extract: "ai.match.step1.extract_model",
  step1Classify: "ai.match.step1.classify_model",
  step2Question: "ai.match.step2.question_model",
  step2Vision: "ai.match.step2.vision_model",
  step2Fallback: "ai.match.step2.fallback_model",
  step3Deep: "ai.match.step3.deep_model",
  step3RequireConfirm: "ai.match.step3.require_recruiter_confirm",
} as const;

export const DEFAULT_STEP1_MODEL = "grok-4-fast";
export const DEFAULT_STEP2_MODEL = "grok-4-fast";
export const DEFAULT_STEP2_FALLBACK_MODEL = "gemini-2.5-flash-lite";
export const DEFAULT_STEP3_MODEL = "gemini-3.1-pro-preview";
export const DEFAULT_STEP3_GROK_MODEL = "grok-4.6";
export const DEFAULT_STEP1_FALLBACKS = [
  "gemini-2.5-flash-lite",
  "gpt-5.4-nano",
] as const;
export const DEFAULT_STEP2_FALLBACKS = [DEFAULT_STEP2_FALLBACK_MODEL] as const;
export const DEFAULT_STEP3_FALLBACKS = ["gpt-5.4", "claude-sonnet-5"] as const;

/** Retired Gemini IDs that still appear in env or prompt-catalog config. */
const RETIRED_MODEL_ALIASES: Record<string, string> = {
  "gemini-2.5-pro": DEFAULT_STEP3_MODEL,
};

export type MatchAnalysisStep = "step1" | "step2" | "step3";

/** GPT-5.4 full, Claude Sonnet, or Grok flagship — not allowed on Step 1 / 2. */
const STEP1_BLOCKED =
  /claude|sonnet|gpt-5\.4(?!-nano)|grok-(?!4-fast)|gemini-2\.5-pro|gemini-3\.1-pro|gemini-1\.5-pro/i;

/** Flash-Lite / grok-4-fast / nano — not allowed for the Step 3 submit recommendation. */
const STEP3_BLOCKED = /flash-lite|grok-4-fast|gpt-5\.4-nano/i;

export function matchConfigEnvName(dottedKey: string): string {
  return dottedKey.replace(/\./g, "_").toUpperCase();
}

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function envFlag(name: string, fallback: boolean): boolean {
  const raw = readEnv(name);
  if (!raw) return fallback;
  return !["0", "false", "no", "off"].includes(raw.toLowerCase());
}

export function isBlockedStep1Model(model: string): boolean {
  return STEP1_BLOCKED.test(model.trim());
}

export function isBlockedStep3Model(model: string): boolean {
  return STEP3_BLOCKED.test(model.trim());
}

function remapRetiredModel(model: string): string {
  return RETIRED_MODEL_ALIASES[model.trim().toLowerCase()] ?? model;
}

export function sanitizeStep1Model(model: string, fallback = DEFAULT_STEP1_MODEL): string {
  const trimmed = model.trim();
  if (!trimmed || isBlockedStep1Model(trimmed)) return fallback;
  return trimmed;
}

export function sanitizeStep3Model(model: string, fallback = DEFAULT_STEP3_MODEL): string {
  const remapped = remapRetiredModel(model.trim());
  if (!remapped || isBlockedStep3Model(remapped)) return fallback;
  return remapped;
}

export function deepMatchModelForProvider(provider: "gemini" | "grok"): string {
  if (provider === "grok") {
    const fromEnv =
      readEnv("AI_MATCH_STEP3_DEEP_GROK_MODEL") ||
      readEnv("XAI_MATCH_DEEP_MODEL") ||
      readEnv("GROK_MATCH_DEEP_MODEL");
    return sanitizeStep3Model(fromEnv, DEFAULT_STEP3_GROK_MODEL);
  }
  return getMatchStepModels().step3Deep;
}

/**
 * xAI Responses API reasoning.effort for a Grok model id.
 * Flagship Grok 4.5+ rejects "none" (always-on reasoning) → use "low".
 * Fast / non-reasoning / 4.3 variants still accept "none".
 */
export function grokReasoningEffort(model: string): "none" | "low" {
  const id = model.trim().toLowerCase();
  if (!id) return "none";
  if (id.includes("fast") || id.includes("non-reasoning")) return "none";
  // grok-4.5, grok-4.6, grok-4.7, grok-4.20-… (not -fast / non-reasoning)
  if (/^grok-4\.(?:[5-9]|\d{2,})\b/.test(id) || /^grok-5\b/.test(id)) {
    return "low";
  }
  return "none";
}

export type MatchStepModelConfig = {
  step1Extract: string;
  step1Classify: string;
  step2Question: string;
  step2Vision: string;
  step2Fallback: string;
  step3Deep: string;
  requireRecruiterConfirm: boolean;
};

export type Step2ModelRoute = {
  primary: { provider: "gemini" | "grok"; model: string };
  fallback: { provider: "gemini" | "grok"; model: string };
};

/** Step 2 Verifications: grok-4-fast primary → gemini-2.5-flash-lite fallback. */
export function getStep2QuestionRoute(): Step2ModelRoute {
  const models = getMatchStepModels();
  return {
    primary: {
      provider: providerForModel(models.step2Question, "grok"),
      model: models.step2Question,
    },
    fallback: {
      provider: providerForModel(models.step2Fallback, "gemini"),
      model: models.step2Fallback,
    },
  };
}

export function getMatchStepModels(): MatchStepModelConfig {
  return {
    step1Extract: sanitizeStep1Model(
      readEnv(matchConfigEnvName(MATCH_CONFIG_KEYS.step1Extract)) || DEFAULT_STEP1_MODEL
    ),
    step1Classify: sanitizeStep1Model(
      readEnv(matchConfigEnvName(MATCH_CONFIG_KEYS.step1Classify)) || DEFAULT_STEP1_MODEL
    ),
    step2Question: sanitizeStep1Model(
      readEnv(matchConfigEnvName(MATCH_CONFIG_KEYS.step2Question)) || DEFAULT_STEP2_MODEL
    ),
    step2Vision: sanitizeStep1Model(
      readEnv(matchConfigEnvName(MATCH_CONFIG_KEYS.step2Vision)) || DEFAULT_STEP2_MODEL
    ),
    step2Fallback: sanitizeStep1Model(
      readEnv(matchConfigEnvName(MATCH_CONFIG_KEYS.step2Fallback)) ||
        DEFAULT_STEP2_FALLBACK_MODEL,
      DEFAULT_STEP2_FALLBACK_MODEL
    ),
    step3Deep: sanitizeStep3Model(
      readEnv(matchConfigEnvName(MATCH_CONFIG_KEYS.step3Deep)) || DEFAULT_STEP3_MODEL
    ),
    requireRecruiterConfirm: envFlag(
      matchConfigEnvName(MATCH_CONFIG_KEYS.step3RequireConfirm),
      true
    ),
  };
}

export function providerForModel(
  model: string,
  fallback: "gemini" | "grok" = "gemini"
): "gemini" | "grok" {
  const lower = model.toLowerCase();
  if (lower.includes("gemini")) return "gemini";
  if (lower.includes("grok")) return "grok";
  return fallback;
}
