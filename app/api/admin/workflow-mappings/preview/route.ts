import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { resolveWorkflowMapping } from "@/lib/job-requisitions/resolve-workflow-mapping";
import type { EmploymentType, PlacementType } from "@/lib/job-requisitions/types";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const match = await resolveWorkflowMapping(supabase, {
    tenantId,
    jobRole: typeof body.jobRole === "string" ? body.jobRole.trim() || null : null,
    employmentType: String(body.employmentType ?? "W2") as EmploymentType,
    placementType: String(body.placementType ?? "Internal") as PlacementType,
  });

  let workflowName: string | null = null;
  if (match.workflowTemplateId) {
    const { data: flow } = await supabase
      .from("onboarding_flows")
      .select("name, status")
      .eq("id", match.workflowTemplateId)
      .maybeSingle();
    workflowName = flow?.name ?? null;
  }

  return NextResponse.json({ match, workflowName });
}
