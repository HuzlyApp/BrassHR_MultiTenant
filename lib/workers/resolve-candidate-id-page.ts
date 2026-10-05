import type { SupabaseClient } from "@supabase/supabase-js";
import {
  candidateListRequiresServerSearch,
  parseCandidateListQueryParams,
  type CandidateListQueryParams,
} from "@/lib/workers/candidate-list-params";
import { resolveUniqueCandidateIdPage } from "@/lib/workers/resolve-unique-candidate-id-page";

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
 * Resolve the current page of unique candidate IDs + exact filtered total.
 * `list_candidate_ids_page` collapses duplicate profiles and pages in the database.
 * Falls back to one tenant-scoped worker range ONLY when no search/filters are active.
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
    try {
      const uniquePage = await resolveUniqueCandidateIdPage(supabase, tenantId, params);
      if (uniquePage.usedRpc) {
        return uniquePage;
      }
      if (requiresSearch) {
        throw new CandidateSearchUnavailableError(
          "Candidate search is temporarily unavailable. Please try again."
        );
      }
    } catch (error) {
      if (error instanceof CandidateSearchUnavailableError) throw error;
      console.warn(
        "[candidates] unique candidate id page failed",
        error instanceof Error ? error.message : error
      );
      if (requiresSearch) {
        throw new CandidateSearchUnavailableError(
          "Candidate search is temporarily unavailable. Please try again."
        );
      }
    }
  }

  // Fallback when the paging RPC is unavailable and no search is active.
  // One range only — do not scan the tenant to dedupe in the application.
  const offset = Math.max(0, params.offset);
  const limit = Math.max(1, params.limit);
  let q = supabase.from("worker").select("id", { count: "exact" });
  if (tenantId) q = q.eq("tenant_id", tenantId);
  if (params.status) q = q.eq("status", params.status);
  q = q
    .order("created_at", { ascending: params.sortDir === "asc" })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const ids = ((data ?? []) as Array<{ id?: string }>)
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);
  return {
    ids,
    total: typeof count === "number" ? count : ids.length,
    usedRpc: false,
  };
}

export function parseWorkersRequestParams(url: URL): CandidateListQueryParams {
  return parseCandidateListQueryParams(url.searchParams);
}
