import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import {
  loadTenantFirmaWorkspaceId,
  resolveFirmaWorkspaceIdFromEnv,
  resolveTenantFirmaWorkspaceId,
} from "@/lib/firma/resolve-tenant-workspace";

export const runtime = "nodejs";

function canManageFirmaSettings(auth: { godAdmin: boolean; role: string }): boolean {
  return auth.godAdmin || auth.role === "admin" || auth.role === "owner";
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  if (!canManageFirmaSettings(auth)) {
    return NextResponse.json({ error: "Not authorized to view Firma settings" }, { status: 403 });
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

  const tenantWorkspace = await loadTenantFirmaWorkspaceId(svc, tenantId);
  const envWorkspace = resolveFirmaWorkspaceIdFromEnv();
  let effectiveWorkspaceId: string | null = null;
  try {
    effectiveWorkspaceId = await resolveTenantFirmaWorkspaceId(svc, tenantId);
  } catch {
    effectiveWorkspaceId = null;
  }

  return NextResponse.json({
    tenant_id: tenantId,
    firma_workspace_id: tenantWorkspace,
    effective_workspace_id: effectiveWorkspaceId,
    env_fallback_workspace_id: envWorkspace ?? null,
    source: tenantWorkspace ? "tenant" : envWorkspace ? "env" : null,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  if (!canManageFirmaSettings(auth)) {
    return NextResponse.json({ error: "Not authorized to update Firma settings" }, { status: 403 });
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

  const body = (await req.json().catch(() => null)) as { firma_workspace_id?: unknown } | null;
  const raw = body?.firma_workspace_id;
  const firmaWorkspaceId =
    raw === null || raw === undefined || raw === ""
      ? null
      : typeof raw === "string"
        ? raw.trim() || null
        : null;

  if (raw !== null && raw !== undefined && raw !== "" && typeof raw !== "string") {
    return NextResponse.json({ error: "firma_workspace_id must be a string or null" }, { status: 400 });
  }

  const { error } = await svc
    .from("tenants")
    .update({
      firma_workspace_id: firmaWorkspaceId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const effectiveWorkspaceId = firmaWorkspaceId ?? resolveFirmaWorkspaceIdFromEnv() ?? null;

  return NextResponse.json({
    ok: true,
    tenant_id: tenantId,
    firma_workspace_id: firmaWorkspaceId,
    effective_workspace_id: effectiveWorkspaceId,
    source: firmaWorkspaceId ? "tenant" : resolveFirmaWorkspaceIdFromEnv() ? "env" : null,
  });
}
