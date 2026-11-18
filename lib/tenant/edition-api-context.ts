import { NextResponse } from "next/server";
import { isStaffRole } from "@/lib/auth/app-role";
import { requireApiSession, requireStaffApiSession } from "@/lib/auth/api-session";
import { requireUserManagement } from "@/lib/auth/user-management";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { EditionFeatureError } from "@/lib/tenant/edition-features";

export function editionError(error: unknown) {
  if (error instanceof EditionFeatureError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[edition-features]", error);
  return NextResponse.json({ error: "Feature data unavailable", code: "FEATURE_DATA_UNAVAILABLE" }, { status: 503 });
}

export async function requireEditionContext(request: Request, manage = false) {
  const auth = manage ? await requireStaffApiSession(request) : await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  if (manage) {
    const denied = await requireUserManagement(auth as Parameters<typeof requireUserManagement>[0]);
    if (denied) return denied;
  }
  const supabase = createServiceRoleClient();
  if (!supabase) return editionError(new Error("Supabase not configured"));
  let tenantId: string | null = null;
  if (auth.authUser && (isStaffRole(auth.role) || auth.godAdmin)) {
    tenantId = await resolveStaffTenantId(supabase, { ...auth, authUser: auth.authUser });
  } else if (auth.authUser && !auth.authUser.is_anonymous) {
    // Workers can read only their own profile tenant, never a client-supplied id.
    const { data, error } = await supabase.from("users").select("tenant_id, is_active")
      .eq("id", auth.userId).maybeSingle();
    if (error) return editionError(error);
    if (data?.is_active !== false) tenantId = data?.tenant_id ?? null;
  }
  if (!tenantId) {
    return NextResponse.json({ error: "No authorized tenant selected", code: "TENANT_REQUIRED" }, { status: 403 });
  }
  return { auth, supabase, tenantId };
}
