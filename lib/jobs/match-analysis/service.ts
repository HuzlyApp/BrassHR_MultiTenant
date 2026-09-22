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
  DEFAULT_STEP1_MODEL,
  getMatchStepModels,
  isBlockedStep1Model,
  isBlockedStep3Model,
  sanitizeStep1Model,
  sanitizeStep3Model,
} from "./step-config";

const DEFAULT_GROK_MODEL = "grok-4-fast";
/** Quick Match Gemini default — FSD Step 1 Flash-Lite (not gemini-flash-latest). */
const DEFAULT_GEMINI_MODEL = DEFAULT_STEP1_MODEL;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TEMPERATURE = 0;
const BASE_MAX_TOKENS = 16_000;
const LONG_RESUME_MAX_TOKENS = 24_000;
const LONG_RESUME_CHARS = 8_000;
const API_TIMEOUT_MS = Number(process.env.MATCH_ANALYSIS_TIMEOUT_MS ?? 90_000);

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
  return sanitizeStep1Model(getMatchStepModels().step1Extract, DEFAULT_GEMINI_MODEL);
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
    timeout: API_TIMEOUT_MS,
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
}): Promise<string> {
  const openai = getGrokClient();
  try {
    const response = await openai.responses.create({
      model: args.model || resolveGrokModel(),
      temperature: TEMPERATURE,
      max_output_tokens: args.maxTokens,
      reasoning: { effort: "none" },
      input: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    });
    const text = extractOutputText(response);
    if (!text) {
      throw new MatchAnalysisGenerationError("EMPTY");
    }
    return text;
  } catch (error) {
    if (error instanceof MatchAnalysisGenerationError) throw error;
    throw mapApiError(error);
  }
}

async function callGemini(args: {
  system: string;
  user: string;
  maxTokens: number;
  model?: string;
}): Promise<string> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new MatchAnalysisGenerationError("MISSING_CONFIG");
  }

  const model = args.model || resolveGeminiModel();
  const url = `${resolveGeminiBaseUrl()}/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
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
  args: { system: string; user: string; maxTokens: number; model: string }
): Promise<string> {
  if (provider === "grok") {
    return callGrok(args);
  }
  return callGemini(args);
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

  const rawText = await callProvider(selectedProvider, {
    system,
    user: userPrompt,
    maxTokens,
    model,
  });

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
    const repairedText = await callProvider(selectedProvider, {
      system,
      user: repairUser,
      maxTokens,
      model,
    });
    finalRawText = repairedText;
    parsedJson = parseJsonObject(repairedText);
    parsed = parseAndValidateMatchAnalysis(repairedText);
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
        provider: selectedProvider,
        model,
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
    model,
  };
}

export async function generateFollowUpQuestions(
  input: {
    jobTitle?: string | null;
    checklist: ChecklistFollowUpRow[];
  },
  provider: AnalysisProvider = DEFAULT_ANALYSIS_PROVIDER
): Promise<{
  questions: AnalysisScreeningQuestion[];
  repaired: boolean;
  model: string;
  rawObject: Record<string, unknown> | null;
}> {
  const selectedProvider = parseAnalysisProvider(provider);
  const model = getMatchAnalysisModelName(selectedProvider);
  const system = FOLLOW_UP_SYSTEM_PROMPT;
  const userPrompt = buildFollowUpQuestionsPrompt(input);

  const rawText = await callProvider(selectedProvider, {
    system,
    user: userPrompt,
    maxTokens: BASE_MAX_TOKENS,
    model,
  });

  let parsed = parseFollowUpQuestions(rawText);
  let repaired = false;
  if (!parsed.ok) {
    const repairedText = await callProvider(selectedProvider, {
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

/** @deprecated Use generateMatchAnalysis(..., "grok"). */
export async function generateMatchAnalysisWithGrok(
  input: MatchAnalysisUserPromptInput,
  resolved: ResolvedPromptVersion | null
): Promise<MatchAnalysisGenerationResult> {
  return generateMatchAnalysis(input, resolved, "grok");
}
