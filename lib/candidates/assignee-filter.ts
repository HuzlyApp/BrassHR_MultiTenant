import type { SupabaseClient } from "@supabase/supabase-js";
import { getApplicationAssigneeFallbackByWorker } from "@/lib/candidates/sync-recruiter-assignment";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";

export const UNASSIGNED_ASSIGNEE_FILTER = "unassigned";

/** Accept any RFC-4122-shaped UUID, including v6/v7 used by newer auth generators. */
const ASSIGNEE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SCAN_PAGE = 1000;
const SCAN_CAP = 5000;

export function isUnassignedAssigneeFilter(value: string): boolean {
  return value.trim().toLowerCase() === UNASSIGNED_ASSIGNEE_FILTER;
}

export function candidateMatchesAssigneeFilter(
  assignedRecruiterUserId: string | null | undefined,
  assigneeFilter: string
): boolean {
  const wanted = assigneeFilter.trim();
  if (!wanted) return true;
  const current = assignedRecruiterUserId?.trim() || "";
  if (isUnassignedAssigneeFilter(wanted)) return !current;
  return current === wanted;
}

export function buildAssigneeFilterOptions(rows: Array<{ id?: string | null; name?: string | null }>): {
  value: string;
  label: string;
}[] {
  const byId = new Map<string, string>();
  for (const row of rows) {
    const id = row.id?.trim() ?? "";
    if (!id || isUnassignedAssigneeFilter(id)) continue;
    const label = row.name?.trim() || "Unknown";
    if (!byId.has(id) || label !== "Unknown") byId.set(id, label);
  }
  return Array.from(byId.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function collectPagedIds(
  fetchPage: (from: number, to: number) => Promise<{ ids: string[]; error: { message: string } | null }>
): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; from < SCAN_CAP; from += SCAN_PAGE) {
    const { ids: page, error } = await fetchPage(from, from + SCAN_PAGE - 1);
    if (error) throw new Error(error.message);
    ids.push(...page);
    if (page.length < SCAN_PAGE) break;
  }
  return [...new Set(ids)];
}

function rowIds(data: Array<{ id?: string | null; worker_id?: string | null }> | null, key: "id" | "worker_id") {
  return (data ?? [])
    .map((row) => {
      const value = row[key];
      return typeof value === "string" ? value.trim() : "";
    })
    .filter(Boolean);
}

function asId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Keep candidate-universe IDs whose effective assignee matches the filter.
 * Effective assignee is worker.assigned_recruiter_user_id, else the latest application assignee.
 * Preserves input order.
 */
export async function filterWorkerIdsByAssignee(
  supabase: SupabaseClient,
  tenantId: string,
  workerIds: string[],
  assigneeFilter: string
): Promise<string[]> {
  const wanted = assigneeFilter.trim();
  const ids = [...new Set(workerIds.map((id) => id.trim()).filter(Boolean))];
  if (!wanted || !tenantId || ids.length === 0) return [];

  if (!isUnassignedAssigneeFilter(wanted) && !ASSIGNEE_ID_RE.test(wanted)) return [];

  const { data: rows, error } = await queryInChunks(ids, async (chunk) => {
    const result = await supabase
      .from("worker")
      .select("id, assigned_recruiter_user_id")
      .eq("tenant_id", tenantId)
      .in("id", chunk);
    return {
      data: (result.data ?? []) as Array<{ id?: string | null; assigned_recruiter_user_id?: string | null }>,
      error: result.error,
    };
  });
  if (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to load candidate assignees"
    );
  }

  const directByWorker = new Map<string, string>();
  for (const row of rows) {
    const id = asId(row.id);
    const assigneeId = asId(row.assigned_recruiter_user_id);
    if (id && assigneeId) directByWorker.set(id, assigneeId);
  }

  const missingDirect = ids.filter((id) => !directByWorker.has(id));
  const fallbackByWorker =
    missingDirect.length > 0
      ? await getApplicationAssigneeFallbackByWorker(supabase, tenantId, missingDirect)
      : new Map<string, string>();

  return ids.filter((id) => {
    const current = directByWorker.get(id) || fallbackByWorker.get(id) || "";
    return candidateMatchesAssigneeFilter(current, wanted);
  });
}

/** Worker IDs whose effective assignee matches the filter (worker column + application fallback). */
export async function loadWorkerIdsForAssigneeFilter(
  supabase: SupabaseClient,
  tenantId: string,
  assigneeFilter: string
): Promise<string[]> {
  const wanted = assigneeFilter.trim();
  if (!wanted || !tenantId) return [];

  if (isUnassignedAssigneeFilter(wanted)) {
    const unassignedWorkerIds = await collectPagedIds(async (from, to) => {
      const { data, error } = await supabase
        .from("worker")
        .select("id")
        .eq("tenant_id", tenantId)
        .is("assigned_recruiter_user_id", null)
        .order("id")
        .range(from, to);
      return { ids: rowIds(data, "id"), error };
    });

    const fallbackByWorker = await queryInChunks(unassignedWorkerIds, async (chunk) => {
      const map = await getApplicationAssigneeFallbackByWorker(supabase, tenantId, chunk);
      return { data: [...map.entries()], error: null };
    });
    if (fallbackByWorker.error) {
      throw new Error(
        fallbackByWorker.error instanceof Error
          ? fallbackByWorker.error.message
          : "Failed to resolve application assignees"
      );
    }
    const assignedViaApplication = new Set(
      fallbackByWorker.data.map(([workerId]) => workerId).filter(Boolean)
    );
    return unassignedWorkerIds.filter((id) => !assignedViaApplication.has(id));
  }

  if (!ASSIGNEE_ID_RE.test(wanted)) return [];

  const [directWorkerIds, applicationWorkerIds] = await Promise.all([
    collectPagedIds(async (from, to) => {
      const { data, error } = await supabase
        .from("worker")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("assigned_recruiter_user_id", wanted)
        .order("id")
        .range(from, to);
      return { ids: rowIds(data, "id"), error };
    }),
    collectPagedIds(async (from, to) => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("worker_id")
        .eq("tenant_id", tenantId)
        .eq("assigned_recruiter_user_id", wanted)
        .not("worker_id", "is", null)
        .order("worker_id")
        .range(from, to);
      return { ids: rowIds(data, "worker_id"), error };
    }),
  ]);

  return [...new Set([...directWorkerIds, ...applicationWorkerIds])];
}
