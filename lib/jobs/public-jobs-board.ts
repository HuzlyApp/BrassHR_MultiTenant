import { formatStoredJobDescriptionHtml } from "@/lib/jobs/job-description-html";
import { htmlToPlainText } from "@/lib/jobs/generate-job-description/sanitize-html";
import {
  buildApplyPath,
  normalizeJobToken,
  publicJobDisplayTitle,
} from "@/lib/jobs/public-application-routing";
import { EMPLOYMENT_TYPES } from "@/lib/jobs/types";
import { formatCityState } from "@/lib/location/city-state";

export const PUBLIC_JOBS_PAGE_SIZE = 10;
/** Split list+detail from laptop width up; tablet/mobile use stacked list → detail. */
export const PUBLIC_JOBS_DESKTOP_MIN_WIDTH = 1024;
export const JOBS_BOARD_INPUT_DEBOUNCE_MS = 300;
export const JOB_LOCATION_TYPES = ["Remote", "Hybrid", "On-site", "Remote, Hybrid"] as const;
export type JobLocationType = (typeof JOB_LOCATION_TYPES)[number];
export const JOBS_BOARD_SORTS = ["recent", "relevant"] as const;
export type JobsBoardSort = (typeof JOBS_BOARD_SORTS)[number];

export type PublicJobRelation = { name?: string } | { name?: string }[] | null;

export type PublicBoardJob = {
  id?: string;
  public_job_token: string;
  public_title: string;
  source_job_title?: string | null;
  source_type?: string | null;
  public_description: string;
  location: string | null;
  location_type?: string | null;
  schedule: string | null;
  employment_type: string;
  pay_rate_min?: number | null;
  pay_rate_max?: number | null;
  pay_rate?: number | null;
  pay_rate_period?: string | null;
  rate_unit?: string | null;
  compensation_type?: string | null;
  currency?: string | null;
  show_pay_by?: string | null;
  qualifications?: string | null;
  responsibilities?: string | null;
  benefits?: string | null;
  application_deadline?: string | null;
  published_at: string | null;
  updated_at?: string | null;
  workflow_id?: string | null;
  professions: PublicJobRelation;
  specialties: PublicJobRelation;
};

export type JobsBoardUrlState = {
  q: string;
  professionId: string;
  specialtyId: string;
  location: string;
  employmentType: string;
  locationType: string;
  sort: JobsBoardSort;
  page: number;
  job: string | null;
  panel: "detail" | null;
};

const SECTION_HEADING_RE =
  /^(?:about the (?:job|role)|job title|job summary|job description|full job description|key responsibilities|responsibilities|qualifications|required qualifications|preferred qualifications|preferred skills|benefits|work location(?: and schedule)?|employment details)\s*:?$/i;

export function relationName(value: PublicJobRelation): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name?.trim() ?? "";
}

export function parseJobsBoardSearchParams(
  searchParams: Pick<URLSearchParams, "get">
): JobsBoardUrlState {
  const pageRaw = Number(searchParams.get("page") || 1);
  const employmentType = searchParams.get("employmentType")?.trim() ?? "";
  const locationType = searchParams.get("locationType")?.trim() ?? "";
  const sortRaw = searchParams.get("sort")?.trim().toLowerCase();
  const panel = searchParams.get("panel")?.trim().toLowerCase();
  return {
    q: searchParams.get("q")?.trim() ?? "",
    professionId: searchParams.get("professionId")?.trim() ?? "",
    specialtyId: searchParams.get("specialtyId")?.trim() ?? "",
    location: searchParams.get("location")?.trim() ?? "",
    employmentType:
      employmentType && EMPLOYMENT_TYPES.includes(employmentType as (typeof EMPLOYMENT_TYPES)[number])
        ? employmentType
        : "",
    locationType: JOB_LOCATION_TYPES.includes(locationType as JobLocationType) ? locationType : "",
    sort: JOBS_BOARD_SORTS.includes(sortRaw as JobsBoardSort) ? (sortRaw as JobsBoardSort) : "recent",
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1,
    job: normalizeJobToken(searchParams.get("job")),
    panel: panel === "detail" ? "detail" : null,
  };
}

