import "server-only";

import OpenAI from "openai";
import {
  buildMatchAnalysisRepairPrompt,
  buildMatchAnalysisUserPrompt,
  MATCH_ANALYSIS_SYSTEM_PROMPT,
  truncateStrengthsAndGaps,
  type MatchAnalysisUserPromptInput,
} from "./prompts";
import { parseAndValidateMatchAnalysis } from "./parse";
import { rescoreMatchAnalysis } from "./score";
import { MATCH_ANALYSIS_ERROR, type MatchAnalysisResponse } from "./schema";

const DEFAULT_MODEL = "grok-4-fast";
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
    | "UNKNOWN";

  constructor(
    code: MatchAnalysisGenerationError["code"],
    message = MATCH_ANALYSIS_ERROR
  ) {
    super(message);
    this.name = "MatchAnalysisGenerationError";
    this.code = code;
  }
}

function resolveApiKey(): string {
  return (
    process.env.XAI_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    ""
  );
}

function resolveBaseUrl(): string {
  return (process.env.GROK_BASE_URL?.trim() || "https://api.x.ai/v1").replace(/\/$/, "");
}

function resolveModel(): string {
  return (
    process.env.XAI_MATCH_MODEL?.trim() ||
    process.env.GROK_MATCH_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

let client: OpenAI | null = null;

function getGrokClient(): OpenAI {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new MatchAnalysisGenerationError("MISSING_CONFIG");
  }
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: resolveBaseUrl(),
      timeout: API_TIMEOUT_MS,
      maxRetries: 0,
    });
  }
  return client;
}

/** Test hook: inject a mock OpenAI/Grok client. */
export function __setGrokClientForTests(mock: OpenAI | null): void {
  client = mock;
}

export function getMatchAnalysisModelName(): string {
  return resolveModel();
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
}): Promise<string> {
  const openai = getGrokClient();
  try {
    const response = await openai.responses.create({
      model: resolveModel(),
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

export type GrokMatchAnalysisResult = {
  analysis: MatchAnalysisResponse;
  rawText: string;
  rawObject: Record<string, unknown> | null;
  repaired: boolean;
  model: string;
};

/**
 * Call Grok, parse/validate JSON, one repair turn on failure, then deterministic rescore.
 */
export async function generateMatchAnalysisWithGrok(
  input: MatchAnalysisUserPromptInput
): Promise<GrokMatchAnalysisResult> {
  const resumeLen = input.resumeText.length;
  const maxTokens = resumeLen > LONG_RESUME_CHARS ? LONG_RESUME_MAX_TOKENS : BASE_MAX_TOKENS;
  const userPrompt = buildMatchAnalysisUserPrompt(input);

  const rawText = await callGrok({
    system: MATCH_ANALYSIS_SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens,
  });

  let parsed = parseAndValidateMatchAnalysis(rawText);
  let repaired = false;
  let finalRawText = rawText;

  if (!parsed.ok) {
    const repairUser = buildMatchAnalysisRepairPrompt({
      badJson: rawText,
      validationErrors: parsed.errors,
    });
    const repairedText = await callGrok({
      system: MATCH_ANALYSIS_SYSTEM_PROMPT,
      user: repairUser,
      maxTokens,
    });
    finalRawText = repairedText;
    parsed = parseAndValidateMatchAnalysis(repairedText);
    repaired = true;
    if (!parsed.ok) {
      throw new MatchAnalysisGenerationError("INVALID_RESPONSE");
    }
  }

  const truncated = truncateStrengthsAndGaps(parsed.data, resumeLen);
  const analysis = rescoreMatchAnalysis(truncated);

  return {
    analysis,
    rawText: finalRawText,
    rawObject: parsed.rawObject,
    repaired,
    model: resolveModel(),
  };
}
