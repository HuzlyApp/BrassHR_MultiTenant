import { NextResponse } from "next/server";
import { loadFreshViewerStaffAccess } from "@/lib/auth/cached-session-grants";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { requireUserManagement } from "@/lib/auth/user-management";
import { seededGrantForRole } from "@/lib/auth/permission-catalog";
import { parseRolePermissionGrants } from "@/lib/auth/parse-role-permissions";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadStaffRoles, matchStaffRole } from "@/lib/admin/staff-roles";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ roleKey: string }> };

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

async function readPermissions(
  supabase: ReturnType<typeof createServiceRoleClient>,
  value: unknown,
  isAdmin: boolean
) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("permission_resources").select("key").eq("always_granted", false);
  if (error || !data?.length) return null;
  const allowed = new Set((data as { key: string }[]).map((row) => row.key));
  // Missing keys use the seed matrix so a partial save cannot silently revoke
  // newly added resources as all-false. Always-granted / unknown keys are ignored.
  return parseRolePermissionGrants(value, allowed, (resourceKey) => {
    const seeded = seededGrantForRole(isAdmin, resourceKey);
    return {
      canView: seeded?.canView === true,
      canEdit: seeded?.canEdit === true,
      canDelete: seeded?.canDelete === true,
    };
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = await requireUserManagement(auth, "edit");
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Forbidden", detail: "Permission data unavailable" }, { status: 403 });
  const tenantId = await resolveStaffTenantId(supabase, auth);
  if (!tenantId) return NextResponse.json({ error: "Forbidden", detail: "Insufficient permission" }, { status: 403 });

  const { roleKey } = await context.params;
  const key = roleKey?.trim().toLowerCase() ?? "";
  const { data: existing, error: existingError } = await supabase
    .from("tenant_roles")
    .select("role_key, is_system, is_admin")
    .eq("tenant_id", tenantId)
    .eq("role_key", key)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "Forbidden", detail: "Permission data unavailable" }, { status: 403 });
  if (!existing) return NextResponse.json({ error: "Role not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    label?: unknown;
    description?: unknown;
    permissions?: unknown;
  } | null;
  const label = cleanText(body?.label, 80);
  const description = cleanText(body?.description, 240);
  const role = existing as { is_admin?: boolean; is_system?: boolean };
  const permissions = await readPermissions(supabase, body?.permissions, role.is_admin === true);
  if (!label || !permissions) return NextResponse.json({ error: "Role details are invalid." }, { status: 400 });

  const company = permissions.find((permission) => permission.resourceKey === "settings_company");
  if (role.is_admin && role.is_system && (!company?.canView || !company.canEdit)) {
    return NextResponse.json(
      { error: "The admin role must keep access to edit company settings." },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("tenant_roles")
    .update({ label, description })
    .eq("tenant_id", tenantId)
    .eq("role_key", key);
  if (updateError) return NextResponse.json({ error: "Forbidden", detail: "Permission data unavailable" }, { status: 403 });

  const { error: deleteError } = await supabase
    .from("tenant_role_permissions")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("role_key", key);
  if (deleteError) return NextResponse.json({ error: "Forbidden", detail: "Permission data unavailable" }, { status: 403 });

  const { error: insertError } = await supabase.from("tenant_role_permissions").insert(
    permissions.map((permission) => ({
      tenant_id: tenantId,
      role_key: key,
      resource_key: permission.resourceKey,
      can_view: permission.canView,
      can_edit: permission.canEdit,
      can_delete: permission.canDelete,
    }))
  );
  if (insertError) return NextResponse.json({ error: "Forbidden", detail: "Permission data unavailable" }, { status: 403 });

  const access = await loadFreshViewerStaffAccess();
  return NextResponse.json({ ok: true, ...(access ? { access } : {}) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = await requireUserManagement(auth, "delete");
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Forbidden", detail: "Permission data unavailable" }, { status: 403 });
  const tenantId = await resolveStaffTenantId(supabase, auth);
  if (!tenantId) return NextResponse.json({ error: "Forbidden", detail: "Insufficient permission" }, { status: 403 });

  const { roleKey } = await context.params;
  const key = roleKey?.trim().toLowerCase() ?? "";
  const { data: existing, error: existingError } = await supabase
    .from("tenant_roles")
    .select("role_key, is_system")
    .eq("tenant_id", tenantId)
    .eq("role_key", key)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "Forbidden", detail: "Permission data unavailable" }, { status: 403 });
  if (!existing) return NextResponse.json({ error: "Role not found." }, { status: 404 });
  if ((existing as { is_system?: boolean }).is_system) {
    return NextResponse.json({ error: "System roles cannot be deleted." }, { status: 400 });
  }

  const catalog = await loadStaffRoles(supabase);
  const { data: members, error: memberError } = await supabase
    .from("user_roles")
    .select("role, is_active")
    .eq("tenant_id", tenantId);
  if (memberError) return NextResponse.json({ error: "Forbidden", detail: "Permission data unavailable" }, { status: 403 });
  const assigned = ((members ?? []) as { role?: string | null; is_active?: boolean | null }[]).some((row) => {
    if (row.is_active === false) return false;
    const matched = matchStaffRole(row.role, catalog);
    return (matched?.key ?? row.role?.trim().toLowerCase()) === key;
  });
  if (assigned) return NextResponse.json({ error: "Reassign users before deleting this role." }, { status: 409 });

  const { error } = await supabase.from("tenant_roles").delete().eq("tenant_id", tenantId).eq("role_key", key);
  if (error) return NextResponse.json({ error: "Forbidden", detail: "Permission data unavailable" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
