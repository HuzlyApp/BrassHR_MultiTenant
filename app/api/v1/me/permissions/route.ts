import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffRole } from "@/lib/auth/app-role";
import { loadSessionGrants } from "@/lib/auth/module-access.server";
import { atomicPermissions } from "@/lib/auth/atomic-permissions";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { editionError, requireEditionContext } from "@/lib/tenant/edition-api-context";
import { loadTenantFeatures } from "@/lib/tenant/edition-features";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await requireEditionContext(request);
    if (context instanceof NextResponse) return context;
    const { auth, supabase, tenantId } = context;
    const { edition, features } = await loadTenantFeatures(supabase, tenantId);
    if (!auth.authUser) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    let permissions: string[] = [];
    if (isStaffRole(auth.role) || auth.godAdmin) {
      const jar = await cookies();
      const access = await loadSessionGrants({ user: auth.authUser,
        tenantSlug: jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value ?? null });
      if (!access.ok) return NextResponse.json({ error: access.detail, code: "FORBIDDEN" }, { status: access.status });
      permissions = atomicPermissions(access.grants, features);
    }
    const { data: membership, error } = await supabase.from("user_roles").select("role, is_active")
      .eq("tenant_id", tenantId).eq("user_id", auth.userId).maybeSingle();
    if (error) throw error;
    if (membership?.is_active === false) return NextResponse.json({ error: "Membership disabled", code: "FORBIDDEN" }, { status: 403 });
    return NextResponse.json({ tenant_id: tenantId, edition, roles: [membership?.role ?? auth.role], permissions },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return editionError(error); }
}
