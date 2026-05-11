/** Quality gate for ATS / LLM resume extraction — client + server. */

/** Pull a JSON object from model output (raw JSON or ```json ... ``` fences). */
export function extractJsonObjectFromModelText(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m) ?? trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const inner = fenced ? fenced[1].trim() : trimmed
  const brace = inner.match(/\{[\s\S]*\}/)?.[0]
  if (!brace) return null
  try {
    const v = JSON.parse(brace) as unknown
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const RESUME_PARSE_FAILED_USER_MESSAGE =
  "Resume parsing failed. Please upload a valid resume or fill in the required fields manually."

export const PARSE_FAILED_STATUS = "Parse Failed" as const
export const PARSE_SUCCESS_STATUS = "success" as const

export type NormalizedParsedResume = {
  first_name: string
  last_name: string
  email: string
  phone: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  job_role: string
}

function s(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string") return v.trim()
  return String(v).trim()
}

/** Normalize common parser / storage shapes to snake_case strings. */
export function normalizeParsedResume(raw: unknown): NormalizedParsedResume {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    first_name: s(o.first_name ?? o.firstName ?? o.FirstName),
    last_name: s(o.last_name ?? o.lastName ?? o.LastName),
    email: s(o.email ?? o.Email),
    phone: s(o.phone ?? o.Phone),
    address1: s(o.address1 ?? o.address ?? o.Address),
    address2: s(o.address2 ?? o.Address2),
    city: s(o.city ?? o.City),
    state: s(o.state ?? o.State),
    zip: s(o.zipCode ?? o.zip ?? o.zip_code ?? o.Zip),
    job_role: s(o.job_role ?? o.jobRole ?? o.job_title ?? o.JobRole),
  }
}

const FIELD_LABELS: { key: keyof NormalizedParsedResume; label: string }[] = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address1", label: "Address line 1" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP code" },
  { key: "job_role", label: "Job title" },
]

function hasAddressSignal(n: NormalizedParsedResume): boolean {
  return Boolean(n.address1 || n.city || n.state || n.zip)
}

function isFilled(n: NormalizedParsedResume, key: keyof NormalizedParsedResume): boolean {
  return s(n[key]) !== ""
}

/**
 * Counts 9 scalar fields for the >50% empty rule (each key independently filled or not).
 */
function emptyScalarCount(n: NormalizedParsedResume): number {
  let empty = 0
  for (const { key } of FIELD_LABELS) {
    if (!isFilled(n, key)) empty += 1
  }
  return empty
}

export type ResumeParseQualityResult =
  | { ok: true; normalized: NormalizedParsedResume }
  | {
      ok: false
      parseStatus: typeof PARSE_FAILED_STATUS
      message: string
      /** Human-readable labels for UI highlights */
      missingFieldLabels: string[]
    }

/**
 * Fail if first/last/email missing, if no address signal, or if strictly more than half
 * of the nine tracked fields are empty.
 */
export function evaluateResumeParseQuality(raw: unknown): ResumeParseQualityResult {
  const normalized = normalizeParsedResume(raw)
  const missingFieldLabels: string[] = []

  for (const { key, label } of FIELD_LABELS) {
    if (!isFilled(normalized, key)) missingFieldLabels.push(label)
  }

  if (!normalized.first_name || !normalized.last_name || !normalized.email) {
    return {
      ok: false,
      parseStatus: PARSE_FAILED_STATUS,
      message: RESUME_PARSE_FAILED_USER_MESSAGE,
      missingFieldLabels,
    }
  }

  if (!hasAddressSignal(normalized)) {
    return {
      ok: false,
      parseStatus: PARSE_FAILED_STATUS,
      message: RESUME_PARSE_FAILED_USER_MESSAGE,
      missingFieldLabels,
    }
  }

  const total = FIELD_LABELS.length
  const empty = emptyScalarCount(normalized)
  if (empty > total / 2) {
    return {
      ok: false,
      parseStatus: PARSE_FAILED_STATUS,
      message: RESUME_PARSE_FAILED_USER_MESSAGE,
      missingFieldLabels,
    }
  }

  return { ok: true, normalized }
}

/** Payload stored for the review step (matches existing localStorage consumers). */
export function normalizedResumeToStoredJson(n: NormalizedParsedResume): Record<string, string> {
  return {
    first_name: n.first_name,
    last_name: n.last_name,
    email: n.email,
    phone: n.phone,
    address1: n.address1,
    address2: n.address2,
    city: n.city,
    state: n.state,
    zipCode: n.zip,
    zip: n.zip,
    job_role: n.job_role,
  }
}
