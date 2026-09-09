import { parseSkillsFilterParam } from "@/lib/jobs/application-skills-filter";
import { skillsPresentInHaystack } from "@/lib/jobs/candidate-import-match";
import { jobDescriptionPlainText } from "@/lib/jobs/job-description-html";
import { formatCityState } from "@/lib/location/city-state";

/**
 * Builds the payload applied when the user clicks Search / presses Enter.
 * Free-text and skills stay separate (listing ANDs them when both are set).
 */
export function buildJobsSearchApplyPayload(input: {
  query: string;
  skillTags: string[];
}): { query: string; skillsFilter: string } {
  return {
    query: input.query.trim(),
    skillsFilter: input.skillTags.map((s) => s.trim()).filter(Boolean).join(", "),
  };
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join(" ");
  }
  return String(value).trim();
}

function relationName(
  value: { name?: string | null } | { name?: string | null }[] | null | undefined
): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name?.trim() || "";
}

function jobDisplayTitleForSearch(job: {
  source_type?: string | null;
  public_title?: string | null;
  source_job_title?: string | null;
}): string {
  const source = String(job.source_type ?? "").trim().toLowerCase();
  if (source === "msp") {
    return job.source_job_title?.trim() || job.public_title?.trim() || "";
  }
  return job.public_title?.trim() || "";
}

/** Fields used by free-text job search (OR across fields). */
export type JobTextSearchRow = {
  source_type?: string | null;
  public_title?: string | null;
  source_job_title?: string | null;
  location?: string | null;
  facility?: string | null;
  facility_name?: string | null;
  msp_name?: string | null;
  msp_client?: string | null;
  professions?: { name?: string | null } | { name?: string | null }[] | null;
};

/**
 * Free-text matches job name/title, location, MSP/client name, or profession (OR).
 */
export function jobMatchesTextSearch(job: JobTextSearchRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const rawLocation =
    job.location?.trim() || job.facility_name?.trim() || job.facility?.trim() || "";
  const formattedLocation = rawLocation ? formatCityState(rawLocation) || rawLocation : "";

  const haystack = [
    jobDisplayTitleForSearch(job),
    job.public_title,
    job.source_job_title,
    rawLocation,
    formattedLocation,
    job.msp_name,
    job.msp_client,
    relationName(job.professions),
  ]
    .map((part) => asText(part).toLowerCase())
    .filter(Boolean)
    .join("\n");

  return haystack.includes(q);
}

/** Fields used to match skill tags against a job row (AND across skills). */
export type JobSkillsSearchRow = {
  tags?: string[] | null;
  public_title?: string | null;
  source_job_title?: string | null;
  qualifications?: string | null;
  public_description?: string | null;
  responsibilities?: string | null;
  special_requirements?: string | null;
  required_credentials?: string | string[] | null;
  professions?: { name?: string | null } | { name?: string | null }[] | null;
  specialties?: { name?: string | null } | { name?: string | null }[] | null;
};

export function jobSkillsSearchHaystack(job: JobSkillsSearchRow): string {
  const tags = Array.isArray(job.tags)
    ? job.tags.map((tag) => String(tag ?? "").trim()).filter(Boolean).join(" ")
    : "";
  const credentials = asText(job.required_credentials);
  const parts = [
    job.public_title,
    job.source_job_title,
    relationName(job.professions),
    relationName(job.specialties),
    tags,
    credentials,
    jobDescriptionPlainText(job.qualifications ?? ""),
    jobDescriptionPlainText(job.public_description ?? ""),
    jobDescriptionPlainText(job.responsibilities ?? ""),
    jobDescriptionPlainText(job.special_requirements ?? ""),
  ];
  return parts.filter(Boolean).join("\n").toLowerCase();
}

/** Every skill tag must appear in the job skills haystack (AND). */
export function jobMatchesSkillsFilter(
  job: JobSkillsSearchRow,
  skillsFilter: string | string[]
): boolean {
  const skills = Array.isArray(skillsFilter)
    ? skillsFilter.map((s) => s.trim()).filter(Boolean)
    : parseSkillsFilterParam(skillsFilter);
  if (!skills.length) return true;
  return skillsPresentInHaystack(jobSkillsSearchHaystack(job), skills);
}
