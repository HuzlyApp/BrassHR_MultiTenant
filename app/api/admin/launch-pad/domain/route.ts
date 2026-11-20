import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { checkSubdomainAvailabilityForOnboarding } from "@/lib/tenant/check-subdomain-availability";
import { validateTenantSubdomainInput, subdomainErrorMessage } from "@/lib/tenant/subdomain-validation";
import { getEffectiveRootDomain } from "@/lib/tenant/tenant-host-resolution";
import { buildTenantVanityUrl } from "@/lib/tenant/tenant-vanity-url";
import { invalidateTenantBrandingCache } from "@/lib/tenant/invalidate-tenant-branding-cache";
import { ADMIN_RECRUITER_HOME_ROUTE } from "@/app/admin_recruiter/components/sidebar-config";
import { registerTenantDomain } from "@/lib/vercel";
import { buildCacheKey, deleteCache } from "@/lib/cache";

async function context() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!auth.godAdmin && auth.role !== "admin") {
    return NextResponse.json({ error: "Tenant admin access is required." }, { status: 403 });
  }
  const sb = createServiceRoleClient();
  if (!sb) return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  const tenantId = await resolveEffectiveAdminTenantId(sb, auth);
  if (!tenantId) return NextResponse.json({ error: "No organization selected." }, { status: 403 });
  const { data: tenant, error } = await sb.from("tenants")
    .select("id, slug, subdomain, domain").eq("id", tenantId).maybeSingle();
  if (error || !tenant) {
    return NextResponse.json({ error: "Could not load your organization." }, { status: 500 });
  }
  return { sb, tenantId, tenant };
}

function payload(subdomain: string | null) {
  const rootDomain = getEffectiveRootDomain();
  return {
    subdomain,
    rootDomain,
    workspaceUrl: subdomain ? buildTenantVanityUrl(subdomain, ADMIN_RECRUITER_HOME_ROUTE, { rootDomain }) : null,
  };
}

export async function GET() {
  const ctx = await context();
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json(payload(ctx.tenant.subdomain), { headers: { "Cache-Control": "no-store" } });
}

const input = z.object({ subdomain: z.string().trim().min(1).max(63) });

export async function PATCH(req: Request) {
  const ctx = await context();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid subdomain." }, { status: 400 });
  const validated = validateTenantSubdomainInput(parsed.data.subdomain);
  if ("failure" in validated) {
    return NextResponse.json({ error: subdomainErrorMessage(validated.failure) }, { status: 400 });
  }
  const subdomain = validated.subdomain;
  if (subdomain !== ctx.tenant.subdomain) {
    const availability = await checkSubdomainAvailabilityForOnboarding(ctx.sb, subdomain, ctx.tenantId);
    if ("error" in availability) return NextResponse.json({ error: availability.error }, { status: 409 });
  }
  try {
    await registerTenantDomain(subdomain);
  } catch (error) {
    console.error("[launch-pad/domain] registration failed", error);
    return NextResponse.json({ error: "Could not connect your domain. Please try again." }, { status: 502 });
  }
  const { data: updated, error } = await ctx.sb.from("tenants").update({
    subdomain,
    domain: `${subdomain}.${getEffectiveRootDomain()}`,
    updated_at: new Date().toISOString(),
  }).eq("id", ctx.tenantId).select("id").maybeSingle();
  if (error || !updated) {
    return NextResponse.json({ error: error?.code === "23505" ? "That subdomain is already taken." : "Could not save your domain." }, { status: error?.code === "23505" ? 409 : 500 });
  }
  // Keep the tenant slug stable so existing applicant links continue to resolve.
  await Promise.all([
    invalidateTenantBrandingCache({ tenantId: ctx.tenantId, slug: ctx.tenant.slug, subdomain: ctx.tenant.subdomain }),
    invalidateTenantBrandingCache({ tenantId: ctx.tenantId, slug: ctx.tenant.slug, subdomain }),
    ...[ctx.tenant.subdomain, subdomain].filter(Boolean).flatMap((label) => [
      deleteCache(buildCacheKey("tenants", ["subdomain", label], { lookup: "slug" })),
      deleteCache(buildCacheKey("tenants", ["public", "slug", label], { active: true })),
    ]),
  ]);
  return NextResponse.json({ ok: true, ...payload(subdomain) });
}
