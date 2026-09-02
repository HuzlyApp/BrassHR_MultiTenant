import { isUuid } from "@/lib/validation/uuid";
import {
  buildFullJobDescriptionText,
  buildStructuredJobRequirements,
  type JobRequisitionForRequirements,
} from "@/lib/jobs/match-analysis/build-job-requirements";

export const IMPORT_MATCH_FETCH_CAP = 250;
export const IMPORT_PAGE_SIZE_DEFAULT = 25;
export const IMPORT_PAGE_SIZE_MAX = 50;
export const IMPORT_MAX_IDS_PER_REQUEST = 50;
export const IMPORT_RECOMMENDED_MIN_SCORE = 60;
export const IMPORT_SEARCH_DEBOUNCE_MS = 400;
export const IMPORT_RESUME_EXCERPT_CHARS = 12_000;
export const IMPORT_NOTES_EXCERPT_CHARS = 2_000;

export const DISCOVERY_TAGS = [
  "Product Management",
  "SaaS",
  "B2B",
  "B2C",
  "Agile",
  "Healthcare",
  "FinTech",
  "Leadership",
  "Remote",
  "Senior",
  "Technical",
  "Nursing",
  "Travel",
  "ICU",
  "Med-Surg",
  "Telemetry",
  "Emergency",
  "OR",
  "Analytics",
  "Roadmap",
  "Stakeholder",
] as const;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "job",
  "role",
  "experience",
  "years",
  "year",
  "required",
  "preferred",
  "must",
  "have",
  "with",
  "for",
  "from",
  "this",
  "that",
  "will",
  "able",
  "work",
  "working",
  "candidate",
  "position",
  "description",
  "including",
  "plus",
  "etc",
  "our",
  "you",
  "your",
  "are",
  "is",
  "be",
  "to",
  "of",
  "in",
  "on",
  "or",
  "as",
  "at",
  "by",
]);

