import { NextResponse } from "next/server";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  tenantStatusFromIsActive,
  type TenantConsoleRow,
} from "@/lib/godadmin/tenant-account-status";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ tenantId: string }> };

/** God Admin: soft-deactivate a tenant (sets is_active = false). */
export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;

  const { tenantId: rawId } = await context.params;
  const tenantId = rawId?.trim().toLowerCase() ?? "";
  if (!UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant id" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data: existing, error: loadErr } = await supabase
    .from("tenants")
    .select("id, name, slug, is_active, created_at, updated_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json(
      { error: "Failed to load tenant", detail: loadErr.message },
      { status: 500 }
    );
  }

  if (!existing?.id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const previousStatus = tenantStatusFromIsActive(
    existing.is_active as boolean | null | undefined
  );

  if (previousStatus === "deactivated") {
    const tenant: TenantConsoleRow = {
      id: String(existing.id),
      name: String(existing.name ?? ""),
      slug: String(existing.slug ?? ""),
      status: "deactivated",
      created_at: existing.created_at != null ? String(existing.created_at) : "",
      updated_at: existing.updated_at != null ? String(existing.updated_at) : "",
    };
    return NextResponse.json({ tenant, alreadyDeactivated: true });
  }

  const updatedAt = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from("tenants")
    .update({ is_active: false, updated_at: updatedAt })
    .eq("id", tenantId)
    .select("id, name, slug, is_active, created_at, updated_at")
    .single();

  if (updateErr) {
    return NextResponse.json(
      { error: "Failed to deactivate tenant", detail: updateErr.message },
      { status: 500 }
    );
  }

  const tenant: TenantConsoleRow = {
    id: String(updated.id),
    name: String(updated.name ?? ""),
    slug: String(updated.slug ?? ""),
    status: tenantStatusFromIsActive(updated.is_active as boolean | null | undefined),
    created_at: updated.created_at != null ? String(updated.created_at) : "",
    updated_at: updated.updated_at != null ? String(updated.updated_at) : "",
  };

  void writeActivityLog({
    actorUserId: auth.userId,
    action: "tenant_deactivated",
    entityType: "tenant",
    entityId: tenant.id,
    metadata: {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      tenant_slug: tenant.slug,
      god_admin_user_id: auth.userId,
      god_admin_email: auth.email,
      timestamp: updatedAt,
      previous_status: previousStatus,
      new_status: tenant.status,
    },
    request: req,
  });

  return NextResponse.json({ tenant });
}
