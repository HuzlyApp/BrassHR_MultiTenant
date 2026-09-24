import "server-only";

import OpenAI from "openai";
import { assembleMatchAnalysisVariables } from "@/lib/ai-catalog/assemble-match-variables";
import { renderPromptTemplate } from "@/lib/ai-catalog/render-prompt";
import { parseJsonObject, validateAgainstJsonSchema } from "@/lib/ai-catalog/validate-response";
import type { ResolvedPromptVersion } from "@/lib/ai-catalog/types";
import {
  ANALYZE_SYSTEM_PROMPT,
  buildMatchAnalysisRepairPrompt,
  buildMatchAnalysisUserPrompt,
  truncateStrengthsAndGaps,
  type MatchAnalysisUserPromptInput,
} from "./prompts";
import {
  FOLLOW_UP_SYSTEM_PROMPT,
  buildFollowUpQuestionsPrompt,
  buildFollowUpRepairPrompt,
  parseFollowUpQuestions,
  type ChecklistFollowUpRow,
} from "./follow-up-questions";
import { parseAndValidateMatchAnalysis } from "./parse";
import { rescoreMatchAnalysis } from "./score";
import {
  DEFAULT_ANALYSIS_PROVIDER,
  MATCH_ANALYSIS_ERROR,
  parseAnalysisProvider,
  type AnalysisProvider,
  type MatchAnalysisResponse,
} from "./schema";
import type { AnalysisScreeningQuestion } from "./workspace";
import {
  deepMatchModelForProvider,
  DEFAULT_STEP1_FALLBACKS,
  getMatchStepModels,
  getStep2QuestionRoute,
  grokReasoningEffort,
  isBlockedStep1Model,
  isBlockedStep3Model,
  sanitizeStep1Model,
  sanitizeStep3Model,
} from "./step-config";

const DEFAULT_GROK_MODEL = "grok-4-fast";
/** Quick Match Gemini default — FSD Step 1 Flash-Lite (not gemini-flash-latest). */
const DEFAULT_GEMINI_MODEL = DEFAULT_STEP1_FALLBACKS[0];
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TEMPERATURE = 0;
const BASE_MAX_TOKENS = 16_000;
const LONG_RESUME_MAX_TOKENS = 24_000;
const LONG_RESUME_CHARS = 8_000;
const DEFAULT_API_TIMEOUT_MS = 90_000;
/** Flagship Deep Match (reasoning) often needs longer than Quick Match. */
const DEFAULT_DEEP_API_TIMEOUT_MS = 120_000;

function readTimeoutMs(envName: string, fallback: number): number {
  const raw = Number(process.env[envName]);
  if (Number.isFinite(raw) && raw >= 5_000) return Math.floor(raw);
  return fallback;
}

function apiTimeoutMs(): number {
  return readTimeoutMs("MATCH_ANALYSIS_TIMEOUT_MS", DEFAULT_API_TIMEOUT_MS);
}

function deepApiTimeoutMs(): number {
  return Math.max(
    apiTimeoutMs(),
    readTimeoutMs("MATCH_ANALYSIS_DEEP_TIMEOUT_MS", DEFAULT_DEEP_API_TIMEOUT_MS)
  );
}

/** Primary Grok Deep Match attempt — leave headroom for Gemini fallback within maxDuration. */
function deepGrokAttemptTimeoutMs(): number {
  return Math.min(
    deepApiTimeoutMs(),
    readTimeoutMs("MATCH_ANALYSIS_DEEP_GROK_TIMEOUT_MS", 60_000)
  );
}

export class MatchAnalysisGenerationError extends Error {
  readonly code:
    | "MISSING_CONFIG"
    | "TIMEOUT"
    | "AUTH"
    | "RATE_LIMIT"
    | "INVALID_RESPONSE"
    | "EMPTY"
    | "NETWORK"
    | "UNKNOWN"
    | "PROMPT_NOT_CONFIGURED";

  constructor(
    code: MatchAnalysisGenerationError["code"],
    message = MATCH_ANALYSIS_ERROR
  ) {
    super(message);
    this.name = "MatchAnalysisGenerationError";
    this.code = code;
  }
}

function resolveGrokApiKey(): string {
  return (
    process.env.XAI_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    ""
  );
}

function resolveGrokBaseUrl(): string {
  return (process.env.GROK_BASE_URL?.trim() || "https://api.x.ai/v1").replace(/\/$/, "");
}