export function buildJobsBoardSearchParams(input: {
  tenant: string;
  q?: string;
  professionId?: string;
  specialtyId?: string;
  location?: string;
  employmentType?: string;
  locationType?: string;
  sort?: JobsBoardSort;
  page?: number;
  job?: string | null;
  panel?: "detail" | null;
}): URLSearchParams {
  const params = new URLSearchParams();
  const tenant = input.tenant.trim().toLowerCase();
  if (tenant) params.set("tenant", tenant);
  const q = input.q?.trim() ?? "";
  const professionId = input.professionId?.trim() ?? "";
  const specialtyId = input.specialtyId?.trim() ?? "";
  const location = input.location?.trim() ?? "";
  const employmentType = input.employmentType?.trim() ?? "";
  const locationType = input.locationType?.trim() ?? "";
  const sort = input.sort === "relevant" ? "relevant" : "";
  const page = input.page && input.page > 1 ? Math.floor(input.page) : 1;
  const job = normalizeJobToken(input.job);
  if (q) params.set("q", q);
  if (professionId) params.set("professionId", professionId);
  if (specialtyId) params.set("specialtyId", specialtyId);
  if (location) params.set("location", location);
  if (employmentType) params.set("employmentType", employmentType);
  if (locationType) params.set("locationType", locationType);
  if (sort) params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  if (job) params.set("job", job);
  if (input.panel === "detail") params.set("panel", "detail");
  return params;
}

export function buildJobsBoardHref(input: Parameters<typeof buildJobsBoardSearchParams>[0]): string {
  return `/jobs?${buildJobsBoardSearchParams(input).toString()}`;
}

export function buildPublicJobsApiSearchParams(input: {
  tenant: string;
  q?: string;
  professionId?: string;
  specialtyId?: string;
  location?: string;
  employmentType?: string;
  locationType?: string;
  page?: number;
  pageSize?: number;
}): URLSearchParams {
  const params = new URLSearchParams({
    tenant: input.tenant.trim().toLowerCase(),
    page: String(Math.max(1, input.page ?? 1)),
    pageSize: String(input.pageSize ?? PUBLIC_JOBS_PAGE_SIZE),
  });
  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.professionId?.trim()) params.set("professionId", input.professionId.trim());
  if (input.specialtyId?.trim()) params.set("specialtyId", input.specialtyId.trim());
  if (input.location?.trim()) params.set("location", input.location.trim());
  if (input.employmentType?.trim()) params.set("employmentType", input.employmentType.trim());
  if (input.locationType?.trim()) params.set("locationType", input.locationType.trim());
  return params;
}

export function hasActiveJobsBoardFilters(state: Pick<
  JobsBoardUrlState,
  "q" | "professionId" | "specialtyId" | "location" | "employmentType"
> & { locationType?: string }): boolean {
  return Boolean(
    state.q ||
      state.professionId ||
      state.specialtyId ||
      state.location ||
      state.employmentType ||
      state.locationType
  );
}

export function hasSecondaryJobsBoardFilters(state: Pick<
  JobsBoardUrlState,
  "professionId" | "specialtyId" | "employmentType" | "locationType"
>): boolean {
  return Boolean(state.professionId || state.specialtyId || state.employmentType || state.locationType);
}

export function countSecondaryJobsBoardFilters(state: Pick<
  JobsBoardUrlState,
  "professionId" | "specialtyId" | "employmentType" | "locationType"
>): number {
  return [state.professionId, state.specialtyId, state.employmentType, state.locationType].filter(Boolean)
    .length;
}

export type JobsBoardActiveChip = {
  key: "professionId" | "specialtyId" | "employmentType" | "locationType";
  label: string;
};

export function jobsBoardActiveChips(
  state: Pick<
    JobsBoardUrlState,
    "professionId" | "specialtyId" | "employmentType" | "locationType"
  >,
  labels: { profession?: string; specialty?: string }
): JobsBoardActiveChip[] {
  const chips: JobsBoardActiveChip[] = [];
  if (state.professionId) chips.push({ key: "professionId", label: labels.profession || "Profession" });
  if (state.specialtyId) chips.push({ key: "specialtyId", label: labels.specialty || "Specialty" });
  if (state.employmentType) chips.push({ key: "employmentType", label: state.employmentType });
  if (state.locationType) chips.push({ key: "locationType", label: state.locationType });
  return chips;
}

/** Strip characters that break PostgREST `or` / `ilike` filter fragments. */
export function sanitizePublicJobsSearchTerm(raw: string): string {
  return raw
    .replace(/[%_]/g, " ")
    .replace(/,/g, " ")
    .replace(/"/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function publicJobsIlikePattern(term: string): string {
  const cleaned = sanitizePublicJobsSearchTerm(term);
  return `"%${cleaned}%"`;
}

const PUBLIC_JOBS_KEYWORD_COLUMNS = [
  "public_title",
  "source_job_title",
  "public_description",
  "location",
  "location_type",
  "schedule",
  "employment_type",
] as const;

const MAX_PUBLIC_JOBS_QUERY_TAGS = 16;

/** Parse comma-separated keyword tags from the jobs board `q` param (same rules as skills chips). */
export function parsePublicJobsQueryTags(query: string | null | undefined): string[] {
  if (!query?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of query.split(",")) {
    const tag = part.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_PUBLIC_JOBS_QUERY_TAGS) break;
  }
  return out;
}

