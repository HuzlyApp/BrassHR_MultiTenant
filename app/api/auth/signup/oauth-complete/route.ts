import { NextResponse } from "next/server";
import { userHasGoogleIdentity } from "@/lib/auth/oauth";
import {
  buildOwnerSignupUserMetadata,
  buildUsersSignupRow,
  normalizeOwnerSignupBody,
  validateOwnerSignupDetails,
  validateOwnerSignupZipForState,
  type OwnerSignupPayload,
} from "@/lib/signup/owner-signup";
import {
  OWNER_SIGNUP_EMAIL_TAKEN_CODE,
  OWNER_SIGNUP_EMAIL_TAKEN_MESSAGE,
  normalizeTenantEmail,
  resolveOwnerSignupEmailAvailability,
} from "@/lib/tenant/tenant-email-uniqueness";
import { getStateCodeFromName } from "@/lib/us-state-names";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Completes tenant-owner signup for an already-authenticated Google user (no password).
 */
export async function POST(req: Request) {
  try {
    return await completeOAuthOwnerSignup(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create account.";
    console.error("[signup/oauth-complete]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function completeOAuthOwnerSignup(req: Request) {
  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.id || user.is_anonymous || !user.email) {
    return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401 });
  }
  if (!userHasGoogleIdentity(user)) {
    return NextResponse.json({ error: "Google sign-in required." }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionEmail = normalizeTenantEmail(user.email);
  const partial = normalizeOwnerSignupBody({
    ...body,
    workEmail: sessionEmail,
    password: "oauth-no-password",
  });
  const detailsError = validateOwnerSignupDetails(partial);
  if (detailsError) {
    return NextResponse.json({ error: detailsError }, { status: 400 });
  }

  const payload = {
    ...(partial as OwnerSignupPayload),
    workEmail: sessionEmail,
    password: "",
  };
  const completedAt = new Date().toISOString();

  const { data: stateRow, error: stateErr } = await svc
    .from("signup_us_states")
    .select("code")
    .eq("name", payload.state)
    .maybeSingle();

  if (stateErr) {
    return NextResponse.json({ error: stateErr.message }, { status: 500 });
  }
  const stateCode = stateRow?.code
    ? String(stateRow.code)
    : getStateCodeFromName(payload.state);
  if (!stateCode) {
    return NextResponse.json({ error: "Please select a valid state." }, { status: 400 });
  }

  if (payload.zipCode) {
    const zipError = validateOwnerSignupZipForState(
      payload.zipCode,
      stateCode,
      payload.state
    );
    if (zipError) {
      return NextResponse.json({ error: zipError }, { status: 400 });
    }
  }

  const emailAvailability = await resolveOwnerSignupEmailAvailability(svc, payload.workEmail, {
    authUserIdHint: user.id,
  });
  if (!emailAvailability.available) {
    return NextResponse.json(
      {
        error: OWNER_SIGNUP_EMAIL_TAKEN_MESSAGE,
        code: OWNER_SIGNUP_EMAIL_TAKEN_CODE,
      },
      { status: 409 }
    );
  }

  const { error: updErr } = await svc.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    app_metadata: {
      platform: "nexus",
      role: "admin",
      signup_completed: true,
      tenant_onboarding_completed: false,
    },
    user_metadata: buildOwnerSignupUserMetadata(payload),
  });
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const { error: uErr } = await svc
    .from("users")
    .upsert(buildUsersSignupRow(user.id, payload, completedAt), { onConflict: "id" });

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  const waitlist = await evaluateAndMarkSignupWaitlist(svc, user.id, payload);
  return NextResponse.json({ ok: true, email: payload.workEmail, ...waitlist });
}

async function evaluateAndMarkSignupWaitlist(
  svc: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  payload: OwnerSignupPayload
) {
  const { evaluateSignupPrimaryLocation } = await import("@/lib/service-area/signup");
  const { ACCOUNT_ACCESS_WAITLIST } = await import("@/lib/service-area/types");
  const result = await evaluateSignupPrimaryLocation(svc, {
    city: payload.primaryCity || payload.city,
    state: payload.primaryState || payload.state,
    postalCode: payload.zipCode,
    hqState: payload.hqState || payload.state,
    email: payload.workEmail,
  });
  const waitlisted = result.accountAccess === ACCOUNT_ACCESS_WAITLIST;
  await svc
    .from("users")
    .update({
      signup_waitlist_pending: waitlisted,
      hq_state: payload.hqState || payload.state,
      primary_city: payload.primaryCity || payload.city,
      primary_state: payload.primaryState || payload.state,
      primary_postal_code: payload.zipCode,
    })
    .eq("id", userId);
  return {
    waitlisted,
    hqInHold: result.hqInHold,
    messageKey: waitlisted ? result.decision.messageKey : null,
  };
}
