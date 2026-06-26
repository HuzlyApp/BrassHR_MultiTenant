import { NextResponse } from "next/server";
import { ADMIN_RECRUITER_HOME_ROUTE } from "@/app/admin_recruiter/components/sidebar-config";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { logGodAdminImpersonation } from "@/lib/godadmin/impersonation-audit";
import {
  normalizeTenantId,
  resolveViewAsTenantTarget,
  VIEW_AS_TENANT_COOKIE_OPTS,
} from "@/lib/godadmin/view-as-tenant";
import { VIEW_AS_TENANT_COOKIE } from "@/lib/tenant/constants";

type RouteContext = { params: Promise<{ tenantId: string }> };

/**
 * God Admin: enter Admin Recruiter view for one active tenant (sets HTTP-only cookie, redirects).
 */
export async function GET(req: Request, context: RouteContext) {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;

  const { tenantId: rawId } = await context.params;
  const tenantId = normalizeTenantId(rawId);
  if (!tenantId) {
    return NextResponse.redirect(
      new URL("/godadmin/tenants?error=invalid-tenant", req.url)
    );
  }

  const resolved = await resolveViewAsTenantTarget(tenantId);
  if (!resolved.ok) {
    const code =
      resolved.status === 404
        ? "tenant-not-found"
        : resolved.status === 403
          ? "tenant-inactive"
          : "view-failed";
    return NextResponse.redirect(new URL(`/godadmin/tenants?error=${code}`, req.url));
  }

  void logGodAdminImpersonation({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    tenantId: resolved.tenant.id,
    tenantSlug: resolved.tenant.slug,
    tenantName: resolved.tenant.name,
    event: "start",
    request: req,
  });

  const res = NextResponse.redirect(new URL(ADMIN_RECRUITER_HOME_ROUTE, req.url));
  res.cookies.set(VIEW_AS_TENANT_COOKIE, resolved.tenant.id, VIEW_AS_TENANT_COOKIE_OPTS);
  return res;
}