function resolveGrokModel(): string {
  return (
    process.env.XAI_MATCH_MODEL?.trim() ||
    process.env.GROK_MATCH_MODEL?.trim() ||
    DEFAULT_GROK_MODEL
  );
}

function resolveGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    ""
  );
}

function resolveGeminiBaseUrl(): string {
  return (process.env.GEMINI_BASE_URL?.trim() || GEMINI_API_BASE).replace(/\/$/, "");
}

function resolveGeminiModel(): string {
  const fromEnv = process.env.GEMINI_MATCH_MODEL?.trim() || "";
  if (fromEnv) return sanitizeStep1Model(fromEnv, DEFAULT_GEMINI_MODEL);
  // Step 1 catalog/env may pin Grok Fast; Gemini provider must still call a Gemini model.
  const fromConfig = getMatchStepModels().step1Extract.trim();
  if (fromConfig.toLowerCase().includes("gemini")) {
    return sanitizeStep1Model(fromConfig, DEFAULT_GEMINI_MODEL);
  }
  return DEFAULT_GEMINI_MODEL;
}

let grokClient: OpenAI | null = null;
let geminiFetchImpl: typeof fetch | null = null;

function getGrokClient(): OpenAI {
  if (grokClient) return grokClient;
  const apiKey = resolveGrokApiKey();
  if (!apiKey) {
    throw new MatchAnalysisGenerationError("MISSING_CONFIG");
  }
  grokClient = new OpenAI({
    apiKey,
    baseURL: resolveGrokBaseUrl(),
    timeout: apiTimeoutMs(),
    maxRetries: 0,
  });
  return grokClient;
}

/** Test hook: inject a mock OpenAI/Grok client. */
export function __setGrokClientForTests(mock: OpenAI | null): void {
  grokClient = mock;
}

/** Test hook: inject a mock fetch for Gemini requests. */
export function __setGeminiFetchForTests(mock: typeof fetch | null): void {
  geminiFetchImpl = mock;
}

export function getMatchAnalysisModelName(
  provider: AnalysisProvider = DEFAULT_ANALYSIS_PROVIDER
): string {
  return parseAnalysisProvider(provider) === "grok" ? resolveGrokModel() : resolveGeminiModel();
}

function modelForProvider(
  provider: AnalysisProvider,
  cfg: Record<string, unknown>,
  analysisMode: "analyze" | "deep" = "analyze"
): string {
  if (analysisMode === "deep") {
    const deepDefault = deepMatchModelForProvider(provider);
    const configured = typeof cfg.model === "string" ? cfg.model.trim() : "";
    if (!configured || isBlockedStep3Model(configured)) return deepDefault;
    const lower = configured.toLowerCase();
    if (provider === "gemini") {
      return lower.includes("gemini")
        ? sanitizeStep3Model(configured, deepDefault)
        : deepDefault;
    }
    return lower.includes("gemini")
      ? deepDefault
      : sanitizeStep3Model(configured, deepDefault);
  }

  const configured = typeof cfg.model === "string" ? cfg.model.trim() : "";
  const fallback = getMatchAnalysisModelName(provider);
  if (!configured) return fallback;
  const lower = configured.toLowerCase();
  if (provider === "gemini") {
    // Catalog may still pin Grok; keep Gemini Quick Match on Step 1 Flash-Lite.
    if (!lower.includes("gemini") || isBlockedStep1Model(configured)) return fallback;
    return sanitizeStep1Model(configured, fallback);
  }
  return lower.includes("gemini") ? fallback : configured;
}

function extractOutputText(response: {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }).candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  const texts = parts
    .map((part) => (typeof part.text === "string" ? part.text.trim() : ""))
    .filter(Boolean);
  if (!texts.length) return "";
  // Prefer a part that looks like JSON (newer Gemini models may also emit thought text).
  const jsonLike = [...texts].reverse().find((t) => t.startsWith("{") || t.startsWith("["));
  return (jsonLike ?? texts[texts.length - 1] ?? "").trim();
}

export function matchAnalysisErrorCode(error: unknown): MatchAnalysisGenerationError["code"] | "UNKNOWN" {
  if (error instanceof MatchAnalysisGenerationError) return error.code;
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "MatchAnalysisGenerationError" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as MatchAnalysisGenerationError).code;
  }
  return "UNKNOWN";
}

