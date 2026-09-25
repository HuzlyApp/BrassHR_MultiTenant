/**
 * Candidate name normalize + validation (BRASS-HR-FSD-NAME-001).
 * Rejects header junk (URLs, email, phone) after resume parse; accepts real human names.
 */

export const NAME_NEEDS_REVIEW_BANNER =
  "We could not confirm the candidate name from this resume. Please edit it."

export type PersonNameValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; normalized: string; reason: string }

export type CandidateNameAssessment = {
  ok: boolean
  needsReview: boolean
  normalized: string
  rawExtract: string
  reason: string | null
}

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u2060]/g

/** Shape check after normalize — necessary but not sufficient (FSD §6.4). */
const NAME_SHAPE_RE =
  /^(?=.*\p{L})[\p{L}\p{M}]+(?:[ '\-.,·]+[\p{L}\p{M}]+)*(?:[.,])?$/u

const EMAIL_LIKE_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const URL_TOKEN_RE = /https?:\/\/|www\.|linkedin|\.com|\.net|\.org/i
const FORBIDDEN_CHARS_RE = /[@/\\_+=#&*!?"|<>()]/u
const EMOJI_RE = /\p{Extended_Pictographic}/u
const PHONE_LIKE_RE =
  /(?:\+\d{1,3}\b|\(\d{3}\)|\d{3}[-.\s]\d{3,4}|\b\d{3,}[-.\s]\d{3,}\b)/
const CONSECUTIVE_DIGITS_RE = /\d{3,}/
const DOUBLED_SEPARATOR_RE = /--|''|\.\.|,{2}| [.'\-·,] /

/**
 * FSD §5 — apply before validation.
 * Returns display-oriented normalized form (smart punctuation straightened).
 */
export function normalizePersonName(raw: string): string {
  return String(raw ?? "")
    .replace(ZERO_WIDTH_RE, "")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // curly single quotes
    .replace(/[\u02BC\u02BB]/g, "'") // modifier apostrophe / okina
    .replace(/[\u2013\u2014\u2010\u2011\u2212]/g, "-") // en/em/hyphen variants / minus
    .replace(/\s+/g, " ")
    .trim()
}

function digitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length
}

function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value)
}

function punctuationNotBetweenLetters(value: string): boolean {
  // Hyphen / apostrophe / period must sit next to a letter (O'Connor, Jean-Luc, St. John).
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]!
    if (ch !== "-" && ch !== "'" && ch !== ".") continue
    const prev = value[i - 1]
    const next = value[i + 1]
    const prevLetter = prev != null && /\p{L}/u.test(prev)
    const nextLetter = next != null && /\p{L}/u.test(next)
    if (ch === ".") {
      // Trailing period (Jr. / St.) or letter-bounded (J.K.).
      if (i === value.length - 1 && prevLetter) continue
      if (prevLetter && nextLetter) continue
      // Particle forms: "St. John" (letter + "." + space + letter).
      const afterSpace = value[i + 2]
      if (prevLetter && next === " " && afterSpace != null && /\p{L}/u.test(afterSpace)) {
        continue
      }
      return true
    }
    if (!prevLetter || !nextLetter) return true
  }
  return false
}

function startsOrEndsWithBadPunctuation(value: string): boolean {
  if (!value) return true
  const first = value[0]!
  const last = value[value.length - 1]!
  if (/[ '\-·,]/.test(first)) return true
  // Trailing period allowed for Jr. / St.; other trailing punct fails.
  if (/[ '\-·,]/.test(last)) return true
  return false
}

/**
 * Validate a full or single-part person name after normalize (FSD §6).
 */
export function validatePersonName(raw: string): PersonNameValidationResult {
  const normalized = normalizePersonName(raw)

  if (normalized.length < 2 || normalized.length > 80) {
    return { ok: false, normalized, reason: "Name must be between 2 and 80 characters." }
  }
  if (!hasLetter(normalized)) {
    return { ok: false, normalized, reason: "Name must include at least one letter." }
  }
  if (FORBIDDEN_CHARS_RE.test(normalized) || EMOJI_RE.test(normalized)) {
    return { ok: false, normalized, reason: "Name contains characters that are not allowed." }
  }
  if (URL_TOKEN_RE.test(normalized)) {
    return { ok: false, normalized, reason: "Name looks like a URL or LinkedIn handle." }
  }
  if (EMAIL_LIKE_RE.test(normalized)) {
    return { ok: false, normalized, reason: "Name looks like an email address." }
  }
  if (CONSECUTIVE_DIGITS_RE.test(normalized) || PHONE_LIKE_RE.test(normalized)) {
    return { ok: false, normalized, reason: "Name looks like a phone number." }
  }
  if (digitCount(normalized) > 4) {
    return { ok: false, normalized, reason: "Name cannot include that many digits." }
  }
  if (startsOrEndsWithBadPunctuation(normalized)) {
    return { ok: false, normalized, reason: "Name cannot start or end with punctuation." }
  }
  if (DOUBLED_SEPARATOR_RE.test(normalized)) {
    return { ok: false, normalized, reason: "Name has doubled or invalid separators." }
  }
  if (punctuationNotBetweenLetters(normalized)) {
    return { ok: false, normalized, reason: "Punctuation in a name must sit next to letters." }
  }
  if (!NAME_SHAPE_RE.test(normalized)) {
    return { ok: false, normalized, reason: "Enter a valid person name." }
  }

  return { ok: true, normalized }
}

/** Assess first + last (and optional middle) as they came from the parser — before contact strip. */
export function assessCandidateName(parts: {
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  fullName?: string | null
}): CandidateNameAssessment {
  const rawExtract =
    String(parts.fullName ?? "").trim() ||
    [parts.firstName, parts.middleName, parts.lastName]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" ")

  const result = validatePersonName(rawExtract)
  if (result.ok) {
    return {
      ok: true,
      needsReview: false,
      normalized: result.normalized,
      rawExtract,
      reason: null,
    }
  }
  return {
    ok: false,
    needsReview: true,
    normalized: result.normalized,
    rawExtract,
    reason: result.reason,
  }
}

/** Required first + last for recruiter confirm; each part and the combined full name must pass. */
export function validateCandidateNameParts(
  firstName: string,
  lastName: string,
): PersonNameValidationResult {
  const firstNorm = normalizePersonName(firstName)
  const lastNorm = normalizePersonName(lastName)
  if (!firstNorm) {
    return { ok: false, normalized: "", reason: "First name is required." }
  }
  if (!lastNorm) {
    return { ok: false, normalized: firstNorm, reason: "Last name is required." }
  }

  const firstPart = validateNamePart(firstNorm, "first")
  if (!firstPart.ok) return firstPart
  const lastPart = validateNamePart(lastNorm, "last")
  if (!lastPart.ok) return lastPart

  return validatePersonName(`${firstPart.normalized} ${lastPart.normalized}`)
}

/** Single given/family token — allows a one-letter initial (e.g. last name "K"). */
function validateNamePart(
  normalized: string,
  label: "first" | "last",
): PersonNameValidationResult {
  if (normalized.length === 1 && /\p{L}/u.test(normalized)) {
    return { ok: true, normalized }
  }
  const result = validatePersonName(normalized)
  if (result.ok) return result
  return {
    ok: false,
    normalized: result.normalized,
    reason:
      result.reason ||
      (label === "first" ? "Enter a valid first name." : "Enter a valid last name."),
  }
}

export function personNameFilterInput(raw: string): string {
  return String(raw ?? "").replace(/[^\p{L}\p{M}\s'.\-.,·]/gu, "")
}
