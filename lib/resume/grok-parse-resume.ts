import OpenAI from "openai"
import {
  extractJsonObjectFromModelText,
  normalizeParsedResume,
  type NormalizedParsedResume,
} from "@/lib/resumeParseQuality"
import {
  buildGrokResumeSnippet,
  extractLocationFromResumeText,
  grokSnippetIsReduced,
  preExtractResumeFields,
  sanitizeParsedIdentityFieldsWithAssessment,
  type ResumeFieldExtractOptions,
} from "@/lib/resume/normalize-resume-text"
import { createTimer, logResumeTiming } from "@/lib/resume/timing"
import type { CandidateNameAssessment } from "@/lib/resume/validate-person-name"

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
    address1: pick(fromGrok.address1, pre.address1),
    address2: pick(fromGrok.address2, pre.address2),
    city: pick(fromGrok.city, pre.city),
    state: pick(fromGrok.state, pre.state),
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
- first_name and last_name are the person's name only. Never put a job title, email, phone, LinkedIn URL, or pipe-separated contact line in last_name.
- "Sr SAP Consultant", "Senior Engineer", and similar phrases are job_role, not last_name. A last initial such as "K" is a valid last_name.
- City and state are geographic locations from the header or contact block (City, ST or City, State). Never use software/ERP module codes (MM, SD, FI, CO, PP, QM) as city or state.
- Prefer an explicit home/current location near the name/contact lines. If none is there, use a clear location only when the snippet states where the person currently lives or is based.
- Extract ZIP / postal code into zip when present.
- job_role is the current or most recent title (any industry, not only healthcare).
- Repair obvious OCR/PDF typos in emails (gmail.cor → gmail.com, .con → .com on well-known providers).
- If a field is already known below, only change it when the snippet clearly contradicts it; otherwise return the known value or fill missing fields.
- If a field is missing return an empty string.

${known ? `Already extracted (prefer keeping unless snippet contradicts):\n${known}` : ""}
`.trim()
}

export type GrokParseResumeResult = {
  normalized: NormalizedParsedResume
  nameAssessment: CandidateNameAssessment
  grokSnippet: string
  grokSnippetReduced: boolean
  aiParseMs: number
  preExtracted: Partial<NormalizedParsedResume>
}

/** Parse resume text with regex pre-extraction + reduced Grok payload. */
export async function grokParseResume(
  fullText: string,
  opts?: ResumeFieldExtractOptions,
): Promise<GrokParseResumeResult> {
  const preExtracted = preExtractResumeFields(fullText, opts)
  const grokSnippet = buildGrokResumeSnippet(fullText)
  const grokSnippetReduced = grokSnippetIsReduced(fullText, grokSnippet)

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
  let sanitized = sanitizeParsedIdentityFieldsWithAssessment(
    normalizeParsedResume(mergeParsedFields(preExtracted, fromGrok)),
    fullText,
    opts,
  )

  // PDF/Grok often miss header location even when city/state are in the text.
  if (!sanitized.parsed.city.trim() || !sanitized.parsed.state.trim()) {
    const fromText = extractLocationFromResumeText(fullText)
    sanitized = sanitizeParsedIdentityFieldsWithAssessment(
      {
        ...sanitized.parsed,
        city: sanitized.parsed.city.trim() || fromText.city,
        state: sanitized.parsed.state.trim() || fromText.state,
      },
      fullText,
      opts,
    )
  }

  logResumeTiming("process-resume", "grok-response", { aiParseMs })

  return {
    normalized: sanitized.parsed,
    nameAssessment: sanitized.nameAssessment,
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
