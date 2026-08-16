import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { assignedRecruiterUserId?: string | null };
  const assigned =
    typeof body.assignedRecruiterUserId === "string" && body.assignedRecruiterUserId.trim()
      ? body.assignedRecruiterUserId.trim()
      : null;

  if (assigned) {
    const { data: member } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", assigned)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const role = String(member?.role ?? "").toLowerCase();
    if (!member || !["admin", "recruiter", "owner"].includes(role)) {
      return NextResponse.json({ error: "Assigned user is not a recruiter for this tenant." }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("job_applications")
    .update({ assigned_recruiter_user_id: assigned, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id, assigned_recruiter_user_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  void writeActivityLog({
    actorUserId: auth.devBypass ? null : auth.userId,
    action: "job_application.recruiter_assigned",
    entityType: "job_application",
    entityId: id,
    tenantId,
    request: req,
    metadata: { assignedRecruiterUserId: assigned },
  });

  return NextResponse.json({ ok: true, assignedRecruiterUserId: data.assigned_recruiter_user_id });
}
