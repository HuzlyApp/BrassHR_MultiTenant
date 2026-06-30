import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { resolveOnboardingWorker, readOnboardingTenantSlugFromRequest } from "@/lib/onboarding/resolve-onboarding-worker";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || "";
    const tenantSlug =
      req.nextUrl.searchParams.get("tenant")?.trim().toLowerCase() ||
      readOnboardingTenantSlugFromRequest(req);
    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const ctx = await resolveOnboardingWorker(supabase, applicantId, tenantSlug);
    if (!ctx) {
      return NextResponse.json({ progress: null });
    }

    const progress = await ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId);
    return NextResponse.json({ progress, workerId: ctx.workerId, tenantId: ctx.tenantId });
  } catch (err: unknown) {
    console.error("[onboarding/progress]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
