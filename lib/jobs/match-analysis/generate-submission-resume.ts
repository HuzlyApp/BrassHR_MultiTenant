import "server-only";

import OpenAI from "openai";
import { assembleSubmissionResumeVariables } from "@/lib/ai-catalog/assemble-match-variables";
import { renderPromptTemplate } from "@/lib/ai-catalog/render-prompt";
import type { ResolvedPromptVersion } from "@/lib/ai-catalog/types";
import { extractJsonObjectFromModelText } from "@/lib/resumeParseQuality";
import { sanitizeResumeForMatchAnalysis } from "./sanitize-resume";
import type { MatchAnalysisResponse } from "./schema";
import {
  buildFallbackSubmissionResume,
  mergeSubmissionResume,
  parseSubmissionResume,
  type SubmissionResume,
  type SubmissionResumeIdentity,
} from "./submission-resume";
import { DEFAULT_STEP3_GROK_MODEL, grokReasoningEffort, sanitizeStep3Model } from "./step-config";

const DEFAULT_MODEL = DEFAULT_STEP3_GROK_MODEL;
const MAX_OUTPUT_TOKENS = 4_000;
const TIMEOUT_MS = 45_000;

function resolveGrokClient(): OpenAI | null {
  const apiKey = process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: (process.env.GROK_BASE_URL?.trim() || "https://api.x.ai/v1").replace(/\/$/, ""),
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });
}

function extractOutputText(response: {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
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

function confirmedLines(analysis: MatchAnalysisResponse | null): string[] {
  if (!analysis) return [];
  return [...(analysis.mandatory_requirements ?? []), ...(analysis.preferred_requirements ?? [])]
    .filter((row) => row.status === "CONFIRMED" || row.requirement_outcome === "MET")
    .map((row) => `${row.requirement}: ${row.candidate_evidence}`.trim())
    .slice(0, 12);
}

/** User prompt for Step 5 draft — includes Deep Match + Steps 2–3 enrichment. */
export function buildSubmissionResumeUserPrompt(args: {
  identity: SubmissionResumeIdentity;
  analysis: MatchAnalysisResponse | null;
  resumeText: string;
  enrichmentNotes?: string | null;
}): string {
  const enrichment = String(args.enrichmentNotes ?? "").trim();
  return [
    `Target job: ${args.identity.jobTitle || "Unknown"}`,
    `Candidate: ${args.identity.fullName}`,
    `Contact: ${[args.identity.email, args.identity.phone, args.identity.location].filter(Boolean).join(" | ")}`,
    args.analysis?.candidate_match?.recruiter_decision_summary
      ? `Recruiter summary: ${args.analysis.candidate_match.recruiter_decision_summary}`
      : "",
    confirmedLines(args.analysis).length
      ? `Confirmed evidence:\n${confirmedLines(args.analysis).map((line) => `- ${line}`).join("\n")}`
      : "",
    args.analysis?.strengths?.length ? `Strengths:\n- ${args.analysis.strengths.join("\n- ")}` : "",
    enrichment
      ? `Recruiter enrichment from Verifications / Follow-Up / Deep Match:\n${enrichment}`
      : "",
    `Original résumé:\n${sanitizeResumeForMatchAnalysis(args.resumeText).slice(0, 12_000) || "(no résumé text)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateOptimizedSubmissionResume(args: {
  identity: SubmissionResumeIdentity;
  analysis: MatchAnalysisResponse | null;
  resumeText: string;
  enrichmentNotes?: string | null;
  resolved: ResolvedPromptVersion;
}): Promise<{ resume: SubmissionResume; usedModel: boolean; model: string | null }> {
  const fallback = buildFallbackSubmissionResume(args);
  const client = resolveGrokClient();
  if (!client) return { resume: fallback, usedModel: false, model: null };

  const system = args.resolved.systemPrompt?.trim() ?? "";
  if (!system) return { resume: fallback, usedModel: false, model: null };

  const user = renderPromptTemplate(
    args.resolved.userPromptTemplate ?? "",
    assembleSubmissionResumeVariables({
      jobTitle: args.identity.jobTitle,
      candidateName: args.identity.fullName,
      email: args.identity.email,
      phone: args.identity.phone,
      location: args.identity.location,
      recruiterSummary: args.analysis?.candidate_match?.recruiter_decision_summary,
      confirmedEvidence: confirmedLines(args.analysis),
      strengths: args.analysis?.strengths ?? [],
      enrichmentNotes: args.enrichmentNotes,
      resumeText: sanitizeResumeForMatchAnalysis(args.resumeText).slice(0, 12_000),
    }),
    { required: ["candidate_resume"] }
  );

  const cfg = args.resolved.modelConfig ?? {};
  const catalogModel =
    typeof cfg.model === "string" && cfg.model.trim()
      ? sanitizeStep3Model(cfg.model, DEFAULT_MODEL)
      : "";
  const model =
    catalogModel ||
    process.env.AI_MATCH_STEP5_SUBMISSION_MODEL?.trim() ||
    process.env.AI_MATCH_STEP3_DEEP_GROK_MODEL?.trim() ||
    process.env.XAI_MATCH_DEEP_MODEL?.trim() ||
    process.env.GROK_MATCH_DEEP_MODEL?.trim() ||
    DEFAULT_MODEL;
  const maxTokens = Number(cfg.base_max_tokens ?? MAX_OUTPUT_TOKENS);

  try {
    const response = await client.responses.create({
      model,
      temperature: typeof cfg.temperature === "number" ? cfg.temperature : 0.2,
      max_output_tokens: maxTokens,
      reasoning: { effort: grokReasoningEffort(model) },
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed = parseSubmissionResume(extractJsonObjectFromModelText(extractOutputText(response)));
    return {
      resume: mergeSubmissionResume(parsed, fallback),
      usedModel: Boolean(parsed),
      model,
    };
  } catch (error) {
    console.warn("[submission-resume] model rewrite failed, using fallback", {
      model,
      message: error instanceof Error ? error.message : "unknown",
    });
    return { resume: fallback, usedModel: false, model };
  }
}
