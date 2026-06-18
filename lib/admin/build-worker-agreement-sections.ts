import type { AdminAttachmentRequirement } from "@/lib/onboarding/build-admin-attachment-requirements";

export type AgreementRecord = {
  id: string;
  request_id: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

export type WorkerAgreementProfileInput = {
  attachment_requirements?: AdminAttachmentRequirement[];
  legacy_document_reviews?: Record<string, string>;
  document_urls?: {
    authorization_document_url?: string | null;
    agreement_w2_url?: string | null;
    agreement_i9_url?: string | null;
  };
  signeasy?: {
    document_name?: string | null;
  };
  zoho_sign?: {
    request_id?: string | null;
    document_id?: string | null;
    status?: string | null;
    updated_at?: string | null;
  };
};

export type AgreementSectionKind = "esign" | "upload";

export type WorkerAgreementSection = {
  id: "w2" | "i9";
  title: string;
  kind: AgreementSectionKind;
  headerText: string;
  uploadedAtLabel: string | null;
  hasFile: boolean;
  isSigned: boolean;
  fileName: string;
  fileUrl: string | null;
  fileSizeLabel: string | null;
  statusBadge: string | null;
  statusBadgeTone?: "signed" | "not_uploaded" | null;
  reviewStatus: string | null;
  submittedDocumentId: string | null;
  requiredDocumentId: string | null;
  legacyDocumentKey: string | null;
  documentField: string | null;
  agreementRecord: AgreementRecord | null;
  zohoRequestId: string | null;
  zohoDocumentId: string | null;
};

function titleMatchesW2(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return false;
  if (t.includes("i9") || t.includes("i-9")) return false;
  return t.includes("w2") || t.includes("employee agreement") || t.includes("employment agreement");
}

function titleMatchesI9(title: string): boolean {
  const t = title.trim().toLowerCase();
  return t.includes("i9") || t.includes("i-9");
}

function fileLabelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : "Document";
  } catch {
    return "Document";
  }
}

function formatAgreementDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function normalizeAgreementStatus(status: string | null | undefined): "signed" | "pending" {
  const value = (status ?? "").trim().toLowerCase();
  if (value === "signed" || value === "completed") return "signed";
  return "pending";
}

function isZohoCompleted(status: string | null | undefined): boolean {
  const value = (status ?? "").trim().toLowerCase();
  return value === "completed" || value === "signed";
}

function pickRequirement(
  requirements: AdminAttachmentRequirement[],
  matcher: (title: string) => boolean
): AdminAttachmentRequirement | null {
  return requirements.find((row) => matcher(row.title)) ?? null;
}

function agreementRecordDate(
  requirement: AdminAttachmentRequirement | null,
  agreements: AgreementRecord[]
): string | null {
  if (requirement?.submitted_document_id) {
    return agreements[0]?.updated_at ?? agreements[0]?.created_at ?? null;
  }
  return agreements[0]?.updated_at ?? agreements[0]?.created_at ?? null;
}

