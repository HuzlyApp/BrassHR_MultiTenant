import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { normalizeJobToken } from "@/lib/jobs/public-application-routing";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { resolveJobApplicationIdForApplicant } from "@/lib/onboarding/resolve-job-application-id";
import { resolveOnboardingWorker, readOnboardingTenantSlugFromRequest } from "@/lib/onboarding/resolve-onboarding-worker";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || "";
    const tenantSlug =
      req.nextUrl.searchParams.get("tenant")?.trim().toLowerCase() ||
      readOnboardingTenantSlugFromRequest(req);
    const jobToken = normalizeJobToken(req.nextUrl.searchParams.get("job_token"));
    const applicationIdParam = req.nextUrl.searchParams.get("applicationId")?.trim() || null;

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

    const applicationId = await resolveJobApplicationIdForApplicant(supabase, {
      tenantId: ctx.tenantId,
      applicantAuthUserId: applicantId,
      workerId: ctx.workerId,
      jobToken,
      applicationId: applicationIdParam,
    });

    const progress = await ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId, {
      applicationId,
    });
    return NextResponse.json({
      progress,
      workerId: ctx.workerId,
      tenantId: ctx.tenantId,
      applicationId,
    });
  } catch (err: unknown) {
    console.error("[onboarding/progress]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
