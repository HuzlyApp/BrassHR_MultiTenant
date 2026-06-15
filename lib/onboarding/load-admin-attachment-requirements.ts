import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAdminAttachmentRequirements,
  type AdminAttachmentRequirement,
  type LegacyDocumentUrls,
  type SubmittedDocumentRecord,
} from "@/lib/onboarding/build-admin-attachment-requirements";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets";
import { resolveStorageAccessibleUrl } from "@/lib/supabase/resolve-storage-accessible-url";

export type LoadAdminAttachmentRequirementsArgs = {
  supabase: SupabaseClient;
  workerId: string;
  tenantId: string;
  resumeUrl: string | null;
  resumePath: string | null;
  resumePathRaw: string | null;
  legacyUrls: LegacyDocumentUrls;
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
};

export async function loadAdminAttachmentRequirements(
  args: LoadAdminAttachmentRequirementsArgs,
  options?: LoadAdminAttachmentRequirementsOptions
): Promise<AdminAttachmentRequirement[]> {
  const { supabase, workerId, tenantId } = args;

  let configVersion = options?.onboardingConfigVersion;
  const needsTenantVersion = configVersion == null;

  const [tenantResult, config, submittedResult, legacyReviewsResult] = await Promise.all([
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
      .select("id, required_document_id, file_url, original_file_name, status")
      .eq("worker_id", workerId),
    options?.legacyReviewRows
      ? Promise.resolve({ data: options.legacyReviewRows })
      : supabase
          .from("worker_legacy_document_reviews")
          .select("document_key, status")
          .eq("worker_id", workerId),
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
  }>;

  const signedEntries = await Promise.all(
    submittedRows.map(async (row) => {
      const requiredDocumentId = String(row.required_document_id ?? "").trim();
      if (!requiredDocumentId) return null;

      const fileUrl = String(row.file_url ?? "").trim();
      let signedUrl: string | null = null;
      if (fileUrl) {
        signedUrl = await resolveStorageAccessibleUrl(supabase, fileUrl, {
          defaultBucket: WORKER_REQUIRED_FILES_BUCKET,
        });
        if (!signedUrl) {
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

  return rows.map((row) => {
    if (row.submitted_document_id || !row.legacy_document_key) return row;
    const legacyStatus = legacyStatusByKey.get(row.legacy_document_key);
    return legacyStatus ? { ...row, status: legacyStatus } : row;
  });
}
