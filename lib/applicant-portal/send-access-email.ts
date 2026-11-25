import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { sendCandidateEmail } from "@/lib/communication/send-candidate-email";
import { resolveApplicantEmailOrigin } from "@/lib/email/applicant-public-origin";
import { isAllowedAppOrigin } from "@/lib/resolve-app-origin";
import { isPortalRole } from "@/lib/auth/app-role";

export type PortalEmailResult = { sent: true } | { sent: false; error: string };

async function authUserByEmail(sb: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => !u.is_anonymous && u.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
}

/** Await delivery, but never turn a saved application into a failed submission. */
export async function sendApplicantPortalAccessEmail(
  sb: SupabaseClient,
  input: { tenantId: string; workerId: string; origin?: string | null },
): Promise<PortalEmailResult> {
  try {
    const origin = input.origin || process.env.NEXT_PUBLIC_APP_URL;
    if (!origin || !isAllowedAppOrigin(origin)) throw new Error("Applicant email origin is not configured.");
    const { data: tenant, error: tenantError } = await sb.from("tenants")
      .select("slug,subdomain,name").eq("id", input.tenantId).eq("is_active", true).single();
    if (tenantError) throw tenantError;
    const { data: worker, error: workerError } = await sb.from("worker")
      .select("id,email,user_id,applicant_password_set_at").eq("tenant_id", input.tenantId).eq("id", input.workerId).single();
    if (workerError) throw workerError;
    const email = worker.email?.trim().toLowerCase();
    if (!email) throw new Error("Candidate email is missing.");

    const existing = await authUserByEmail(sb, email);
    const { data: membership, error: membershipError } = existing
      ? await sb.from("user_roles").select("role,is_active")
        .eq("user_id", existing.id).eq("tenant_id", input.tenantId).maybeSingle()
      : { data: null, error: null };
    if (membershipError) throw membershipError;
    if (membership && (!membership.is_active || !isPortalRole(membership.role))) {
      throw new Error("This email has a staff or inactive tenant membership; manual account review is required.");
    }
    const role = membership?.role === "worker" ? "worker" : "candidate";
    // Auth may already exist even when this tenant has never invited this email.
    let link = await sb.auth.admin.generateLink({ type: existing ? "magiclink" : "invite", email });
    if (link.error && !existing && ["email_exists", "user_already_exists"].includes(link.error.code || "")) {
      link = await sb.auth.admin.generateLink({ type: "magiclink", email });
    }
    if (link.error) throw link.error;
    const user = link.data.user;
    const token = link.data.properties?.hashed_token;
    if (!user || !token || user.email?.toLowerCase() !== email || (existing && user.id !== existing.id)) {
      throw new Error("Could not verify the applicant email identity.");
    }

    // Link only this tenant's application records. Never replace global staff roles.
    const { error: memberInsertError } = await sb.from("user_roles").upsert({
      user_id: user.id, tenant_id: input.tenantId, role, is_active: true,
    }, { onConflict: "user_id,tenant_id", ignoreDuplicates: true });
    if (memberInsertError) throw memberInsertError;
    const { error: profileError } = await sb.from("users").upsert({
      id: user.id, tenant_id: input.tenantId, email, role, is_active: true,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (profileError) throw profileError;
    if (!user.app_metadata?.role) {
      const { error } = await sb.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, role, platform: "nexus", tenant_id: input.tenantId },
      });
      if (error) throw error;
    }
    const slug = tenant.slug || tenant.subdomain;
    const url = new URL("/candidate-access", resolveApplicantEmailOrigin(origin, tenant.subdomain || slug));
    url.searchParams.set("tenant", slug);
    // A fragment keeps the bearer token out of request logs and referrers.
    const signup = !existing?.email_confirmed_at || !worker.applicant_password_set_at;
    url.hash = new URLSearchParams({ token_hash: token,
      type: link.data.properties.verification_type === "invite" ? "invite" : "email",
      setup: signup ? "1" : "0" }).toString();
    const result = await sendCandidateEmail({
      to: email,
      subject: `${tenant.name}: ${signup ? "Set up your applicant portal" : "Sign in to your applicant portal"}`,
      body: `Your application with ${tenant.name} is available in your applicant portal.\n\n${signup ? "Set up your account" : "Sign in"} to view your applications and track their progress:\n${url.href}\n\nUse the newest email link.`,
    });
    if (!result.ok) throw new Error(result.error);
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send applicant portal email.";
    console.error("[applicant-portal/access-email]", { tenantId: input.tenantId, workerId: input.workerId, message });
    return { sent: false, error: message };
  }
}
