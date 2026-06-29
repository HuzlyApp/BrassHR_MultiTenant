import type { NormalizedParsedResume } from "@/lib/resumeParseQuality"

const EMAIL_RE =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g

const PHONE_RE =
  /(?:\+?1[\s.-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g

const ZIP_RE = /\b\d{5}(?:-\d{4})?\b/

const JOB_TITLE_HINTS =
  /\b(CNA|RN|LPN|LVN|Caregiver|Medical Assistant|Nurse|Nursing Assistant|Home Health Aide|HHA)\b/i

const CONTACT_LINE_HINT =
  /(@|\(\d{3}\)|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|blvd|boulevard|suite|apt|city|state|zip)\b)/i

const DEFAULT_GROK_CHAR_BUDGET = 3500

function firstMatch(re: RegExp, text: string): string {
  const m = text.match(re)
  return m?.[0]?.trim() ?? ""
}

function lines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
}

function pickRelevantLines(allLines: string[], maxLines: number): string[] {
  const picked = new Set<number>()
  for (let i = 0; i < allLines.length; i += 1) {
    if (CONTACT_LINE_HINT.test(allLines[i]!) || JOB_TITLE_HINTS.test(allLines[i]!)) {
      for (const j of [i - 1, i, i + 1]) {
        if (j >= 0 && j < allLines.length) picked.add(j)
      }
    }
  }
  const ordered = [...picked].sort((a, b) => a - b).slice(0, maxLines)
  return ordered.map((i) => allLines[i]!)
}

/** Regex pre-extraction for obvious contact fields before Grok. */
export function preExtractResumeFields(text: string): Partial<NormalizedParsedResume> {
  const trimmed = text.trim()
  if (!trimmed) return {}

  const email = firstMatch(EMAIL_RE, trimmed)
  const phone = firstMatch(PHONE_RE, trimmed)
  const zip = firstMatch(ZIP_RE, trimmed)

  const allLines = lines(trimmed)
  const nameLine = allLines[0] ?? ""
  const nameParts = nameLine.split(/\s+/).filter(Boolean)
  const first_name = nameParts[0] ?? ""
  const last_name = nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""

  let job_role = ""
  for (const line of allLines.slice(0, 12)) {
    if (JOB_TITLE_HINTS.test(line)) {
      job_role = line.slice(0, 120)
      break
    }
  }

  return {
    first_name,
    last_name,
    email,
    phone,
    zip,
    job_role,
  }
}

/**
 * Build a reduced snippet for Grok: head of resume + lines around contact signals.
 * Keeps payload under `charBudget` (default 3500).
 */
export function buildGrokResumeSnippet(
  text: string,
  charBudget = DEFAULT_GROK_CHAR_BUDGET,
): string {
  const trimmed = text.trim()
  if (!trimmed) return ""
  if (trimmed.length <= charBudget) return trimmed

  const allLines = lines(trimmed)
  const head = trimmed.slice(0, Math.min(2000, trimmed.length))
  const relevant = pickRelevantLines(allLines, 24)
  const tail = relevant.join("\n")

  const combined = `${head}\n\n--- contact / title hints ---\n${tail}`.slice(0, charBudget)
  return combined
}

export function grokSnippetIsReduced(fullText: string, snippet: string): boolean {
  return fullText.trim().length > snippet.length
}
