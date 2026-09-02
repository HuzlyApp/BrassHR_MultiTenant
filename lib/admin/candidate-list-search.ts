import {
  resolveApplicationApplicantEmail,
  resolveApplicationApplicantLocation,
  resolveApplicationApplicantName,
  resolveApplicationApplicantPhone,
  type ApplicationApplicantSource,
  type EmbeddedRecord,
} from "@/lib/jobs/application-applicant-display";

export const CANDIDATE_LIST_SEARCH_PLACEHOLDER =
  "Search name, email, phone, job code, job role, location…";

function oneEmbedded(value: EmbeddedRecord): Record<string, unknown> {
  if (!value) return {};
  return (Array.isArray(value) ? value[0] : value) ?? {};
}

export function normalizeCandidateSearchQuery(query: string): { text: string; digits: string } {
  const trimmed = query.trim();
  return {
    text: trimmed.toLowerCase(),
    digits: trimmed.replace(/\D/g, ""),
  };
}

function normalizeSearchComparable(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesText(value: string, text: string): boolean {
  if (!text) return false;
  const hay = normalizeSearchComparable(value);
  const needle = normalizeSearchComparable(text);
  if (!needle) return false;
  return hay.includes(needle);
}

function includesDigits(value: string, digits: string): boolean {
  if (!digits || digits.length < 3) return false;
  const normalized = value.replace(/\D/g, "");
  return normalized.includes(digits);
}

function matchesTextFields(text: string, fields: string[]): boolean {
  if (!text) return false;
  return fields.some((field) => includesText(field, text));
}

export type CandidateListSearchRow = {
  id?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  reference?: string;
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
  role?: string;
  /** Latest applied job title from job application (when available). */
  applicationJobTitle?: string | null;
  /** All applied job titles joined for search (matches applications list job title). */
  applicationJobTitlesText?: string | null;
  /**
   * Searchable text from applications (same fields as the applications list).
   * Includes withdrawn and archived applications (All tab parity).
   */
  applicationSearchText?: string | null;
};

export function matchesCandidateListSearch(row: CandidateListSearchRow, query: string): boolean {
  const { text, digits } = normalizeCandidateSearchQuery(query);
  if (!text && !digits) return true;

  const locationLine = [row.city, row.state].filter(Boolean).join(", ");
  const jobRole = row.role?.trim() === "N/A" ? "" : (row.role ?? "");

  if (
    matchesTextFields(text, [
      row.name,
      row.firstName ?? "",
      row.lastName ?? "",
      row.email,
      row.phone,
      row.reference ?? "",
      row.id ?? "",
      row.city ?? "",
      row.state ?? "",
      row.zip ?? "",
      row.address ?? "",
      jobRole,
      row.applicationSearchText ?? "",
      row.applicationJobTitle ?? "",
      row.applicationJobTitlesText ?? "",
      locationLine,
    ])
  ) {
    return true;
  }

  if (digits) {
    return includesDigits(row.phone, digits) || includesDigits(row.reference ?? "", digits);
  }

  return false;
}

export type ApplicationListSearchRow = ApplicationApplicantSource & {
  id: string;
  job_requisition_id: string;
  job_requisitions?: EmbeddedRecord;
};

export function resolveApplicationJobCode(row: ApplicationListSearchRow): string {
  const job = oneEmbedded(row.job_requisitions);
  const code = String(job.internal_requisition_number ?? "").trim();
  if (code) return code;
  const jobId = String(row.job_requisition_id ?? "").trim();
  return jobId ? jobId.slice(0, 8).toUpperCase() : "";
}

export function resolveApplicationJobLocation(row: ApplicationListSearchRow): string {
  const job = oneEmbedded(row.job_requisitions);
  return (
    String(job.location ?? "").trim() ||
    String(job.facility_name ?? "").trim() ||
    String(job.facility ?? "").trim()
  );
}

/** Fields searched on the applications list — reused for candidate list parity. */
export function collectApplicationListSearchFields(row: ApplicationListSearchRow): string[] {
  const job = oneEmbedded(row.job_requisitions);
  const jobTitle = String(job.public_title ?? job.source_job_title ?? "").trim();

  return [
    resolveApplicationApplicantName(row),
    resolveApplicationApplicantEmail(row),
    resolveApplicationApplicantPhone(row),
    resolveApplicationJobCode(row),
    resolveApplicationJobLocation(row),
    resolveApplicationApplicantLocation(row),
    jobTitle,
    row.id,
    row.job_requisition_id,
  ];
}

export function matchesApplicationListSearch(row: ApplicationListSearchRow, query: string): boolean {
  const { text, digits } = normalizeCandidateSearchQuery(query);
  if (!text && !digits) return true;

  if (matchesTextFields(text, collectApplicationListSearchFields(row))) {
    return true;
  }

  if (digits) {
    return includesDigits(resolveApplicationApplicantPhone(row), digits);
  }

  return false;
}
