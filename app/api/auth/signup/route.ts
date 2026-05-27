import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type SignupBody = {
  firstName?: string;
  lastName?: string;
  workEmail?: string;
  jobTitle?: string;
  password?: string;
};

/**
 * Creates the Braas HR owner account (auth + public.users) after the signup UI.
 */
export async function POST(req: Request) {
  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let body: SignupBody = {};
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.workEmail ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();

  if (!email.includes("@")) {
    return NextResponse.json({ error: "A valid work email is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  }

  const { data: list, error: listErr } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
  if (existing?.id) {
    const { data: profile } = await svc
      .from("users")
      .select("signup_completed_at")
      .eq("id", existing.id)
      .maybeSingle();

    if (profile?.signup_completed_at) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead.", code: "EMAIL_TAKEN" },
        { status: 409 }
      );
    }

    const { error: updErr } = await svc.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: {
        platform: "nexus",
        role: "admin",
        signup_completed: true,
        tenant_onboarding_completed: false,
      },
    });
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const { error: uErr } = await svc.from("users").upsert(
      {
        id: existing.id,
        email,
        role: "admin",
        email_verified: true,
        signup_completed_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, email });
  }

  const { data: created, error: cuErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      platform: "nexus",
      role: "admin",
      signup_completed: true,
      tenant_onboarding_completed: false,
    },
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      job_title: String(body.jobTitle ?? "").trim() || null,
    },
  });

  if (cuErr || !created.user?.id) {
    const message = cuErr?.message ?? "Could not create account.";
    const status = message.toLowerCase().includes("already") ? 409 : 500;
    return NextResponse.json({ error: message, code: status === 409 ? "EMAIL_TAKEN" : undefined }, { status });
  }

  const userId = created.user.id;
  const { error: uErr } = await svc.from("users").upsert(
    {
      id: userId,
      email,
      role: "admin",
      email_verified: true,
      signup_completed_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (uErr) {
    await svc.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email });
}
