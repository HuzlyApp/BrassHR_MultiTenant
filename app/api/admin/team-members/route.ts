import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const STAFF_ROLES = new Set(["admin", "recruiter", "owner"]);

export async function GET(_req: NextRequest) {
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

  const { data, error } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, role")
    .eq("tenant_id", scope.tenantId)
    .order("first_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const members = (data ?? [])
    .filter((row) => STAFF_ROLES.has(String(row.role ?? "").trim().toLowerCase()))
    .map((row) => ({
      id: String(row.id),
      email: String(row.email ?? "").trim().toLowerCase(),
      name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || String(row.email ?? ""),
      role: String(row.role ?? ""),
    }))
    .filter((row) => row.email.includes("@"));

  return NextResponse.json({ members });
}
