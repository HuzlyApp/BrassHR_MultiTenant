import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { EMPLOYMENT_TYPES, PLACEMENT_TYPES } from "@/lib/jobs/types";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const mappingSchema = z.object({
  id: z.uuid().optional(),
  professionId: z.uuid(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  placementType: z.enum(PLACEMENT_TYPES),
  workflowId: z.uuid(),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(10_000).default(100),
});

function forbidden() {
  return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin" && !auth.godAdmin) return forbidden();
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const { data, error } = await supabase
      .from("workflow_mappings")
      .select(
        "id, profession_id, employment_type, placement_type, workflow_id, is_active, priority, professions(name), onboarding_flows(name)"
      )
      .eq("tenant_id", tenantId)
      .order("priority")
      .order("created_at");
    if (error) throw error;
    return NextResponse.json({ mappings: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load mappings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin" && !auth.godAdmin) return forbidden();
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const parsed = mappingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workflow mapping", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const row = {
      tenant_id: tenantId,
      profession_id: parsed.data.professionId,
      employment_type: parsed.data.employmentType,
      placement_type: parsed.data.placementType,
      workflow_id: parsed.data.workflowId,
      is_active: parsed.data.isActive,
      priority: parsed.data.priority,
      updated_by: auth.userId,
    };

    const query = parsed.data.id
      ? supabase
          .from("workflow_mappings")
          .update(row)
          .eq("id", parsed.data.id)
          .eq("tenant_id", tenantId)
      : supabase
          .from("workflow_mappings")
          .insert({ ...row, created_by: auth.userId });
    const { data, error } = await query.select("*").single();
    if (error) {
      const duplicate = error.code === "23505";
      return NextResponse.json(
        {
          error: duplicate
            ? "An active mapping already exists for this profession, employment type, and placement type."
            : error.message,
        },
        { status: duplicate ? 409 : 400 }
      );
    }
    return NextResponse.json({ mapping: data }, { status: parsed.data.id ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save mapping" },
      { status: 500 }
    );
  }
}
