import { parseCityStateLocation } from "@/lib/location/city-state"
import { sanitizeResumeEmail, type NormalizedParsedResume } from "@/lib/resumeParseQuality"

const EMAIL_RE =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/

const PHONE_RE =
  /(?:\+?1[\s.-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/

/** Bare 10–11 digit phone sequences (no separators) that often jam into name fields. */
const BARE_PHONE_RE = /(?<!\d)(?:\+?1)?\d{10}(?!\d)/

const URL_RE = /https?:\/\/\S+/i

/** LinkedIn / www URLs without a protocol, and linkedin.com/in/slug fragments. */
const LINKEDIN_OR_WWW_RE =
  /(?:(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9._%-]+\/?|(?:www\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\/\S*)/i

const ZIP_RE = /\b\d{5}(?:-\d{4})?\b/

const CITY_STATE_RE =
  /\b([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,2}),\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\b/

const LOCATION_LABEL_RE =
  /^(?:location|based\s+in|residing\s+in|lives?\s+in|address|city\s*\/\s*state)\s*[:\-–—]?\s+/i

const BULLET_LINE_RE = /^[\s•●◦▪▸►\-*–—]+/

const US_STATE_CODES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL","IN","KS","KY",
  "LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH",
  "OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY",
])

/** All-caps tokens Grok/PDF extractors confuse with US city/state (SAP modules, etc.). */
const SOFTWARE_MODULE_LOCATION_CODES = new Set([
  "MM", "SD", "FI", "CO", "PP", "QM", "PM", "WM", "PS", "CS", "LE", "TR",
  "AA", "GL", "AP", "AR", "BW", "BI", "BO", "HR", "IM", "EWM", "TM",
])

const JOB_TITLE_HINTS =
  /\b(CNA|RN|LPN|LVN|Caregiver|Medical Assistant|Nurse|Nursing Assistant|Home Health Aide|HHA|Consultant|Engineer|Developer|Analyst|Manager|Architect|Specialist)\b/i

const CONTACT_LINE_HINT =
  /(@|\(\d{3}\)|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|blvd|boulevard|suite|apt|city|state|zip)\b)/i

const NAME_PREFIXES = new Set(["dr", "mr", "mrs", "ms", "miss", "prof", "sir"])

const TITLE_WORDS = new Set([
  "sr", "senior", "jr", "junior", "lead", "principal", "staff", "chief",
  "consultant", "consultants", "engineer", "engineering", "developer", "analyst",
  "manager", "architect", "specialist", "administrator", "director", "officer",
  "intern", "associate", "coordinator", "technician", "designer", "programmer",
  "scientist", "executive", "president", "vp", "svp", "avp", "head",
  "sap", "abap", "fiori", "hana", "ecc", "btp", "fico",
  "full", "stack", "frontend", "backend", "software", "data",
  "registered", "nurse", "nursing", "assistant", "aide", "caregiver",
  "cna", "rn", "lpn", "lvn", "hha", "cma", "medical",
  "ii", "iii", "iv",
])

const SECTION_HEADER_RE =
  /^(professional\s+summary|summary|objective|profile|experience|education|skills|certifications?|work\s+history|employment)\b/i

const GENERIC_FILE_STEM_RE =
  /^(resume|cv|curriculumvitae|document|untitled|scan|file|attachment)$/i

const DEFAULT_GROK_CHAR_BUDGET = 3500

export type ResumeFieldExtractOptions = {
  fileName?: string | null
}

function firstMatch(re: RegExp, text: string): string {
  const m = text.match(re)
  return m?.[0]?.trim() ?? ""
}

function lines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
}

/**
 * Find a US city/state in resume header/contact lines.
 * Prefers early lines; supports "City, ST", "City, StateName", and labeled location lines.
 */
export function extractLocationFromResumeText(text: string): { city: string; state: string } {
  const repaired = repairExtractedResumeText(text)
  if (!repaired) return { city: "", state: "" }

  const allLines = lines(repaired)
  const candidates: string[] = []

  for (let i = 0; i < Math.min(allLines.length, 40); i += 1) {
    const raw = allLines[i] ?? ""
    if (!raw || raw.length > 100) continue
    if (EMAIL_RE.test(raw) || URL_RE.test(raw) || SECTION_HEADER_RE.test(raw)) continue
    if (BULLET_LINE_RE.test(raw) && i > 12) continue
    // Skip ERP module lists that look like "MM, SD, FI/CO, …"
    if (looksLikeSoftwareModuleList(raw)) continue

    const unlabeled = raw.replace(LOCATION_LABEL_RE, "").trim()
    if (unlabeled) candidates.push(unlabeled)

    // City and state sometimes land on consecutive PDF lines.
    const next = allLines[i + 1] ?? ""
    if (
      next &&
      next.length <= 40 &&
      !EMAIL_RE.test(next) &&
      !URL_RE.test(next) &&
      !SECTION_HEADER_RE.test(next) &&
      !looksLikeSoftwareModuleList(next)
    ) {
      candidates.push(`${unlabeled || raw}, ${next.replace(LOCATION_LABEL_RE, "").trim()}`)
    }
  }

  for (const candidate of candidates) {
    const parsed = parseCityStateLocation(candidate)
    if (parsed.city && parsed.stateCode && !cityLooksLikeSoftwareModules(parsed.city)) {
      return { city: parsed.city, state: parsed.stateCode }
    }

    const cityStateMatch = candidate.match(CITY_STATE_RE)
    if (cityStateMatch && US_STATE_CODES.has(cityStateMatch[2] ?? "")) {
      const city = (cityStateMatch[1] ?? "").trim()
      const state = (cityStateMatch[2] ?? "").trim()
      if (city && !cityLooksLikeSoftwareModules(city)) {
        return { city, state }
      }
    }
  }

  return { city: "", state: "" }
}

