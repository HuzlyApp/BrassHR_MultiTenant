import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  ApplicationStatusError,
  changeApplicationStatus,
  ensureDefaultApplicationStatuses,
  getStatusBySystemKey,
} from "@/lib/jobs/application-statuses";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function markApplicationWithdrawn(args: {
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>;
  tenantId: string;
  applicationId: string;
  changedByUserId: string | null;
}) {
  const { supabase, tenantId, applicationId, changedByUserId } = args;

  const { data: withdrawnStatus, error: statusError } = await supabase
    .from("application_statuses")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("system_key", "withdrawn")
    .maybeSingle();
  if (statusError) throw statusError;

  if (withdrawnStatus?.id && withdrawnStatus.is_active !== false) {
    await changeApplicationStatus(supabase, {
      tenantId,
      applicationId,
      statusId: withdrawnStatus.id,
      changedByUserId,
      note: "Removed from this job",
    });
    return;
  }

  try {
    await ensureDefaultApplicationStatuses(supabase, tenantId);
    const status = await getStatusBySystemKey(supabase, tenantId, "withdrawn");
    if (status?.isActive) {
      await changeApplicationStatus(supabase, {
        tenantId,
        applicationId,
        statusId: status.id,
        changedByUserId,
        note: "Removed from this job",
      });
      return;
    }
  } catch (statusError) {
    if (!(statusError instanceof ApplicationStatusError)) {
      throw statusError;
    }
  }

  const { error: fallbackError } = await supabase
    .from("job_applications")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("tenant_id", tenantId);
  if (fallbackError) throw fallbackError;
}

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
    await markApplicationWithdrawn({
      supabase,
      tenantId,
      applicationId: id,
      changedByUserId: auth.devBypass ? null : auth.userId,
    });
  } catch (statusError) {
    return NextResponse.json(
      { error: statusError instanceof Error ? statusError.message : "Failed to remove application" },
      { status: 500 }
    );
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
