import { htmlToPlainText } from "@/lib/jobs/generate-job-description/sanitize-html";
import {
  structuredJobRequirementsSchema,
  type StructuredJobRequirements,
} from "./schema";

export type JobRequisitionForRequirements = {
  id?: string | null;
  public_title?: string | null;
  qualifications?: string | null;
  responsibilities?: string | null;
  public_description?: string | null;
  special_requirements?: string | null;
  required_credentials?: unknown;
  years_of_experience?: string | null;
  years_experience_required?: number | null;
  location?: string | null;
  specialty?: string | null;
  specialties?: { name?: string | null } | { name?: string | null }[] | null;
  professions?: { name?: string | null } | { name?: string | null }[] | null;
  msp_client?: string | null;
  msp_name?: string | null;
  facility?: string | null;
  facility_name?: string | null;
  structured_requirements?: unknown;
};

function oneName(
  value: { name?: string | null } | { name?: string | null }[] | null | undefined
): string {
  if (!value) return "";
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name?.trim() ?? "";
}

function asStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return asStringList(parsed);
    } catch {
      /* plain text */
    }
    return trimmed
      .split(/[\n;,|]+/)
      .map((part) => part.replace(/^[-*•\s]+/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function uniquePhrases(items: string[], max = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

function toPlainText(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (!/<\/?[a-z][\s\S]*>/i.test(raw)) return raw;
  return htmlToPlainText(raw);
}

function normalizeHeading(line: string): string {
  return line
    .replace(/[’‘]/g, "'")
    .replace(/[:.\s]+$/g, "")
    .trim();
}

function classifyDescriptionHeading(
  line: string
): "mandatory" | "preferred" | "other" | null {
  if (line.length > 80) return null;
  const heading = normalizeHeading(line);
  if (!heading) return null;

  if (
    /^(?:required\s+qualifications?|required\s+skills?|mandatory\s+(?:requirements?|qualifications?)|must[- ]?haves?|minimum\s+requirements?|qualifications)$/i.test(
      heading
    )
  ) {
    return "mandatory";
  }
  if (
    /^(?:preferred\s+qualifications?|preferred\s+skills?|nice[- ]?to[- ]?have|desired\s+(?:qualifications?|skills?)|pluses?)$/i.test(
      heading
    )
  ) {
    return "preferred";
  }
  if (
    /^(?:about the (?:role|opportunity|job)|job title|job summary|job description|full job description|key responsibilities|responsibilities|what you'll do|what you will do|benefits|work location(?: and schedule)?|employment (?:type|details)|compensation|how to apply)$/i.test(
      heading
    )
  ) {
    return "other";
  }
  return null;
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^(?:[-*•]|\d+[.)])\s+/, "").trim();
}

function splitLines(text: string): string[] {
  return text.split(/\n+/).map(stripBulletPrefix).filter(Boolean);
}

function splitQualificationBullets(text: string | null | undefined): {
  mandatory: string[];
  preferred: string[];
} {
  const raw = toPlainText(text);
  if (!raw) return { mandatory: [], preferred: [] };

  const lines = splitLines(raw);
  const mandatory: string[] = [];
  const preferred: string[] = [];
  let mode: "mandatory" | "preferred" = "mandatory";

  for (const line of lines) {
    const heading = classifyDescriptionHeading(line);
    if (heading === "mandatory") {
      mode = "mandatory";
      continue;
    }
    if (heading === "preferred") {
      mode = "preferred";
      continue;
    }
    if (/^(required|mandatory|must\s*have|minimum)\b/i.test(line) && line.length < 60) {
      mode = "mandatory";
      continue;
    }
    if (/^(preferred|nice\s*to\s*have|plus|desired)\b/i.test(line) && line.length < 60) {
      mode = "preferred";
      continue;
    }
    if (/\b(preferred|nice\s*to\s*have)\b/i.test(line)) {
      preferred.push(line);
    } else if (mode === "preferred") {
      preferred.push(line);
    } else {
      mandatory.push(line);
    }
  }

  // If no bullets, treat whole block as one mandatory blob (truncated)
  if (!mandatory.length && !preferred.length && raw.length) {
    mandatory.push(raw.slice(0, 1000));
  }

  return {
    mandatory: uniquePhrases(mandatory),
    preferred: uniquePhrases(preferred),
  };
}

/**
 * Pull Required / Preferred sections out of a full job description.
 * Ignores responsibilities and other sections so they are not treated as qualifications.
 */
export function extractQualificationSectionsFromDescription(
  htmlOrText: string | null | undefined
): { mandatory: string[]; preferred: string[] } {
  const raw = toPlainText(htmlOrText);
  if (!raw) return { mandatory: [], preferred: [] };

  const mandatory: string[] = [];
  const preferred: string[] = [];
  let mode: "skip" | "mandatory" | "preferred" = "skip";

  for (const line of splitLines(raw)) {
    const heading = classifyDescriptionHeading(line);
    if (heading === "mandatory") {
      mode = "mandatory";
      continue;
    }
    if (heading === "preferred") {
      mode = "preferred";
      continue;
    }
    if (heading === "other") {
      mode = "skip";
      continue;
    }
    if (mode === "mandatory") mandatory.push(line);
    else if (mode === "preferred") preferred.push(line);
  }

  return {
    mandatory: uniquePhrases(mandatory),
    preferred: uniquePhrases(preferred),
  };
}

function cachedHasRequirementLists(data: StructuredJobRequirements): boolean {
  return (
    data.mandatoryRequirements.length > 0 || data.preferredRequirements.length > 0
  );
}

/**
 * Build structured requirement lists from a job requisition.
 * Prefer cached structured_requirements only when they already include
 * required or preferred qualification lists. Location / years alone are not enough —
 * those can be filled while the actual quals still live in the HTML description.
 */
export function buildStructuredJobRequirements(
  job: JobRequisitionForRequirements
): StructuredJobRequirements {
  const cached = structuredJobRequirementsSchema.safeParse(job.structured_requirements);
  if (cached.success && cachedHasRequirementLists(cached.data)) {
    return cached.data;
  }

  const quals = splitQualificationBullets(job.qualifications);
  const fromDescription = extractQualificationSectionsFromDescription(job.public_description);
  const special = splitQualificationBullets(job.special_requirements);
  const credentials = asStringList(job.required_credentials);

  const licenses = credentials.filter((c) =>
    /\b(license|licensure|RN|LPN|CNA|compact|state)\b/i.test(c)
  );
  const certs = credentials.filter((c) => !licenses.includes(c));

  const specialty = oneName(job.specialties) || job.specialty?.trim() || "";
  const years =
    job.years_of_experience?.trim() ||
    (job.years_experience_required != null
      ? String(job.years_experience_required)
      : null);

  return structuredJobRequirementsSchema.parse({
    mandatoryRequirements: uniquePhrases([
      ...quals.mandatory,
      ...fromDescription.mandatory,
      ...special.mandatory,
    ]),
    preferredRequirements: uniquePhrases([
      ...quals.preferred,
      ...fromDescription.preferred,
      ...special.preferred,
    ]),
    requiredLicenses: licenses.slice(0, 20),
    requiredCertifications: certs.slice(0, 20),
    educationRequirements: cached.success ? cached.data.educationRequirements : [],
    requiredYearsExperience: years,
    specialty: specialty || null,
    location: job.location?.trim() || null,
  });
}

export function buildFullJobDescriptionText(job: JobRequisitionForRequirements): string {
  const parts: string[] = [];
  const title = job.public_title?.trim();
  if (title) parts.push(`Title: ${title}`);
  const profession = oneName(job.professions);
  if (profession) parts.push(`Profession: ${profession}`);
  const specialty = oneName(job.specialties) || job.specialty?.trim();
  if (specialty) parts.push(`Specialty: ${specialty}`);
  if (job.location?.trim()) parts.push(`Location: ${job.location.trim()}`);
  if (job.facility_name?.trim() || job.facility?.trim()) {
    parts.push(`Facility: ${job.facility_name?.trim() || job.facility?.trim()}`);
  }
  const description = toPlainText(job.public_description);
  if (description) {
    parts.push("Description:", description);
  }
  const responsibilities = toPlainText(job.responsibilities);
  if (responsibilities) {
    parts.push("Responsibilities:", responsibilities);
  }
  const qualifications = toPlainText(job.qualifications);
  if (qualifications) {
    parts.push("Qualifications:", qualifications);
  }
  const special = toPlainText(job.special_requirements);
  if (special) {
    parts.push("Special requirements:", special);
  }
  const creds = asStringList(job.required_credentials);
  if (creds.length) {
    parts.push("Required credentials:", creds.map((c) => `- ${c}`).join("\n"));
  }
  return parts.join("\n\n");
}

export function jobMetaFromRequisition(job: JobRequisitionForRequirements) {
  return {
    jobId: job.id ?? "",
    jobTitle: job.public_title?.trim() || "",
    mspOrClient: job.msp_client?.trim() || job.msp_name?.trim() || "",
    specialty: oneName(job.specialties) || job.specialty?.trim() || "",
    location: job.location?.trim() || "",
  };
}
