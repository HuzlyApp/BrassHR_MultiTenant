import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffApiAuthContext } from "@/lib/auth/api-session";
import { getCachedStaffTenantScope } from "@/lib/auth/cached-staff-auth";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { resolveTenantIdBySlug } from "@/lib/tenant/resolve-tenant-id-by-slug";
import { createPerfTimer, logPerf } from "@/lib/perf";

/**
 * Effective admin tenant for branding/header routes.
 * Reuses cached staff tenant scope (view-as / JWT / profile) instead of re-querying users.
 */
export async function resolveEffectiveAdminTenantIdCached(
  auth: StaffApiAuthContext,
  supabase: SupabaseClient | null,
): Promise<string | null> {
  const timer = createPerfTimer();
  const scope = await getCachedStaffTenantScope(auth.authUser);

  if (scope.mode === "scoped") {
    logPerf("effective-branding.tenantScope", {
      totalMs: timer.elapsedMs(),
      userId: auth.userId,
      tenantId: scope.tenantId,
      source: "staff_scope_cache",
    });
    return scope.tenantId;
  }

  if (auth.godAdmin && supabase) {
    const jar = await cookies();
    const onboardingSlug = jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase();
    if (onboardingSlug && onboardingSlug.length >= 2) {
      const fromSlug = await resolveTenantIdBySlug(supabase, onboardingSlug);
      if (fromSlug) {
        logPerf("effective-branding.tenantScope", {
          totalMs: timer.elapsedMs(),
          userId: auth.userId,
          tenantId: fromSlug,
          source: "onboarding_slug",
        });
        return fromSlug.toLowerCase();
      }
    }
  }

  logPerf("effective-branding.tenantScope", {
    totalMs: timer.elapsedMs(),
    userId: auth.userId,
    tenantId: null,
    source: "unscoped",
  });
  return null;
}
