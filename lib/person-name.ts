/** Max characters for first / last name inputs (client + API). */
export const PERSON_NAME_MAX_LENGTH = 50;
export const PERSON_NAME_MIN_LENGTH = 2;

export const NAME_NEEDS_REVIEW_MESSAGE =
  "We could not confirm the candidate name from this resume. Please edit it.";

export function personNameTooLongMessage(label: string): string {
  return `${label} must be ${PERSON_NAME_MAX_LENGTH} characters or fewer.`;
}

export function isPersonNameTooLong(value: string): boolean {
  return value.trim().length > PERSON_NAME_MAX_LENGTH;
}

const ZERO_WIDTH_RE = /[\u200B-\u200D\u2060\uFEFF]/g;
/** Curly / modifier apostrophes, backtick, acute accent, prime, Hawaiian okina. */
const APOSTROPHE_VARIANTS_RE = /[\u2018\u2019\u201A\u201B\u0060\u00B4\u02B9\u02BB\u02BC\u02BD\u2032]/g;
/** Unicode hyphens and dashes (Word / PDF exports). */
const HYPHEN_VARIANTS_RE = /[\u00AD\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/**
 * Letters and combining marks, joined by a single space / hyphen / apostrophe / middle dot,
 * or by a period / comma optionally followed by a space (J.K., St. John, Smith, Jr.).
 * One trailing period is allowed for suffixes (Robert Jr.).
 */
const NAME_SHAPE_RE = new RegExp(
  "^[\\p{L}\\p{M}]+(?:(?:[ '\\-\\u00B7]|[.,] ?)[\\p{L}\\p{M}]+)*\\.?$",
  "u"
);
const ALLOWED_CHARS_RE = new RegExp("^[\\p{L}\\p{M} '\\-.,\\u00B7]*$", "u");
const HAS_LETTER_RE = new RegExp("\\p{L}", "u");
const EMOJI_RE = new RegExp("\\p{Extended_Pictographic}", "u");
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const URL_TOKEN_RE = /https?|www|linkedin|\.com|\.net|\.org/i;
const PHONE_RE = /\d{3,}|\(\s*\d{3}\s*\)|\+\s*\d/;

const NAME_INPUT_DISALLOWED_RE = new RegExp(
  "[^\\p{L}\\p{M} '\\-.,\\u00B7\\u2018\\u2019\\u02BB\\u02BC\\u2010-\\u2015]",
  "gu"
);

/** Keystroke filter for name inputs: drops characters that can never appear in a valid name. */
export function filterPersonNameInput(raw: string): string {
  return raw.replace(NAME_INPUT_DISALLOWED_RE, "").slice(0, PERSON_NAME_MAX_LENGTH);
}

/** Trim, collapse spaces, straighten smart punctuation, strip zero-width characters. */
export function normalizePersonName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(ZERO_WIDTH_RE, "")
    .replace(APOSTROPHE_VARIANTS_RE, "'")
    .replace(HYPHEN_VARIANTS_RE, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export type PersonNameValidation =
  | { ok: true; value: string }
  | { ok: false; value: string; error: string };

/**
 * Validates a single name field (first or last). Accepts hyphenated, apostrophe, accented,
 * and Jr. / St. forms; rejects URLs, emails, phone numbers, and stray symbols.
 */
export function validatePersonName(
  raw: string,
  opts: { label?: string; maxLength?: number } = {}
): PersonNameValidation {
  const label = opts.label ?? "Name";
  const maxLength = opts.maxLength ?? PERSON_NAME_MAX_LENGTH;
  const value = normalizePersonName(raw ?? "");
  const fail = (error: string): PersonNameValidation => ({ ok: false, value, error });

  if (!value) return fail(`${label} is required.`);
  if (EMAIL_RE.test(value)) return fail(`${label} cannot include an email address.`);
  if (URL_TOKEN_RE.test(value)) return fail(`${label} cannot include a website or LinkedIn link.`);
  const digitCount = (value.match(/\d/g) ?? []).length;
  if (PHONE_RE.test(value) || digitCount > 4) {
    return fail(`${label} cannot include a phone number.`);
  }
  if (digitCount > 0) return fail(`${label} cannot include numbers.`);
  if (EMOJI_RE.test(value) || !ALLOWED_CHARS_RE.test(value)) {
    return fail(`${label} can only use letters, spaces, hyphens, apostrophes, and periods.`);
  }
  if (!HAS_LETTER_RE.test(value)) return fail(`${label} must include letters.`);
  if (value.length < PERSON_NAME_MIN_LENGTH) {
    return fail(`${label} must be at least ${PERSON_NAME_MIN_LENGTH} characters.`);
  }
  if (value.length > maxLength) {
    return fail(`${label} must be ${maxLength} characters or fewer.`);
  }
  if (!NAME_SHAPE_RE.test(value)) {
    return fail(`${label} has misplaced punctuation. Hyphens, apostrophes, and periods must sit next to letters.`);
  }
  return { ok: true, value };
}

export type ParsedNameReview = {
  needsReview: boolean;
  /** Normalized values when valid; the raw extract otherwise, so the recruiter sees what was grabbed. */
  firstName: string;
  lastName: string;
  rawExtract: string;
  firstNameError: string | null;
  lastNameError: string | null;
};

/** Post-parse gate: auto-accept clean names, flag anything suspicious for recruiter review. */
export function reviewParsedCandidateName(rawFirst: string, rawLast: string): ParsedNameReview {
  const first = validatePersonName(rawFirst, { label: "First name" });
  const last = validatePersonName(rawLast, { label: "Last name" });
  return {
    needsReview: !first.ok || !last.ok,
    firstName: first.ok ? first.value : (rawFirst ?? "").trim(),
    lastName: last.ok ? last.value : (rawLast ?? "").trim(),
    rawExtract: [rawFirst, rawLast].map((part) => (part ?? "").trim()).filter(Boolean).join(" "),
    firstNameError: first.ok ? null : first.error,
    lastNameError: last.ok ? null : last.error,
  };
}
