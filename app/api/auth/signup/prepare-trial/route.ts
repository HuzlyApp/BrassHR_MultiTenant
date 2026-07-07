import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendOwnerOnboardingContinuationEmail } from "@/lib/onboarding/send-owner-onboarding-continuation-email";
import { resolvePlatformAppOrigin } from "@/lib/resolve-app-origin";
import { fetchOwnerOnboardingStatus } from "@/lib/auth/owner-onboarding-status";
import { resolveOwnerTrialPreparationUser } from "@/lib/auth/resolve-owner-trial-preparation-user";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST — after owner signup, provision trial messaging: create continuation token and send setup email.
 */
export async function POST(req: NextRequest) {
  const ctx = await resolveOwnerTrialPreparationUser(req);
  if (!ctx) {
    console.info("[signup/prepare-trial] unauthorized_no_context");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const authClient = await createClient();
  const status = ctx.user
    ? await fetchOwnerOnboardingStatus(authClient, ctx.user)
    : await fetchOwnerOnboardingStatusFromUserId(svc, ctx.userId);

  if (status.tenantOnboardingCompleted) {
    console.info("[signup/prepare-trial] skipped_onboarding_complete", { userId: ctx.userId });
    return NextResponse.json({ ok: true, skipped: true, reason: "ONBOARDING_COMPLETE" });
  }

  const origin = resolvePlatformAppOrigin(req);
  if (!origin) {
    return NextResponse.json({ error: "Could not resolve app origin" }, { status: 400 });
  }

  const { data: profile } = await svc
    .from("users")
    .select("first_name, last_name, email")
    .eq("id", ctx.userId)
    .maybeSingle();

  const firstName = profile?.first_name != null ? String(profile.first_name).trim() : "";
  const lastName = profile?.last_name != null ? String(profile.last_name).trim() : "";
  const tenantAdminName = `${firstName} ${lastName}`.trim() || "there";
  const email = (profile?.email ?? ctx.user?.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Owner email not found" }, { status: 400 });
  }

  console.info("[signup/prepare-trial] trial_preparation_start", {
    userId: ctx.userId,
    source: ctx.source,
    email,
  });

  const result = await sendOwnerOnboardingContinuationEmail(svc, {
    userId: ctx.userId,
    email,
    tenantAdminName,
    origin,
    request: req,
  });

  console.info("[signup/prepare-trial] trial_preparation_result", {
    userId: ctx.userId,
    outcome: result.outcome,
    reason: result.reason ?? null,
    messageId: result.messageId ?? null,
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

async function fetchOwnerOnboardingStatusFromUserId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string
) {
  const { parseOwnerOnboardingRow } = await import("@/lib/auth/owner-onboarding-status");
  const { data, error } = await supabase!
    .from("users")
    .select("signup_completed_at, tenant_onboarding_completed_at, onboarding_completed, god_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[signup/prepare-trial] users lookup failed", error.message);
  }

  return parseOwnerOnboardingRow(data as import("@/lib/auth/owner-onboarding-status").UsersOnboardingRow | null);
}
