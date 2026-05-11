import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import { brandingFromTenantRow, defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import { VIEW_AS_TENANT_COOKIE } from "@/lib/tenant/constants";
import { tenantIdFromUser } from "@/lib/auth/staff-tenant-scope";
import { requireStaffApiSession } from "@/lib/auth/api-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loadTenant(id: string): Promise<TenantBrandingRow | null> {
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
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  let tenantId: string | null = null;

  if (auth.godAdmin) {
    const cookieId = (await cookies()).get(VIEW_AS_TENANT_COOKIE)?.value?.trim() ?? "";
    if (cookieId && UUID_RE.test(cookieId)) {
      tenantId = cookieId.toLowerCase();
    }
  } else {
    tenantId = tenantIdFromUser(auth.authUser);
    if (!tenantId) {
      const sb = createServiceRoleClient();
      if (sb) {
        const { data } = await sb
          .from("users")
          .select("tenant_id")
          .eq("id", auth.userId)
          .maybeSingle<{ tenant_id: string | null }>();
        if (data?.tenant_id && UUID_RE.test(data.tenant_id)) {
          tenantId = String(data.tenant_id).toLowerCase();
        }
      }
    }
  }

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

  const row = await loadTenant(tenantId);
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
