import type { SupabaseClient } from "@supabase/supabase-js";
import { getApplicationAssigneeFallbackByWorker } from "@/lib/candidates/sync-recruiter-assignment";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";

export const UNASSIGNED_ASSIGNEE_FILTER = "unassigned";

const ASSIGNEE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
