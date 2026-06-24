import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { provisionFirmaWorkspaceForTenant } from "@/lib/firma/provision-tenant-workspace";

export const runtime = "nodejs";

function canManageFirmaSettings(auth: { godAdmin: boolean; role: string }): boolean {
  return auth.godAdmin || auth.role === "admin" || auth.role === "owner";
}

export async function POST() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  if (!canManageFirmaSettings(auth)) {
    return NextResponse.json({ error: "Not authorized to provision Firma workspace" }, { status: 403 });
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(svc, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });

  if (!tenantId) {
    return NextResponse.json({ error: "No organization selected" }, { status: 400 });
  }

  const { data: tenant, error: tenantError } = await svc
    .from("tenants")
    .select("id, name, subdomain, slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }
  if (!tenant?.id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const result = await provisionFirmaWorkspaceForTenant({
    supabase: svc,
    tenantId: tenant.id,
    tenantName: String(tenant.name ?? ""),
    tenantSlug: tenant.subdomain ?? tenant.slug ?? null,
  });

  return NextResponse.json({
    ok: result.status === "created" || result.status === "already_configured",
    firmaProvisioning: {
      status: result.status,
      workspaceId: result.workspaceId,
      message: result.message ?? null,
    },
  });
}