function looksLikeSoftwareModuleList(line: string): boolean {
  const codes = line.toUpperCase().match(/\b[A-Z]{2,3}\b/g) ?? []
  const moduleHits = codes.filter((code) => SOFTWARE_MODULE_LOCATION_CODES.has(code)).length
  return moduleHits >= 2
}

function cityLooksLikeSoftwareModules(city: string): boolean {
  const tokens = city
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
  if (tokens.some((token) => SOFTWARE_MODULE_LOCATION_CODES.has(token))) return true
  return city.length <= 3 && SOFTWARE_MODULE_LOCATION_CODES.has(city.toUpperCase())
}

function looksLikeTitleToken(token: string): boolean {
  const t = token.toLowerCase().replace(/[.,/()]/g, "")
  return Boolean(t) && TITLE_WORDS.has(t)
}

function titleCaseNameToken(token: string): string {
  if (token.length === 1) return token.toUpperCase()
  if (/^[A-Z]{2,4}$/.test(token)) return token
  return token.slice(0, 1).toUpperCase() + token.slice(1).toLowerCase()
}

function replaceEvery(re: RegExp, value: string, replacement: string): string {
  const flags = `${re.flags.replace("g", "")}g`
  return value.replace(new RegExp(re.source, flags), replacement)
}

/** Remove emails, phones, URLs, LinkedIn slugs, and pipe separators from a person-name field. */
export function stripContactFromPersonName(value: string): string {
  return replaceEvery(
    BARE_PHONE_RE,
    replaceEvery(
      PHONE_RE,
      replaceEvery(
        LINKEDIN_OR_WWW_RE,
        replaceEvery(URL_RE, replaceEvery(EMAIL_RE, value, " "), " "),
        " "
      ),
      " "
    ),
    " "
  )
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function parseNameAndTitle(line: string): {
  first_name: string
  last_name: string
  job_role: string
} {
  const cleaned = stripContactFromPersonName(line)
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  while (tokens.length && NAME_PREFIXES.has(tokens[0]!.toLowerCase().replace(/\./g, ""))) {
    tokens.shift()
  }
  if (!tokens.length || SECTION_HEADER_RE.test(tokens.join(" "))) {
    return { first_name: "", last_name: "", job_role: "" }
  }

  const first_name = tokens.shift() ?? ""
  const lastTokens: string[] = []
  const titleTokens: string[] = []
  let inTitle = false
  for (const token of tokens) {
    if (!inTitle && looksLikeTitleToken(token)) inTitle = true
    if (inTitle) titleTokens.push(token)
    else lastTokens.push(token)
  }
  return {
    first_name,
    last_name: lastTokens.join(" "),
    job_role: titleTokens.join(" "),
  }
}

function lastNameFromLinkedIn(text: string, firstName: string): string {
  const first = firstName.trim().toLowerCase()
  if (!first) return ""
  const match = text.match(/linkedin\.com\/in\/([A-Za-z0-9._-]+)/i)
  if (!match?.[1]) return ""
  const slug = match[1]
  // Vanity handles with long digit tails are not reliable last-name sources.
  if (/\d{4,}/.test(slug)) return ""
  const parts = slug.split(/[-_.]+/).filter(Boolean)
  while (parts.length && /\d/.test(parts[parts.length - 1]!)) {
    parts.pop()
  }
  const remaining = parts.filter(
    (part) => part.toLowerCase() !== first && !part.toLowerCase().includes(first),
  )
  // Require at least one alphabetic token of length >= 2 (skip single-letter noise from handles).
  const nameLike = remaining.filter((part) => /^[A-Za-z]{2,}$/.test(part))
  if (nameLike.length === 0 || nameLike.length > 3) return ""
  return nameLike.map(titleCaseNameToken).join(" ")
}

function lastNameFromFileName(fileName: string, firstName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "")
  const tokens = base.split(/[_\s-]+/).filter(Boolean)
  while (tokens.length && GENERIC_FILE_STEM_RE.test(tokens[0]!.replace(/[^A-Za-z]/g, "").toLowerCase())) {
    tokens.shift()
  }
  if (!tokens.length) return ""
  const parsed = parseNameAndTitle(tokens.join(" "))
  const last = parsed.last_name.trim()
  if (!last) return ""
  if (last.toLowerCase() === firstName.trim().toLowerCase()) return ""
  return last
}

