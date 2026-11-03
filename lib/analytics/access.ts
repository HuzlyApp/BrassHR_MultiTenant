import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AnalyticsAccessContext = {
  authUser: { id: string; email?: string | null };
  tenantId: string;
  supabase: SupabaseClient;
  role: string;
  canViewAllEmployees: boolean;
  canConfigureKpis: boolean;
  canExport: boolean;
};

/**
 * Gate for /api/admin/reports/* — staff session + scoped tenant.
 * Fine-grained page/API grants are also enforced by authorizeStaffHttpAccess via permission catalog.
 */
export async function requireTeamProductivityAccess(): Promise<
  AnalyticsAccessContext | NextResponse
> {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const scope = await resolveStaffTenantScope(auth.authUser);
  if (scope.mode !== "scoped") {
    return NextResponse.json(
      { error: "Select a tenant before viewing Team Productivity analytics." },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const role = String(auth.role ?? "").trim().toLowerCase();
  const isAdmin = role === "admin" || Boolean(auth.godAdmin);
  const isManager = role === "manager" || role === "hr" || isAdmin;
  const canViewAllEmployees =
    isManager || role === "recruiter" || role === "client" || role === "finance" || role === "support";
  const canConfigureKpis = isAdmin;
  const canExport = canViewAllEmployees;

  return {
    authUser: { id: auth.authUser.id, email: auth.authUser.email },
    tenantId: scope.tenantId,
    supabase,
    role,
    canViewAllEmployees,
    canConfigureKpis,
    canExport,
  };
}

export async function writeAnalyticsAudit(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    actorUserId: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("analytics_audit_logs").insert({
    tenant_id: input.tenantId,
    actor_user_id: input.actorUserId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    metadata: input.metadata ?? {},
  });
}
