import type { SupabaseClient } from "@supabase/supabase-js";
import {
  toListCandidateIdsRpcArgs,
  type CandidateListQueryParams,
} from "@/lib/workers/candidate-list-params";

type IdPageRow = { id?: string; total_count?: number };

/**
 * One database round trip. `list_candidate_ids_page` already collapses duplicate
 * profiles and applies limit/offset, so the caller must not scan the tenant
 * and dedupe in the application.
 */
export async function resolveUniqueCandidateIdPage(
  supabase: SupabaseClient,
  tenantId: string | null,
  params: CandidateListQueryParams
): Promise<{ ids: string[]; total: number; usedRpc: boolean }> {
  if (!tenantId) {
    return { ids: [], total: 0, usedRpc: false };
  }

  const rpcArgs = toListCandidateIdsRpcArgs(params, tenantId);
  let { data, error } = await supabase.rpc("list_candidate_ids_page", rpcArgs);
  if (error && /schema cache/i.test(error.message)) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    ({ data, error } = await supabase.rpc("list_candidate_ids_page", rpcArgs));
  }
  if (error || !Array.isArray(data)) {
    return { ids: [], total: 0, usedRpc: false };
  }

  const page = data as IdPageRow[];
  const ids = page
    .map((row) => (typeof row.id === "string" ? row.id.trim() : ""))
    .filter(Boolean);
  const rawTotal = typeof page[0]?.total_count === "number" ? Number(page[0].total_count) : ids.length;

  return {
    ids,
    total: rawTotal,
    usedRpc: true,
  };
}
