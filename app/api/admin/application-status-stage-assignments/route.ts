import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { requireWorkflowAdmin } from "@/lib/auth/workflow-admin";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  ApplicationStatusError,
  assignGroupToPreHireStage,
  listApplicationStatusGroupStageAssignments,
  unassignGroupFromPreHireStage,
} from "@/lib/jobs/application-statuses";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function handleError(error: unknown) {
  if (error instanceof ApplicationStatusError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  console.error("[admin/application-status-stage-assignments]", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Failed to manage stage assignments" },
    { status: 500 }
  );
}

/** GET — list Pre-Hire stage ↔ status group assignments. */
export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const assignments = await listApplicationStatusGroupStageAssignments(supabase, tenantId);
    return NextResponse.json({
      assignments,
      canManage: auth.role === "admin" || auth.godAdmin,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT — assign or unassign a status GROUP on a Pre-Hire stage.
 * One group may be available on many stages.
 * Body:
 * - { action: "assign", stageName, groupId }
 * - { action: "unassign", stageName, groupId }
 */
export async function PUT(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as {
      action?: unknown;
      stageName?: unknown;
      groupId?: unknown;
    } | null;

    const action = typeof body?.action === "string" ? body.action : "";
    const stageName = typeof body?.stageName === "string" ? body.stageName : "";
    const groupId = typeof body?.groupId === "string" ? body.groupId : "";

    if (!stageName || !groupId) {
      return NextResponse.json(
        { error: "stageName and groupId are required" },
        { status: 400 }
      );
    }

    let assignments;
    if (action === "unassign") {
      assignments = await unassignGroupFromPreHireStage(supabase, {
        tenantId,
        stageName,
        groupId,
      });
      await writeActivityLog({
        actorUserId: auth.userId,
        action: "application_status_group_stage_assignment.unassigned",
        entityType: "application_status_group",
        entityId: groupId,
        tenantId,
        metadata: { stageName, groupId },
        request: req,
      });
    } else if (action === "assign") {
      assignments = await assignGroupToPreHireStage(supabase, {
        tenantId,
        stageName,
        groupId,
        actorUserId: auth.userId,
      });
      await writeActivityLog({
        actorUserId: auth.userId,
        action: "application_status_group_stage_assignment.assigned",
        entityType: "application_status_group",
        entityId: groupId,
        tenantId,
        metadata: { stageName, groupId },
        request: req,
      });
    } else {
      return NextResponse.json(
        { error: 'action must be "assign" or "unassign"' },
        { status: 400 }
      );
    }

    return NextResponse.json({ assignments });
  } catch (error) {
    return handleError(error);
  }
}
