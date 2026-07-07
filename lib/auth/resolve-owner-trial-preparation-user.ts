import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { readOwnerTrialPreparationUserId } from "@/lib/auth/owner-trial-preparation-session.server";

export type ResolvedOwnerTrialPreparationUser = {
  userId: string;
  source: "auth_session" | "trial_preparation_cookie";
  user?: User;
};

export async function resolveOwnerTrialPreparationUser(
  req: NextRequest
): Promise<ResolvedOwnerTrialPreparationUser | null> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (user?.id && user.email) {
    return { userId: user.id, source: "auth_session", user };
  }

  const userId = readOwnerTrialPreparationUserId(req);
  if (userId) {
    return { userId, source: "trial_preparation_cookie" };
  }

  return null;
}

export async function loadOwnerTrialPreparationStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<import("@/lib/auth/owner-trial-preparation-types").OwnerTrialPreparationStatus> {
  const { hasOwnerSignupContinuationBeenSent } = await import(
    "@/lib/onboarding/owner-onboarding-continuation-link"
  );

  const { data: profile, error } = await supabase
    .from("users")
    .select("tenant_onboarding_completed_at, onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[owner-trial-preparation] users lookup failed", error.message);
  }

  const tenantOnboardingCompleted =
    Boolean(profile?.tenant_onboarding_completed_at) || profile?.onboarding_completed === true;

  if (tenantOnboardingCompleted) {
    return {
      phase: "onboarding_complete",
      emailSent: true,
      tenantOnboardingCompleted: true,
      continuationReason: null,
    };
  }

  const { data: continuation } = await supabase
    .from("owner_onboarding_continuation_links")
    .select("reason, sent_at")
    .eq("user_id", userId)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const emailSent = await hasOwnerSignupContinuationBeenSent(supabase, userId);

  if (emailSent || continuation?.sent_at) {
    return {
      phase: "email_sent",
      emailSent: true,
      tenantOnboardingCompleted: false,
      continuationReason: continuation?.reason ? String(continuation.reason) : "signup_continuation",
    };
  }

  return {
    phase: "preparing",
    emailSent: false,
    tenantOnboardingCompleted: false,
    continuationReason: null,
  };
}
