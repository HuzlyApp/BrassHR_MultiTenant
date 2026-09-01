import type { SupabaseClient } from "@supabase/supabase-js";
import {
  collectApplicationListSearchFields,
  type ApplicationListSearchRow,
} from "@/lib/admin/candidate-list-search";
import { JOB_APPLICATION_APPLICANT_EMBED } from "@/lib/jobs/application-applicant-display";
import type { ApplicationStatusTabOption } from "@/lib/jobs/application-status-tab";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";

type ApplicationSearchRow = ApplicationListSearchRow & {
  worker_id: string | null;
  status: string;
  status_id?: string | null;
  application_statuses?:
    | { id?: string; system_key?: string | null }
    | { id?: string; system_key?: string | null }[]
    | null;
};

const APPLICATION_SEARCH_SELECT = `id, worker_id, status, status_id, job_requisition_id, application_statuses(id, system_key), job_requisitions(public_title, source_job_title, location, facility, facility_name, internal_requisition_number), ${JOB_APPLICATION_APPLICANT_EMBED}`;

/** Same inclusion rules as the applications screen “All” tab. */
export function isApplicationIncludedInAllTabSearch(
  _row: ApplicationSearchRow,
  _statusOptions: ApplicationStatusTabOption[]
): boolean {
  return true;
}

export function mergeApplicationSearchFields(existing: string[], fields: string[]): string[] {
  const merged = [...existing];
  for (const field of fields) {
    const trimmed = field.trim();
    if (!trimmed) continue;
    if (!merged.includes(trimmed)) merged.push(trimmed);
  }
  return merged;
}

export function buildApplicationSearchText(fields: string[]): string {
  return fields.join(" | ");
}

export function indexApplicationSearchRows(
  rows: ApplicationSearchRow[],
  statusOptions: ApplicationStatusTabOption[]
): Map<string, string> {
  const fieldLists = new Map<string, string[]>();

  for (const row of rows) {
    const workerId = row.worker_id?.trim();
    if (!workerId || !isApplicationIncludedInAllTabSearch(row, statusOptions)) continue;

    const fields = collectApplicationListSearchFields(row);
    fieldLists.set(workerId, mergeApplicationSearchFields(fieldLists.get(workerId) ?? [], fields));
  }

  const result = new Map<string, string>();
  for (const [workerId, fields] of fieldLists) {
    const text = buildApplicationSearchText(fields);
    if (text) result.set(workerId, text);
  }
  return result;
}

async function loadApplicationStatusOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ApplicationStatusTabOption[]> {
  const { data, error } = await supabase
    .from("application_statuses")
    .select("id, system_key")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    systemKey: typeof row.system_key === "string" ? row.system_key : null,
  }));
}

/**
 * Builds per-worker searchable text from applications visible on the applications “All” tab.
 * Includes withdrawn/rejected applications; excludes archived (matches new screen search scope).
 */
export async function getApplicationSearchTextByWorker(
  supabase: SupabaseClient,
  args: { tenantId?: string | null; workerIds: string[] }
): Promise<Map<string, string>> {
  const workerIds = Array.from(new Set(args.workerIds.filter(Boolean)));
  if (workerIds.length === 0 || !args.tenantId) return new Map();

  const statusOptions = await loadApplicationStatusOptions(supabase, args.tenantId);

  const { data, error } = await queryInChunks(workerIds, async (chunk) => {
    const result = await supabase
      .from("job_applications")
      .select(APPLICATION_SEARCH_SELECT)
      .in("worker_id", chunk)
      .eq("tenant_id", args.tenantId!);

    return { data: (result.data ?? []) as ApplicationSearchRow[], error: result.error };
  });
  if (error) throw error;

  return indexApplicationSearchRows(data, statusOptions);
}
