import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findApplicantByEmail, resolveTenantIdForApplicantPortal } from "@/lib/applicant-portal";
import { portalHomePath } from "@/lib/auth/portal-rbac";
import { withTenant } from "@/lib/tenant/with-tenant";

const schema = z.object({
  tokenHash: z.string().min(1).max(2048),
  type: z.enum(["invite", "email"]),
  tenant: z.string().min(2).max(100),
  password: z.string().min(8).max(128).optional(),
});

/** Only an explicit POST consumes the email token; scanners may safely open the page. */
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid access link or password." }, { status: 400 });
  const input = parsed.data;
  if (input.type === "invite" && !input.password) {
    return NextResponse.json({ error: "Choose a password of at least 8 characters." }, { status: 400 });
  }
  const sb = createServiceRoleClient();
  if (!sb) return NextResponse.json({ error: "Portal unavailable." }, { status: 503 });
  const tenantId = await resolveTenantIdForApplicantPortal(sb, input.tenant);
  if (!tenantId) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  const auth = await createClient();
  const { data, error } = await auth.auth.verifyOtp({ token_hash: input.tokenHash, type: input.type });
  if (error || !data.user || !data.session) {
    return NextResponse.json({ error: "This link has expired or was already used. Use the newest email link." }, { status: 400 });
  }
  const applicant = data.user.email ? await findApplicantByEmail(sb, data.user.email, tenantId) : null;
  const { data: membership, error: memberError } = await sb.from("user_roles")
    .select("role,is_active").eq("user_id", data.user.id).eq("tenant_id", tenantId).maybeSingle();
  if (!applicant || memberError || !membership?.is_active || !["candidate", "worker"].includes(membership.role)) {
    await auth.auth.signOut({ scope: "local" });
    return NextResponse.json({ error: "This account cannot access this organization's applicant portal." }, { status: 403 });
  }
  if (input.password) {
    const { error: passwordError } = await auth.auth.updateUser({ password: input.password });
    if (passwordError) return NextResponse.json({ error: passwordError.message }, { status: 400 });
  }
  // Claim the tenant-scoped records only after the recipient proves email ownership.
  // Until then, the original anonymous onboarding session can still view its submission.
  for (const [table, patch, column] of [
    ["worker", { user_id: data.user.id }, "id"],
    ["applicant_profiles", { auth_user_id: data.user.id }, "worker_id"],
    ["job_applications", { applicant_auth_user_id: data.user.id }, "worker_id"],
  ] as const) {
    const { error: linkError } = await sb.from(table).update(patch)
      .eq("tenant_id", tenantId).eq(column, applicant.id);
    if (linkError) return NextResponse.json({ error: "Could not link your applications. Please contact support." }, { status: 500 });
  }
  const { error: profileError } = await sb.from("users").update({ email_verified: true })
    .eq("tenant_id", tenantId).eq("id", data.user.id);
  if (profileError) return NextResponse.json({ error: "Could not finish account verification." }, { status: 500 });
  if (input.password || applicant.applicant_password_set_at) {
    const { error: updateError } = await sb.from("worker")
      .update({ applicant_password_set_at: applicant.applicant_password_set_at || new Date().toISOString() })
      .eq("tenant_id", tenantId).eq("id", applicant.id).eq("user_id", data.user.id);
    if (updateError) return NextResponse.json({ error: "Could not finish account setup." }, { status: 500 });
  }
  return NextResponse.json({ redirectTo: withTenant(portalHomePath(membership.role), input.tenant) }, {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
