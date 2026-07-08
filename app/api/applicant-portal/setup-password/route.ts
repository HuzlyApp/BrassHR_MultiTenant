import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  findApplicantByEmail,
  resolveTenantIdForApplicantPortal,
} from "@/lib/applicant-portal";

export const runtime = "nodejs";

async function findAuthUserByEmail(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  email: string
): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((user) => (user.email ?? "").trim().toLowerCase() === normalizedEmail);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      confirmPassword?: string;
      tenantSlug?: string | null;
    };

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    if (!email) return NextResponse.json({ error: "Enter your registered email address." }, { status: 400 });
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Password fields do not match." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const tenantId = await resolveTenantIdForApplicantPortal(supabase, body.tenantSlug);
    const applicant = await findApplicantByEmail(supabase, email, tenantId);
    if (!applicant?.id) {
      return NextResponse.json({ error: "No application was found for that email address." }, { status: 404 });
    }

    const appMetadata = {
      platform: "nexus",
      role: "worker",
      tenant_id: applicant.tenant_id,
    };
    const existingAuthUser = await findAuthUserByEmail(supabase, email);
    let authUserId = existingAuthUser?.id ?? applicant.user_id;

    if (authUserId) {
      const updatePayload: {
        password: string;
        email_confirm: boolean;
        app_metadata: typeof appMetadata;
        email?: string;
      } = {
        password,
        email_confirm: true,
        app_metadata: appMetadata,
      };
      if (!existingAuthUser?.id) updatePayload.email = email;

      const { error: authError } = await supabase.auth.admin.updateUserById(authUserId, updatePayload);
      if (authError && existingAuthUser?.id && existingAuthUser.id !== applicant.user_id) {
        console.error("[applicant-portal/setup-password] update existing auth user", authError);
      }
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    } else {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: appMetadata,
      });
      if (createError || !created.user?.id) {
        return NextResponse.json(
          { error: createError?.message ?? "Could not create applicant account." },
          { status: 400 }
        );
      }
      authUserId = created.user.id;
    }

    if (!authUserId) {
      return NextResponse.json({ error: "Could not resolve applicant auth account." }, { status: 400 });
    }

    const { error: workerUserError } = await supabase
      .from("worker")
      .update({ user_id: authUserId })
      .eq("id", applicant.id);
    if (workerUserError) throw workerUserError;

    const { error: updateError } = await supabase
      .from("worker")
      .update({ applicant_password_set_at: new Date().toISOString() })
      .eq("id", applicant.id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, dashboardPath: "/application/applicant-dashboard" });
  } catch (err) {
    console.error("[applicant-portal/setup-password]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
