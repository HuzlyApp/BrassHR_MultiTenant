import "server-only";

import { cache } from "react";
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache } from "@/lib/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logPerf } from "@/lib/perf";

export type StaffUserProfileRow = {
  god_admin: boolean;
  tenant_id: string | null;
  role: string | null;
};

async function fetchStaffUserProfileFromDb(userId: string): Promise<StaffUserProfileRow | null> {
  const sb = createServiceRoleClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("users")
    .select("god_admin, tenant_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { god_admin?: boolean; tenant_id?: string | null; role?: string | null };
  return {
    god_admin: row.god_admin === true,
    tenant_id: row.tenant_id != null ? String(row.tenant_id) : null,
    role: row.role != null ? String(row.role) : null,
  };
}

/** Short-TTL Redis cache for non-sensitive staff profile flags (not session tokens). */
export async function loadStaffUserProfile(userId: string): Promise<StaffUserProfileRow | null> {
  const timer = performance.now();
  const cacheKey = buildCacheKey("staff_user_profile", ["user", userId], { v: 1 });
  const profile = await getOrSetCache(
    cacheKey,
    () => fetchStaffUserProfileFromDb(userId),
    CACHE_TTL_SECONDS.searchResults,
  );
  logPerf("auth.staffProfile", {
    totalMs: Math.round(performance.now() - timer),
    userId,
    cacheHit: profile !== null,
  });
  return profile;
}

/** Per-request dedupe of staff profile load (same user, multiple callers in one route). */
export const loadStaffUserProfileCached = cache(loadStaffUserProfile);
