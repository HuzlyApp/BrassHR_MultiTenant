import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatStaffNameWithRole,
  loadStaffUsersByIds,
} from "@/lib/account/resolve-staff-users";
import {
  buildAdminAttachmentRequirements,
  type AdminAttachmentRequirement,
  type LegacyDocumentUrls,
  type SubmittedDocumentRecord,
} from "@/lib/onboarding/build-admin-attachment-requirements";
import { candidateUploaderLabel } from "@/lib/onboarding/candidate-workflow-step-inspection";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import {
  applyProfessionDocumentsToAttachments,
  resolveWorkerTenantProfessionId,
  type ProfessionAttachmentFile,
} from "@/lib/onboarding/profession-attachment-requirements";
import { staffUploaderIdFromPath } from "@/lib/onboarding/staff-step-documents";
import { classifyResumeUploaderRole } from "@/lib/resume/resume-upload-limit";
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets";
import { resolveStorageAccessibleUrl } from "@/lib/supabase/resolve-storage-accessible-url";
import { listActiveProfessionDocuments } from "@/lib/professions/profession-documents";

export type LoadAdminAttachmentRequirementsArgs = {
  supabase: SupabaseClient;
  workerId: string;
  tenantId: string;
  resumeUrl: string | null;
  resumePath: string | null;
  resumePathRaw: string | null;
  legacyUrls: LegacyDocumentUrls;
  /** Display name for "Uploaded by … (Applicant)". */
  candidateName?: string | null;
  /** Auth user id for the worker, used to classify resume uploaders. */
  workerUserId?: string | null;
};

type LegacyReviewRow = {
  document_key?: string | null;
  status?: string | null;
};

export type LoadAdminAttachmentRequirementsOptions = {
  /** When set, skips re-fetching tenants.onboarding_config_version. */
  onboardingConfigVersion?: number;
  /** When set, skips re-fetching worker_legacy_document_reviews. */
  legacyReviewRows?: LegacyReviewRow[];
  /**
   * Hire-journey phase load only reads document status. Signing every file
   * blocks that response and the signed URLs are not opened from the board.
   * Defaults to true for the attachments screen.
   */
  signFileUrls?: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeUserId(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value.trim()));
}

function isResumeAttachmentRow(row: Pick<AdminAttachmentRequirement, "id" | "step_type">): boolean {
  return row.step_type === "resume_upload" || row.id === "resume";
}

async function resolveUploadedByLabels(
  supabase: SupabaseClient,
  tenantId: string,
  rows: AdminAttachmentRequirement[],
  params: {
    candidateName: string | null;
    workerUserId: string | null;
    workerId: string;
    resumeUploadedByUserId: string | null;
  }
): Promise<AdminAttachmentRequirement[]> {
  const staffIds = new Set<string>();
  if (looksLikeUserId(params.resumeUploadedByUserId)) {
    staffIds.add(params.resumeUploadedByUserId!.trim());
  }
  for (const row of rows) {
    if (looksLikeUserId(row.uploaded_by)) staffIds.add(String(row.uploaded_by).trim());
    for (const file of row.files ?? []) {
      if (looksLikeUserId(file.uploaded_by)) staffIds.add(String(file.uploaded_by).trim());
    }
  }

  const staffById = await loadStaffUsersByIds(supabase, tenantId, [...staffIds]).catch(
    () => new Map()
  );

  const labelFor = (
    userId: string | null | undefined,
    opts: {
      forResume?: boolean;
      hasFile?: boolean;
      /** Profession license/cert rows must not guess applicant when uploader is unknown. */
      professionDoc?: boolean;
    } = {}
  ): string | null => {
    const id = userId?.trim() || "";
    if (!id) {
      if (!opts.hasFile) return null;
      if (opts.professionDoc) return null;
      return candidateUploaderLabel(params.candidateName);
    }
    if (opts.forResume) {
      const role = classifyResumeUploaderRole(id, params.workerUserId, params.workerId);
      if (role === "worker") return candidateUploaderLabel(params.candidateName);
    } else if (id === params.workerUserId?.trim() || id === params.workerId) {
      return candidateUploaderLabel(params.candidateName);
    }
    const staff = staffById.get(id);
    if (staff) return formatStaffNameWithRole(staff) || staff.name;
    if (looksLikeUserId(id)) return "Team member (Staff)";
    // Already a display label from an earlier pass.
    return id;
  };

  return rows.map((row) => {
    const forResume = isResumeAttachmentRow(row);
    const professionDoc = String(row.id ?? "").startsWith("profession-doc-");
    const rawUploader = forResume
      ? params.resumeUploadedByUserId ?? row.uploaded_by
      : row.uploaded_by;
    const hasFile = Boolean(row.url) || Boolean(row.files?.some((file) => file.url));
    const uploadedBy = hasFile
      ? labelFor(rawUploader, { forResume, hasFile: true, professionDoc })
      : row.uploaded_by && !looksLikeUserId(row.uploaded_by)
        ? row.uploaded_by
        : null;
    const files = row.files?.map((file) => ({
      ...file,
      uploaded_by: file.url
        ? labelFor(file.uploaded_by ?? (forResume ? params.resumeUploadedByUserId : rawUploader), {
            forResume,
            hasFile: true,
            professionDoc,
          })
        : null,
    }));
    return {
      ...row,
      uploaded_by: uploadedBy,
      files,
    };
  });
}

