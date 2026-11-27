import { checkStaffSessionActivity } from "@/lib/auth/staff-session-activity";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { sendOwnerOnboardingContinuationEmail } from "@/lib/onboarding/send-owner-onboarding-continuation-email";
import { resolvePlatformAppOrigin } from "@/lib/resolve-app-origin";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { industryKeyFromLegacyLabel } from "@/lib/ai-catalog/industry-catalog";
import {
  smbCategoryLabel,
} from "@/lib/signup/smb-post-signup";
import { ADMIN_LAUNCH_PAD_ROUTE } from "@/lib/signup/smb-post-signup";
import { buildTenantWorkspaceUrl, usesTenantQueryUrls } from "@/lib/tenant/tenant-vanity-url";
import { getEffectiveRootDomain } from "@/lib/tenant/tenant-host-resolution";
import { registerTenantDomain } from "@/lib/vercel";
import { invalidateTenantBrandingCache } from "@/lib/tenant/invalidate-tenant-branding-cache";
import { hasVerifiedStaffSession } from "@/lib/auth/staff-session-verification";
import { createStaffSessionProof, STAFF_SESSION_PROOF_COOKIE, STAFF_SESSION_PROOF_SECONDS } from "@/lib/auth/login-otp-proof";

type Body = {
  companyName?: string;
  companyWebsite?: string;
  industry?: string;
  industries?: string[];
  city?: string;
  state?: string;
  phone?: string;
  isStaffingCompany?: boolean | null;
};