const TOKEN_RE = /[a-z0-9][a-z0-9+.#/-]{1,}/g;
const YEARS_RE = /(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/gi;

export type ImportSearchTab = "recommended" | "all";
export type ImportExperienceBucket = "under3" | "3to5" | "5to10" | "10plus";
export type ImportMatchBand = "excellent" | "strong" | "good" | "possible" | "low";

export type JobMatchProfile = {
  title: string;
  specialty: string;
  location: string;
  department: string;
  requiredSkills: string[];
  preferredSkills: string[];
  certifications: string[];
  education: string[];
  tags: string[];
  keywords: string[];
  minYears: number | null;
};

export type ImportCandidateScoreInput = {
  fullName?: string | null;
  specialty?: string | null;
  location?: string | null;
  currentRole?: string | null;
  previousTitles?: string[] | null;
  resumeText?: string | null;
  notes?: string | null;
  verified?: unknown;
};

export type CandidateJobMatch = {
  score: number;
  band: ImportMatchBand;
  reasons: string[];
  matchedSkills: string[];
  tags: string[];
  yearsExperience: number | null;
  experienceHighlights: string[];
};

export type ImportSearchParams = {
  tab: ImportSearchTab;
  q: string;
  page: number;
  pageSize: number;
  minMatch: number;
  role: string;
  skills: string[];
  tags: string[];
  location: string;
  experience: ImportExperienceBucket | null;
  status: string;
  previousTitle: string;
};

export type ImportCandidateView = {
  id: string;
  fullName: string;
  currentRole: string;
  location: string;
  yearsExperience: number | null;
  topSkills: string[];
  tags: string[];
  matchScore: number;
  matchReasons: string[];
  statusName: string;
  statusColor: string | null;
  alreadyAdded: boolean;
  experienceHighlights: string[];
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniquePhrases(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const phrase = asText(value);
    if (!phrase) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

export function splitSkillPhrases(value: string | null | undefined): string[] {
  const raw = asText(value);
  if (!raw) return [];
  return uniquePhrases(
    raw
      .split(/[\n,;|•]+|(?:\s+[-–—]\s+)/)
      .map((part) => part.replace(/^[-*•\d.)\s]+/, "").trim())
  );
}

export function sanitizeJobSearchTerm(raw: string | null | undefined): string {
  return asText(raw)
    .replace(/[%_,.()'"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function toCandidateSearchPattern(raw: string | null | undefined): string | null {
  const term = sanitizeJobSearchTerm(raw);
  if (term.length < 2) return null;
  return `%${term}%`;
}

export function isImportCandidateUuid(value: string | null | undefined): boolean {
  return Boolean(value && isUuid(value));
}

export function tokenize(text: string | null | undefined): string[] {
  const lower = asText(text).toLowerCase();
  if (!lower) return [];
  const tokens: string[] = [];
  for (const match of lower.matchAll(TOKEN_RE)) {
    const token = match[0].replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
    if (token.length < 3) continue;
    if (STOPWORDS.has(token)) continue;
    tokens.push(token);
  }
  return tokens;
}

function tokenOverlapRatio(needles: string[], haystack: string): number {
  if (!needles.length) return 0;
  const hayTokens = new Set(tokenize(haystack));
  const lower = haystack.toLowerCase();
  let hits = 0;
  for (const token of needles) {
    if (hayTokens.has(token) || lower.includes(token)) hits += 1;
  }
  return hits / needles.length;
}

export function phrasePresent(haystack: string, phrase: string): boolean {
  const needle = asText(phrase);
  if (needle.length < 2) return false;
  const hay = haystack.toLowerCase();
  const lower = needle.toLowerCase();
  if (lower === "or") {
    return /\bor\b/.test(hay) || hay.includes("operating room");
  }
  if (lower.length >= 4 && hay.includes(lower)) return true;
  const tokens = tokenize(lower);
  if (!tokens.length) return hay.includes(lower);
  return tokens.every((token) => hay.includes(token));
}

export function extractYearsExperience(
  haystack: string,
  verified?: unknown
): number | null {
  let max: number | null = null;
  YEARS_RE.lastIndex = 0;
  for (const match of haystack.matchAll(YEARS_RE)) {
    const years = Number(match[1]);
    if (!Number.isFinite(years)) continue;
    const capped = Math.min(50, Math.max(0, years));
    max = max == null ? capped : Math.max(max, capped);
  }
  if (max != null) return max;

  const license = verifiedStringField(verified, "license_information");
  if (license) {
    YEARS_RE.lastIndex = 0;
    for (const match of license.matchAll(YEARS_RE)) {
      const years = Number(match[1]);
      if (!Number.isFinite(years)) continue;
      return Math.min(50, Math.max(0, years));
    }
  }
  return null;
}

export function experienceHighlights(resumeText: string | null | undefined, max = 5): string[] {
  const lines = asText(resumeText)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dated = lines.filter(
    (line) =>
      /\b(?:19|20)\d{2}\b/.test(line) || /\d{1,2}\s*\+?\s*(?:years?|yrs?)\b/i.test(line)
  );
  return dated.slice(0, max);
}

export function experienceBucketMatch(
  years: number | null,
  bucket: ImportExperienceBucket | null
): boolean {
  if (!bucket) return true;
  if (years == null) return false;
  switch (bucket) {
    case "under3":
      return years < 3;
    case "3to5":
      return years >= 3 && years < 5;
    case "5to10":
      return years >= 5 && years < 10;
    case "10plus":
      return years >= 10;
    default:
      return true;
  }
}

function verifiedStringField(verified: unknown, key: string): string {
  if (!verified || typeof verified !== "object" || Array.isArray(verified)) return "";
  const value = (verified as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function verifiedHaystack(verified: unknown): string {
  if (!verified) return "";
  if (typeof verified === "string") return verified;
  if (Array.isArray(verified)) {
    return verified
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return Object.values(item as Record<string, unknown>)
            .filter((value): value is string => typeof value === "string")
            .join(" ");
        }
        return "";
      })
      .join(" ");
  }
  if (typeof verified === "object") {
    return Object.values(verified as Record<string, unknown>)
      .filter((value): value is string => typeof value === "string")
      .join(" ");
  }
  return "";
}

export function candidateHaystack(input: ImportCandidateScoreInput): string {
  return [
    input.fullName,
    input.specialty,
    input.location,
    input.currentRole,
    ...(input.previousTitles ?? []),
    input.resumeText,
    input.notes,
    verifiedHaystack(input.verified),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function detectDiscoveryTags(haystack: string): string[] {
  return DISCOVERY_TAGS.filter((tag) => phrasePresent(haystack, tag));
}

export function matchScoreBand(score: number): ImportMatchBand {
  if (score >= 90) return "excellent";
  if (score >= 80) return "strong";
  if (score >= 70) return "good";
  if (score >= 60) return "possible";
  return "low";
}

function parseMinYears(value: string | null | undefined): number | null {
  const match = asText(value).match(/\d{1,2}/);
  if (!match) return null;
  const years = Number(match[0]);
  return Number.isFinite(years) ? years : null;
}

function firstTokensFromBlob(blob: string, max = 24): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokenize(blob)) {
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }
  return out;
}

export function jobProfileFromWorkspace(
  job: JobRequisitionForRequirements & { department?: string | null }
): JobMatchProfile {
  const structured = buildStructuredJobRequirements(job);
  const blob = [
    buildFullJobDescriptionText(job),
    job.department,
    structured.mandatoryRequirements.join("\n"),
    structured.preferredRequirements.join("\n"),
    structured.requiredLicenses.join("\n"),
    structured.requiredCertifications.join("\n"),
    structured.educationRequirements.join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const requiredSkills = uniquePhrases([
    ...structured.mandatoryRequirements.flatMap(splitSkillPhrases),
    ...structured.requiredLicenses.flatMap(splitSkillPhrases),
  ]).slice(0, 40);

  const preferredSkills = uniquePhrases(
    structured.preferredRequirements.flatMap(splitSkillPhrases)
  ).slice(0, 40);

  const certifications = uniquePhrases([
    ...structured.requiredCertifications,
    ...structured.requiredLicenses,
  ]);
  const education = uniquePhrases(structured.educationRequirements);
  const specialty = asText(structured.specialty) || asText(job.specialty);
  const location = asText(structured.location) || asText(job.location);
  const department = asText(job.department);
  const tags = uniquePhrases([
    specialty,
    department,
    ...detectDiscoveryTags(blob.toLowerCase()),
  ]);

  return {
    title: asText(job.public_title),
    specialty,
    location,
    department,
    requiredSkills,
    preferredSkills,
    certifications,
    education,
    tags,
    keywords: firstTokensFromBlob(blob, 24),
    minYears: parseMinYears(structured.requiredYearsExperience ?? job.years_of_experience),
  };
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreCandidateAgainstJob(
  job: JobMatchProfile,
  candidate: ImportCandidateScoreInput
): CandidateJobMatch {
  const currentRole = asText(candidate.currentRole);
  const specialty = asText(candidate.specialty);
  const previousTitles = (candidate.previousTitles ?? []).map(asText).filter(Boolean);
  const hay = candidateHaystack(candidate);
  const years = extractYearsExperience(hay, candidate.verified);
  const reasons: string[] = [];
  let points = 0;

  const roleHay = `${currentRole} ${specialty} ${previousTitles.join(" ")} ${hay.slice(0, 800)}`;
  let titleRatio = 0.5;
  if (job.title) {
    if (phrasePresent(roleHay, job.title)) {
      titleRatio = 1;
    } else {
      titleRatio = tokenOverlapRatio(tokenize(job.title), roleHay);
    }
  }
  points += 22 * titleRatio;
  if (titleRatio >= 0.7 && job.title) {
    reasons.push(`Role aligns with ${job.title}`);
  } else if (currentRole && titleRatio >= 0.4) {
    reasons.push(`Related experience as ${currentRole}`);
  }

  const required = job.requiredSkills.slice(0, 12);
  if (required.length) {
    const matchedRequired = required.filter((skill) => phrasePresent(hay, skill));
    const ratio = matchedRequired.length / required.length;
    points += 28 * ratio;
    reasons.push(`${matchedRequired.length}/${required.length} required skills matched`);
  } else {
    const keywords = job.keywords.slice(0, 12);
    const denom = Math.min(Math.max(keywords.length, 6), 12);
    const hits = keywords.filter((keyword) => phrasePresent(hay, keyword)).length;
    points += denom > 0 ? 28 * (hits / denom) : 0;
    if (hits >= 3) reasons.push(`${hits} job keywords matched`);
  }

  const preferred = job.preferredSkills.slice(0, 8);
  if (preferred.length) {
    const matchedPreferred = preferred.filter((skill) => phrasePresent(hay, skill));
    points += 10 * (matchedPreferred.length / preferred.length);
    if (matchedPreferred.length) {
      reasons.push(`${matchedPreferred.length} preferred qualifications matched`);
    }
  } else {
    points += 5;
  }

  if (job.minYears != null && years != null) {
    if (years >= job.minYears) {
      points += 10;
      reasons.push(`${years} years experience (meets ${job.minYears}+ requirement)`);
    } else if (years >= job.minYears - 2) {
      points += 6;
      reasons.push(`${years} years experience (near ${job.minYears}+ requirement)`);
    } else {
      points += 2;
    }
  } else if (years != null) {
    if (years >= 8) points += 8;
    else if (years >= 3) points += 6;
    else points += 4;
    if (years >= 5) {
      const label = specialty || job.title || "this role";
      reasons.push(`${years} years experience in ${label}`);
    }
  } else {
    points += 5;
  }

  if (job.specialty) {
    if (phrasePresent(hay, job.specialty)) {
      points += 10;
      reasons.push(`${job.specialty} background`);
    } else {
      points += 10 * tokenOverlapRatio(tokenize(job.specialty), hay);
    }
  } else {
    points += 6;
  }

  if (job.location) {
    const locRatio = phrasePresent(hay, job.location)
      ? 1
      : tokenOverlapRatio(tokenize(job.location), hay);
    if (locRatio >= 0.5) {
      points += 8;
      reasons.push(`Location fit: ${job.location}`);
    } else if (hay.includes("remote")) {
      points += 4;
      reasons.push("Remote or flexible location");
    }
  } else {
    points += 5;
  }

  const certItems = [...job.certifications, ...job.education];
  if (certItems.length) {
    const matchedCerts = certItems.filter((item) => phrasePresent(hay, item));
    points += 6 * (matchedCerts.length / certItems.length);
    if (matchedCerts.length) {
      reasons.push(`${matchedCerts.length} certification/education items matched`);
    }
  } else {
    points += 3;
  }

  const keywordSlice = job.keywords.slice(0, 16);
  if (keywordSlice.length) {
    const denom = Math.min(keywordSlice.length, 10);
    const hits = keywordSlice.filter((keyword) => phrasePresent(hay, keyword)).length;
    points += 6 * (hits / denom);
  } else {
    points += 3;
  }

  const score = clampScore(points);
  const dedupedReasons = uniquePhrases(reasons).slice(0, 6);
  if (!dedupedReasons.length && score >= 50) {
    dedupedReasons.push("Partial overlap with job title and description");
  }

  const matchedSkills = uniquePhrases(
    [...job.requiredSkills, ...job.preferredSkills].filter((skill) => phrasePresent(hay, skill))
  ).slice(0, 8);

  const tags = uniquePhrases([
    specialty,
    ...detectDiscoveryTags(hay),
    ...job.tags.filter((tag) => phrasePresent(hay, tag) || phrasePresent(`${specialty} ${hay}`, tag)),
  ]).slice(0, 8);

  return {
    score,
    band: matchScoreBand(score),
    reasons: dedupedReasons,
    matchedSkills,
    tags,
    yearsExperience: years,
    experienceHighlights: experienceHighlights(candidate.resumeText),
  };
}

function parseCommaList(value: string | null): string[] {
  if (!value) return [];
  return uniquePhrases(value.split(","));
}

function parseExperience(value: string | null): ImportExperienceBucket | null {
  if (value === "under3" || value === "3to5" || value === "5to10" || value === "10plus") {
    return value;
  }
  return null;
}

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function parseImportSearchParams(searchParams: URLSearchParams): ImportSearchParams {
  const tab: ImportSearchTab = searchParams.get("tab") === "all" ? "all" : "recommended";
  const q = asText(searchParams.get("q") ?? searchParams.get("search"));
  const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(
    searchParams.get("pageSize"),
    IMPORT_PAGE_SIZE_DEFAULT,
    1,
    IMPORT_PAGE_SIZE_MAX
  );
  const minMatchRaw = searchParams.get("minMatch");
  const minMatch =
    minMatchRaw == null || minMatchRaw === ""
      ? tab === "recommended"
        ? IMPORT_RECOMMENDED_MIN_SCORE
        : 0
      : clampInt(minMatchRaw, tab === "recommended" ? IMPORT_RECOMMENDED_MIN_SCORE : 0, 0, 100);

  return {
    tab,
    q,
    page,
    pageSize,
    minMatch,
    role: asText(searchParams.get("role")),
    skills: parseCommaList(searchParams.get("skills")),
    tags: parseCommaList(searchParams.get("tags")),
    location: asText(searchParams.get("location")),
    experience: parseExperience(searchParams.get("experience")),
    status: asText(searchParams.get("status")),
    previousTitle: asText(searchParams.get("previousTitle")),
  };
}

export function normalizeImportCandidateIds(raw: unknown): {
  ids: string[];
  invalid: boolean;
  empty: boolean;
  tooMany: boolean;
} {
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== "string")) {
    return { ids: [], invalid: true, empty: false, tooMany: false };
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const id = value.trim();
    if (!id) continue;
    if (!isImportCandidateUuid(id)) {
      return { ids: [], invalid: true, empty: false, tooMany: false };
    }
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(id);
  }
  if (!unique.length) return { ids: [], invalid: false, empty: true, tooMany: false };
  if (unique.length > IMPORT_MAX_IDS_PER_REQUEST) {
    return { ids: unique.slice(0, IMPORT_MAX_IDS_PER_REQUEST), invalid: false, empty: false, tooMany: true };
  }
  return { ids: unique, invalid: false, empty: false, tooMany: false };
}

export function buildImportResultMessage(importedCount: number, skippedAlreadyAddedCount: number): string {
  if (importedCount === 1 && skippedAlreadyAddedCount === 0) {
    return "1 candidate successfully added.";
  }
  if (skippedAlreadyAddedCount > 0) {
    const added = `${importedCount} candidate${importedCount === 1 ? "" : "s"} added`;
    const skipped = `${skippedAlreadyAddedCount} candidate${skippedAlreadyAddedCount === 1 ? "" : "s"} skipped because they already belong to this job.`;
    return `${added}. ${skipped}`;
  }
  return `${importedCount} candidates successfully added.`;
}

export function skillsPresentInHaystack(haystack: string, skills: string[]): boolean {
  return skills.every((skill) => phrasePresent(haystack, skill));
}

export function tagsPresentInHaystack(haystack: string, tags: string[]): boolean {
  return tags.every((tag) => phrasePresent(haystack, tag));
}
