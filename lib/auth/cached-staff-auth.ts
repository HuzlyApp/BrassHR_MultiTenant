import "server-only";

import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { NextResponse } from "next/server";
import { requireStaffApiSession, type StaffApiAuthContext } from "@/lib/auth/api-session";
import {
  resolveStaffTenantScope,
  type StaffTenantScope,
} from "@/lib/auth/staff-tenant-scope";
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache } from "@/lib/cache";
import { logPerf, createPerfTimer } from "@/lib/perf";
import { normalizeTenantId } from "@/lib/godadmin/view-as-tenant";
import { VIEW_AS_TENANT_COOKIE } from "@/lib/tenant/constants";

type CachedStaffScopePayload = StaffTenantScope & { viewAsKey: string };

async function readViewAsKeyForCache(): Promise<string> {
  const jar = await cookies();
  return normalizeTenantId(jar.get(VIEW_AS_TENANT_COOKIE)?.value) ?? "none";
}

async function resolveStaffTenantScopeWithCache(authUser: User): Promise<StaffTenantScope> {
  const timer = createPerfTimer();
  const viewAsKey = await readViewAsKeyForCache();
  const cacheKey = buildCacheKey("staff_scope", ["user", authUser.id, "viewAs", viewAsKey], {
    v: 1,
  });

  const cached = await getOrSetCache(
    cacheKey,
    async (): Promise<CachedStaffScopePayload> => {
      const scope = await resolveStaffTenantScope(authUser);
      return { ...scope, viewAsKey };
    },
    CACHE_TTL_SECONDS.searchResults,
  );

  const { viewAsKey: _vk, ...scope } = cached;
  logPerf("tenant.resolve", {
    totalMs: timer.elapsedMs(),
    userId: authUser.id,
    mode: scope.mode,
    tenantId: scope.mode === "scoped" ? scope.tenantId : null,
    viewAsKey,
  });
  return scope;
}

export const getCachedStaffApiSession = cache(async (): Promise<StaffApiAuthContext | NextResponse> => {
  const timer = createPerfTimer();
  const result = await requireStaffApiSession();
  logPerf("auth.resolve", {
    totalMs: timer.elapsedMs(),
    ok: !(result instanceof NextResponse),
    userId: result instanceof NextResponse ? null : result.userId,
    devBypass: result instanceof NextResponse ? null : result.devBypass,
  });
  return result;
});

export const getCachedStaffTenantScope = cache(
  async (authUser: User): Promise<StaffTenantScope> => resolveStaffTenantScopeWithCache(authUser),
);
