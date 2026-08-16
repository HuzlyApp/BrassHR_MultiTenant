import type { SupabaseClient } from "@supabase/supabase-js";
import { applicantDisplayName } from "@/lib/interviews/format";

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
};

/**
 * Links a worker+application to public.applicants (upsert by tenant + application_id).
 * applicationId is required for multi-job recruiting isolation.
 */
export async function ensureApplicantForWorker(
  supabase: SupabaseClient,
  tenantId: string,
  worker: WorkerRow,
  applicationId?: string | null
): Promise<string> {
  const appId = applicationId?.trim() || null;

  if (appId) {
    const { data: existingByApp, error: findByAppError } = await supabase
      .from("applicants")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("application_id", appId)
      .maybeSingle();
    if (findByAppError) throw findByAppError;
    if (existingByApp?.id) return existingByApp.id;
  } else {
    // Legacy fallback: only when a single applicant row exists for the worker
    const { data: existing, error: findError } = await supabase
      .from("applicants")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("worker_id", worker.id)
      .is("application_id", null)
      .maybeSingle();
    if (findError) throw findError;
    if (existing?.id) return existing.id;
  }

  const fullName = applicantDisplayName(worker.first_name, worker.last_name);
  const status = (worker.status ?? "pending").trim().toLowerCase() || "pending";

  const { data: inserted, error: insertError } = await supabase
    .from("applicants")
    .insert({
      tenant_id: tenantId,
      worker_id: worker.id,
      application_id: appId,
      full_name: fullName,
      email: worker.email?.trim() || null,
      status,
    })
    .select("id")
    .single();

  if (insertError) {
    // Concurrent create for same application
    if (appId && (insertError.code === "23505" || /duplicate key/i.test(insertError.message))) {
      const { data: raced } = await supabase
        .from("applicants")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("application_id", appId)
        .maybeSingle();
      if (raced?.id) return raced.id;
    }
    throw insertError;
  }
  return inserted.id;
}
