import "server-only";

import OpenAI from "openai";
import { assembleMatchAnalysisVariables } from "@/lib/ai-catalog/assemble-match-variables";
import { renderPromptTemplate } from "@/lib/ai-catalog/render-prompt";
import { parseJsonObject, validateAgainstJsonSchema } from "@/lib/ai-catalog/validate-response";
import type { ResolvedPromptVersion } from "@/lib/ai-catalog/types";
import { buildMatchAnalysisRepairPrompt, truncateStrengthsAndGaps, type MatchAnalysisUserPromptInput } from "./prompts";
import { parseAndValidateMatchAnalysis } from "./parse";
import { rescoreMatchAnalysis } from "./score";
import {
  DEFAULT_ANALYSIS_PROVIDER,
  MATCH_ANALYSIS_ERROR,
  parseAnalysisProvider,
  type AnalysisProvider,
  type MatchAnalysisResponse,
} from "./schema";

const DEFAULT_GROK_MODEL = "grok-4-fast";
const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
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
  return process.env.GEMINI_MATCH_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
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
  cfg: Record<string, unknown>
): string {
  const configured = typeof cfg.model === "string" ? cfg.model.trim() : "";
  const fallback = getMatchAnalysisModelName(provider);
  if (!configured) return fallback;
  const lower = configured.toLowerCase();
  if (provider === "gemini") {
    return lower.includes("gemini") ? configured : fallback;
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
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
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
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("econn")
  ) {
    return new MatchAnalysisGenerationError("NETWORK");
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
 * Call the selected provider using a database-resolved prompt. Never falls back to a hard-coded body.
 */
export async function generateMatchAnalysis(
  input: MatchAnalysisUserPromptInput,
  resolved: ResolvedPromptVersion,
  provider: AnalysisProvider = DEFAULT_ANALYSIS_PROVIDER
): Promise<MatchAnalysisGenerationResult> {
  const selectedProvider = parseAnalysisProvider(provider);
  const resumeLen = input.resumeText.length;
  const cfg = resolved.modelConfig ?? {};
  const longResumeChars = Number(cfg.long_resume_chars ?? LONG_RESUME_CHARS);
  const maxTokens =
    resumeLen > longResumeChars
      ? Number(cfg.long_resume_max_tokens ?? LONG_RESUME_MAX_TOKENS)
      : Number(cfg.base_max_tokens ?? BASE_MAX_TOKENS);
  const analysisMode = resolved.variantKey === "deep" ? "deep" : "analyze";
  const system = resolved.systemPrompt;
  if (!system.trim()) {
    throw new MatchAnalysisGenerationError("PROMPT_NOT_CONFIGURED");
  }
  const userPrompt = renderPromptTemplate(
    resolved.userPromptTemplate,
    assembleMatchAnalysisVariables(input),
    { required: ["job_description", "candidate_resume"] }
  );
  const model = modelForProvider(selectedProvider, cfg);

  const rawText = await callProvider(selectedProvider, {
    system,
    user: userPrompt,
    maxTokens,
    model,
  });

  let parsedJson = parseJsonObject(rawText);
  let schemaErrors = parsedJson.ok
    ? validateAgainstJsonSchema(parsedJson.value, resolved.responseSchema)
    : [parsedJson.error];
  let parsed = parseAndValidateMatchAnalysis(rawText);
  let repaired = false;
  let finalRawText = rawText;

  if (!parsed.ok || schemaErrors.length) {
    const repairUser = buildMatchAnalysisRepairPrompt({
      badJson: rawText,
      validationErrors: [...schemaErrors, ...(parsed.ok ? [] : parsed.errors)],
      analysisMode,
      responseSchema: resolved.responseSchema,
    });
    const repairedText = await callProvider(selectedProvider, {
      system,
      user: repairUser,
      maxTokens,
      model,
    });
    finalRawText = repairedText;
    parsedJson = parseJsonObject(repairedText);
    schemaErrors = parsedJson.ok
      ? validateAgainstJsonSchema(parsedJson.value, resolved.responseSchema)
      : [parsedJson.error];
    parsed = parseAndValidateMatchAnalysis(repairedText);
    repaired = true;
    if (!parsed.ok || schemaErrors.length) {
      throw new MatchAnalysisGenerationError("INVALID_RESPONSE");
    }
  }

  const truncated = truncateStrengthsAndGaps(parsed.data, resumeLen, analysisMode);
  const analysis = rescoreMatchAnalysis(truncated);

  return {
    analysis,
    rawText: finalRawText,
    rawObject: parsed.rawObject,
    repaired,
    model,
  };
}

/** @deprecated Use generateMatchAnalysis(..., "grok"). */
export async function generateMatchAnalysisWithGrok(
  input: MatchAnalysisUserPromptInput,
  resolved: ResolvedPromptVersion
): Promise<MatchAnalysisGenerationResult> {
  return generateMatchAnalysis(input, resolved, "grok");
}
