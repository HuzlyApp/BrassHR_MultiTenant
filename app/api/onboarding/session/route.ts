import { checkInitialApplicationSession } from "@/lib/onboarding/initial-application-session";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { APPLICANT_ACCESS_COOKIE } from "@/lib/onboarding/request-access";

/** Bridge the isolated applicant client to HTTP-only same-origin API requests. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceRoleClient();
  if (!svc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (data.user.is_anonymous) {
    const previousToken = req.cookies.get(APPLICANT_ACCESS_COOKIE)?.value;
    if (previousToken && previousToken !== token) {
      const previous = await svc.auth.getUser(previousToken);
      if (previous.error || !previous.data.user) {
        return NextResponse.json({ error: "Create an account or sign in to continue. Start a new application only if you are a different person.", reason: "sign_in_required" }, { status: 401 });
      }
      if (previous.data.user?.is_anonymous && previous.data.user.id !== data.user.id) {
        const { error: revokeError } = await svc.from("initial_application_sessions").update({ expires_at: new Date().toISOString() }).eq("user_id", previous.data.user.id);
        if (revokeError) return NextResponse.json({ error: "Unable to verify applicant access." }, { status: 503 });
        await svc.auth.admin.signOut(previousToken, "local");
        return NextResponse.json({ error: "Create an account or sign in to continue. Start a new application only if you are a different person.", reason: "sign_in_required" }, { status: 401 });
      }
    }
    const body = await req.json().catch(() => ({}));
    const slug = typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : "";
    let tenantId: string | null = null;
    if (slug) {
      if (!/^[a-z0-9-]{2,63}$/.test(slug)) return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
      const { data: tenant, error } = await svc.from("tenants").select("id").or(`slug.eq.${slug},subdomain.eq.${slug}`).eq("is_active", true).maybeSingle();
      if (error || !tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
      tenantId = tenant.id;
    }
    const jobToken = typeof body.jobToken === "string" ? body.jobToken.trim() : null;
    if (!(await checkInitialApplicationSession(svc, data.user, token, tenantId, jobToken, Boolean(slug)))) {
      return NextResponse.json({ error: "Create an account or sign in to continue or apply again.", reason: "sign_in_required" }, { status: 401 });
    }
  }
  const res = NextResponse.json({ ok: true });
  const secure = new URL(req.url).protocol === "https:" || process.env.NODE_ENV === "production";
  res.cookies.set(APPLICANT_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    // Keep cookie aligned with a full onboarding session (was 1h and caused upload 403s).
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

/** Explicitly start as a different person; never sign out the staff cookie session. */
export async function DELETE(req: NextRequest) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const token = req.cookies.get(APPLICANT_ACCESS_COOKIE)?.value;
  const svc = createServiceRoleClient();
  if (!svc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  if (token) {
    const { data, error } = await svc.auth.getUser(token);
    if (!error && data.user?.is_anonymous) {
      const { error: revokeError } = await svc.from("initial_application_sessions").update({ expires_at: new Date().toISOString() }).eq("user_id", data.user.id);
      if (revokeError) return NextResponse.json({ error: "Could not end the previous application session." }, { status: 503 });
      await svc.auth.admin.signOut(token, "local");
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(APPLICANT_ACCESS_COOKIE);
  return res;
}
