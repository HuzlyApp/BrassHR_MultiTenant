import "server-only";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { APPLICANT_CONTINUATION_SESSION_COOKIE } from "@/lib/tenant/constants";
import { hashContinuationToken } from "@/lib/onboarding/applicant-continuation-link";
import { isDraftPreviewApplicantId } from "@/lib/onboarding/is-draft-preview";
import { authorizeStaffHttpAccess } from "@/lib/auth/module-access.server";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { rethrowDynamicServerUsage } from "@/lib/auth/dynamic-server-usage";
import { hasVerifiedStaffSession } from "@/lib/auth/staff-session-verification";

export const APPLICANT_ACCESS_COOKIE = "brass_applicant_access";
const denied = (reason?: string) =>
  NextResponse.json({ error: "Forbidden", ...(reason ? { reason } : {}) }, { status: 403 });

/**
 * Plain service-role client (no resilient-fetch wrapper).
 * Matches working onboarding routes like /api/onboarding/config — the resilient
 * wrapper has caused opaque 403s on Vercel for REST lookups during authorize.
 */
function createOnboardingAuthClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Read a cookie from the Cookie header.
 * Avoid NextRequest.cookies — duplicated next/server copies on Vercel make
 * private #state access throw TypeError.
 */
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

/**
 * Peek at identity fields without consuming the route handler body.
 * Prefer instance clone(); never Request.prototype.clone.call(nextReq) —
 * that cross-realm call is what throws "#state" on Vercel.
 */
async function readRequestValues(request: Request): Promise<Record<string, unknown>> {
  const values: Record<string, unknown> = Object.fromEntries(new URL(request.url).searchParams);
  if (["GET", "HEAD"].includes(request.method)) return values;

  const raw = request.clone();
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    for (const [key, value] of await raw.formData()) {
      if (typeof value !== "string") continue;
      if (key in values && values[key] !== value) {
        throw Object.assign(new Error("identity_conflict"), { code: "identity_conflict" });
      }
      values[key] = value;
    }
    return values;
  }

  const body = await raw.json().catch(() => ({}));
  if (body && typeof body === "object" && !Array.isArray(body)) {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (key in values && values[key] !== value) {
        throw Object.assign(new Error("identity_conflict"), { code: "identity_conflict" });
      }
      values[key] = value;
    }
  }
  return values;
}

