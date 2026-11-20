import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { industryKeyFromLegacyLabel } from "@/lib/ai-catalog/industry-catalog";
import {
  isSmbOwnerSignup,
  smbCategoryLabel,
  subdomainCandidateFromCompanyName,
  withSubdomainSuffix,
} from "@/lib/signup/smb-post-signup";
import { ADMIN_LAUNCH_PAD_ROUTE } from "@/lib/signup/smb-post-signup";

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
 * SMB owners skip /your-trial and full-page tenant-onboarding.
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
      : meta.is_staffing_company === true
        ? true
        : meta.is_staffing_company === false || String(meta.tenant_category ?? "").toLowerCase() === "smb"
          ? false
          : null;

  if (!isSmbOwnerSignup({ isStaffingCompany })) {
    return NextResponse.json(
      { error: "Only SMB signups can use this provisioning path." },
      { status: 400 }
    );
  }

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

  const { data: existingProfile } = await svc
    .from("users")
    .select("tenant_id, tenant_onboarding_completed_at, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (
    existingProfile?.tenant_id &&
    (existingProfile.tenant_onboarding_completed_at || existingProfile.onboarding_completed)
  ) {
    return NextResponse.json({
      ok: true,
      alreadyProvisioned: true,
      tenantId: existingProfile.tenant_id,
      redirectTo: ADMIN_LAUNCH_PAD_ROUTE,
    });
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
        category: smbCategoryLabel({ isStaffingCompany: false }),
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
      await svc.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...(user.app_metadata ?? {}),
          tenant_onboarding_completed: true,
          signup_completed: true,
        },
      });

      return NextResponse.json({
        ok: true,
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
