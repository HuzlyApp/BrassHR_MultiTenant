export const LICENSE_TYPES = [
  "nursing_license",
  "drivers_license",
  "cpr_certification",
  "tb_test",
  "other",
] as const;

export type LicenseType = (typeof LICENSE_TYPES)[number];

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  nursing_license: "Professional / Nursing License",
  drivers_license: "Driver's License",
  cpr_certification: "CPR Certification",
  tb_test: "TB Test",
  other: "Other License",
};

export const LEGACY_DOCUMENT_KEY_BY_LICENSE_TYPE: Partial<Record<LicenseType, string>> = {
  nursing_license: "nursing_license_url",
  drivers_license: "drivers_license_url",
  cpr_certification: "cpr_certification_url",
  tb_test: "tb_test_url",
};

export type DocumentReviewStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "needs_revision"
  | "expired";

export function documentStatusLabel(status: string): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "needs_revision":
      return "Needs revision";
    case "expired":
      return "Expired";
    case "pending":
    case "under_review":
    case "uploaded":
      return "Pending review";
    default:
      return "Pending review";
  }
}

export function licenseUrgency(
  expiresAt: string | null | undefined,
  status: string
): "expired" | "expiring_soon" | "ok" | "unknown" {
  if (status === "expired") return "expired";
  if (!expiresAt) return "unknown";
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return "unknown";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (expiry < today) return "expired";
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  if (expiry <= soon) return "expiring_soon";
  return "ok";
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
