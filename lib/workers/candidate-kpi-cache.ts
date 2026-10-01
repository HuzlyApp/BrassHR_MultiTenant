import "server-only";

import { buildCacheKey, invalidateTenantCache } from "@/lib/cache";

/** Tenant-wide counts only. The payload has no user id, name, or email. */
export const CANDIDATE_KPI_CACHE_TTL_SECONDS = 120;

const TABLE = "candidate_kpi";

export function candidateKpiCacheKey(tenantId: string, pipelineStatus: string | null): string {
  const status = pipelineStatus?.trim().toLowerCase() || "all";
  return buildCacheKey(TABLE, ["tenant", tenantId, "status", status]);
}

export async function invalidateCandidateKpiCache(tenantId: string): Promise<void> {
  const id = tenantId.trim();
  if (!id) return;
  await invalidateTenantCache(TABLE, id);
}