function buildW2Section(
  profile: WorkerAgreementProfileInput,
  agreements: AgreementRecord[]
): WorkerAgreementSection {
  const requirements = profile.attachment_requirements ?? [];
  const requirement = pickRequirement(requirements, titleMatchesW2);
  const zoho = profile.zoho_sign ?? {};
  const zohoRequestId = zoho.request_id?.trim() || null;
  const agreementRecord =
    agreements.find((row) => row.request_id === zohoRequestId) ??
    agreements.find((row) => normalizeAgreementStatus(row.status) === "signed") ??
    agreements[0] ??
    null;

  const legacyW2Url =
    profile.document_urls?.agreement_w2_url?.trim() ||
    profile.document_urls?.authorization_document_url?.trim() ||
    null;
  const requirementUrl = requirement?.url?.trim() || null;
  const zohoUrl = zohoRequestId
    ? `/api/zoho-sign/document?request_id=${encodeURIComponent(zohoRequestId)}&mode=preview`
    : null;

  const isSigned =
    isZohoCompleted(zoho.status) ||
    normalizeAgreementStatus(agreementRecord?.status) === "signed" ||
    requirement?.status === "approved";

  const hasFile = Boolean(zohoRequestId || requirementUrl || legacyW2Url || profile.signeasy?.document_name);
  const fileUrl = requirementUrl || zohoUrl || legacyW2Url;
  const fileName = hasFile
    ? requirement?.filename?.trim() && requirement.filename !== "—"
      ? requirement.filename
      : profile.signeasy?.document_name?.trim() ||
        (legacyW2Url ? fileLabelFromUrl(legacyW2Url) : null) ||
        "Employee Agreement W2.pdf"
    : "";

  const reviewStatus =
    requirement?.status ??
    (requirement?.legacy_document_key
      ? profile.legacy_document_reviews?.[requirement.legacy_document_key] ?? null
      : null) ??
    profile.legacy_document_reviews?.agreement_w2_url ??
    profile.legacy_document_reviews?.document_url ??
    null;

  return {
    id: "w2",
    title: requirement?.title?.trim() || "Employee Agreement W2",
    kind: "esign",
    headerText: isSigned
      ? "Signed 1 of 1"
      : hasFile
        ? "Pending 0 of 1"
        : "Not uploaded 0 of 1",
    uploadedAtLabel: null,
    hasFile,
    isSigned,
    fileName,
    fileUrl,
    fileSizeLabel: null,
    statusBadge: isSigned
      ? "Signed"
      : !hasFile && reviewStatus === "needs_revision"
        ? "Request Sent"
        : null,
    statusBadgeTone: isSigned
      ? "signed"
      : !hasFile && reviewStatus === "needs_revision"
        ? "signed"
        : null,
    reviewStatus,
    submittedDocumentId: requirement?.submitted_document_id ?? null,
    requiredDocumentId: requirement?.required_document_id ?? null,
    legacyDocumentKey: requirement?.legacy_document_key ?? "agreement_w2_url",
    documentField: "agreement_w2",
    agreementRecord,
    zohoRequestId,
    zohoDocumentId: zoho.document_id?.trim() || null,
  };
}

function buildI9Section(
  profile: WorkerAgreementProfileInput,
  agreements: AgreementRecord[]
): WorkerAgreementSection {
  const requirements = profile.attachment_requirements ?? [];
  const requirement = pickRequirement(requirements, titleMatchesI9);
  const requirementUrl = requirement?.url?.trim() || null;
  const legacyI9Url = profile.document_urls?.agreement_i9_url?.trim() || null;
  const resolvedUrl = requirementUrl || legacyI9Url;
  const hasFile = Boolean(resolvedUrl);
  const uploadedAt = formatAgreementDate(agreementRecordDate(requirement, agreements));

  const reviewStatus =
    requirement?.status ??
    profile.legacy_document_reviews?.agreement_i9_url ??
    null;

  return {
    id: "i9",
    title: requirement?.title?.trim() || "I9 Form",
    kind: "upload",
    headerText: hasFile ? "Uploaded 1 of 1" : "Uploaded 0 of 1",
    uploadedAtLabel: uploadedAt ? `Uploaded: ${uploadedAt}` : null,
    hasFile,
    isSigned: false,
    fileName: hasFile
      ? requirement?.filename?.trim() && requirement.filename !== "—"
        ? requirement.filename
        : legacyI9Url
          ? fileLabelFromUrl(legacyI9Url)
          : "I9 Form.pdf"
      : "",
    fileUrl: resolvedUrl,
    fileSizeLabel: null,
    statusBadge: hasFile
      ? null
      : reviewStatus === "needs_revision"
        ? "Request Sent"
        : "Not Uploaded",
    statusBadgeTone: hasFile
      ? null
      : reviewStatus === "needs_revision"
        ? "signed"
        : "not_uploaded",
    reviewStatus,
    submittedDocumentId: requirement?.submitted_document_id ?? null,
    requiredDocumentId: requirement?.required_document_id ?? null,
    legacyDocumentKey: requirement?.legacy_document_key ?? "agreement_i9_url",
    documentField: "agreement_i9",
    agreementRecord: null,
    zohoRequestId: null,
    zohoDocumentId: null,
  };
}

export function buildWorkerAgreementSections(
  profile: WorkerAgreementProfileInput,
  agreements: AgreementRecord[]
): WorkerAgreementSection[] {
  return [buildW2Section(profile, agreements), buildI9Section(profile, agreements)];
}
