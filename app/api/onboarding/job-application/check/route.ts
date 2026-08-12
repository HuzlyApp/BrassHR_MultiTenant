import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkExistingJobApplication } from "@/lib/jobs/service";
import { normalizeJobToken } from "@/lib/jobs/public-application-routing";
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context";
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-tenant-id-by-slug";
import { readOnboardingTenantSlugFromRequest } from "@/lib/onboarding/resolve-onboarding-worker";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

type Body = {
  applicantId?: string;
  tenantSlug?: string;
  jobToken?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : "";
    const tenantSlug =
      (typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : "") ||
      readOnboardingTenantSlugFromRequest(req) ||
      "";
    const jobToken = normalizeJobToken(body.jobToken);

    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 });
    }
    if (!tenantSlug || tenantSlug.length < 2) {
      return NextResponse.json({ error: "Missing tenant" }, { status: 400 });
    }
    if (!jobToken) {
      return NextResponse.json({ error: "Missing job token" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const tenantId = await resolveTenantIdBySlug(supabase, tenantSlug);
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const ctx = await resolveWorkerByApplicantId(supabase, applicantId, tenantId);
    if (!ctx) {
      return NextResponse.json({
        ok: true,
        exists: false,
        alreadySubmitted: false,
        applicationId: null,
      });
    }

    const result = await checkExistingJobApplication(supabase, {
      tenantId,
      jobToken,
      applicantAuthUserId: applicantId,
      workerId: ctx.workerId,
    });

    return NextResponse.json({
      ok: true,
      exists: result.exists,
      alreadySubmitted: result.alreadySubmitted,
      applicationId: result.applicationId,
    });
  } catch (error) {
    console.error("[onboarding/job-application/check]", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
