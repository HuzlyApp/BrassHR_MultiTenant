import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-worker-context";

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

    const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
    if (!config) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    return NextResponse.json({ config });
  } catch (err: unknown) {
    console.error("[onboarding/config]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
