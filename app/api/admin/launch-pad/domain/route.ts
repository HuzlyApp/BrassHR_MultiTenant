import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLaunchPadContext as context, loadLaunchPadProgress, saveLaunchPadStep } from "@/lib/launch-pad/server";
import { LAUNCH_PAD_STEP_IDS } from "@/app/admin_recruiter/launch-pad/constants";
import { checkSubdomainAvailabilityForOnboarding } from "@/lib/tenant/check-subdomain-availability";
import { validateTenantSubdomainInput, subdomainErrorMessage } from "@/lib/tenant/subdomain-validation";
import { getEffectiveRootDomain } from "@/lib/tenant/tenant-host-resolution";
import {
  buildLaunchPadDomainDisplayUrl,
  buildTenantWorkspaceUrl,
  usesTenantQueryUrls,
} from "@/lib/tenant/tenant-vanity-url";
import { invalidateTenantBrandingCache } from "@/lib/tenant/invalidate-tenant-branding-cache";
import { ADMIN_RECRUITER_HOME_ROUTE } from "@/app/admin_recruiter/components/sidebar-config";
import { registerTenantDomain } from "@/lib/vercel";
import { buildCacheKey, deleteCache } from "@/lib/cache";

function requestOrigin(request?: Request): string | undefined {
  return request ? new URL(request.url).origin : undefined;
}

function payload(tenant: { slug: string; subdomain: string | null }, request?: Request) {
  const rootDomain = getEffectiveRootDomain();
  const origin = requestOrigin(request);
  const usesTenantQuery = origin ? usesTenantQueryUrls(new URL(origin).hostname) : false;
  return {
    subdomain: tenant.subdomain,
    rootDomain,
    usesTenantQuery,
    workspaceUrl: tenant.subdomain
      ? buildTenantWorkspaceUrl(
          { slug: tenant.slug, subdomain: tenant.subdomain },
          ADMIN_RECRUITER_HOME_ROUTE,
          { rootDomain, origin }
        )
      : null,
    domainDisplayUrl: tenant.subdomain
      ? buildLaunchPadDomainDisplayUrl({
          subdomain: tenant.subdomain,
          rootDomain,
          origin,
        })
      : null,
  };
}

export async function GET(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json(payload(ctx.tenant, request), { headers: { "Cache-Control": "no-store" } });
}

const input = z.object({ subdomain: z.string().trim().min(1).max(63) });

export async function PATCH(req: Request) {
  const ctx = await context(req);
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
  const { data: updated, error } = await ctx.sb.from("tenants").update({
    subdomain,
    // Reserve the name now; activation is a separate, completion-gated action.
    domain: subdomain === ctx.tenant.subdomain ? ctx.tenant.domain : null,
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
  try {
    await saveLaunchPadStep(ctx, "domain");
  } catch {
    return NextResponse.json({ error: "Your domain name was saved, but progress could not be saved. Please try again." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ...payload({ ...ctx.tenant, subdomain }, req) });
}

/** Activate only after all six tasks have been recorded for the authenticated tenant. */
export async function POST(req: Request) {
  const ctx = await context(req);
  if (ctx instanceof NextResponse) return ctx;
  try {
    const progress = await loadLaunchPadProgress(ctx);
    if (!LAUNCH_PAD_STEP_IDS.every((id) => progress[id])) {
      return NextResponse.json({ error: "Finish all Launch Pad tasks before activating your workspace." }, { status: 409 });
    }
    if (!ctx.tenant.subdomain) return NextResponse.json({ error: "Choose your domain name first." }, { status: 409 });
    const origin = requestOrigin(req);
    const registration = await registerTenantDomain(ctx.tenant.subdomain, { origin });
    const queryMode = origin ? usesTenantQueryUrls(new URL(origin).hostname) : false;
    if (!queryMode && (registration.skipped || !registration.domain.verified)) {
      return NextResponse.json({ error: "Your domain is not connected yet. Please try again or contact support." }, { status: 503 });
    }
    const domain = queryMode ? null : `${ctx.tenant.subdomain}.${getEffectiveRootDomain()}`;
    const { data, error } = await ctx.sb.from("tenants").update({ domain, updated_at: new Date().toISOString() })
      .eq("id", ctx.tenantId).select("id").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Could not activate your workspace. Please try again." }, { status: 503 });
    await invalidateTenantBrandingCache({ tenantId: ctx.tenantId, slug: ctx.tenant.slug, subdomain: ctx.tenant.subdomain });
    return NextResponse.json({ ok: true, ...payload(ctx.tenant, req) });
  } catch (error) {
    console.error("[launch-pad/domain] activation failed", error);
    return NextResponse.json({ error: "Could not activate your workspace. Please try again." }, { status: 502 });
  }
}
