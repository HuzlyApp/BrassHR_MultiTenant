import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { loadOnboardingBuilderMeta } from "@/lib/onboarding/load-onboarding-builder-meta";
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-worker-context";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";

export const runtime = "nodejs";

/** Public/worker-safe onboarding config (no correct_answer on questions). */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug")?.trim() || "";
    const tenantIdParam = req.nextUrl.searchParams.get("tenantId")?.trim() || "";

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);

    let tenantId = tenantIdParam;
    if (!tenantId && slug) {
      tenantId = (await resolveTenantIdBySlug(supabase, slug)) ?? "";
    }

    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenant slug or tenantId" }, { status: 400 });
    }

    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("id, slug, subdomain, is_active")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenantRow?.id || tenantRow.is_active === false) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (slug) {
      const canonicalSlug = String(tenantRow.slug ?? "").toLowerCase();
      const subdomain = String(tenantRow.subdomain ?? "").toLowerCase();
      if (slug !== canonicalSlug && slug !== subdomain) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
      }
    }

    const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
    if (!config) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    if (!getEnabledTenantSteps(config).length) {
      return NextResponse.json(
        {
          error: "This tenant has not published an onboarding flow yet.",
          code: "NOT_PUBLISHED",
        },
        { status: 403 }
      );
    }

    const builder = await loadOnboardingBuilderMeta(supabase, tenantId);
    const publishStatus = builder.publishStatus;

    if (publishStatus === "draft") {
      console.info("[onboarding/config] serving published steps; builder draft not applied to applicants", {
        tenantId,
        tenantSlug: tenantRow.slug ?? slug,
        enabledSteps: getEnabledTenantSteps(config).length,
      });
    }

    return NextResponse.json({
      config,
      tenantSlug: tenantRow.slug ?? slug,
      publishStatus,
      source: "published",
    });
  } catch (err: unknown) {
    console.error("[onboarding/config]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
