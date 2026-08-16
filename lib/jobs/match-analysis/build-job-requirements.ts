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

function splitQualificationBullets(text: string | null | undefined): {
  mandatory: string[];
  preferred: string[];
} {
  const raw = (text ?? "").trim();
  if (!raw) return { mandatory: [], preferred: [] };

  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);

  const mandatory: string[] = [];
  const preferred: string[] = [];
  let mode: "mandatory" | "preferred" = "mandatory";

  for (const line of lines) {
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
    mandatory: mandatory.slice(0, 40),
    preferred: preferred.slice(0, 40),
  };
}

/**
 * Build structured requirement lists from a job requisition.
 * Prefer cached structured_requirements when present and valid.
 */
export function buildStructuredJobRequirements(
  job: JobRequisitionForRequirements
): StructuredJobRequirements {
  const cached = structuredJobRequirementsSchema.safeParse(job.structured_requirements);
  if (cached.success) {
    const data = cached.data;
    const hasAny =
      data.mandatoryRequirements.length > 0 ||
      data.preferredRequirements.length > 0 ||
      data.requiredLicenses.length > 0 ||
      data.requiredCertifications.length > 0 ||
      data.educationRequirements.length > 0 ||
      Boolean(data.requiredYearsExperience) ||
      Boolean(data.specialty) ||
      Boolean(data.location);
    if (hasAny) return data;
  }

  const quals = splitQualificationBullets(job.qualifications);
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
    mandatoryRequirements: [...quals.mandatory, ...special.mandatory].slice(0, 40),
    preferredRequirements: [...quals.preferred, ...special.preferred].slice(0, 40),
    requiredLicenses: licenses.slice(0, 20),
    requiredCertifications: certs.slice(0, 20),
    educationRequirements: [],
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
  if (job.public_description?.trim()) {
    parts.push("Description:", job.public_description.trim());
  }
  if (job.responsibilities?.trim()) {
    parts.push("Responsibilities:", job.responsibilities.trim());
  }
  if (job.qualifications?.trim()) {
    parts.push("Qualifications:", job.qualifications.trim());
  }
  if (job.special_requirements?.trim()) {
    parts.push("Special requirements:", job.special_requirements.trim());
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
