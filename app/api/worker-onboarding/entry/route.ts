import { NextRequest, NextResponse } from "next/server";
import { resolveWorkerOnboardingEntry } from "@/lib/onboarding/resolve-worker-onboarding-entry";

export const runtime = "nodejs";

/** Resolve the first applicant onboarding step for a tenant (no intermediate /worker-onboarding hop). */
export async function GET(req: NextRequest) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  const result = await resolveWorkerOnboardingEntry(tenant);

  if (result.kind === "redirect") {
    return NextResponse.json({ url: result.url, tenantSlug: result.tenantSlug });
  }

  const status =
    result.code === "TENANT_REQUIRED" ? 400 : result.code === "NOT_PUBLISHED" ? 403 : 404;

  return NextResponse.json(
    { code: result.code, message: result.message, tenantSlug: result.tenantSlug },
    { status }
  );
}
