import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import { brandingFromTenantRow, defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import { getCachedStaffApiSession } from "@/lib/auth/cached-staff-auth";
import { resolveEffectiveAdminTenantIdCached } from "@/lib/auth/resolve-effective-admin-tenant-cached";
import { buildCacheKey, CACHE_TTL_SECONDS, getCache, getOrSetCache, setCache } from "@/lib/cache";
import { createPerfTimer, logPerf } from "@/lib/perf";
import type { StaffApiAuthContext } from "@/lib/auth/api-session";

async function loadTenant(id: string): Promise<TenantBrandingRow | null> {
  return getOrSetCache(
    buildCacheKey("tenants", ["tenant", id, "branding"], {
      fields: "branding",
    }),
    async () => {
      const sb = createServiceRoleClient();
      if (!sb) return null;
      const { data } = await sb
        .from("tenants")
        .select(
          "id, name, slug, logo_url, favicon_url, primary_color, secondary_color, accent_color, welcome_headline, welcome_subtitle, auth_background_image_url"
        )
        .eq("id", id)
        .maybeSingle<TenantBrandingRow>();
      return data ?? null;
    },
    CACHE_TTL_SECONDS.tenantConfig
  );
}

type EffectiveBrandingResponse = {
  branding: ReturnType<typeof defaultTenantBranding>;
  viewer: {
    godAdmin: boolean;
    scoped: boolean;
    tenantId: string | null;
    tenantName: string | null;
  };
  debug?: Record<string, unknown>;
};

function buildUnscopedPayload(auth: StaffApiAuthContext): EffectiveBrandingResponse {
  const branding = defaultTenantBranding();
  return {
    branding,
    viewer: { godAdmin: auth.godAdmin, scoped: false, tenantId: null, tenantName: null },
    ...(process.env.NODE_ENV !== "production"
      ? {
          debug: {
            email: auth.email,
            userId: auth.userId,
            role: auth.role,
            godAdmin: auth.godAdmin,
            tenantId: null,
            tenantName: null,
            branding,
          },
        }
      : {}),
  };
}

function buildScopedPayload(
  auth: StaffApiAuthContext,
  tenantId: string,
  row: TenantBrandingRow | null,
): EffectiveBrandingResponse {
  const branding = brandingFromTenantRow(row);
  return {
    branding,
    viewer: {
      godAdmin: auth.godAdmin,
      scoped: true,
      tenantId,
      tenantName: row?.name ?? null,
    },
    ...(process.env.NODE_ENV !== "production"
      ? {
          debug: {
            email: auth.email,
            userId: auth.userId,
            role: auth.role,
            godAdmin: auth.godAdmin,
            tenantId,
            tenantName: row?.name ?? null,
            branding,
          },
        }
      : {}),
  };
}

export async function GET() {
  const routeTimer = createPerfTimer();

  const authTimer = createPerfTimer();
  const auth = await getCachedStaffApiSession();
  logPerf("effective-branding.auth", {
    totalMs: authTimer.elapsedMs(),
    ok: !(auth instanceof NextResponse),
  });
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();

  const tenantId = await resolveEffectiveAdminTenantIdCached(auth, supabase);
  const tenantScopeKey = tenantId ?? "none";
  const cacheKey = buildCacheKey(
    "admin_effective_branding",
    ["user", auth.userId, "tenant", tenantScopeKey],
    { fields: "branding+viewer" }
  );

  const cacheTimer = createPerfTimer();
  const cached = await getCache<EffectiveBrandingResponse>(cacheKey);
  logPerf("effective-branding.cacheLookup", {
    totalMs: cacheTimer.elapsedMs(),
    cacheHit: cached !== null,
    cacheKey,
  });

  if (cached !== null) {
    logPerf("effective-branding.total", {
      totalMs: routeTimer.elapsedMs(),
      cacheHit: true,
      tenantId: tenantScopeKey,
    });
    return Response.json(cached);
  }

  const payload: EffectiveBrandingResponse = !tenantId
    ? buildUnscopedPayload(auth)
    : buildScopedPayload(auth, tenantId, await loadTenant(tenantId));

  await setCache(cacheKey, payload, CACHE_TTL_SECONDS.userScoped);

  logPerf("effective-branding.total", {
    totalMs: routeTimer.elapsedMs(),
    cacheHit: false,
    tenantId: tenantScopeKey,
  });

  return Response.json(payload);
}
