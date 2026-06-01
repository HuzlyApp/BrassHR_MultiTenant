import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { logGodAdminImpersonation } from "@/lib/godadmin/impersonation-audit";
import {
  normalizeTenantId,
  resolveViewAsTenantTarget,
  VIEW_AS_TENANT_COOKIE_OPTS,
} from "@/lib/godadmin/view-as-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { VIEW_AS_TENANT_COOKIE } from "@/lib/tenant/constants";
import { resolveTenantIdBySlug } from "@/lib/tenant/resolve-tenant-id-by-slug";

type Body = { tenantId?: string | null; slug?: string | null };

/**
 * Narrow god-admin recruiter traffic to one active tenant (HTTP-only cookie).
 * Only God Admin may set or clear impersonation scope.
 */
export async function POST(req: Request) {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clearChoice =
    body.tenantId === null ||
    body.tenantId === "" ||
    (typeof body.tenantId === "undefined" &&
      (body.slug === null || body.slug === "" || typeof body.slug === "undefined"));

  if (clearChoice) {
    const jar = await cookies();
    const previousId = normalizeTenantId(jar.get(VIEW_AS_TENANT_COOKIE)?.value);
    if (previousId) {
      const sb = createServiceRoleClient();
      if (sb) {
        const { data } = await sb
          .from("tenants")
          .select("id, name, slug")
          .eq("id", previousId)
          .maybeSingle();
        void logGodAdminImpersonation({
          actorUserId: auth.userId,
          actorEmail: auth.email,
          tenantId: previousId,
          tenantSlug: data?.slug != null ? String(data.slug) : null,
          tenantName: data?.name != null ? String(data.name) : null,
          event: "end",
          request: req,
        });
      }
    }

    const res = NextResponse.json({ ok: true, tenantId: null });
    res.cookies.set(VIEW_AS_TENANT_COOKIE, "", { ...VIEW_AS_TENANT_COOKIE_OPTS, maxAge: 0 });
    return res;
  }

  let raw = normalizeTenantId(
    typeof body.tenantId === "string" ? body.tenantId : null
  );

  if (!raw && typeof body.slug === "string" && body.slug.trim().length >= 2) {
    const sb = createServiceRoleClient();
    if (!sb) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }
    raw = await resolveTenantIdBySlug(sb, body.slug.trim());
    if (!raw) {
      return NextResponse.json({ error: "Tenant not found for slug" }, { status: 404 });
    }
  }

  if (!raw) {
    return NextResponse.json(
      { error: "tenantId must be a UUID or omitted to clear." },
      { status: 400 }
    );
  }

  const resolved = await resolveViewAsTenantTarget(raw);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
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

  const res = NextResponse.json({
    ok: true,
    tenantId: resolved.tenant.id,
    tenantName: resolved.tenant.name,
    tenantSlug: resolved.tenant.slug,
  });
  res.cookies.set(VIEW_AS_TENANT_COOKIE, resolved.tenant.id, VIEW_AS_TENANT_COOKIE_OPTS);
  return res;
}
