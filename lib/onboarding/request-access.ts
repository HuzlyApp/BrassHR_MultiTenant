import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { APPLICANT_CONTINUATION_SESSION_COOKIE } from "@/lib/tenant/constants";
import { hashContinuationToken } from "@/lib/onboarding/applicant-continuation-link";
import { isDraftPreviewApplicantId } from "@/lib/onboarding/is-draft-preview";
import { authorizeStaffHttpAccess } from "@/lib/auth/module-access.server";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { hasVerifiedStaffSession } from "@/lib/auth/staff-session-verification";

export const APPLICANT_ACCESS_COOKIE = "brass_applicant_access";
const denied = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

/** Verify identity before any legacy handler can use service-role identifiers. */
export async function authorizeOnboardingRequest(request: Request): Promise<NextResponse | null> {
  try {
    const req = request instanceof NextRequest ? request : new NextRequest(request);
    const url = new URL(req.url);
    const origin = req.headers.get("origin");
    if (!["GET", "HEAD"].includes(req.method) && origin && origin !== url.origin) return denied();
    const svc = createServiceRoleClient();
    if (!svc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    const values: Record<string, unknown> = Object.fromEntries(url.searchParams);
    if (!["GET", "HEAD"].includes(req.method)) {
      const copy = req.clone();
      if (req.headers.get("content-type")?.includes("multipart/form-data")) {
        for (const [key, value] of await copy.formData()) if (typeof value === "string") {
          if (key in values && values[key] !== value) return denied();
          values[key] = value;
        }
      } else {
        const body = await copy.json().catch(() => ({}));
        for (const [key, value] of Object.entries(body)) {
          if (key in values && values[key] !== value) return denied();
          values[key] = value;
        }
      }
    }
    const str = (key: string) => typeof values[key] === "string" ? String(values[key]).trim() : "";
    for (const aliases of [["applicantId", "applicant_id"], ["workerId", "worker_id"], ["applicationId", "application_id"], ["signingRequestId", "signing_request_id"], ["tenantId", "tenant_id"], ["tenantSlug", "tenant", "slug"]]) {
      if (new Set(aliases.map(str).filter(Boolean)).size > 1) return denied();
    }
    const applicantId = str("applicantId") || str("applicant_id");
    let workerId = str("workerId") || str("worker_id");
    const applicationId = str("applicationId") || str("application_id");
    const signingId = str("signingRequestId") || str("signing_request_id");
    const tenantSlug = str("tenantSlug") || str("tenant") || str("slug") || req.cookies.get("onboarding_tenant_slug")?.value || "";
    let tenantId = str("tenantId") || str("tenant_id");
    if (tenantSlug) {
      if (!/^[a-z0-9-]{2,63}$/i.test(tenantSlug)) return denied();
      const { data, error } = await svc.from("tenants").select("id").or(`slug.eq.${tenantSlug},subdomain.eq.${tenantSlug}`).eq("is_active", true).maybeSingle();
      if (error || !data || (tenantId && tenantId !== data.id)) return denied();
      tenantId = data.id;
    }
    let userId = "";
    const continuation = req.cookies.get(APPLICANT_CONTINUATION_SESSION_COOKIE)?.value;
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
      const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
      const token = bearer || req.cookies.get(APPLICANT_ACCESS_COOKIE)?.value;
      if (token && !isDraftPreviewApplicantId(applicantId)) {
        const { data, error } = await svc.auth.getUser(token);
        if (error || !data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        userId = data.user.id;
      } else {
        // Staff preview and staff document views retain the normal permission boundary.
        const { data, error } = await (await createClient()).auth.getUser();
        if (error || !data.user || data.user.is_anonymous) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!(await hasVerifiedStaffSession(data.user))) return denied();
        const decision = await authorizeStaffHttpAccess({ user: data.user, pathname: isDraftPreviewApplicantId(applicantId) ? "/api/admin/onboarding" : "/api/admin/candidates", method: req.method, tenantSlug });
        if (!decision.ok) return denied();
        const { data: profile } = await svc.from("users").select("god_admin").eq("id", data.user.id).maybeSingle();
        const staffTenant = await resolveEffectiveAdminTenantId(svc, { userId: data.user.id, authUser: data.user, godAdmin: isGodAdminUser(data.user) || profile?.god_admin === true });
        if (!staffTenant || (tenantId && tenantId !== staffTenant)) return denied();
        tenantId = staffTenant;
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
  } catch {
    return NextResponse.json({ error: "Unable to verify access" }, { status: 403 });
  }
}
