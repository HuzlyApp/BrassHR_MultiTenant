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
 * Resolve the current page of candidate IDs + exact filtered total.
 * Prefers `list_candidate_ids_page`, then collapses to unique candidate profiles
 * (same email, or same phone + name) before applying limit/offset.
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

  // Fallback: basic range query (no server search/filters beyond status),
  // then collapse to unique candidate profiles before paging.
  const pageSize = 1000;
  const matchingIds: string[] = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from("worker").select("id");
    if (tenantId) q = q.eq("tenant_id", tenantId);
    if (params.status) {
      q = q.eq("status", params.status);
    }
    q = q
      .order("created_at", { ascending: params.sortDir === "asc" })
      .range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    const page = ((data ?? []) as Array<{ id?: string }>)
      .map((row) => (typeof row.id === "string" ? row.id : ""))
      .filter(Boolean);
    matchingIds.push(...page);
    if (page.length < pageSize) break;
    if (matchingIds.length >= 5000) break;
  }

  return resolveUniqueCandidateIdPage(supabase, tenantId, params, {
    matchingIds,
  });
}

export function parseWorkersRequestParams(url: URL): CandidateListQueryParams {
  return parseCandidateListQueryParams(url.searchParams);
}
