import "server-only";
import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { LAUNCH_PAD_STEP_IDS, type LaunchPadStepId } from "@/app/admin_recruiter/launch-pad/constants";

export async function requireLaunchPadContext(request?: Request, options?: { allowStaffRead?: boolean }) {
  const auth = await requireStaffApiSession(request);
  if (auth instanceof NextResponse) return auth;
  if (!options?.allowStaffRead && !auth.godAdmin && auth.role !== "admin") {
    return NextResponse.json({ error: "Tenant admin access is required." }, { status: 403 });
  }
  const sb = createServiceRoleClient();
  if (!sb) return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  const tenantId = await resolveEffectiveAdminTenantId(sb, auth);
  if (!tenantId) return NextResponse.json({ error: "No organization selected." }, { status: 403 });
  const { data: tenant, error } = await sb.from("tenants")
    .select("id, slug, subdomain, domain").eq("id", tenantId).maybeSingle();
  if (error || !tenant) {
    return NextResponse.json({ error: "Could not load your organization." }, { status: 500 });
  }
  return { sb, tenantId, tenant, auth };
}

type LaunchPadContext = Exclude<Awaited<ReturnType<typeof requireLaunchPadContext>>, NextResponse>;

export async function loadLaunchPadProgress(ctx: LaunchPadContext) {
  const { data, error } = await ctx.sb.from("tenant_launch_pad_steps")
    .select("step_id").eq("tenant_id", ctx.tenantId);
  if (error) throw new Error("Could not load Launch Pad progress. Please try again.");
  const completed = new Set((data ?? []).map((row: { step_id: string }) => row.step_id));
  return Object.fromEntries(LAUNCH_PAD_STEP_IDS.map((id) => [id, completed.has(id)])) as Record<LaunchPadStepId, boolean>;
}

export async function saveLaunchPadStep(ctx: LaunchPadContext, stepId: LaunchPadStepId) {
  const { error } = await ctx.sb.from("tenant_launch_pad_steps").upsert({
    tenant_id: ctx.tenantId,
    step_id: stepId,
  }, { onConflict: "tenant_id,step_id", ignoreDuplicates: true });
  if (error) throw new Error("Could not save Launch Pad progress. Please try again.");
}
