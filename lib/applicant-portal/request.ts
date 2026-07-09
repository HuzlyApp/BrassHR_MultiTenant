import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  findApplicantByUserId,
  resolveTenantIdForApplicantPortal,
  type ApplicantWorkerRow,
} from "@/lib/applicant-portal";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { onboardingSlugFromRequestCookies } from "@/lib/tenant/onboarding-slug-from-cookie";
import { resolveRequestTenantHost } from "@/lib/tenant/resolve-tenant-context";

export type ApplicantPortalContext = {
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>;
  user: User;
  applicant: ApplicantWorkerRow;
};

export function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/** Tenant slug from query, cookie, or request host subdomain (e.g. jobs.brasshr.com → jobs). */
export function readApplicantPortalTenantSlugFromRequest(req: NextRequest): string | null {
  const fromQuery =
    req.nextUrl.searchParams.get("tenantSlug") ??
    req.nextUrl.searchParams.get("tenant") ??
    req.nextUrl.searchParams.get("slug");
  if (fromQuery && fromQuery.trim().length >= 2) {
    return fromQuery.trim().toLowerCase();
  }

  const fromCookie = onboardingSlugFromRequestCookies(req);
  if (fromCookie) return fromCookie;

  const { subdomainLabel } = resolveRequestTenantHost(req.headers);
  if (subdomainLabel && subdomainLabel.trim().length >= 2) {
    return subdomainLabel.trim().toLowerCase();
  }

  return null;
}

export async function resolveApplicantPortalTenantId(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  req: NextRequest
): Promise<string | null> {
  const tenantSlug = readApplicantPortalTenantSlugFromRequest(req);
  if (!tenantSlug) return null;
  return resolveTenantIdForApplicantPortal(supabase, tenantSlug);
}

export async function requireApprovedApplicant(
  req: NextRequest
): Promise<ApplicantPortalContext | NextResponse> {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await resolveApplicantPortalTenantId(supabase, req);
  const applicant = await findApplicantByUserId(supabase, data.user.id, tenantId);
  if (!applicant?.id) {
    return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  }

  return { supabase, user: data.user, applicant };
}
