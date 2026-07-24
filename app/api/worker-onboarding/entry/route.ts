import { NextRequest, NextResponse } from "next/server";
import { resolveTenantApplicationEntry } from "@/lib/jobs/validate-job-application";
import { resolveWorkerOnboardingEntry } from "@/lib/onboarding/resolve-worker-onboarding-entry";

export const runtime = "nodejs";

/**
 * Resolve the first step for a tenant applicant.
 * Job-based tenants route to published job listings (or a single job apply URL).
 */
export async function GET(req: NextRequest) {
  const tenant = req.nextUrl.searchParams.get("tenant");

  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
    const supabase = createServiceRoleClient();
    if (supabase) {
      const route = await resolveTenantApplicationEntry(supabase, tenant);
      return NextResponse.json({
        url: route.path,
        tenantSlug: route.tenantSlug,
        kind: route.kind,
        jobToken: route.kind === "apply" ? route.jobToken : undefined,
        message: route.kind === "empty" ? route.message : undefined,
      });
    }
  } catch {
    /* fall through to legacy onboarding resolution */
  }

  const result = await resolveWorkerOnboardingEntry(tenant);
  if (result.kind === "redirect") {
    return NextResponse.json({ url: result.url, tenantSlug: result.tenantSlug, kind: "legacy" });
  }

  const status =
    result.code === "TENANT_REQUIRED" ? 400 : result.code === "NOT_PUBLISHED" ? 403 : 404;

  return NextResponse.json(
    { code: result.code, message: result.message, tenantSlug: result.tenantSlug },
    { status }
  );
}
