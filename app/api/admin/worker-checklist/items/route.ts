import { NextRequest, NextResponse } from "next/server"
import { writeActivityLog } from "@/lib/audit/activity-log"
import { formatApiError } from "@/lib/api/format-api-error"
import { requireStaffApiSession } from "@/lib/auth/api-session"
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import {
  buildPipelineDetailLine,
  getPipelineItemDef,
  getPipelineSectionForItem,
  isPipelineChecklistItemKey,
  pipelineCheckboxLabel,
  pipelineItemIsComplete,
  saveWorkerPipelineChecklistItem,
  type PipelineChecklistItemKey,
  type PipelineChecklistItemRow,
} from "@/lib/worker-pipeline-checklist"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

type ItemState = "pending" | "complete" | "not_applicable"

function pipelineRowResponse(itemKey: PipelineChecklistItemKey, row: PipelineChecklistItemRow | undefined) {
  const def = getPipelineItemDef(itemKey)
  const isComplete = pipelineItemIsComplete(row)
  const state: ItemState = isComplete ? "complete" : def.optional ? "not_applicable" : "pending"
  const detailLine = buildPipelineDetailLine(itemKey, row, isComplete)
  return {
    id: itemKey,
    title: def.title,
    subtitle: def.subtitle,
    optional: def.optional,
    state,
    checked: isComplete,
    badge: isComplete ? "Complete" : "Pending",
    detailLine,
    checkboxLabel: pipelineCheckboxLabel(itemKey),
    manualCompleted: row?.manual_completed === true,
    callLogCompleted: row?.call_log_completed === true,
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession()
    if (auth instanceof NextResponse) return auth

    const body = (await req.json().catch(() => ({}))) as {
      workerId?: string
      itemKey?: string
      completed?: boolean
    }

    const idCheck = parseRequiredUuid(body.workerId?.trim() ?? "", "workerId")
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }

    if (!isPipelineChecklistItemKey(body.itemKey)) {
      return NextResponse.json({ error: "Invalid pipeline checklist item" }, { status: 400 })
    }

    if (typeof body.completed !== "boolean") {
      return NextResponse.json({ error: "completed must be a boolean" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, user_id, tenant_id")
      .eq("id", idCheck.value)
      .maybeSingle()

    if (workerError) throw workerError
    if (!worker?.id || worker.tenant_id == null) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    }

    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tenantId = String(worker.tenant_id)
    const scope = await resolveStaffTenantScope(auth.authUser)
    if (scope.mode === "scoped" && scope.tenantId !== tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const itemKey = body.itemKey
    const completedBy = auth.devBypass ? null : auth.userId

    const savedRow = await saveWorkerPipelineChecklistItem(supabase, {
      workerId: idCheck.value,
      tenantId,
      itemKey,
      completed: body.completed,
      completedBy,
    })

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      tenantId,
      action: body.completed
        ? "worker.pipeline_checklist.complete"
        : "worker.pipeline_checklist.uncomplete",
      entityType: "worker",
      entityId: idCheck.value,
      metadata: {
        route: "PATCH /api/admin/worker-checklist/items",
        item_key: itemKey,
        section_id: getPipelineSectionForItem(itemKey),
        completion_source: "manual",
        completed: body.completed,
      },
      request: req,
    })

    return NextResponse.json({
      ok: true,
      row: pipelineRowResponse(itemKey, savedRow),
      sectionId: getPipelineSectionForItem(itemKey),
    })
  } catch (err: unknown) {
    console.error("[admin/worker-checklist/items]", err)
    const msg = formatApiError(err)
    const status = msg === "Checklist table not configured" ? 503 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
