import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAdminAttachmentRequirements,
  type AdminAttachmentRequirement,
  type LegacyDocumentUrls,
  type SubmittedDocumentRecord,
} from "@/lib/onboarding/build-admin-attachment-requirements";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets";

export type LoadAdminAttachmentRequirementsArgs = {
  supabase: SupabaseClient;
  workerId: string;
  tenantId: string;
  resumeUrl: string | null;
  resumePath: string | null;
  resumePathRaw: string | null;
  legacyUrls: LegacyDocumentUrls;
};

export type LoadAdminAttachmentRequirementsOptions = {
  /** When set, skips re-fetching tenants.onboarding_config_version. */
  onboardingConfigVersion?: number;
};

export async function loadAdminAttachmentRequirements(
  args: LoadAdminAttachmentRequirementsArgs,
  options?: LoadAdminAttachmentRequirementsOptions
): Promise<AdminAttachmentRequirement[]> {
  const { supabase, workerId, tenantId } = args;

  let configVersion = options?.onboardingConfigVersion;
  if (configVersion == null) {
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("onboarding_config_version")
      .eq("id", tenantId)
      .maybeSingle();
    configVersion =
      (tenantRow as { onboarding_config_version?: number } | null)?.onboarding_config_version ?? 0;
  }
  const useLegacyFallback = configVersion < 1;

  const config = await loadTenantOnboardingConfig(supabase, tenantId);

  const { data: submittedRaw, error: submittedErr } = await supabase
    .from("worker_submitted_documents")
    .select("id, required_document_id, file_url, original_file_name, status")
    .eq("worker_id", workerId);

  if (submittedErr) {
    console.warn("[load-admin-attachment-requirements] worker_submitted_documents", submittedErr);
  }

  const submittedByRequiredId = new Map<string, SubmittedDocumentRecord>();
  for (const row of submittedRaw ?? []) {
    const requiredDocumentId = String(
      (row as { required_document_id?: string }).required_document_id ?? ""
    ).trim();
    if (!requiredDocumentId) continue;

    const fileUrl = String((row as { file_url?: string }).file_url ?? "").trim();
    let signedUrl: string | null = null;
    if (fileUrl) {
      const { data: signed, error: signErr } = await supabase.storage
        .from(WORKER_REQUIRED_FILES_BUCKET)
        .createSignedUrl(fileUrl, 3600);
      if (signErr) {
        console.warn("[load-admin-attachment-requirements] signed URL", signErr.message);
      } else {
        signedUrl = signed?.signedUrl ?? null;
      }
    }

    submittedByRequiredId.set(requiredDocumentId, {
      submitted_document_id: String((row as { id?: string }).id ?? "").trim() || null,
      required_document_id: requiredDocumentId,
      signed_url: signedUrl,
      original_file_name:
        (row as { original_file_name?: string | null }).original_file_name != null
          ? String((row as { original_file_name?: string | null }).original_file_name)
          : null,
      status: String((row as { status?: string | null }).status ?? "").trim() || null,
    });
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

  const { data: legacyReviewsRaw } = await supabase
    .from("worker_legacy_document_reviews")
    .select("document_key, status")
    .eq("worker_id", workerId);

  const legacyStatusByKey = new Map<string, string>();
  for (const row of legacyReviewsRaw ?? []) {
    const key = String((row as { document_key?: string }).document_key ?? "").trim();
    const status = String((row as { status?: string }).status ?? "").trim();
    if (key && status) legacyStatusByKey.set(key, status);
  }

  return rows.map((row) => {
    if (row.submitted_document_id || !row.legacy_document_key) return row;
    const legacyStatus = legacyStatusByKey.get(row.legacy_document_key);
    return legacyStatus ? { ...row, status: legacyStatus } : row;
  });
}