export function serializePublicJobsQueryTags(tags: string[]): string {
  return parsePublicJobsQueryTags(tags.join(",")).join(",");
}

/** One PostgREST `or(...)` filter per keyword tag/phrase (AND across tags). */
export function buildPublicJobsKeywordOrFilters(query: string): string[] {
  const tags = parsePublicJobsQueryTags(query);
  return tags
    .map((tag) => {
      const cleaned = sanitizePublicJobsSearchTerm(tag);
      if (!cleaned) return "";
      const pattern = publicJobsIlikePattern(cleaned);
      return PUBLIC_JOBS_KEYWORD_COLUMNS.map((column) => `${column}.ilike.${pattern}`).join(",");
    })
    .filter(Boolean);
}

export function matchWorkplaceTypeFromLocationSearch(raw: string): JobLocationType | null {
  const normalized = sanitizePublicJobsSearchTerm(raw).toLowerCase();
  if (!normalized) return null;
  if (normalized === "onsite" || normalized === "on site") return "On-site";
  for (const type of JOB_LOCATION_TYPES) {
    if (type.toLowerCase() === normalized) return type;
  }
  return null;
}

/**
 * Workplace filter matching (advanced dropdown + typing "remote" in location).
 * Includes jobs with empty location_type that still say Remote/Hybrid/On-site in location text.
 */
export function buildPublicJobsWorkplaceTypeOrFilter(locationType: string): string | null {
  const cleaned = locationType.trim();
  if (!cleaned) return null;
  const quoted = `"${cleaned.replace(/"/g, '\\"')}"`;
  // Keep commas (e.g. "Remote, Hybrid") — only strip PostgREST wildcards / quotes.
  const ilikeValue = cleaned.replace(/[%_]/g, " ").replace(/"/g, " ").replace(/\s+/g, " ").trim();
  const pattern = `"%${ilikeValue}%"`;
  return [
    `location_type.eq.${quoted}`,
    `and(location_type.is.null,schedule.eq.${quoted})`,
    `and(location_type.eq."",schedule.eq.${quoted})`,
    `and(location_type.is.null,location.ilike.${pattern})`,
    `and(location_type.eq."",location.ilike.${pattern})`,
  ].join(",");
}

/** Location box: city/state text, or exact workplace words like "remote". */
export function buildPublicJobsLocationOrFilter(location: string): string | null {
  const cleaned = sanitizePublicJobsSearchTerm(location);
  if (!cleaned) return null;
  const workplace = matchWorkplaceTypeFromLocationSearch(location);
  if (workplace) return buildPublicJobsWorkplaceTypeOrFilter(workplace);
  const pattern = publicJobsIlikePattern(cleaned);
  return [
    `location.ilike.${pattern}`,
    `location_type.ilike.${pattern}`,
    `schedule.ilike.${pattern}`,
  ].join(",");
}

export function jobActivityTimestamp(job: Pick<PublicBoardJob, "published_at" | "updated_at">): number {
  const published = Date.parse(String(job.published_at ?? "")) || 0;
  const updated = Date.parse(String(job.updated_at ?? "")) || 0;
  return Math.max(published, updated);
}

function tokenizeSearchTerms(...parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const part of parts) {
    for (const raw of String(part ?? "")
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/i)) {
      const token = raw.trim();
      if (token.length < 2 || seen.has(token)) continue;
      seen.add(token);
      tokens.push(token);
    }
  }
  return tokens;
}

