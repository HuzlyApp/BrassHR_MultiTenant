import { NextRequest, NextResponse } from "next/server";
import { fetchOwnerOnboardingStatus } from "@/lib/auth/owner-onboarding-status";
import { resolveOwnerTrialPreparationUser } from "@/lib/auth/resolve-owner-trial-preparation-user";
import { setOwnerTrialPreparationCookie } from "@/lib/auth/owner-trial-preparation-session.server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST — mint the short-lived trial preparation cookie after owner signup.
 */
export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user?.id || !user.email) {
    const cookieUserId = (
      await import("@/lib/auth/owner-trial-preparation-session.server")
    ).readOwnerTrialPreparationUserId(req);
    if (cookieUserId) {
      console.info("[signup/begin-trial-session] already_has_trial_prep_cookie", {
        userId: cookieUserId,
      });
      return NextResponse.json({ ok: true, source: "trial_preparation_cookie" });
    }

    console.info("[signup/begin-trial-session] unauthorized_no_session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await fetchOwnerOnboardingStatus(authClient, user);
  if (!status.signupCompleted) {
    console.info("[signup/begin-trial-session] signup_not_completed", { userId: user.id });
    return NextResponse.json({ error: "Signup is not complete." }, { status: 400 });
  }

  if (status.tenantOnboardingCompleted) {
    console.info("[signup/begin-trial-session] onboarding_already_complete", { userId: user.id });
    return NextResponse.json({ ok: true, skipped: true, reason: "ONBOARDING_COMPLETE" });
  }

  console.info("[signup/begin-trial-session] trial_preparation_started", { userId: user.id });
  const res = NextResponse.json({ ok: true, source: "auth_session" });
  setOwnerTrialPreparationCookie(res, user.id);
  return res;
}