/**
 * Split a jammed header (name + title + email|phone|url on one line) and restore
 * camelCase spaces when the extractor dropped them.
 */
export function repairExtractedResumeText(text: string): string {
  const trimmed = text.replace(/\u0000/g, "").trim()
  if (!trimmed) return ""

  const newlineAt = trimmed.search(/\r?\n/)
  const first = newlineAt === -1 ? trimmed : trimmed.slice(0, newlineAt)
  const rest = newlineAt === -1 ? "" : trimmed.slice(newlineAt)
  const headerLooksJammed =
    EMAIL_RE.test(first) || URL_RE.test(first) || first.includes("|")

  let repairedFirst = first
  if (headerLooksJammed) {
    repairedFirst = first
      .replace(/\s*\|\s*/g, "\n")
      .replace(/([A-Za-z])\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "$1\n$2")
      .replace(/\s*(https?:\/\/\S+)/gi, "\n$1")
  }

  let out = `${repairedFirst}${rest}`
  out = maybeRestoreMissingSpaces(out)
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

function maybeRestoreMissingSpaces(text: string): string {
  const letters = (text.match(/[A-Za-z]/g) ?? []).length
  const spaces = (text.match(/ /g) ?? []).length
  if (letters < 80) return text
  if (spaces / letters > 0.06) return text
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
}

function dropSoftwareModuleLocation<T extends Pick<NormalizedParsedResume, "city" | "state" | "zip">>(
  fields: T,
): T {
  const city = fields.city.trim()
  if (city.length <= 3 && SOFTWARE_MODULE_LOCATION_CODES.has(city.toUpperCase())) {
    return {
      ...fields,
      city: "",
      state: fields.zip.trim() ? fields.state : "",
    }
  }
  return fields
}

/** Clean polluted Grok/pre-extract identity fields (title/contact in last name, SAP MM/SD as city). */
export function sanitizeParsedIdentityFields(
  parsed: NormalizedParsedResume,
  resumeText = "",
  opts?: ResumeFieldExtractOptions,
): NormalizedParsedResume {
  const header = parseNameAndTitle(
    `${stripContactFromPersonName(parsed.first_name)} ${stripContactFromPersonName(parsed.last_name)}`.trim(),
  )
  let first_name = header.first_name || stripContactFromPersonName(parsed.first_name)
  let last_name = header.last_name
  let job_role = parsed.job_role.trim() || header.job_role

  if (!last_name) {
    last_name =
      lastNameFromLinkedIn(resumeText, first_name) ||
      lastNameFromFileName(opts?.fileName ?? "", first_name)
  }

  return dropSoftwareModuleLocation({
    ...parsed,
    first_name,
    last_name,
    job_role,
    email: sanitizeResumeEmail(parsed.email),
  })
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
export function preExtractResumeFields(
  text: string,
  opts?: ResumeFieldExtractOptions,
): Partial<NormalizedParsedResume> {
  const trimmed = repairExtractedResumeText(text)
  if (!trimmed) return {}

  const email = sanitizeResumeEmail(firstMatch(EMAIL_RE, trimmed))
  const phone = firstMatch(PHONE_RE, trimmed)
  const zip = firstMatch(ZIP_RE, trimmed)

  const allLines = lines(trimmed)
  const location = extractLocationFromResumeText(trimmed)
  let city = location.city
  let state = location.state
  if (!city || !state) {
    for (const line of allLines.slice(0, 8)) {
      if (EMAIL_RE.test(line) || URL_RE.test(line)) continue
      const cityStateMatch = line.match(CITY_STATE_RE)
      if (cityStateMatch && US_STATE_CODES.has(cityStateMatch[2] ?? "")) {
        city = city || (cityStateMatch[1] ?? "")
        state = state || (cityStateMatch[2] ?? "")
        break
      }
    }
  }

  const nameLine = allLines.find((line) => !SECTION_HEADER_RE.test(line)) ?? ""
  const fromHeader = parseNameAndTitle(nameLine)
  let job_role = fromHeader.job_role
  if (!job_role) {
    for (const line of allLines.slice(0, 12)) {
      if (JOB_TITLE_HINTS.test(line) && !EMAIL_RE.test(line)) {
        job_role = parseNameAndTitle(line).job_role || line.slice(0, 120)
        break
      }
    }
  }

  const first_name = fromHeader.first_name
  const last_name =
    fromHeader.last_name ||
    lastNameFromLinkedIn(trimmed, first_name) ||
    lastNameFromFileName(opts?.fileName ?? "", first_name)

  return dropSoftwareModuleLocation({
    first_name,
    last_name,
    email,
    phone,
    city,
    state,
    zip,
    job_role,
    address1: "",
    address2: "",
  })
}

/**
 * Build a reduced snippet for Grok: head of resume + lines around contact signals.
 * Keeps payload under `charBudget` (default 3500).
 */
export function buildGrokResumeSnippet(
  text: string,
  charBudget = DEFAULT_GROK_CHAR_BUDGET,
): string {
  const trimmed = repairExtractedResumeText(text)
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
  return repairExtractedResumeText(fullText).length > snippet.length
}
