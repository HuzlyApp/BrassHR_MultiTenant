import { NextResponse } from "next/server";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  tenantStatusFromIsActive,
  type TenantConsoleRow,
} from "@/lib/godadmin/tenant-account-status";

export const runtime = "nodejs";

/** God Admin: list all tenant accounts (including deactivated). */
export async function GET() {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load tenants", detail: error.message },
      { status: 500 }
    );
  }

  const tenants: TenantConsoleRow[] = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    status: tenantStatusFromIsActive(row.is_active as boolean | null | undefined),
    created_at: row.created_at != null ? String(row.created_at) : "",
    updated_at: row.updated_at != null ? String(row.updated_at) : "",
  }));

  return NextResponse.json({ tenants });
}
