import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import { brandingFromTenantRow, defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache } from "@/lib/cache";

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
          "id, name, slug, logo_url, primary_color, secondary_color, accent_color, welcome_headline, welcome_subtitle, auth_background_image_url"
        )
        .eq("id", id)
        .maybeSingle<TenantBrandingRow>();
      return data ?? null;
    },
    CACHE_TTL_SECONDS.tenantConfig
  );
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });

  if (!tenantId) {
    return Response.json({
      branding: defaultTenantBranding(),
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
              branding: defaultTenantBranding(),
            },
          }
        : {}),
    });
  }

  const row = await loadTenant(tenantId!);
  const branding = brandingFromTenantRow(row);
  return Response.json({
    branding,
    viewer: {
      godAdmin: auth.godAdmin,
      scoped: Boolean(tenantId),
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
  });
}