/** Verify identity before any legacy handler can use service-role identifiers. */
export async function authorizeOnboardingRequest(request: Request): Promise<NextResponse | null> {
  try {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (!["GET", "HEAD"].includes(request.method) && origin && origin !== url.origin) {
      return denied("origin_mismatch");
    }
    const svc = createOnboardingAuthClient();
    if (!svc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    let values: Record<string, unknown>;
    try {
      values = await readRequestValues(request);
    } catch (error) {
      if (error instanceof Error && (error as { code?: string }).code === "identity_conflict") {
        return denied("identity_conflict");
      }
      throw error;
    }
    const str = (key: string) => typeof values[key] === "string" ? String(values[key]).trim() : "";
    for (const aliases of [["applicantId", "applicant_id"], ["workerId", "worker_id"], ["applicationId", "application_id"], ["signingRequestId", "signing_request_id"], ["tenantId", "tenant_id"], ["tenantSlug", "tenant", "slug"]]) {
      if (new Set(aliases.map(str).filter(Boolean)).size > 1) return denied();
    }
    const applicantId = str("applicantId") || str("applicant_id");
    let workerId = str("workerId") || str("worker_id");
    const applicationId = str("applicationId") || str("application_id");
    const signingId = str("signingRequestId") || str("signing_request_id");
    const tenantSlug =
      str("tenantSlug") ||
      str("tenant") ||
      str("slug") ||
      readCookie(request, "onboarding_tenant_slug") ||
      "";
    let tenantId = str("tenantId") || str("tenant_id");
    if (tenantSlug) {
      if (!/^[a-z0-9-]{2,63}$/i.test(tenantSlug)) return denied();
      try {
        const { data, error } = await svc.from("tenants").select("id").or(`slug.eq.${tenantSlug},subdomain.eq.${tenantSlug}`).eq("is_active", true).maybeSingle();
        if (error || !data || (tenantId && tenantId !== data.id)) {
          return NextResponse.json(
            {
              error: "Forbidden",
              reason: "tenant_lookup",
              detail: error?.message ?? (!data ? "tenant_not_found" : "tenant_mismatch"),
            },
            { status: 403 }
          );
        }
        tenantId = data.id;
      } catch (error) {
        rethrowDynamicServerUsage(error);
        const detail = error instanceof Error ? error.message : "unknown";
        console.error("[onboarding] tenant lookup failed", detail);
        return NextResponse.json(
          { error: "Unable to verify access", reason: "tenant_lookup_throw", detail },
          { status: 403 }
        );
      }
    }
    let userId = "";
    const continuation = readCookie(request, APPLICANT_CONTINUATION_SESSION_COOKIE);
    if (continuation) {
      const { data: link, error } = await svc.from("applicant_continuation_links")
        .select("worker_id,tenant_id,applicant_user_id,expires_at,revoked_at,completed_at")
        .eq("token_hash", hashContinuationToken(continuation)).maybeSingle();
      if (error || !link || link.revoked_at || link.completed_at || Date.parse(link.expires_at) <= Date.now()) return denied();
      if ((tenantId && tenantId !== link.tenant_id) || (workerId && workerId !== link.worker_id)) return denied();
      tenantId = link.tenant_id;
      workerId = link.worker_id;
      const { data: worker } = await svc.from("worker").select("user_id").eq("id", workerId).eq("tenant_id", tenantId).maybeSingle();
      userId = worker?.user_id || "";
      if (!userId || (link.applicant_user_id && link.applicant_user_id !== userId)) return denied();
    } else {
      const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
      const token = bearer || readCookie(request, APPLICANT_ACCESS_COOKIE);
      if (token && !isDraftPreviewApplicantId(applicantId)) {
        try {
          const { data, error } = await svc.auth.getUser(token);
          if (error || !data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          userId = data.user.id;
        } catch (error) {
          rethrowDynamicServerUsage(error);
          console.error(
            "[onboarding] applicant token lookup failed",
            error instanceof Error ? error.message : "unknown"
          );
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      } else {
        // Staff preview and staff document views retain the normal permission boundary.
        let staffUser: User | null = null;
        try {
          const { data, error } = await (await createServerSupabase()).auth.getUser();
          if (!error && data.user && !data.user.is_anonymous) staffUser = data.user;
        } catch (error) {
          rethrowDynamicServerUsage(error);
          console.error(
            "[onboarding] staff session lookup failed",
            error instanceof Error ? error.message : "unknown"
          );
        }
        if (!staffUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        try {
          if (!(await hasVerifiedStaffSession(staffUser))) return denied();
          const decision = await authorizeStaffHttpAccess({ user: staffUser, pathname: isDraftPreviewApplicantId(applicantId) ? "/api/admin/onboarding" : "/api/admin/candidates", method: request.method, tenantSlug });
          if (!decision.ok) return denied();
          const { data: profile } = await svc.from("users").select("god_admin").eq("id", staffUser.id).maybeSingle();
          const staffTenant = await resolveEffectiveAdminTenantId(svc, { userId: staffUser.id, authUser: staffUser, godAdmin: isGodAdminUser(staffUser) || profile?.god_admin === true });
          if (!staffTenant || (tenantId && tenantId !== staffTenant)) return denied();
          tenantId = staffTenant;
        } catch (error) {
          rethrowDynamicServerUsage(error);
          console.error(
            "[onboarding] staff access check failed",
            error instanceof Error ? error.message : "unknown"
          );
          return denied();
        }
        if (isDraftPreviewApplicantId(applicantId)) return null;
        if (applicantId) {
          const { data: worker } = await svc.from("worker").select("id,user_id").eq("user_id", applicantId).eq("tenant_id", tenantId).maybeSingle();
          if (!worker) return denied();
          userId = worker.user_id;
          if (workerId && workerId !== worker.id) return denied();
          workerId = worker.id;
        } else if (workerId) {
          const { data: worker } = await svc.from("worker").select("user_id").eq("id", workerId).eq("tenant_id", tenantId).maybeSingle();
          if (!worker) return denied();
          userId = worker.user_id;
        }
      }
    }
    if (applicantId && applicantId !== userId) return denied();
    if (!applicantId && !workerId && !applicationId && !signingId && url.pathname !== "/api/onboarding/worker-references") return denied();
    if (workerId) {
      let query = svc.from("worker").select("id,tenant_id").eq("id", workerId).eq("user_id", userId);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data } = await query.maybeSingle();
      if (!data) return denied();
      tenantId = data.tenant_id;
    }
    if (applicationId) {
      let query = svc.from("job_applications").select("worker_id,tenant_id,applicant_auth_user_id").eq("id", applicationId);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data } = await query.maybeSingle();
      if (!data || (workerId && data.worker_id !== workerId)) return denied();
      if (data.worker_id) {
        const { data: worker } = await svc.from("worker").select("id").eq("id", data.worker_id).eq("tenant_id", data.tenant_id).eq("user_id", userId).maybeSingle();
        if (!worker) return denied();
        workerId = worker.id;
      } else if (!userId || data.applicant_auth_user_id !== userId) return denied();
      tenantId = data.tenant_id;
    }
    if (signingId) {
      let query = svc.from("worker_firma_signing_sessions").select("worker_id,tenant_id").eq("signing_request_id", signingId);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data } = await query.maybeSingle();
      if (!data || (workerId && workerId !== data.worker_id)) return denied();
      const { data: worker } = await svc.from("worker").select("id").eq("id", data.worker_id).eq("tenant_id", data.tenant_id).eq("user_id", userId).maybeSingle();
      if (!worker) return denied();
    }
    return null;
  } catch (error) {
    rethrowDynamicServerUsage(error);
    const detail = error instanceof Error ? error.message : "unknown";
    console.error("[onboarding] access verification failed", detail);
    return NextResponse.json(
      {
        error: "Unable to verify access",
        // Temporary diagnostic for staging 403s — remove once root cause is confirmed.
        detail,
        name: error instanceof Error ? error.name : typeof error,
      },
      { status: 403 }
    );
  }
}