/** Higher = more relevant for "Most relevant" sort. */
export function jobRelevanceScore(
  job: PublicBoardJob,
  query: string,
  locationQuery = ""
): number {
  const title = publicBoardJobTitle(job).toLowerCase();
  const sourceTitle = String(job.source_job_title ?? "").toLowerCase();
  const location = String(job.location ?? "").toLowerCase();
  const workplace = String(job.location_type ?? job.schedule ?? "").toLowerCase();
  const description = String(job.public_description ?? "").toLowerCase();
  const term = query.trim().toLowerCase();
  const locationTerm = locationQuery.trim().toLowerCase();
  let score = 0;

  if (term) {
    if (title === term || sourceTitle === term) score += 80;
    else if (title.startsWith(term) || sourceTitle.startsWith(term)) score += 60;
    else if (title.includes(term) || sourceTitle.includes(term)) score += 45;

    for (const token of tokenizeSearchTerms(term)) {
      if (title.includes(token) || sourceTitle.includes(token)) score += 14;
      else if (location.includes(token) || workplace.includes(token)) score += 8;
      else if (description.includes(token)) score += 4;
    }
  }

  if (locationTerm) {
    if (location.includes(locationTerm) || workplace.includes(locationTerm)) score += 28;
    for (const token of tokenizeSearchTerms(locationTerm)) {
      if (location.includes(token) || workplace.includes(token)) score += 10;
      else if (title.includes(token) || description.includes(token)) score += 3;
    }
  }

  // Without keywords, still rank "better" postings above sparse ones so Relevant ≠ Recent.
  if (job.workflow_id) score += 10;
  if (job.pay_rate_min != null || job.pay_rate_max != null || job.pay_rate != null) score += 6;
  if (description.length > 280) score += 5;
  else if (description.length > 80) score += 2;
  if (job.location_type?.trim()) score += 4;
  if (job.employment_type?.trim()) score += 2;
  if (title.length >= 12) score += 2;

  return score;
}

export function sortPublicBoardJobs(
  jobs: PublicBoardJob[],
  sort: JobsBoardSort,
  query: string,
  locationQuery = ""
): PublicBoardJob[] {
  const byActivityDesc = (a: PublicBoardJob, b: PublicBoardJob) =>
    jobActivityTimestamp(b) - jobActivityTimestamp(a);

  if (sort !== "relevant") {
    return [...jobs].sort(byActivityDesc);
  }

  return [...jobs].sort((a, b) => {
    const scoreDiff =
      jobRelevanceScore(b, query, locationQuery) - jobRelevanceScore(a, query, locationQuery);
    if (scoreDiff !== 0) return scoreDiff;
    return byActivityDesc(a, b);
  });
}

export function resolveSelectedJobToken(
  jobs: Array<Pick<PublicBoardJob, "public_job_token">>,
  requestedToken: string | null | undefined,
  options?: { fallbackToFirst?: boolean }
): string | null {
  const tokens = jobs
    .map((job) => normalizeJobToken(job.public_job_token))
    .filter((token): token is string => Boolean(token));
  if (!tokens.length) return null;
  const requested = normalizeJobToken(requestedToken);
  if (requested && tokens.includes(requested)) return requested;
  if (options?.fallbackToFirst === false) return null;
  return tokens[0] ?? null;
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

export function jobCardSummary(description: string, jobTitle?: string): string {
  const title = jobTitle?.trim() ?? "";
  const titleLower = title.toLowerCase();
  const plain = decodeHtmlEntities(htmlToPlainText(description ?? "")).replace(/\u00a0/g, " ");
  const lines = plain
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => {
      const normalized = line.replace(/[:.\s]+$/g, "").trim().toLowerCase();
      if (!normalized) return false;
      if (SECTION_HEADING_RE.test(normalized)) return false;
      if (titleLower && normalized === titleLower) return false;
      if (titleLower && normalized === `about the job ${titleLower}`) return false;
      return true;
    })
    .map((line) => {
      if (!titleLower) return line;
      return line.replace(new RegExp(`^about the job\\s+${escapeRegExp(title)}\\s*`, "i"), "").trim();
    })
    .filter(Boolean);

  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= 140) return text;
  const sliced = text.slice(0, 140);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}

export function formatPublicJobPay(job: Pick<
  PublicBoardJob,
  "pay_rate_min" | "pay_rate_max" | "pay_rate" | "pay_rate_period" | "rate_unit" | "compensation_type" | "show_pay_by"
>): string | null {
  const parts = formatPublicJobPayParts(job);
  if (!parts) return null;
  const period = formatPayPeriodLabel(job.pay_rate_period || job.rate_unit || job.compensation_type);
  return period ? `${parts.amount} ${period}` : parts.amount;
}

