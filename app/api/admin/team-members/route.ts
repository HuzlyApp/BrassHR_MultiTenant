import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const STAFF_ROLES = new Set(["admin", "recruiter", "owner", "client"]);

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const scope = await resolveStaffTenantScope(auth.authUser);
  if (scope.mode !== "scoped") {
    return NextResponse.json({ error: "Select a tenant before loading team members." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id, role, is_active")
    .eq("tenant_id", scope.tenantId);

  const membershipIds = new Set(
    ((roleRows ?? []) as Array<{ user_id: string; role: string | null; is_active?: boolean | null }>)
      .filter((row) => STAFF_ROLES.has(String(row.role ?? "").trim().toLowerCase()) || String(row.role ?? "") === "client")
      .filter((row) => row.is_active !== false)
      .map((row) => row.user_id)
  );

  const { data, error } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, role")
    .eq("tenant_id", scope.tenantId)
    .order("first_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let extra: Array<{ id: string; email: string | null; first_name: string | null; last_name: string | null; role: string | null }> = [];
  const missingIds = [...membershipIds].filter((id) => !(data ?? []).some((row) => String(row.id) === id));
  if (missingIds.length > 0) {
    const extraResult = await supabase
      .from("users")
      .select("id, email, first_name, last_name, role")
      .in("id", missingIds);
    extra = (extraResult.data ?? []) as typeof extra;
  }

  const members = [...(data ?? []), ...extra]
    .filter((row) => STAFF_ROLES.has(String(row.role ?? "").trim().toLowerCase()) || membershipIds.has(String(row.id)))
    .map((row) => ({
      id: String(row.id),
      email: String(row.email ?? "").trim().toLowerCase(),
      name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || String(row.email ?? ""),
      role: String(row.role ?? ""),
    }))
    .filter((row) => row.email.includes("@"));

  return NextResponse.json({ members });
}
