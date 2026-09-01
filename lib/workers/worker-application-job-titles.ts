import type { SupabaseClient } from "@supabase/supabase-js";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";

type AppTitleRow = {
  worker_id: string | null;
  job_requisitions:
    | { public_title: string | null }
    | { public_title: string | null }[]
    | null;
};

function oneJobTitle(
  value: AppTitleRow["job_requisitions"]
): string {
  if (!value) return "";
  const job = Array.isArray(value) ? value[0] : value;
  return String(job?.public_title ?? "").trim();
}

/** All applied job titles per worker (used for candidate search parity with applications list). */
export async function getApplicationJobTitlesByWorker(
  supabase: SupabaseClient,
  args: { tenantId?: string | null; workerIds: string[] }
): Promise<Map<string, string[]>> {
  const workerIds = Array.from(new Set(args.workerIds.filter(Boolean)));
  const result = new Map<string, string[]>();
  if (workerIds.length === 0) return result;

  const { data, error } = await queryInChunks(workerIds, async (chunk) => {
    let query = supabase
      .from("job_applications")
      .select("worker_id, job_requisitions(public_title)")
      .in("worker_id", chunk)
      .not("status", "in", '("rejected","withdrawn")');

    if (args.tenantId) {
      query = query.eq("tenant_id", args.tenantId);
    }

    const result = await query;
    return { data: (result.data ?? []) as AppTitleRow[], error: result.error };
  });
  if (error) throw error;

  for (const row of data) {
    const workerId = row.worker_id?.trim();
    const title = oneJobTitle(row.job_requisitions);
    if (!workerId || !title) continue;
    const list = result.get(workerId) ?? [];
    if (!list.includes(title)) list.push(title);
    result.set(workerId, list);
  }

  return result;
}

export function joinApplicationJobTitles(titles: string[] | undefined): string {
  return (titles ?? []).join(" | ");
}
