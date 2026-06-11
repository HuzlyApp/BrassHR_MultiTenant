import type { SupabaseClient } from "@supabase/supabase-js";
import { applicantDisplayName } from "@/lib/interviews/format";

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
};

/** Links a worker to public.applicants (upsert by tenant + worker_id). */
export async function ensureApplicantForWorker(
  supabase: SupabaseClient,
  tenantId: string,
  worker: WorkerRow
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from("applicants")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("worker_id", worker.id)
    .maybeSingle();

  if (findError) throw findError;
  if (existing?.id) return existing.id;

  const fullName = applicantDisplayName(worker.first_name, worker.last_name);
  const status = (worker.status ?? "pending").trim().toLowerCase() || "pending";

  const { data: inserted, error: insertError } = await supabase
    .from("applicants")
    .insert({
      tenant_id: tenantId,
      worker_id: worker.id,
      full_name: fullName,
      email: worker.email?.trim() || null,
      status,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted.id;
}
