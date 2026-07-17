import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { EMPLOYMENT_TYPES, PLACEMENT_TYPES, SOURCE_TYPES } from "@/lib/jobs/types";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const [professions, specialties, workflows] = await Promise.all([
      supabase
        .from("professions")
        .select("id, name, code")
        .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("specialties")
        .select("id, profession_id, name, code")
        .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("onboarding_flows")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("status", "published")
        .order("name"),
    ]);
    const error = professions.error ?? specialties.error ?? workflows.error;
    if (error) throw error;

    return NextResponse.json({
      professions: professions.data ?? [],
      specialties: specialties.data ?? [],
      workflows: auth.role === "admin" || auth.godAdmin ? workflows.data ?? [] : [],
      employmentTypes: EMPLOYMENT_TYPES,
      placementTypes: PLACEMENT_TYPES,
      sourceTypes: SOURCE_TYPES,
      canManageWorkflows: auth.role === "admin" || auth.godAdmin,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load job options" },
      { status: 500 }
    );
  }
}
