import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-worker-context";

export const runtime = "nodejs";

/**
 * Public applicant API: enabled onboarding steps for the active tenant (subdomain or slug).
 */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug")?.trim().toLowerCase() || "";
    const subdomain = req.nextUrl.searchParams.get("subdomain")?.trim().toLowerCase() || "";
    const tenantIdParam = req.nextUrl.searchParams.get("tenantId")?.trim() || "";

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);

    let tenantId = tenantIdParam;
    if (!tenantId) {
      const lookup = slug || subdomain;
      if (lookup) tenantId = (await resolveTenantIdBySlug(supabase, lookup)) ?? "";
    }

    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenant slug, subdomain, or tenantId" }, { status: 400 });
    }

    const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
    if (!config) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    const steps = getEnabledTenantSteps(config).map((s) => ({
      id: s.id,
      key: s.step_key,
      type: s.step_type,
      label: s.title,
      description: s.description,
      sortOrder: s.sort_order,
      isRequired: s.is_required,
      isEnabled: s.is_enabled,
      config: s.metadata,
    }));

    return NextResponse.json({
      tenantId: config.tenantId,
      configId: config.configId,
      steps,
    });
  } catch (err: unknown) {
    console.error("[tenant/onboarding-steps]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