function mapApiError(error: unknown): MatchAnalysisGenerationError {
  if (error instanceof MatchAnalysisGenerationError) return error;
  const anyErr = error as { status?: number; message?: string; name?: string; code?: string };
  const status = anyErr?.status;
  const code = String(anyErr?.code ?? "");
  const msg = (anyErr?.message || "").toLowerCase();

  if (status === 401 || status === 403 || code === "invalid_api_key") {
    return new MatchAnalysisGenerationError("AUTH");
  }
  if (status === 429) {
    return new MatchAnalysisGenerationError("RATE_LIMIT");
  }
  if (
    status === 408 ||
    code === "ETIMEDOUT" ||
    code === "ECONNABORTED" ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("aborted") ||
    anyErr?.name === "AbortError"
  ) {
    return new MatchAnalysisGenerationError("TIMEOUT");
  }
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("econn")
  ) {
    return new MatchAnalysisGenerationError("NETWORK");
  }
  // Gemini often returns 400/404 for retired or invalid model ids.
  if (status === 400 || status === 404) {
    return new MatchAnalysisGenerationError("INVALID_RESPONSE");
  }
  return new MatchAnalysisGenerationError("UNKNOWN");
}

async function callGrok(args: {
  system: string;
  user: string;
  maxTokens: number;
  model?: string;
  timeoutMs?: number;
}): Promise<string> {
  const openai = getGrokClient();
  const model = args.model || resolveGrokModel();
  const timeoutMs = args.timeoutMs ?? apiTimeoutMs();
  const startedAt = Date.now();
  try {
    const response = await openai.responses.create(
      {
        model,
        temperature: TEMPERATURE,
        max_output_tokens: args.maxTokens,
        reasoning: { effort: grokReasoningEffort(model) },
        input: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      },
      { timeout: timeoutMs }
    );
    const text = extractOutputText(response);
    if (!text) {
      throw new MatchAnalysisGenerationError("EMPTY");
    }
    return text;
  } catch (error) {
    if (error instanceof MatchAnalysisGenerationError) throw error;
    const anyErr = error as { status?: number; message?: string; code?: string; name?: string };
    console.error("[match-analysis] grok request failed", {
      model,
      timeoutMs,
      elapsedMs: Date.now() - startedAt,
      status: anyErr?.status ?? null,
      code: anyErr?.code ?? null,
      name: anyErr?.name ?? null,
      detail: String(anyErr?.message ?? error).slice(0, 500),
    });
    throw mapApiError(error);
  }
}