/** Figma detail row: amount + short unit (e.g. amount "$35 - $67", unit "/ hr"). */
export function formatPublicJobPayParts(job: Pick<
  PublicBoardJob,
  "pay_rate_min" | "pay_rate_max" | "pay_rate" | "pay_rate_period" | "rate_unit" | "compensation_type" | "show_pay_by"
>): { amount: string; unit: string } | null {
  const min = toFiniteNumber(job.pay_rate_min);
  const max = toFiniteNumber(job.pay_rate_max);
  const suggested = toFiniteNumber(job.pay_rate);
  if (min == null && max == null && suggested == null) return null;
  const showPayBy = String(job.show_pay_by ?? "").trim().toLowerCase();
  const isRange = showPayBy.includes("range") || (min != null && max != null && min !== max);
  let amount: string;
  if (isRange && min != null && max != null && min !== max) {
    amount = `$${formatMoney(min)} - $${formatMoney(max)}`;
  } else {
    const value = min ?? max ?? suggested;
    if (value == null) return null;
    const prefix = showPayBy.includes("starting") ? "From " : "";
    amount = `${prefix}$${formatMoney(value)}`;
  }
  return { amount, unit: formatPayUnitShort(job.pay_rate_period || job.rate_unit || job.compensation_type) };
}

export function formatWorkplaceType(locationType: string | null | undefined): string | null {
  const value = locationType?.trim();
  return value || null;
}

/** Place-only line for detail header (workplace goes in the meta row). */
export function formatJobPlaceLine(location: string | null | undefined): string {
  const raw = location?.trim() || "";
  if (!raw) return "";
  return formatCityState(raw) || raw;
}

export function formatJobLocationLine(
  location: string | null | undefined,
  locationType: string | null | undefined
): string {
  const workplace = formatWorkplaceType(locationType);
  const place = formatJobPlaceLine(location);
  if (workplace && /^remote$/i.test(workplace) && !place) return "Remote";
  if (workplace && place && !place.toLowerCase().includes(workplace.toLowerCase())) {
    return `${place} · ${workplace}`;
  }
  return place || workplace || "Location not specified";
}

export function formatPostedDate(iso: string | null | undefined, updatedIso?: string | null): string | null {
  const resolved = resolvePostedDate(iso, updatedIso);
  if (!resolved) return null;
  return `${resolved.label} ${resolved.date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

/** Figma detail: "Posted: September 2, 2026" */
export function formatPostedDateDetail(iso: string | null | undefined, updatedIso?: string | null): string | null {
  const resolved = resolvePostedDate(iso, updatedIso);
  if (!resolved) return null;
  return `${resolved.label}: ${resolved.date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function benefitItems(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function descriptionHasSection(html: string, heading: string): boolean {
  const plain = htmlToPlainText(html).toLowerCase();
  const needle = heading.trim().toLowerCase();
  if (!needle) return false;
  return new RegExp(`(^|\\n)\\s*${escapeRegExp(needle)}\\s*:?\\s*(\\n|$)`, "i").test(plain);
}

export function formatPublicJobDescriptionHtml(
  raw: string,
  hasSeparateBenefits: boolean,
  _jobTitle?: string
): string {
  return formatStoredJobDescriptionHtml(raw, {
    stripBenefits: hasSeparateBenefits,
  });
}

export function selectedJobApplyHref(
  tenantSlug: string,
  job: Pick<PublicBoardJob, "public_job_token" | "workflow_id"> | null
): string | null {
  if (!job) return null;
  const token = normalizeJobToken(job.public_job_token);
  if (!token || !job.workflow_id) return null;
  return buildApplyPath(tenantSlug, token);
}

export function publicBoardJobTitle(job: PublicBoardJob): string {
  return publicJobDisplayTitle(job);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatMoney(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPayPeriodLabel(period: string | null | undefined): string {
  const raw = String(period ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("hour")) return "per hour";
  if (raw.includes("week")) return "per week";
  if (raw.includes("month")) return "per month";
  if (raw.includes("year") || raw.includes("annual")) return "per year";
  return String(period ?? "").trim();
}

function formatPayUnitShort(period: string | null | undefined): string {
  const raw = String(period ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("hour")) return "/ hr";
  if (raw.includes("week")) return "/ wk";
  if (raw.includes("month")) return "/ mo";
  if (raw.includes("year") || raw.includes("annual")) return "/ yr";
  if (raw.includes("day")) return "/ day";
  return "";
}

function resolvePostedDate(
  iso: string | null | undefined,
  updatedIso?: string | null
): { label: "Posted" | "Updated"; date: Date } | null {
  const published = parseDate(iso);
  const updated = parseDate(updatedIso);
  const shown =
    updated && published && updated.getTime() - published.getTime() > 36 * 60 * 60 * 1000
      ? updated
      : published ?? updated;
  if (!shown) return null;
  const label =
    updated && published && updated.getTime() - published.getTime() > 36 * 60 * 60 * 1000
      ? "Updated"
      : "Posted";
  return { label, date: shown };
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
