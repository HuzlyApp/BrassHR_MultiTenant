import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrSetCache } from "@/lib/cache";
import { selectUniqueCandidateProfilesInOrder } from "@/lib/workers/candidate-identity";
import {
  CANDIDATE_KPI_CACHE_TTL_SECONDS,
  candidateKpiCacheKey,
} from "@/lib/workers/candidate-kpi-cache";
import { ACTIVE_CANDIDATE_PIPELINE_STATUSES } from "@/lib/workers/candidate-status-label";
import { loadPagedRows } from "@/lib/workers/load-paged-rows";

type WorkerIdentityRow = {
  id?: string;
  status?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: string | null;
};

const PAGE_SIZE = 1000;

function isPipelineBaseStatus(status: string): boolean {
  if (!status) return true;
  return (ACTIVE_CANDIDATE_PIPELINE_STATUSES as readonly string[]).includes(status);
}

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  return /could not find the function|schema cache|does not exist/i.test(error.message ?? "");
}

function readRpcCount(data: unknown): number | null {
  const value = Array.isArray(data) ? data[0] : data;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

async function countViaRpc(supabase: SupabaseClient, tenantId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("count_unique_active_candidate_profiles", {
    p_tenant_id: tenantId,
  });
  if (error) {
    if (isMissingRpc(error)) return null;
    throw error;
  }
  return readRpcCount(data);
}

async function loadWorkerPages(
  supabase: SupabaseClient,
  tenantId: string
): Promise<WorkerIdentityRow[]> {
  return loadPagedRows(
    async (from, to) => {
      const { data, error } = await supabase
        .from("worker")
        .select("id, status, email, phone, first_name, last_name, created_at")
        .eq("tenant_id", tenantId)
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as WorkerIdentityRow[];
    },
    { pageSize: PAGE_SIZE }
  );
}

async function loadConvertedIds(supabase: SupabaseClient, tenantId: string): Promise<Set<string>> {
  try {
    const rows = await loadPagedRows(
      async (from, to) => {
        const { data, error } = await supabase
          .from("workers")
          .select("candidate_id")
          .eq("tenant_id", tenantId)
          .not("candidate_id", "is", null)
          .order("candidate_id", { ascending: true })
          .range(from, to);
        if (error) {
          if (String(error.message ?? "").includes("does not exist")) {
            const missing = new Error(error.message) as Error & { missingRelation?: boolean };
            missing.missingRelation = true;
            throw missing;
          }
          throw error;
        }
        return (data ?? []) as Array<{ candidate_id?: string | null }>;
      },
      { pageSize: PAGE_SIZE }
    );
    const ids = new Set<string>();
    for (const row of rows) {
      const id = String(row.candidate_id ?? "").trim();
      if (id) ids.add(id);
    }
    return ids;
  } catch (error) {
    if (error && typeof error === "object" && "missingRelation" in error) return new Set();
    throw error;
  }
}

async function countFromPages(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const [workerRows, convertedIds] = await Promise.all([
    loadWorkerPages(supabase, tenantId),
    loadConvertedIds(supabase, tenantId),
  ]);

  const baseRows = workerRows.filter((row) => {
    const id = String(row.id ?? "").trim();
    const status = String(row.status ?? "").trim().toLowerCase();
    if (!id || convertedIds.has(id) || status === "converted") return false;
    if (!isPipelineBaseStatus(status)) return false;
    return status !== "disapproved" && status !== "rejected";
  });

  return selectUniqueCandidateProfilesInOrder(baseRows.map((row) => ({ ...row }))).length;
}

async function countUncached(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const rpcCount = await countViaRpc(supabase, tenantId);
  if (rpcCount != null) return rpcCount;
  return countFromPages(supabase, tenantId);
}

/**
 * Unique active candidate profiles for the Jobs dashboard KPI.
 * One SQL function when the migration is applied; otherwise paged reads in parallel.
 * Repeated loads reuse the candidate KPI cache (120s, tenant-scoped, same invalidation).
 */
export async function countUniqueActiveCandidateProfiles(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const key = candidateKpiCacheKey(tenantId, "unique-active-profiles");
  return getOrSetCache(key, () => countUncached(supabase, tenantId), CANDIDATE_KPI_CACHE_TTL_SECONDS);
}
