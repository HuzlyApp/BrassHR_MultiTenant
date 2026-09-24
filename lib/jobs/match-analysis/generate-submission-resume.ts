import "server-only";

import OpenAI from "openai";
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
import { DEFAULT_STEP3_GROK_MODEL, grokReasoningEffort } from "./step-config";

const DEFAULT_MODEL = DEFAULT_STEP3_GROK_MODEL;
const MAX_OUTPUT_TOKENS = 4_000;
const TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `You rewrite a candidate résumé for MSP / client submission.

Return JSON only. No markdown.

Schema:
{
  "fullName": "",
  "headline": "",
  "email": "",
  "phone": "",
  "location": "",
  "summary": "",
  "skills": [""],
  "experience": [{ "title": "", "company": "", "dates": "", "bullets": [""] }],
  "education": [{ "school": "", "credential": "", "year": "" }],
  "licenses": [""]
}

Rules:
- Optimize wording and order for the target job.
- Put the most relevant experience first.
- Use keywords from confirmed requirements only when they already appear in the résumé or evidence.
- Never invent employers, titles, dates, licenses, education, tools, or achievements.
- Do not include protected-class details, SSN, or street address.
- Keep bullets factual and concise.
- skills[] must be short labels (max ~80 characters each), not full requirement sentences.
- If a fact is missing, omit it.`;

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

export async function generateOptimizedSubmissionResume(args: {
  identity: SubmissionResumeIdentity;
  analysis: MatchAnalysisResponse | null;
  resumeText: string;
}): Promise<{ resume: SubmissionResume; usedModel: boolean }> {
  const fallback = buildFallbackSubmissionResume(args);
  const client = resolveGrokClient();
  if (!client) return { resume: fallback, usedModel: false };

  const user = [
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
    `Original résumé:\n${sanitizeResumeForMatchAnalysis(args.resumeText).slice(0, 12_000) || "(no résumé text)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const model =
    process.env.AI_MATCH_STEP5_SUBMISSION_MODEL?.trim() ||
    process.env.AI_MATCH_STEP3_DEEP_GROK_MODEL?.trim() ||
    process.env.XAI_MATCH_DEEP_MODEL?.trim() ||
    process.env.GROK_MATCH_DEEP_MODEL?.trim() ||
    DEFAULT_MODEL;

  try {
    const response = await client.responses.create({
      model,
      temperature: 0.2,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: grokReasoningEffort(model) },
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
    });
    const parsed = parseSubmissionResume(extractJsonObjectFromModelText(extractOutputText(response)));
    return { resume: mergeSubmissionResume(parsed, fallback), usedModel: Boolean(parsed) };
  } catch (error) {
    console.warn("[submission-resume] model rewrite failed, using fallback", {
      model,
      message: error instanceof Error ? error.message : "unknown",
    });
    return { resume: fallback, usedModel: false };
  }
}
