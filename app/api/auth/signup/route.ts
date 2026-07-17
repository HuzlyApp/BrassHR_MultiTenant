import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  buildUsersSignupRow,
  normalizeOwnerSignupBody,
  validateOwnerSignupDetails,
  validateOwnerSignupPassword,
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

/**
 * Creates the Braas HR owner account (auth + public.users) after the signup UI.
 */
export async function POST(req: Request) {
  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const partial = normalizeOwnerSignupBody(body);
  const detailsError = validateOwnerSignupDetails(partial);
  if (detailsError) {
    return NextResponse.json({ error: detailsError }, { status: 400 });
  }

  const passwordError = validateOwnerSignupPassword(partial.password ?? "");
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const payload = partial as OwnerSignupPayload;
  payload.workEmail = normalizeTenantEmail(payload.workEmail);
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

  const zipError = validateOwnerSignupZipForState(
    payload.zipCode,
    stateCode,
    payload.state
  );
  if (zipError) {
    return NextResponse.json({ error: zipError }, { status: 400 });
  }

  const { data: list, error: listErr } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const existingAuth = list?.users?.find(
    (u) => normalizeTenantEmail(u.email || "") === payload.workEmail
  );

  const emailAvailability = await resolveOwnerSignupEmailAvailability(
    svc,
    payload.workEmail,
    { authUserIdHint: existingAuth?.id }
  );
  if (!emailAvailability.available) {
    return NextResponse.json(
      {
        error: OWNER_SIGNUP_EMAIL_TAKEN_MESSAGE,
        code: OWNER_SIGNUP_EMAIL_TAKEN_CODE,
      },
      { status: 409 }
    );
  }

  if (existingAuth?.id) {
    const userId = existingAuth.id;

    const { error: updErr } = await svc.auth.admin.updateUserById(userId, {
      password: payload.password,
      email_confirm: true,
      app_metadata: {
        platform: "nexus",
        role: "admin",
        signup_completed: true,
        tenant_onboarding_completed: false,
      },
      user_metadata: {
        first_name: payload.firstName,
        last_name: payload.lastName,
        job_title: payload.jobTitle || null,
        city: payload.city,
        state: payload.state,
        zip_code: payload.zipCode,
      },
    });
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const { error: uErr } = await svc
      .from("users")
      .upsert(buildUsersSignupRow(userId, payload, completedAt), { onConflict: "id" });

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, email: payload.workEmail });
  }

  const { data: created, error: cuErr } = await svc.auth.admin.createUser({
    email: payload.workEmail,
    password: payload.password,
    email_confirm: true,
    app_metadata: {
      platform: "nexus",
      role: "admin",
      signup_completed: true,
      tenant_onboarding_completed: false,
    },
    user_metadata: {
      first_name: payload.firstName,
      last_name: payload.lastName,
      job_title: payload.jobTitle || null,
      city: payload.city,
      state: payload.state,
      zip_code: payload.zipCode,
    },
  });

  if (cuErr || !created.user?.id) {
    const message = cuErr?.message ?? "Could not create account.";
    const status = message.toLowerCase().includes("already") ? 409 : 500;
    return NextResponse.json(
      { error: message, code: status === 409 ? "EMAIL_TAKEN" : undefined },
      { status }
    );
  }

  const userId = created.user.id;
  const { error: uErr } = await svc
    .from("users")
    .upsert(buildUsersSignupRow(userId, payload, completedAt), { onConflict: "id" });

  if (uErr) {
    await svc.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: payload.workEmail });
}