export async function loadAdminAttachmentRequirements(
  args: LoadAdminAttachmentRequirementsArgs,
  options?: LoadAdminAttachmentRequirementsOptions
): Promise<AdminAttachmentRequirement[]> {
  const { supabase, workerId, tenantId } = args;
  const candidateName = args.candidateName?.trim() || null;
  const workerUserId = args.workerUserId?.trim() || null;

  let configVersion = options?.onboardingConfigVersion;
  const needsTenantVersion = configVersion == null;

  const [tenantResult, config, submittedResult, legacyReviewsResult, resumeUploaderResult] =
    await Promise.all([
      needsTenantVersion
        ? supabase
            .from("tenants")
            .select("onboarding_config_version")
            .eq("id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      loadTenantOnboardingConfig(supabase, tenantId),
      supabase
        .from("worker_submitted_documents")
        .select(
          "id, required_document_id, file_url, original_file_name, status, uploaded_at, uploaded_by_user_id, reviewed_at, reviewed_by, review_notes"
        )
        .eq("worker_id", workerId),
      options?.legacyReviewRows
        ? Promise.resolve({ data: options.legacyReviewRows })
        : supabase
            .from("worker_legacy_document_reviews")
            .select("document_key, status")
            .eq("worker_id", workerId),
      args.resumeUrl || args.resumePath
        ? supabase
            .from("worker_resumes")
            .select("uploaded_by_user_id")
            .eq("worker_id", workerId)
            .order("uploaded_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  if (configVersion == null) {
    configVersion =
      (tenantResult.data as { onboarding_config_version?: number } | null)
        ?.onboarding_config_version ?? 0;
  }
  const useLegacyFallback = configVersion < 1;

  const { data: submittedRaw, error: submittedErr } = submittedResult;
  if (submittedErr) {
    console.warn("[load-admin-attachment-requirements] worker_submitted_documents", submittedErr);
  }

  const submittedRows = (submittedRaw ?? []) as Array<{
    id?: string;
    required_document_id?: string;
    file_url?: string;
    original_file_name?: string | null;
    status?: string | null;
    uploaded_at?: string | null;
    uploaded_by_user_id?: string | null;
    reviewed_at?: string | null;
    reviewed_by?: string | null;
    review_notes?: string | null;
  }>;

  const signFileUrls = options?.signFileUrls !== false;
  const signedEntries = await Promise.all(
    submittedRows.map(async (row) => {
      const requiredDocumentId = String(row.required_document_id ?? "").trim();
      if (!requiredDocumentId) return null;

      const fileUrl = String(row.file_url ?? "").trim();
      let signedUrl: string | null = null;
      if (fileUrl) {
        // A stored path is enough to mark the file uploaded. Signing is only
        // needed when the caller opens the file.
        signedUrl = signFileUrls
          ? await resolveStorageAccessibleUrl(supabase, fileUrl, {
              defaultBucket: WORKER_REQUIRED_FILES_BUCKET,
            })
          : fileUrl;
        if (signFileUrls && !signedUrl) {
          console.warn("[load-admin-attachment-requirements] signed URL unavailable for", fileUrl);
        }
      }

      return {
        requiredDocumentId,
        record: {
          submitted_document_id: String(row.id ?? "").trim() || null,
          required_document_id: requiredDocumentId,
          signed_url: signedUrl,
          original_file_name:
            row.original_file_name != null ? String(row.original_file_name) : null,
          status: String(row.status ?? "").trim() || null,
          uploaded_at: row.uploaded_at ?? null,
          uploaded_by_user_id: row.uploaded_by_user_id
            ? String(row.uploaded_by_user_id)
            : staffUploaderIdFromPath(fileUrl),
          reviewed_at: row.reviewed_at ?? null,
          reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
          review_notes: row.review_notes ?? null,
        } satisfies SubmittedDocumentRecord,
      };
    })
  );

  const submittedByRequiredId = new Map<string, SubmittedDocumentRecord>();
  for (const entry of signedEntries) {
    if (!entry) continue;
    submittedByRequiredId.set(entry.requiredDocumentId, entry.record);
  }

  const rows = buildAdminAttachmentRequirements({
    config,
    resumeUrl: args.resumeUrl,
    resumePath: args.resumePath,
    resumePathRaw: args.resumePathRaw,
    legacyUrls: args.legacyUrls,
    submittedByRequiredId,
    useLegacyFallback,
  });

  const legacyStatusByKey = new Map<string, string>();
  for (const row of legacyReviewsResult.data ?? []) {
    const key = String((row as LegacyReviewRow).document_key ?? "").trim();
    const status = String((row as LegacyReviewRow).status ?? "").trim();
    if (key && status) legacyStatusByKey.set(key, status);
  }

  const withLegacyStatus = rows.map((row) => {
    if (row.submitted_document_id || !row.legacy_document_key) return row;
    const legacyStatus = legacyStatusByKey.get(row.legacy_document_key);
    return legacyStatus ? { ...row, status: legacyStatus } : row;
  });

  const resumeUploadedByUserId =
    (resumeUploaderResult.data as { uploaded_by_user_id?: string | null } | null)
      ?.uploaded_by_user_id ?? null;

  let attachmentRows = withLegacyStatus;

  try {
    let professionId = await resolveWorkerTenantProfessionId(supabase, tenantId, workerId);
    if (!professionId) {
      const { data: documented, error: documentedError } = await supabase
        .from("tenant_profession_documents")
        .select("profession_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      if (documentedError) throw documentedError;
      const professionIds = [
        ...new Set((documented ?? []).map((row) => String(row.profession_id ?? "")).filter(Boolean)),
      ];
      professionId = professionIds.length === 1 ? professionIds[0] : null;
    }

    const documents = professionId
      ? await listActiveProfessionDocuments(supabase, tenantId, professionId)
      : [];

    const uploadsWithUploader = await supabase
      .from("worker_profession_document_uploads")
      .select(
        "id, profession_document_id, file_url, original_file_name, status, uploaded_at, issued_date, expiry_date, uploaded_by_user_id"
      )
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .order("uploaded_at", { ascending: true });
    // Column may not exist until migration is applied; fall back without it.
    const uploadsResult =
      uploadsWithUploader.error && /uploaded_by_user_id/i.test(uploadsWithUploader.error.message)
        ? await supabase
            .from("worker_profession_document_uploads")
            .select(
              "id, profession_document_id, file_url, original_file_name, status, uploaded_at, issued_date, expiry_date"
            )
            .eq("tenant_id", tenantId)
            .eq("worker_id", workerId)
            .order("uploaded_at", { ascending: true })
        : uploadsWithUploader;
    if (uploadsResult.error) throw uploadsResult.error;
    const uploads = uploadsResult.data ?? [];

    const filesByDocumentId = new Map<string, ProfessionAttachmentFile[]>();
    await Promise.all(
      uploads.map(async (upload) => {
        const documentId = String(upload.profession_document_id ?? "");
        const fileUrl = String(upload.file_url ?? "").trim();
        if (!documentId || !fileUrl) return;
        const signedUrl = signFileUrls
          ? await resolveStorageAccessibleUrl(supabase, fileUrl, {
              defaultBucket: WORKER_REQUIRED_FILES_BUCKET,
            })
          : fileUrl;
        const rawStoredUploader = (upload as { uploaded_by_user_id?: string | null })
          .uploaded_by_user_id;
        const storedUploader =
          rawStoredUploader != null && String(rawStoredUploader).trim()
            ? String(rawStoredUploader).trim()
            : null;
        const list = filesByDocumentId.get(documentId) ?? [];
        list.push({
          id: String(upload.id ?? ""),
          signedUrl,
          originalFileName: upload.original_file_name ? String(upload.original_file_name) : null,
          status: upload.status ? String(upload.status) : null,
          issuedDate: upload.issued_date ? String(upload.issued_date) : null,
          expiryDate: upload.expiry_date ? String(upload.expiry_date) : null,
          uploadedByUserId: storedUploader || staffUploaderIdFromPath(fileUrl),
        });
        filesByDocumentId.set(documentId, list);
      })
    );

    attachmentRows = applyProfessionDocumentsToAttachments(
      withLegacyStatus,
      documents,
      filesByDocumentId,
      args.legacyUrls
    );
  } catch (error) {
    console.warn("[load-admin-attachment-requirements] profession documents", error);
    attachmentRows = withLegacyStatus;
  }

  return resolveUploadedByLabels(supabase, tenantId, attachmentRows, {
    candidateName,
    workerUserId,
    workerId,
    resumeUploadedByUserId,
  });
}