/**
 * Staffing and SMB owners complete setup in Launch Pad.
 * The endpoint name is retained for compatibility with existing clients.
 * Provisions a random workspace address, then signs the owner into its Launch Pad.
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
  const createdAt = Date.parse(user.created_at);
  const newSignup = Number.isFinite(createdAt) && createdAt <= Date.now() && Date.now() - createdAt < 15 * 60 * 1000;
  // Only a fresh signup or an already verified staff session can start this handoff.
  if (!newSignup && !(await hasVerifiedStaffSession(user))) {
    return NextResponse.json({ error: "Sign in and verify your account to reopen your workspace." }, { status: 401 });
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
  const industriesFromBody = Array.isArray(body.industries)
    ? body.industries.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const industriesFromMeta = Array.isArray(meta.industries)
    ? meta.industries.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const industries =
    industriesFromBody.length > 0
      ? industriesFromBody
      : industriesFromMeta.length > 0
        ? industriesFromMeta
        : (() => {
            const primary = String(body.industry ?? meta.industry ?? "").trim();
            return primary ? [primary] : [];
          })();
  const industry = industries[0] ?? "";
  const industryKeysFromMeta = Array.isArray(meta.industry_keys)
    ? meta.industry_keys.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const industryKeys =
    industryKeysFromMeta.length > 0
      ? industryKeysFromMeta
      : industries
          .map((label) => industryKeyFromLegacyLabel(label))
          .filter((key): key is NonNullable<typeof key> => Boolean(key));
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

  const openWorkspace = async (tenantId: string, alreadyProvisioned = false) => {
    try {
      // Re-read membership after provisioning; never trust a tenant ID from the client.
      const { data: owner, error: ownerError } = await svc.from("users")
        .select("tenant_id, role").eq("id", user.id).maybeSingle();
      if (ownerError || owner?.role !== "admin" || owner.tenant_id !== tenantId) {
        return NextResponse.json({ error: "Could not verify your admin workspace." }, { status: 403 });
      }
      const { data: tenant, error: tenantError } = await svc.from("tenants")
        .select("id, slug, subdomain, is_active").eq("id", tenantId).maybeSingle();
      if (tenantError || !tenant?.subdomain || !tenant.slug || !tenant.is_active) {
        return NextResponse.json({ error: "Could not load your workspace." }, { status: 503 });
      }
      const origin = new URL(req.url).origin;
      const queryMode = usesTenantQueryUrls(new URL(origin).hostname);
      const registration = await registerTenantDomain(tenant.subdomain, { origin });
      if (!queryMode && (registration.skipped || !registration.domain.verified)) {
        return NextResponse.json({ error: "Your account is ready, but its workspace address is still being connected. Please try again." }, { status: 503 });
      }
      const { data: updated, error: updateError } = await svc.from("tenants")
        .update({ domain: queryMode ? null : `${tenant.subdomain}.${getEffectiveRootDomain()}`, updated_at: new Date().toISOString() })
        .eq("id", tenantId).select("id").maybeSingle();
      if (updateError || !updated) {
        return NextResponse.json({ error: "Could not save your workspace address. Please try again." }, { status: 503 });
      }
      await invalidateTenantBrandingCache({ tenantId, slug: tenant.slug, subdomain: tenant.subdomain });
      const workspaceUrl = buildTenantWorkspaceUrl(tenant, ADMIN_LAUNCH_PAD_ROUTE, { origin });
      let redirectTo = workspaceUrl;
      let staffProof: string | null = null;
      if (new URL(workspaceUrl).origin !== origin) {
        // One-time sign-in establishes host-only cookies on the destination tenant.
        const { data: link, error: linkError } = await svc.auth.admin.generateLink({ type: "magiclink", email: adminEmail });
        if (linkError || link?.user?.id !== user.id || !link.properties?.hashed_token) {
          return NextResponse.json({ error: "Could not prepare admin sign-in. Please try again." }, { status: 503 });
        }
        const callback = new URL("/auth/callback/workspace", workspaceUrl);
        callback.searchParams.set("token_hash", link.properties.hashed_token);
        redirectTo = callback.href;
      } else {
        // Pick up the admin and tenant claims assigned by the provisioning endpoint.
        const { data: refreshed, error: refreshError } = await auth.auth.refreshSession();
        if (refreshError || !refreshed.session) return NextResponse.json({ error: "Could not refresh your admin session. Please sign in again." }, { status: 401 });
        const claims = JSON.parse(Buffer.from(refreshed.session.access_token.split(".")[1], "base64url").toString("utf8"));
        if (claims.sub !== user.id || typeof claims.session_id !== "string" || !claims.session_id ||
          (user.factors?.some((factor) => factor.status === "verified") && claims.aal !== "aal2")) {
          return NextResponse.json({ error: "Sign in and verify your admin session." }, { status: 401 });
        }
        if (!(await checkStaffSessionActivity(user.id, claims.session_id, "start", refreshed.session.access_token))) {
          return NextResponse.json({ error: "Please sign in and verify your session again." }, { status: 401 });
        }
        staffProof = createStaffSessionProof(user.id, claims.session_id);
      }
      const email = await sendLaunchPadEmail();
      const response = NextResponse.json({ ok: true, emailOutcome: email.outcome, alreadyProvisioned, tenantId, subdomain: tenant.subdomain, workspaceUrl, redirectTo }, {
        headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
      });
      if (staffProof) response.cookies.set(STAFF_SESSION_PROOF_COOKIE, staffProof, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: STAFF_SESSION_PROOF_SECONDS,
      });
      return response;
    } catch {
      return NextResponse.json({ error: "Could not open your workspace. Please try again." }, { status: 503 });
    }
  };

  if (
    existingProfile?.tenant_id &&
    (existingProfile.tenant_onboarding_completed_at || existingProfile.onboarding_completed)
  ) {
    if (existingProfile.role !== "admin") {
      return NextResponse.json({ error: "This signup belongs to an existing staff account." }, { status: 403 });
    }
    return openWorkspace(existingProfile.tenant_id, true);
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
    const subdomain = `workspace-${randomBytes(8).toString("hex")}`;
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
        industries,
        industryKeys,
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
      if (!payload.tenantId) return NextResponse.json({ error: "Workspace setup did not return an organization." }, { status: 503 });
      return openWorkspace(payload.tenantId);
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
