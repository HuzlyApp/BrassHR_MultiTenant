import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { authorizeOnboardingRequest } from "@/lib/onboarding/request-access";

export const runtime = "nodejs";

/**
 * Temporary staging diagnostic for public-apply 403s.
 * Returns supabase host + tenant/auth probe results. No secrets.
 */
export async function GET(req: NextRequest) {
  // Temporary staging probe — remove after the public-apply 403 is resolved.
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
  const debugEnabled =
    Boolean(bearer) ||
    process.env.ONBOARDING_ACCESS_DEBUG === "1" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NODE_ENV !== "production";
  if (!debugEnabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const host = url ? new URL(url).host : null;
  const tenantSlug =
    req.nextUrl.searchParams.get("tenant")?.trim().toLowerCase() || "testcompany";

  const out: Record<string, unknown> = {
    host,
    hasServiceRoleKey: Boolean(key),
    hasBearer: Boolean(bearer),
    tenantSlug,
  };

  if (!url || !key) {
    return NextResponse.json({ ...out, error: "missing_supabase_env" }, { status: 503 });
  }

  const svc = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const tenant = await svc
      .from("tenants")
      .select("id,slug,is_active")
      .or(`slug.eq.${tenantSlug},subdomain.eq.${tenantSlug}`)
      .eq("is_active", true)
      .maybeSingle();
    out.tenant = {
      id: tenant.data?.id ?? null,
      error: tenant.error?.message ?? null,
    };
  } catch (error) {
    out.tenant = {
      threw: true,
      detail: error instanceof Error ? error.message : "unknown",
    };
  }

  if (bearer) {
    try {
      const user = await svc.auth.getUser(bearer);
      out.user = {
        id: user.data.user?.id ?? null,
        isAnonymous: user.data.user?.is_anonymous ?? null,
        error: user.error?.message ?? null,
      };
    } catch (error) {
      out.user = {
        threw: true,
        detail: error instanceof Error ? error.message : "unknown",
      };
    }
  }

  const denied = await authorizeOnboardingRequest(req);
  if (!denied) {
    out.authorize = { ok: true };
  } else {
    const body = await denied.json().catch(() => ({}));
    out.authorize = { ok: false, status: denied.status, body };
  }

  return NextResponse.json(out);
}
