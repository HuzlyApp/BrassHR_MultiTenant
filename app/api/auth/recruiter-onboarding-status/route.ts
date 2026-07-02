import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveRecruiterRedirectUrl } from "@/lib/auth/recruiter-dashboard-redirect";
import { resolveRecruiterOnboardingStatus } from "@/lib/auth/recruiter-onboarding-status.server";
import { forwardedHostFromHeaders } from "@/lib/tenant/tenant-host-resolution";

export async function GET(req: Request) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const tenantSlug = url.searchParams.get("tenant");
  const host = forwardedHostFromHeaders(req.headers);
  const protocolHeader = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocol = protocolHeader === "http" ? "http" : "https";

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

    const redirectUrl = resolveRecruiterRedirectUrl({
      path: status.redirectTarget,
      tenantSubdomain: status.tenantSubdomain,
      currentHostname: host,
      protocol,
    });

    console.info("[recruiter-onboarding-status]", {
      userId: status.userId,
      role: status.role,
      activeTenantId: status.activeTenantId,
      requestedTenantId: status.requestedTenantId,
      tenantOnboardingCompleted: status.tenantOnboardingCompleted,
      tenantSubdomain: status.tenantSubdomain,
      redirectTarget: status.redirectTarget,
      redirectUrl,
      host,
    });

    return NextResponse.json({
      ...status,
      redirectUrl,
    });
  } catch (error) {
    console.error(
      "[recruiter-onboarding-status]",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Could not resolve onboarding status" }, { status: 500 });
  }
}