async function callGemini(args: {
  system: string;
  user: string;
  maxTokens: number;
  model?: string;
  timeoutMs?: number;
}): Promise<string> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new MatchAnalysisGenerationError("MISSING_CONFIG");
  }

  const model = args.model || resolveGeminiModel();
  const timeoutMs = args.timeoutMs ?? apiTimeoutMs();
  const url = `${resolveGeminiBaseUrl()}/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const doFetch = geminiFetchImpl ?? fetch;

  try {
    const response = await doFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: "user", parts: [{ text: args.user }] }],
        generationConfig: {
          temperature: TEMPERATURE,
          maxOutputTokens: args.maxTokens,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      let detail = `Gemini HTTP ${response.status}`;
      try {
        const errBody: unknown = await response.json();
        const message =
          errBody &&
          typeof errBody === "object" &&
          "error" in errBody &&
          errBody.error &&
          typeof errBody.error === "object" &&
          "message" in errBody.error &&
          typeof errBody.error.message === "string"
            ? errBody.error.message
            : null;
        if (message) detail = message.slice(0, 500);
      } catch {
        /* keep status-only detail */
      }
      console.error("[match-analysis] gemini request failed", {
        model,
        status: response.status,
        detail,
      });
      throw mapApiError({
        status: response.status,
        message: detail,
      });
    }

    const payload: unknown = await response.json().catch(() => null);
    const text = extractGeminiText(payload);
    if (!text) {
      throw new MatchAnalysisGenerationError("EMPTY");
    }
    return text;
  } catch (error) {
    if (error instanceof MatchAnalysisGenerationError) throw error;
    throw mapApiError(error);
  } finally {
    clearTimeout(timer);
  }
}

async function callProvider(
  provider: AnalysisProvider,
  args: {
    system: string;
    user: string;
    maxTokens: number;
    model: string;
    timeoutMs?: number;
  }
): Promise<string> {
  if (provider === "grok") {
    return callGrok(args);
  }
  return callGemini(args);
}

function shouldFallbackDeepProvider(error: unknown): boolean {
  const code = matchAnalysisErrorCode(error);
  return code === "TIMEOUT" || code === "NETWORK" || code === "UNKNOWN" || code === "RATE_LIMIT";
}

/**
 * Deep Match: try the selected provider, then fall back Grok → Gemini on transport failures.
 * Quick Match stays single-provider (volume routing is handled elsewhere).
 */
async function callProviderWithDeepFallback(args: {
  provider: AnalysisProvider;
  analysisMode: "analyze" | "deep";
  system: string;
  user: string;
  maxTokens: number;
  model: string;
  modelConfig: Record<string, unknown>;
}): Promise<{ text: string; provider: AnalysisProvider; model: string }> {
  const canFallbackToGemini = args.analysisMode === "deep" && args.provider === "grok";
  const timeoutMs =
    args.analysisMode === "deep"
      ? canFallbackToGemini
        ? deepGrokAttemptTimeoutMs()
        : deepApiTimeoutMs()
      : apiTimeoutMs();
  try {
    const text = await callProvider(args.provider, {
      system: args.system,
      user: args.user,
      maxTokens: args.maxTokens,
      model: args.model,
      timeoutMs,
    });
    return { text, provider: args.provider, model: args.model };
  } catch (error) {
    if (!canFallbackToGemini || !shouldFallbackDeepProvider(error)) {
      throw error;
    }
    const fallbackModel = modelForProvider("gemini", args.modelConfig, "deep");
    console.warn("[match-analysis] deep grok failed; falling back to gemini", {
      primaryModel: args.model,
      fallbackModel,
      code: matchAnalysisErrorCode(error),
    });
    const text = await callProvider("gemini", {
      system: args.system,
      user: args.user,
      maxTokens: args.maxTokens,
      model: fallbackModel,
      timeoutMs: deepApiTimeoutMs(),
    });
    return { text, provider: "gemini", model: fallbackModel };
  }
}

export type MatchAnalysisGenerationResult = {
  analysis: MatchAnalysisResponse;
  rawText: string;
  rawObject: Record<string, unknown> | null;
  repaired: boolean;
  model: string;
};

/** @deprecated Use MatchAnalysisGenerationResult. */
export type GrokMatchAnalysisResult = MatchAnalysisGenerationResult;

/**
 * Call the selected provider. Quick Match (analyze) uses the hardcoded Step 1 prompt
 * for now. Deep Match still requires a database-resolved prompt.
 */
export async function generateMatchAnalysis(
  input: MatchAnalysisUserPromptInput,
  resolved: ResolvedPromptVersion | null,
  provider: AnalysisProvider = DEFAULT_ANALYSIS_PROVIDER
): Promise<MatchAnalysisGenerationResult> {
  const selectedProvider = parseAnalysisProvider(provider);
  const resumeLen = input.resumeText.length;
  const analysisMode = input.analysisMode === "deep" || resolved?.variantKey === "deep" ? "deep" : "analyze";
  const cfg = resolved?.modelConfig ?? {};
  const longResumeChars = Number(cfg.long_resume_chars ?? LONG_RESUME_CHARS);
  const maxTokens =
    resumeLen > longResumeChars
      ? Number(cfg.long_resume_max_tokens ?? LONG_RESUME_MAX_TOKENS)
      : Number(cfg.base_max_tokens ?? BASE_MAX_TOKENS);

  const system =
    analysisMode === "deep" ? resolved?.systemPrompt?.trim() ?? "" : ANALYZE_SYSTEM_PROMPT;
  if (!system.trim()) {
    throw new MatchAnalysisGenerationError("PROMPT_NOT_CONFIGURED");
  }

  const userPrompt =
    analysisMode === "deep"
      ? renderPromptTemplate(
          resolved?.userPromptTemplate ?? "",
          assembleMatchAnalysisVariables(input),
          { required: ["job_description", "candidate_resume"] }
        )
      : buildMatchAnalysisUserPrompt({ ...input, analysisMode: "analyze" });
  const model = modelForProvider(selectedProvider, cfg, analysisMode);

  const primary = await callProviderWithDeepFallback({
    provider: selectedProvider,
    analysisMode,
    system,
    user: userPrompt,
    maxTokens,
    model,
    modelConfig: cfg,
  });
  let activeProvider = primary.provider;
  let activeModel = primary.model;
  const rawText = primary.text;

  let parsedJson = parseJsonObject(rawText);
  let parsed = parseAndValidateMatchAnalysis(rawText);
  let schemaErrors =
    analysisMode === "deep" && resolved && parsedJson.ok
      ? validateAgainstJsonSchema(parsedJson.value, resolved.responseSchema)
      : parsed.ok
        ? []
        : parsed.errors;
  let repaired = false;
  let finalRawText = rawText;

  if (!parsed.ok || schemaErrors.length) {
    const repairUser = buildMatchAnalysisRepairPrompt({
      badJson: rawText,
      validationErrors: [...schemaErrors, ...(parsed.ok ? [] : parsed.errors)],
      analysisMode,
      responseSchema: analysisMode === "deep" ? resolved?.responseSchema : null,
    });
    const repairedCall = await callProviderWithDeepFallback({
      provider: activeProvider,
      analysisMode,
      system,
      user: repairUser,
      maxTokens,
      model: activeModel,
      modelConfig: cfg,
    });
    activeProvider = repairedCall.provider;
    activeModel = repairedCall.model;
    finalRawText = repairedCall.text;
    parsedJson = parseJsonObject(repairedCall.text);
    parsed = parseAndValidateMatchAnalysis(repairedCall.text);
    schemaErrors =
      analysisMode === "deep" && resolved && parsedJson.ok
        ? validateAgainstJsonSchema(parsedJson.value, resolved.responseSchema)
        : parsed.ok
          ? []
          : parsed.errors;
    repaired = true;
    if (!parsed.ok || schemaErrors.length) {
      console.error("[match-analysis] INVALID_RESPONSE after repair", {
        analysisMode,
        provider: activeProvider,
        model: activeModel,
        parseErrors: parsed.ok ? [] : parsed.errors.slice(0, 20),
        schemaErrors: schemaErrors.slice(0, 20),
      });
      throw new MatchAnalysisGenerationError("INVALID_RESPONSE");
    }
  }

  const truncated = truncateStrengthsAndGaps(parsed.data, resumeLen, analysisMode);
  const analysis = analysisMode === "deep" ? rescoreMatchAnalysis(truncated) : truncated;

  return {
    analysis,
    rawText: finalRawText,
    rawObject: parsed.rawObject,
    repaired,
    model: activeModel,
  };
}

export async function generateFollowUpQuestions(
  input: {
    jobTitle?: string | null;
    checklist: ChecklistFollowUpRow[];
  },
  _provider: AnalysisProvider = DEFAULT_ANALYSIS_PROVIDER
): Promise<{
  questions: AnalysisScreeningQuestion[];
  repaired: boolean;
  model: string;
  rawObject: Record<string, unknown> | null;
}> {
  // FS-AI-MATCH Step 2: grok-4-fast primary → gemini-2.5-flash-lite fallback.
  // Provider toggle is ignored so volume routing stays consistent.
  void _provider;
  const route = getStep2QuestionRoute();
  const system = FOLLOW_UP_SYSTEM_PROMPT;
  const userPrompt = buildFollowUpQuestionsPrompt(input);

  async function runOnce(provider: AnalysisProvider, model: string) {
    const rawText = await callProvider(provider, {
      system,
      user: userPrompt,
      maxTokens: BASE_MAX_TOKENS,
      model,
    });

    let parsed = parseFollowUpQuestions(rawText);
    let repaired = false;
    if (!parsed.ok) {
      const repairedText = await callProvider(provider, {
        system,
        user: buildFollowUpRepairPrompt({
          badJson: rawText,
          validationErrors: parsed.errors,
        }),
        maxTokens: BASE_MAX_TOKENS,
        model,
      });
      parsed = parseFollowUpQuestions(repairedText);
      repaired = true;
    }
    if (!parsed.ok) {
      throw new MatchAnalysisGenerationError("INVALID_RESPONSE");
    }
    return {
      questions: parsed.questions,
      repaired,
      model,
      rawObject: parsed.rawObject,
    };
  }

  try {
    return await runOnce(route.primary.provider, route.primary.model);
  } catch (primaryError) {
    const sameModel =
      route.primary.model.toLowerCase() === route.fallback.model.toLowerCase() &&
      route.primary.provider === route.fallback.provider;
    if (sameModel) throw primaryError;
    const code =
      primaryError instanceof MatchAnalysisGenerationError ? primaryError.code : "UNKNOWN";
    if (code === "INVALID_RESPONSE" || code === "PROMPT_NOT_CONFIGURED") {
      throw primaryError;
    }
    try {
      return await runOnce(route.fallback.provider, route.fallback.model);
    } catch {
      throw primaryError;
    }
  }
}

/** @deprecated Use generateMatchAnalysis(..., "grok"). */
export async function generateMatchAnalysisWithGrok(
  input: MatchAnalysisUserPromptInput,
  resolved: ResolvedPromptVersion | null
): Promise<MatchAnalysisGenerationResult> {
  return generateMatchAnalysis(input, resolved, "grok");
}
