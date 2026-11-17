import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { formatApiError } from "@/lib/api/format-api-error";
import { isStaffRole, parseAppRole } from "@/lib/auth/app-role";
import { authorizeStaffHttpAccess } from "@/lib/auth/module-access.server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";

export const runtime = "nodejs";

/** Soft-deactivate the signed-in staff user (self-service). */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = parseAppRole((user.app_metadata as { role?: unknown } | undefined)?.role);
    if (role && isStaffRole(role)) {
      const jar = await cookies();
      const decision = await authorizeStaffHttpAccess({
        user,
        pathname: "/api/account/deactivate",
        method: "POST",
        tenantSlug: jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value ?? null,
      });
      if (!decision.ok && decision.code !== "not_staff") {
        return NextResponse.json({ error: decision.error, detail: decision.detail }, { status: decision.status });
      }
    }

    const svc = createServiceRoleClient();
    if (!svc) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const { error: updateError } = await svc
      .from("users")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, deactivated: true });
  } catch (err) {
    console.error("[account/deactivate POST]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}
