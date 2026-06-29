import OpenAI from "openai"
import {
  extractJsonObjectFromModelText,
  normalizeParsedResume,
  type NormalizedParsedResume,
} from "@/lib/resumeParseQuality"
import { buildGrokResumeSnippet, preExtractResumeFields } from "@/lib/resume/normalize-resume-text"
import { createTimer, logResumeTiming } from "@/lib/resume/timing"

export const GROK_RESUME_MODEL = "grok-4-fast"

let client: OpenAI | null = null

function getGrokClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    })
  }
  return client
}

function mergeParsedFields(
  pre: Partial<NormalizedParsedResume>,
  fromGrok: NormalizedParsedResume,
): NormalizedParsedResume {
  const pick = (grokVal: string, preVal?: string) =>
    grokVal.trim() || (preVal?.trim() ?? "")

  return {
    first_name: pick(fromGrok.first_name, pre.first_name),
    last_name: pick(fromGrok.last_name, pre.last_name),
    email: pick(fromGrok.email, pre.email),
    phone: pick(fromGrok.phone, pre.phone),
    address1: fromGrok.address1,
    address2: fromGrok.address2,
    city: fromGrok.city,
    state: fromGrok.state,
    zip: pick(fromGrok.zip, pre.zip),
    job_role: pick(fromGrok.job_role, pre.job_role),
  }
}

function buildSystemPrompt(pre: Partial<NormalizedParsedResume>): string {
  const known = Object.entries(pre)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")

  return `
You are an ATS resume parser.

Extract structured contact/profile information from the resume snippet.

Return JSON ONLY (no markdown, no commentary).

Schema:
{
  "first_name": "",
  "last_name": "",
  "address1": "",
  "address2": "",
  "city": "",
  "state": "",
  "zip": "",
  "phone": "",
  "email": "",
  "job_role": ""
}

Rules:
- Split full name into first_name and last_name when not already known.
- Extract ZIP / postal code into zip when present.
- Detect healthcare roles such as CNA, RN, LPN, Caregiver, Medical Assistant.
- If a field is already known below, only change it when the snippet clearly contradicts it; otherwise return the known value or fill missing fields.
- If a field is missing return an empty string.

${known ? `Already extracted (prefer keeping unless snippet contradicts):\n${known}` : ""}
`.trim()
}

export type GrokParseResumeResult = {
  normalized: NormalizedParsedResume
  grokSnippet: string
  grokSnippetReduced: boolean
  aiParseMs: number
  preExtracted: Partial<NormalizedParsedResume>
}

/** Parse resume text with regex pre-extraction + reduced Grok payload. */
export async function grokParseResume(fullText: string): Promise<GrokParseResumeResult> {
  const preExtracted = preExtractResumeFields(fullText)
  const grokSnippet = buildGrokResumeSnippet(fullText)
  const grokSnippetReduced = fullText.trim().length > grokSnippet.length

  logResumeTiming("process-resume", "grok-request", {
    fullTextLength: fullText.length,
    grokSnippetLength: grokSnippet.length,
    grokSnippetReduced,
    preEmail: preExtracted.email ?? null,
    prePhone: preExtracted.phone ?? null,
  })

  const timer = createTimer()
  const completion = await getGrokClient().chat.completions.create({
    model: GROK_RESUME_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt(preExtracted) },
      { role: "user", content: grokSnippet },
    ],
  })
  const aiParseMs = timer.elapsedMs()

  const result = completion.choices?.[0]?.message?.content || ""
  const extracted = extractJsonObjectFromModelText(result)
  const fromGrok = normalizeParsedResume(extracted ?? {})
  const normalized = mergeParsedFields(preExtracted, fromGrok)

  logResumeTiming("process-resume", "grok-response", { aiParseMs })

  return {
    normalized,
    grokSnippet,
    grokSnippetReduced,
    aiParseMs,
    preExtracted,
  }
}

/** Test hook: inject a mock OpenAI client. */
export function __setGrokClientForTests(mock: OpenAI | null): void {
  client = mock
}
