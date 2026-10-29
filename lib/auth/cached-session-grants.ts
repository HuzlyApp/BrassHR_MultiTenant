import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { NextResponse } from "next/server";
import type { StaffAccessRecord } from "@/lib/admin/staff-access-cache";
import { getCachedStaffApiSession, getCachedStaffTenantScope } from "@/lib/auth/cached-staff-auth";
import { loadSessionGrants } from "@/lib/auth/module-access.server";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";

async function loadViewerStaffAccess(): Promise<StaffAccessRecord | null> {
  const auth = await getCachedStaffApiSession();
  if (auth instanceof NextResponse) return null;

  const jar = await cookies();
  const result = await loadSessionGrants({
    user: auth.authUser,
    tenantSlug: jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value ?? null,
  });
  if (!result.ok) return null;

  const scope = await getCachedStaffTenantScope(auth.authUser);
  return {
    tenantId: scope.mode === "scoped" ? scope.tenantId : "all",
    godAdmin: result.godAdmin,
    grants: result.grants,
    viewKeys: result.grants.filter((grant) => grant.canView).map((grant) => grant.key),
  };
}

/**
 * Grants for the signed-in viewer, deduped within one render.
 * Reads the same session and grant loader as `/api/admin/access`. Does not accept a client tenant id.
 */
export const getCachedStaffAccessSeed = cache(async (): Promise<StaffAccessRecord | null> => {
  try {
    return await loadViewerStaffAccess();
  } catch (error) {
    console.error("[staff-access] seed failed", error);
    return null;
  }
});

/** Fresh grants after a role write. Bypasses the per-request seed cache so the save response is current. */
export async function loadFreshViewerStaffAccess(): Promise<StaffAccessRecord | null> {
  try {
    return await loadViewerStaffAccess();
  } catch (error) {
    console.error("[staff-access] refresh failed", error);
    return null;
  }
}
