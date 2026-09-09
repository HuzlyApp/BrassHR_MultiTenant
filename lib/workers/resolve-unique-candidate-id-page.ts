import type { SupabaseClient } from "@supabase/supabase-js";
import {
  candidateListRequiresRpcSearch,
  toListCandidateIdsRpcArgs,
  type CandidateListQueryParams,
} from "@/lib/workers/candidate-list-params";
import { selectUniqueCandidateProfilesInOrder } from "@/lib/workers/candidate-identity";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";
import { loadWorkerIdsForAssigneeFilter } from "@/lib/candidates/assignee-filter";

/** Max worker rows to scan when building unique candidate-profile pages. */
export const UNIQUE_CANDIDATE_SCAN_CAP = 5000;
const RPC_FETCH_BATCH = 500;

type IdPageRow = { id?: string; total_count?: number };

async function fetchMatchingWorkerIdsViaRpc(
  supabase: SupabaseClient,
  tenantId: string,
  params: CandidateListQueryParams
): Promise<{ ids: string[]; rawTotal: number } | null> {
  const ids: string[] = [];
  let rawTotal = 0;
  let offset = 0;

  while (ids.length < UNIQUE_CANDIDATE_SCAN_CAP) {
    const batchLimit = Math.min(RPC_FETCH_BATCH, UNIQUE_CANDIDATE_SCAN_CAP - ids.length);
    const rpcArgs = toListCandidateIdsRpcArgs(
      { ...params, limit: batchLimit, offset },
      tenantId
    );
    let { data, error } = await supabase.rpc("list_candidate_ids_page", rpcArgs);
    if (error && /schema cache/i.test(error.message)) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      ({ data, error } = await supabase.rpc("list_candidate_ids_page", rpcArgs));
    }
    if (error || !Array.isArray(data)) return null;

    const page = data as IdPageRow[];
    if (page.length === 0) break;

    if (typeof page[0]?.total_count === "number") {
      rawTotal = Number(page[0].total_count);
    }

    for (const row of page) {
      const id = typeof row.id === "string" ? row.id.trim() : "";
      if (id) ids.push(id);
    }

    offset += page.length;
    if (page.length < batchLimit) break;
    if (rawTotal > 0 && ids.length >= rawTotal) break;
  }

  return { ids, rawTotal: rawTotal || ids.length };
}

async function loadIdentityRowsOrdered(
  supabase: SupabaseClient,
  tenantId: string | null,
  orderedIds: string[]
): Promise<Record<string, unknown>[]> {
  if (orderedIds.length === 0) return [];

  const { data, error } = await queryInChunks(orderedIds, async (chunk) => {
    let query = supabase
      .from("worker")
      .select("id, email, phone, first_name, last_name, created_at, status")
      .in("id", chunk);
    if (tenantId) query = query.eq("tenant_id", tenantId);
    const result = await query;
    return {
      data: (result.data ?? []) as Record<string, unknown>[],
      error: result.error,
    };
  });
  if (error) throw error;

  const byId = new Map(
    data.map((row) => [String((row as { id?: string }).id ?? "").trim(), row])
  );
  return orderedIds
    .map((id) => byId.get(id))
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

/**
 * Resolve a page of unique candidate-profile IDs (deduped by email / phone+name)
 * with a total that matches visible list rows.
 */
export async function resolveUniqueCandidateIdPage(
  supabase: SupabaseClient,
  tenantId: string | null,
  params: CandidateListQueryParams,
  options?: {
    /** Pre-fetched matching worker IDs (legacy path). */
    matchingIds?: string[];
    rawTotal?: number;
  }
): Promise<{ ids: string[]; total: number; usedRpc: boolean }> {
  let matchingIds = options?.matchingIds ?? [];
  let usedRpc = false;
  const assigneeFilter = params.assignee.trim();
  const needsRpcSearch = candidateListRequiresRpcSearch(params);
  let startedFromAssignee = false;

  if (assigneeFilter && tenantId && matchingIds.length === 0 && !needsRpcSearch) {
    matchingIds = await loadWorkerIdsForAssigneeFilter(supabase, tenantId, assigneeFilter);
    usedRpc = true;
    startedFromAssignee = true;
  } else if ((!matchingIds || matchingIds.length === 0) && tenantId) {
    const scanned = await fetchMatchingWorkerIdsViaRpc(supabase, tenantId, params);
    if (scanned) {
      matchingIds = scanned.ids;
      usedRpc = true;
    }
  }

  if (assigneeFilter && tenantId && matchingIds.length > 0 && !startedFromAssignee) {
    const allowed = new Set(await loadWorkerIdsForAssigneeFilter(supabase, tenantId, assigneeFilter));
    matchingIds = matchingIds.filter((id) => allowed.has(id));
    usedRpc = true;
  }

  if (matchingIds.length === 0) {
    return { ids: [], total: 0, usedRpc };
  }

  const orderedIdentityRows = await loadIdentityRowsOrdered(
    supabase,
    tenantId,
    matchingIds
  );
  const uniqueProfiles = selectUniqueCandidateProfilesInOrder(orderedIdentityRows);
  const uniqueIds = uniqueProfiles
    .map((row) => (typeof row.id === "string" ? row.id.trim() : ""))
    .filter(Boolean);

  const offset = Math.max(0, params.offset);
  const limit = Math.max(1, params.limit);
  const pageIds = uniqueIds.slice(offset, offset + limit);

  return {
    ids: pageIds,
    total: uniqueIds.length,
    usedRpc,
  };
}
