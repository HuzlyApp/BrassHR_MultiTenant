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
import {
  ONBOARDING_TENANT_SLUG_COOKIE,
  VIEW_AS_TENANT_COOKIE,
} from "@/lib/tenant/constants";

type CachedStaffScopePayload = StaffTenantScope & { scopeKey: string };

async function readScopeKeyForCache(): Promise<string> {
  const jar = await cookies();
  const viewAs = normalizeTenantId(jar.get(VIEW_AS_TENANT_COOKIE)?.value) ?? "none";
  const hostSlug =
    jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase() || "none";
  return `${viewAs}:${hostSlug}`;
}

async function resolveStaffTenantScopeWithCache(authUser: User): Promise<StaffTenantScope> {
  const timer = createPerfTimer();
  const scopeKey = await readScopeKeyForCache();
  const cacheKey = buildCacheKey("staff_scope", ["user", authUser.id, "scope", scopeKey], {
    v: 2,
  });

  const cached = await getOrSetCache(
    cacheKey,
    async (): Promise<CachedStaffScopePayload> => {
      const scope = await resolveStaffTenantScope(authUser);
      return { ...scope, scopeKey };
    },
    CACHE_TTL_SECONDS.searchResults,
  );

  const { scopeKey: _sk, ...scope } = cached;
  logPerf("tenant.resolve", {
    totalMs: timer.elapsedMs(),
    userId: authUser.id,
    mode: scope.mode,
    tenantId: scope.mode === "scoped" ? scope.tenantId : null,
    scopeKey,
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
