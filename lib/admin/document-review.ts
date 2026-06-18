export const DOCUMENT_REVIEW_STATUSES = [
  "uploaded",
  "under_review",
  "approved",
  "rejected",
  "needs_revision",
] as const;

export type DocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number];

export const LEGACY_DOCUMENT_KEYS = [
  "nursing_license_url",
  "tb_test_url",
  "cpr_certification_url",
  "ssn_url",
  "ssn_back_url",
  "drivers_license_url",
  "drivers_license_back_url",
  "document_url",
  "agreement_w2_url",
  "agreement_i9_url",
] as const;

export type LegacyDocumentKey = (typeof LEGACY_DOCUMENT_KEYS)[number];

const DOCUMENT_FIELD_TO_LEGACY_KEY: Record<string, LegacyDocumentKey> = {
  authorization: "document_url",
  agreement_w2: "agreement_w2_url",
  agreement_i9: "agreement_i9_url",
  ssn_front: "ssn_url",
  ssn_back: "ssn_back_url",
  dl_front: "drivers_license_url",
  dl_back: "drivers_license_back_url",
};

export type AgreementSectionId = "w2" | "i9";

export function agreementLegacyKeyForSection(section: AgreementSectionId): LegacyDocumentKey {
  return section === "w2" ? "agreement_w2_url" : "agreement_i9_url";
}

export function agreementDocumentFieldForSection(section: AgreementSectionId): string {
  return section === "w2" ? "agreement_w2" : "agreement_i9";
}

export function legacyDocumentKeyFromField(
  documentField: string | null | undefined
): LegacyDocumentKey | null {
  const key = documentField?.trim().toLowerCase();
  if (!key) return null;
  return DOCUMENT_FIELD_TO_LEGACY_KEY[key] ?? null;
}

export function isDocumentReviewStatus(value: string): value is DocumentReviewStatus {
  return (DOCUMENT_REVIEW_STATUSES as readonly string[]).includes(value);
}
