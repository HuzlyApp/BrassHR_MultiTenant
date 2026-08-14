import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  ApplicationStatusError,
  changeApplicationStatusBySystemKey,
} from "@/lib/jobs/application-statuses";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

  const { id } = await context.params;
  const { data: application, error } = await supabase
    .from("job_applications")
    .select("id, worker_id, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  try {
    await changeApplicationStatusBySystemKey(supabase, {
      tenantId,
      applicationId: id,
      systemKey: "withdrawn",
      changedByUserId: auth.userId,
      note: "Removed from this job",
    });
  } catch (statusError) {
    if (statusError instanceof ApplicationStatusError) {
      const { error: fallbackError } = await supabase
        .from("job_applications")
        .update({ status: "withdrawn", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }
    } else {
      return NextResponse.json(
        { error: statusError instanceof Error ? statusError.message : "Failed to remove application" },
        { status: 500 }
      );
    }
  }

  void writeActivityLog({
    actorUserId: auth.devBypass ? null : auth.userId,
    action: "job_application.removed_from_job",
    entityType: "job_application",
    entityId: id,
    tenantId,
    request: req,
    metadata: { workerId: application.worker_id },
  });

  return NextResponse.json({ ok: true });
}
