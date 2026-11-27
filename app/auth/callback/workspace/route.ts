import { checkStaffSessionActivity } from "@/lib/auth/staff-session-activity";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAuthCookieOptions } from "@/lib/auth/session-cookie";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { ADMIN_LAUNCH_PAD_ROUTE } from "@/lib/signup/smb-post-signup";
import { getEffectiveRootDomain, extractTenantSubdomainLabel } from "@/lib/tenant/tenant-host-resolution";
import { createStaffSessionProof, STAFF_SESSION_PROOF_COOKIE, STAFF_SESSION_PROOF_SECONDS } from "@/lib/auth/login-otp-proof";

function redirect(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/** Redeem the owner's one-time signup sign-in on the registered tenant host. */
export async function GET(request: NextRequest) {
  const failure = () => redirect(request, "/admin?error=workspace_signin&next=" + encodeURIComponent(ADMIN_LAUNCH_PAD_ROUTE));
  const tokenHash = request.nextUrl.searchParams.get("token_hash")?.trim();
  const label = extractTenantSubdomainLabel(request.nextUrl.hostname, getEffectiveRootDomain());
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  const svc = createServiceRoleClient();
  if (!tokenHash || !label || !url || !key || !svc) return failure();

  // Cookie writes are collected on this response and returned only after membership checks.
  const response = redirect(request, ADMIN_LAUNCH_PAD_ROUTE);
  const auth = createServerClient(url, key, {
    cookieOptions: supabaseAuthCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  try {
    const { data, error } = await auth.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (error || !data.session || !data.user || data.user.is_anonymous) return failure();
    const { data: owner, error: ownerError } = await svc.from("users")
      .select("tenant_id, role, is_active").eq("id", data.user.id).maybeSingle();
    if (ownerError || owner?.role !== "admin" || !owner.tenant_id || owner.is_active === false) return failure();
    const { data: tenant, error: tenantError } = await svc.from("tenants")
      .select("subdomain, domain, is_active").eq("id", owner.tenant_id).maybeSingle();
    if (tenantError || !tenant?.is_active || tenant.subdomain !== label || tenant.domain !== request.nextUrl.hostname) return failure();
    const claims = JSON.parse(Buffer.from(data.session.access_token.split(".")[1], "base64url").toString("utf8"));
    if (claims.sub !== data.user.id || typeof claims.session_id !== "string" || !claims.session_id ||
      (data.user.factors?.some((factor) => factor.status === "verified") && claims.aal !== "aal2")) return failure();
    if (!(await checkStaffSessionActivity(data.user.id, claims.session_id, "start", data.session.access_token))) return failure();
    response.cookies.set(STAFF_SESSION_PROOF_COOKIE, createStaffSessionProof(data.user.id, claims.session_id), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: STAFF_SESSION_PROOF_SECONDS,
    });
    return response;
  } catch {
    return failure();
  }
}
