import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { requireSchedulingContext, schedulingError } from "@/lib/scheduling/api-context";
import { readApplicantPortalTenantSlugFromRequest } from "@/lib/applicant-portal/request";
import { resolveTenantIdBySlug } from "@/lib/tenant/resolve-tenant-id-by-slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadTenantFeatures } from "@/lib/tenant/edition-features";
import { WorkerRequestError } from "./requests-contract";

export async function requireWorkerRequestContext(request: Request, review = false, checkSchedulingFeature = true) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  if (review || auth.role !== "worker" || auth.godAdmin) {
    const staff = checkSchedulingFeature ? await requireSchedulingContext(request) : await requireSchedulingContext(request,false);
    if (staff instanceof NextResponse) return staff;
    return { ...staff, ownWorkerIds: null as string[] | null };
  }
  if (!auth.authUser || auth.authUser.is_anonymous) throw new WorkerRequestError("Unauthorized", "UNAUTHORIZED", 401);
  const supabase = createServiceRoleClient();
  if (!supabase) throw new WorkerRequestError("Service unavailable", "DATA_UNAVAILABLE", 503);
  // Identity lookup precedes tenant resolution; no client-supplied user ID is used.
  const { data: profile, error: profileError } = await supabase.from("users").select("tenant_id,is_active")
    .eq("id", auth.userId).maybeSingle();
  if (profileError) throw profileError;
  if (profile?.is_active === false) throw new WorkerRequestError("Account disabled", "FORBIDDEN", 403);
  const slug = readApplicantPortalTenantSlugFromRequest(new NextRequest(request.url, { headers: request.headers }));
  if (slug && !/^[a-z0-9-]{2,63}$/.test(slug)) throw new WorkerRequestError("Invalid tenant selection", "TENANT_REQUIRED", 403);
  const tenantId = slug ? await resolveTenantIdBySlug(supabase, slug) : profile?.tenant_id;
  if (!tenantId) throw new WorkerRequestError("Select an authorized tenant", "TENANT_REQUIRED", 403);
  const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id")
    .eq("id", tenantId).eq("is_active", true).maybeSingle();
  if (tenantError) throw tenantError;
  if (!tenant) throw new WorkerRequestError("Tenant unavailable", "TENANT_REQUIRED", 403);
  const { data: member, error: memberError } = await supabase.from("user_roles").select("is_active")
    .eq("tenant_id", tenantId).eq("user_id", auth.userId).maybeSingle();
  if (memberError) throw memberError;
  if (member?.is_active === false) throw new WorkerRequestError("Membership disabled", "FORBIDDEN", 403);
  const { data: workers, error: workerError } = await supabase.from("worker").select("id")
    .eq("tenant_id", tenantId).eq("user_id", auth.userId).order("updated_at", { ascending: false });
  if (workerError) throw workerError;
  const ownWorkerIds = (workers ?? []).map((w) => String(w.id));
  if (!ownWorkerIds.length) throw new WorkerRequestError("Worker profile not found in tenant", "FORBIDDEN", 403);
  const resolved = await loadTenantFeatures(supabase, tenantId);
  if (checkSchedulingFeature && !resolved.features.internal_scheduling && !resolved.features.manage_clients) {
    throw new WorkerRequestError("Scheduling is disabled", "FEATURE_DISABLED", 403);
  }
  return { auth, supabase, tenantId: String(tenantId), ...resolved, ownWorkerIds };
}

export function workerRequestError(error: unknown) {
  if (error instanceof WorkerRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  const code = (error as { code?: string } | null)?.code;
  if (code === "P0001") return NextResponse.json({ error: "Request already reviewed", code: "CONFLICT" }, { status: 409 });
  if (code === "42501") return NextResponse.json({ error: "Another authorized reviewer is required", code: "FORBIDDEN" }, { status: 403 });
  return schedulingError(error);
}
