/** How a job application / candidate record was created. */
export const APPLICATION_REFERENCE_SOURCES = ["applicant", "admin", "api"] as const;

export type ApplicationReferenceSource = (typeof APPLICATION_REFERENCE_SOURCES)[number];

const LABELS: Record<ApplicationReferenceSource, string> = {
  applicant: "Onboarding application",
  admin: "Manual resume upload",
  api: "Uploaded via API",
};

export function normalizeApplicationReferenceSource(
  value: string | null | undefined
): ApplicationReferenceSource | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "applicant" || raw === "admin" || raw === "api") return raw;
  return null;
}

/** Human-readable label for candidate Source / reference_source UI. */
export function formatApplicationReferenceSourceLabel(
  value: string | null | undefined
): string | null {
  const normalized = normalizeApplicationReferenceSource(value);
  return normalized ? LABELS[normalized] : null;
}

/** Pill classes for Source tags (AI analysis, lists, hire journey). */
export function applicationReferenceSourceTagClassName(
  value: string | null | undefined
): string {
  const normalized = normalizeApplicationReferenceSource(value);
  if (normalized === "applicant") {
    return "bg-[#ECFDF5] text-[#047857]";
  }
  if (normalized === "admin") {
    return "bg-[#EFF6FF] text-[#1D4ED8]";
  }
  if (normalized === "api") {
    return "bg-[#FFF7ED] text-[#C2410C]";
  }
  return "bg-[#F1F5F9] text-[#64748B]";
}
