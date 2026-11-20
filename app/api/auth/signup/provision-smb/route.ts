import { NextResponse } from "next/server";
import { sendOwnerOnboardingContinuationEmail } from "@/lib/onboarding/send-owner-onboarding-continuation-email";
import { resolvePlatformAppOrigin } from "@/lib/resolve-app-origin";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  smbCategoryLabel,
  subdomainCandidateFromCompanyName,
  withSubdomainSuffix,
} from "@/lib/signup/smb-post-signup";
import { ADMIN_LAUNCH_PAD_ROUTE } from "@/lib/signup/smb-post-signup";

type Body = {
  companyName?: string;
  companyWebsite?: string;
  industry?: string;
  city?: string;
  state?: string;
  phone?: string;
  isStaffingCompany?: boolean | null;
};

/**
 * Staffing and SMB owners complete setup in Launch Pad.
 * The endpoint name is retained for compatibility with existing clients.
 * Provisions a tenant from signup details, then the client lands on Launch Pad.
 */
export async function POST(req: Request) {
  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.id || user.is_anonymous) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const isStaffingCompany =
    typeof body.isStaffingCompany === "boolean"
      ? body.isStaffingCompany
      : meta.is_staffing_company === true || meta.is_staffing_company === "true" || String(meta.tenant_category ?? "").toLowerCase() === "staffing"
        ? true
        : meta.is_staffing_company === false || meta.is_staffing_company === "false" || String(meta.tenant_category ?? "").toLowerCase() === "smb"
          ? false
          : null;

  const companyName =
    String(body.companyName ?? meta.company_name ?? "").trim() ||
    String(meta.first_name ?? "Company").trim();
  const industry = String(body.industry ?? meta.industry ?? "").trim();
  const city = String(body.city ?? meta.city ?? "").trim();
  const state = String(body.state ?? meta.state ?? "").trim();
  const phone = String(body.phone ?? meta.phone ?? "").trim();
  const adminEmail = user.email?.trim().toLowerCase() ?? "";

  if (!adminEmail.includes("@")) {
    return NextResponse.json({ error: "Account email is required." }, { status: 400 });
  }

  const { data: existingProfile, error: profileError } = await svc
    .from("users")
    .select("tenant_id, tenant_onboarding_completed_at, onboarding_completed, signup_waitlist_pending, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "Could not load your workspace status." }, { status: 500 });
  }

  if (existingProfile?.signup_waitlist_pending) {
    return NextResponse.json({ error: "Your account is on the waitlist.", code: "WAITLIST_PENDING" }, { status: 403 });
  }

  const sendLaunchPadEmail = () => sendOwnerOnboardingContinuationEmail(svc, {
    userId: user.id,
    email: adminEmail,
    tenantAdminName: [meta.first_name, meta.last_name].filter(Boolean).join(" ") || companyName,
    origin: resolvePlatformAppOrigin(req) ?? new URL(req.url).origin,
    request: req,
  });

  if (
    existingProfile?.tenant_id &&
    (existingProfile.tenant_onboarding_completed_at || existingProfile.onboarding_completed)
  ) {
    if (existingProfile.role !== "admin") {
      return NextResponse.json({ error: "This signup belongs to an existing staff account." }, { status: 403 });
    }
    const email = await sendLaunchPadEmail();
    return NextResponse.json({
      ok: true,
      emailOutcome: email.outcome,
      alreadyProvisioned: true,
      tenantId: existingProfile.tenant_id,
      redirectTo: ADMIN_LAUNCH_PAD_ROUTE,
    });
  }

  if (isStaffingCompany === null) {
    return NextResponse.json(
      { error: "Select whether your company is a staffing company." },
      { status: 400 }
    );
  }

  const origin = new URL(req.url).origin;
  const cookie = req.headers.get("cookie") ?? "";
  let lastError = "Could not provision your workspace.";

  for (let attempt = 0; attempt < 6; attempt++) {
    const subdomain = withSubdomainSuffix(subdomainCandidateFromCompanyName(companyName), attempt);
    const completeRes = await fetch(`${origin}/api/tenant-onboarding/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        organizationName: companyName,
        subdomain,
        adminEmail,
        industry,
        city,
        state,
        phone,
        email: adminEmail,
        address: "",
        zipCode: "",
        companySize: "",
        businessInfoSkipped: true,
        category: smbCategoryLabel({ isStaffingCompany }),
        primaryColor: "#BC8B41",
        secondaryColor: "#012352",
        accentColor: "#E9B771",
      }),
    });

    const payload = (await completeRes.json().catch(() => ({}))) as {
      error?: string;
      tenantId?: string;
      code?: string;
    };

    if (completeRes.ok) {
      // The complete endpoint binds this identity as tenant admin without changing its password.
      const email = await sendLaunchPadEmail();

      return NextResponse.json({
        ok: true,
        emailOutcome: email.outcome,
        tenantId: payload.tenantId ?? null,
        subdomain,
        redirectTo: ADMIN_LAUNCH_PAD_ROUTE,
      });
    }

    lastError = payload.error ?? lastError;
    const taken =
      completeRes.status === 409 ||
      /already taken|already exists|subdomain/i.test(String(payload.error ?? ""));
    if (!taken) {
      return NextResponse.json({ error: lastError }, { status: completeRes.status || 500 });
    }
  }

  return NextResponse.json({ error: lastError }, { status: 409 });
}
