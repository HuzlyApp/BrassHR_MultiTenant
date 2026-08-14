import "server-only";

import OpenAI from "openai";
import { extractJsonObjectFromModelText } from "@/lib/resumeParseQuality";
import {
  buildJobDescriptionUserPrompt,
  JOB_DESCRIPTION_SYSTEM_PROMPT,
} from "./prompts";
import {
  JOB_DESCRIPTION_GENERATE_ERROR,
  type GenerateJobDescriptionRequest,
  type GenerateJobDescriptionResult,
} from "./schema";
import { htmlToPlainText, sanitizeJobDescriptionHtml, boldJobDescriptionSectionTitles } from "./sanitize-html";
import { ensureJobDescriptionBulletLists } from "@/lib/jobs/job-description-html";

const DEFAULT_MODEL = "grok-4.3";
const MAX_OUTPUT_TOKENS = 1100;
const TEMPERATURE = 0.4;
const API_TIMEOUT_MS = 12_000;

export class JobDescriptionGenerationError extends Error {
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
    code: JobDescriptionGenerationError["code"],
    message = JOB_DESCRIPTION_GENERATE_ERROR
  ) {
    super(message);
    this.name = "JobDescriptionGenerationError";
    this.code = code;
  }
}

function resolveModel(): string {
  const fromEnv = process.env.XAI_JOB_DESCRIPTION_MODEL?.trim();
  return fromEnv || DEFAULT_MODEL;
}

function resolveBaseUrl(): string {
  return (process.env.GROK_BASE_URL?.trim() || "https://api.x.ai/v1").replace(/\/$/, "");
}

let client: OpenAI | null = null;

function getGrokClient(): OpenAI {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    throw new JobDescriptionGenerationError("MISSING_CONFIG");
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

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parseModelResult(rawText: string): GenerateJobDescriptionResult {
  const parsed = extractJsonObjectFromModelText(rawText);
  if (!parsed) {
    throw new JobDescriptionGenerationError("INVALID_RESPONSE");
  }

  const rawHtml =
    typeof parsed.descriptionHtml === "string"
      ? parsed.descriptionHtml
      : typeof parsed.description_html === "string"
        ? parsed.description_html
        : "";
  const rawPlain =
    typeof parsed.plainText === "string"
      ? parsed.plainText
      : typeof parsed.plain_text === "string"
        ? parsed.plain_text
        : "";

  const descriptionHtml = ensureJobDescriptionBulletLists(
    boldJobDescriptionSectionTitles(sanitizeJobDescriptionHtml(rawHtml))
  );
  const plainText =
    (typeof rawPlain === "string" && rawPlain.trim()
      ? rawPlain.trim()
      : htmlToPlainText(descriptionHtml)
    ).slice(0, 12_000);

  if (!descriptionHtml && !plainText) {
    throw new JobDescriptionGenerationError("EMPTY");
  }

  // Prefer sanitized HTML; if model only returned plain text, wrap lightly.
  const finalHtml =
    descriptionHtml ||
    plainText
      .split(/\n{2,}/)
      .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
      .join("");

  return {
    descriptionHtml: ensureJobDescriptionBulletLists(
      boldJobDescriptionSectionTitles(sanitizeJobDescriptionHtml(finalHtml))
    ),
    plainText: plainText || htmlToPlainText(finalHtml),
    warnings: normalizeWarnings(parsed.warnings),
  };
}

function mapApiError(error: unknown): JobDescriptionGenerationError {
  if (error instanceof JobDescriptionGenerationError) return error;

  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: number }).status)
      : undefined;
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code ?? "")
      : "";
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (status === 401 || status === 403 || code === "invalid_api_key") {
    return new JobDescriptionGenerationError("AUTH");
  }
  if (status === 429) {
    return new JobDescriptionGenerationError("RATE_LIMIT");
  }
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNABORTED" ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted")
  ) {
    return new JobDescriptionGenerationError("TIMEOUT");
  }
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    message.includes("network") ||
    message.includes("fetch failed")
  ) {
    return new JobDescriptionGenerationError("NETWORK");
  }

  return new JobDescriptionGenerationError("UNKNOWN");
}

/**
 * Generate a suggested job description via xAI Responses API (Grok).
 * Never logs the API key or full description bodies.
 */
export async function generateJobDescriptionWithGrok(
  input: GenerateJobDescriptionRequest,
  options?: { signal?: AbortSignal }
): Promise<GenerateJobDescriptionResult> {
  const openai = getGrokClient();
  const model = resolveModel();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  options?.signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await openai.responses.create(
      {
        model,
        temperature: TEMPERATURE,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: "none" },
        input: [
          {
            role: "system",
            content: JOB_DESCRIPTION_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: buildJobDescriptionUserPrompt(input),
          },
        ],
      },
      { signal: controller.signal }
    );

    const rawText = extractOutputText(response);
    if (!rawText) {
      throw new JobDescriptionGenerationError("EMPTY");
    }

    return parseModelResult(rawText);
  } catch (error) {
    throw mapApiError(error);
  } finally {
    clearTimeout(timeoutId);
    options?.signal?.removeEventListener("abort", onExternalAbort);
  }
}

export function getJobDescriptionModelName(): string {
  return resolveModel();
}
