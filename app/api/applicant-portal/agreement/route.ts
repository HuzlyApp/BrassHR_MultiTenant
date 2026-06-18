import { NextRequest, NextResponse } from "next/server";
import { buildWorkerAgreementSections } from "@/lib/admin/build-worker-agreement-sections";
import type { AdminAttachmentRequirement } from "@/lib/onboarding/build-admin-attachment-requirements";
import { documentStatusLabel } from "@/lib/applicant-portal/documents";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { resolveStorageAccessibleUrl } from "@/lib/supabase/resolve-storage-accessible-url";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const workerId = auth.applicant.id;
    const tenantId = auth.applicant.tenant_id;

    const [docsRes, reviewsRes, submittedRes, requiredRes, agreementsRes] = await Promise.all([
      auth.supabase
        .from("worker_documents")
        .select(
          "document_url, document_name, agreement_w2_url, agreement_i9_url, updated_at"
        )
        .eq("worker_id", workerId)
        .maybeSingle(),
      auth.supabase
        .from("worker_legacy_document_reviews")
        .select("document_key, status, review_notes")
        .eq("worker_id", workerId),
      auth.supabase
        .from("worker_submitted_documents")
        .select(
          "id, required_document_id, file_url, original_file_name, status, uploaded_at"
        )
        .eq("worker_id", workerId),
      auth.supabase
        .from("tenant_required_documents")
        .select("id, title, description, is_required")
        .eq("tenant_id", tenantId),
      auth.supabase
        .from("agreements")
        .select("id, request_id, status, created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (docsRes.error) throw docsRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    if (submittedRes.error) throw submittedRes.error;
    if (requiredRes.error) throw requiredRes.error;
    if (agreementsRes.error) throw agreementsRes.error;

    const docs = docsRes.data;
    const legacyDocumentReviews = Object.fromEntries(
      (reviewsRes.data ?? [])
        .map((row) => {
          const key = String(row.document_key ?? "").trim();
          const status = String(row.status ?? "").trim();
          return key && status ? [key, status] : null;
        })
        .filter((entry): entry is [string, string] => entry != null)
    );

    const legacyReviewNotes = Object.fromEntries(
      (reviewsRes.data ?? [])
        .map((row) => {
          const key = String(row.document_key ?? "").trim();
          const notes = String(row.review_notes ?? "").trim();
          return key && notes ? [key, notes] : null;
        })
        .filter((entry): entry is [string, string] => entry != null)
    );

    const authContext = auth;
    const supabase = authContext.supabase;

    async function resolveUrl(stored: unknown): Promise<string | null> {
      if (typeof stored !== "string" || !stored.trim()) return null;
      return resolveStorageAccessibleUrl(supabase, stored.trim());
    }

    const [agreementW2Url, agreementI9Url, authUrl] = await Promise.all([
      resolveUrl(docs?.agreement_w2_url),
      resolveUrl(docs?.agreement_i9_url),
      resolveUrl(docs?.document_url),
    ]);

    const requiredById = new Map(
      (requiredRes.data ?? []).map((row) => [String(row.id), row])
    );

    const attachmentRequirements: AdminAttachmentRequirement[] = await Promise.all(
      (submittedRes.data ?? []).map(async (row, index) => {
        const required = requiredById.get(String(row.required_document_id));
        const fileUrl = row.file_url ? await resolveUrl(row.file_url) : null;
        return {
          id: `submitted-${row.id}`,
          title: String(required?.title ?? "Required document"),
          step_key: "agreement",
          step_type: "document_upload" as const,
          required_document_id: String(row.required_document_id),
          submitted_document_id: String(row.id),
          legacy_document_key: null,
          status: row.status as string | null,
          url: fileUrl,
          filename: row.original_file_name ? String(row.original_file_name) : "—",
          sort_order: index,
        };
      })
    );
    for (const req of requiredRes.data ?? []) {
      const title = String(req.title ?? "").toLowerCase();
      const isAgreementDoc =
        title.includes("w2") ||
        title.includes("i9") ||
        title.includes("i-9") ||
        title.includes("employee agreement");
      if (!isAgreementDoc) continue;
      const already = attachmentRequirements.some(
        (row) => row.required_document_id === String(req.id)
      );
      if (already) continue;
      attachmentRequirements.push({
        id: `required-${req.id}`,
        title: String(req.title ?? "Required document"),
        step_key: "agreement",
        step_type: "document_upload" as const,
        required_document_id: String(req.id),
        submitted_document_id: null,
        legacy_document_key: null,
        status: null,
        url: null,
        filename: "—",
        sort_order: attachmentRequirements.length,
      });
    }

    const profile = {
      attachment_requirements: attachmentRequirements,
      legacy_document_reviews: legacyDocumentReviews,
      document_urls: {
        authorization_document_url: authUrl,
        agreement_w2_url: agreementW2Url ?? authUrl,
        agreement_i9_url: agreementI9Url,
      },
      signeasy: {
        document_name: docs?.document_name ? String(docs.document_name) : null,
      },
      zoho_sign: {},
    };

    const agreements = (agreementsRes.data ?? []).map((row) => ({
      id: String(row.id),
      request_id: String(row.request_id ?? ""),
      status: String(row.status ?? ""),
      created_at: row.created_at ? String(row.created_at) : null,
      updated_at: null,
    }));

    const sections = buildWorkerAgreementSections(profile, agreements).map((section) => {
      const legacyKey =
        section.id === "w2" ? "agreement_w2_url" : "agreement_i9_url";
      const reviewNotes = legacyReviewNotes[legacyKey] ?? null;
      const uploadRequested =
        section.reviewStatus === "needs_revision" || section.reviewStatus === "rejected";

      return {
        id: section.id,
        title: section.title,
        kind: section.kind,
        hasFile: section.hasFile,
        fileName: section.fileName,
        fileUrl: section.fileUrl,
        headerText: section.headerText,
        statusBadge: section.statusBadge,
        reviewStatus: section.reviewStatus,
        reviewNotes,
        uploadRequested,
        requiredDocumentId: section.requiredDocumentId,
        submittedDocumentId: section.submittedDocumentId,
        statusLabel: section.reviewStatus
          ? documentStatusLabel(section.reviewStatus)
          : section.hasFile
            ? "Pending review"
            : null,
      };    });

    return NextResponse.json({ sections });
  } catch (err) {
    console.error("[applicant-portal/agreement:get]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load agreement" },
      { status: 500 }
    );
  }
}
