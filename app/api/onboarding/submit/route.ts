import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import {
  readOnboardingTenantSlugFromRequest,
} from "@/lib/onboarding/resolve-onboarding-worker";
import { submitOnboardingApplication } from "@/lib/onboarding/submit-onboarding-application";

export const runtime = "nodejs";

type Body = {
  applicantId?: string;
  tenantSlug?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : "";
    const tenantSlug =
      (typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : "") ||
      readOnboardingTenantSlugFromRequest(req) ||
      "";

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const result = await submitOnboardingApplication(supabase, { applicantId, tenantSlug });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      submittedAt: result.submittedAt,
      submittedWithIncompleteSteps: result.submittedWithIncompleteSteps,
      incompleteStepKeys: result.incompleteStepKeys,
      applicationStatus: result.applicationStatus,
      progress: result.progress,
    });
  } catch (err: unknown) {
    console.error("[onboarding/submit]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
