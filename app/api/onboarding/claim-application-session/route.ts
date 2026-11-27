import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { authorizeOnboardingRequest, APPLICANT_ACCESS_COOKIE } from "@/lib/onboarding/request-access";
import { candidateSignInHref } from "@/lib/auth/worker-sign-in";
import {
  checkApplicationSessionOwnership,
} from "@/lib/onboarding/verify-application-session";

export const runtime = "nodejs";

type Body = {
  applicationId?: string;
  jobToken?: string;
  tenantSlug?: string;
};

function readCookie(request: Request, name: string): string {
  const header = request.headers.get("cookie");
  if (!header) return "";
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    return trimmed.slice(eq + 1);
  }
  return "";
}

export async function POST(req: NextRequest) {
  const denied = await authorizeOnboardingRequest(req);
  if (denied) return denied;
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Forbidden", reason: "origin_mismatch" }, { status: 403 });
  }

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const token = bearer || readCookie(req, APPLICANT_ACCESS_COOKIE);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUserId = authData.user.id;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const applicationId =
    typeof body.applicationId === "string" ? body.applicationId.trim() : "";
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const jobToken = typeof body.jobToken === "string" ? body.jobToken.trim() : "";
  const tenantSlug =
    (typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : "") ||
    readCookie(req, "onboarding_tenant_slug") ||
    "";

  let tenantId: string | null = null;
  if (tenantSlug) {
    if (!/^[a-z0-9-]{2,63}$/i.test(tenantSlug)) {
      return NextResponse.json({ error: "Forbidden", reason: "tenant_lookup" }, { status: 403 });
    }
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .or(`slug.eq.${tenantSlug},subdomain.eq.${tenantSlug}`)
      .eq("is_active", true)
      .maybeSingle();
    if (tenantError || !tenant?.id) {
      return NextResponse.json({ error: "Forbidden", reason: "tenant_lookup" }, { status: 403 });
    }
    tenantId = tenant.id;
  }

  try {
    const check = await checkApplicationSessionOwnership(supabase, {
      applicationId,
      authUserId,
      tenantId,
      jobToken: jobToken || null,
    });

    if (!check) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (check.owned) {
      return NextResponse.json({ ok: true, owned: true, claimed: false });
    }

    return NextResponse.json(
      {
        error: "Forbidden",
        reason: "application_ownership",
        ownerEmail: check.ownerEmail,
        ownerIsAnonymous: check.ownerIsAnonymous,
        signInHref: candidateSignInHref({ tenant: tenantSlug || null }),
        message:
          "This application was started in a different browser session. Sign in with the email used on your application to continue.",
      },
      { status: 403 }
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    console.error("[onboarding] claim-application-session failed", detail);
    return NextResponse.json(
      { error: "Unable to verify application session", detail },
      { status: 500 }
    );
  }
}
