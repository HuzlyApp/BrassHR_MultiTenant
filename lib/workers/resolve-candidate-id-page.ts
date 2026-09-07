import type { SupabaseClient } from "@supabase/supabase-js";
import {
  candidateListRequiresServerSearch,
  parseCandidateListQueryParams,
  toListCandidateIdsRpcArgs,
  type CandidateListQueryParams,
} from "@/lib/workers/candidate-list-params";

export type CandidateIdPageResult = {
  ids: string[];
  total: number;
  usedRpc: boolean;
};

export class CandidateSearchUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateSearchUnavailableError";
  }
}

/**
 * Resolve the current page of candidate IDs + exact filtered total.
 * Prefers `list_candidate_ids_page` (conversion-safe, filterable).
 * Falls back to a tenant-scoped worker range ONLY when no search/filters are active.
 * Never returns an unfiltered page while the client thinks a search is applied.
 */
export async function resolveCandidateIdPage(
  supabase: SupabaseClient,
  tenantId: string | null,
  params: CandidateListQueryParams
): Promise<CandidateIdPageResult> {
  const requiresSearch = candidateListRequiresServerSearch(params);

  if (!tenantId) {
    if (requiresSearch) {
      throw new CandidateSearchUnavailableError(
        "Candidate search requires a tenant workspace. Select a workspace and try again."
      );
    }
  } else {
    const rpcArgs = toListCandidateIdsRpcArgs(params, tenantId);
    const callRpc = async () => supabase.rpc("list_candidate_ids_page", rpcArgs);

    let { data, error } = await callRpc();
    // PostgREST schema cache can lag CREATE OR REPLACE; one short retry usually clears it.
    if (error && /schema cache/i.test(error.message)) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      ({ data, error } = await callRpc());
    }
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
      console.warn("[candidates] list_candidate_ids_page unavailable", error.message);
      if (requiresSearch) {
        const schemaCacheMiss = /schema cache/i.test(error.message);
        throw new CandidateSearchUnavailableError(
          schemaCacheMiss
            ? "Candidate search is reloading. Please wait a moment and try again."
            : "Candidate search is temporarily unavailable. Please try again."
        );
      }
    } else if (requiresSearch) {
      throw new CandidateSearchUnavailableError(
        "Candidate search returned an unexpected response. Please try again."
      );
    }
  }

  // Fallback: basic range query (no server search/filters beyond status).
  // Only reached when search/filters are inactive.
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
