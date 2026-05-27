import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveRecruiterOnboardingStatus } from "@/lib/auth/recruiter-onboarding-status.server";

export async function GET(req: Request) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const tenantSlug = url.searchParams.get("tenant");

  try {
    const status = await resolveRecruiterOnboardingStatus(auth.authUser, { tenantSlug });
    if (!status.validTenantAccess) {
      return NextResponse.json(
        {
          error: "Forbidden",
          detail: "This recruiter does not have access to the requested tenant.",
          requestedTenantId: status.requestedTenantId,
          activeTenantId: status.activeTenantId,
        },
        { status: 403 }
      );
    }

    console.info("[recruiter-onboarding-status]", {
      userId: status.userId,
      role: status.role,
      activeTenantId: status.activeTenantId,
      requestedTenantId: status.requestedTenantId,
      tenantOnboardingCompleted: status.tenantOnboardingCompleted,
      redirectTarget: status.redirectTarget,
    });

    return NextResponse.json(status);
  } catch (error) {
    console.error(
      "[recruiter-onboarding-status]",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Could not resolve onboarding status" }, { status: 500 });
  }
}
