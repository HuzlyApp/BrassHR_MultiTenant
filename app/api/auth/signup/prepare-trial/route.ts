import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendOwnerOnboardingContinuationEmail } from "@/lib/onboarding/send-owner-onboarding-continuation-email";
import { resolvePlatformAppOrigin } from "@/lib/resolve-app-origin";
import { fetchOwnerOnboardingStatus } from "@/lib/auth/owner-onboarding-status";

export const runtime = "nodejs";

/**
 * POST — after owner signup, provision trial messaging: create continuation token and send setup email.
 */
export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const status = await fetchOwnerOnboardingStatus(authClient, user);
  if (status.tenantOnboardingCompleted) {
    return NextResponse.json({ ok: true, skipped: true, reason: "ONBOARDING_COMPLETE" });
  }

  const origin = resolvePlatformAppOrigin(req);
  if (!origin) {
    return NextResponse.json({ error: "Could not resolve app origin" }, { status: 400 });
  }

  const { data: profile } = await svc
    .from("users")
    .select("first_name, last_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const firstName = profile?.first_name != null ? String(profile.first_name).trim() : "";
  const lastName = profile?.last_name != null ? String(profile.last_name).trim() : "";
  const tenantAdminName = `${firstName} ${lastName}`.trim() || "there";
  const email = (profile?.email ?? user.email).trim().toLowerCase();

  const result = await sendOwnerOnboardingContinuationEmail(svc, {
    userId: user.id,
    email,
    tenantAdminName,
    origin,
    request: req,
  });

  return NextResponse.json({
    ok: true,
    sent: result.outcome === "sent",
    skipped: result.outcome === "skipped",
    failed: result.outcome === "failed",
    reason: result.reason ?? null,
    messageId: result.messageId ?? null,
  });
}
