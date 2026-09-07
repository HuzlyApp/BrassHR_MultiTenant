import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseCandidateListQueryParams,
  toListCandidateIdsRpcArgs,
  type CandidateListQueryParams,
} from "@/lib/workers/candidate-list-params";

export type CandidateIdPageResult = {
  ids: string[];
  total: number;
  usedRpc: boolean;
};

/**
 * Resolve the current page of candidate IDs + exact filtered total.
 * Prefers `list_candidate_ids_page` (conversion-safe, filterable). Falls back to
 * a tenant-scoped worker range when the RPC is unavailable.
 */
export async function resolveCandidateIdPage(
  supabase: SupabaseClient,
  tenantId: string | null,
  params: CandidateListQueryParams
): Promise<CandidateIdPageResult> {
  if (tenantId) {
    const rpcArgs = toListCandidateIdsRpcArgs(params, tenantId);
    const { data, error } = await supabase.rpc("list_candidate_ids_page", rpcArgs);
    if (!error && Array.isArray(data)) {
      const ids = data
        .map((row: { id?: string }) => (typeof row.id === "string" ? row.id : ""))
        .filter(Boolean);
      const total =
        data.length > 0 && typeof data[0]?.total_count === "number"
          ? Number(data[0].total_count)
          : ids.length === 0
            ? 0
            : ids.length;
      return { ids, total, usedRpc: true };
    }
    if (error) {
      console.warn("[candidates] list_candidate_ids_page unavailable, falling back", error.message);
    }
  }

  // Fallback: basic range query (no server search/filters beyond status).
  let q = supabase.from("worker").select("id", { count: "exact" });
  if (tenantId) q = q.eq("tenant_id", tenantId);
  if (params.status) {
    q = q.eq("status", params.status);
  }
  q = q.order("created_at", { ascending: params.sortDir === "asc" }).range(
    params.offset,
    params.offset + params.limit - 1
  );
  const { data, error, count } = await q;
  if (error) throw error;
  const ids = ((data ?? []) as Array<{ id?: string }>)
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);
  return { ids, total: typeof count === "number" ? count : ids.length, usedRpc: false };
}

export function parseWorkersRequestParams(url: URL): CandidateListQueryParams {
  return parseCandidateListQueryParams(url.searchParams);
}
