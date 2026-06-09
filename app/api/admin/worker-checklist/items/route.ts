import { NextRequest, NextResponse } from "next/server"
import { writeActivityLog } from "@/lib/audit/activity-log"
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
  type PipelineChecklistItemKey,
  type PipelineChecklistItemRow,
} from "@/lib/worker-pipeline-checklist"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

const TABLE_NAMES = ["worker_pipeline_checklist_items", "worker_screening_checklist_items"] as const

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

async function resolveTable(supabase: ReturnType<typeof createServiceRoleClient>): Promise<string | null> {
  if (!supabase) return null
  for (const table of TABLE_NAMES) {
    const { error } = await supabase.from(table).select("id").limit(1)
    if (!error) return table
    if (/not find|does not exist|schema cache/i.test(error.message ?? "")) continue
    throw error
  }
  return null
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

    const table = await resolveTable(supabase)
    if (!table) {
      return NextResponse.json({ error: "Checklist table not configured" }, { status: 503 })
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
    const now = new Date().toISOString()
    const completedBy = auth.devBypass ? null : auth.userId

    const { data: existing, error: existingError } = await supabase
      .from(table)
      .select(
        "id, manual_completed, manual_completed_by, manual_completed_at, call_log_completed, call_log_completed_at, call_log_ref, updated_at"
      )
      .eq("worker_id", idCheck.value)
      .eq("item_key", itemKey)
      .maybeSingle()

    if (existingError) throw existingError

    const manualPayload = body.completed
      ? {
          manual_completed: true,
          manual_completed_by: completedBy,
          manual_completed_at: now,
        }
      : {
          manual_completed: false,
          manual_completed_by: null,
          manual_completed_at: null,
        }

    let savedRow: PipelineChecklistItemRow | undefined

    if (existing?.id) {
      const { data: updated, error: updateError } = await supabase
        .from(table)
        .update({ ...manualPayload, updated_at: now })
        .eq("id", existing.id)
        .select(
          "item_key, manual_completed, manual_completed_by, manual_completed_at, call_log_completed, call_log_completed_at, call_log_ref, updated_at"
        )
        .maybeSingle()

      if (updateError) throw updateError
      savedRow = (updated as PipelineChecklistItemRow | null) ?? undefined
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from(table)
        .insert({
          tenant_id: tenantId,
          worker_id: idCheck.value,
          item_key: itemKey,
          ...manualPayload,
          call_log_completed: false,
          call_log_completed_at: null,
          call_log_ref: null,
          updated_at: now,
        })
        .select(
          "item_key, manual_completed, manual_completed_by, manual_completed_at, call_log_completed, call_log_completed_at, call_log_ref, updated_at"
        )
        .maybeSingle()

      if (insertError) throw insertError
      savedRow = (inserted as PipelineChecklistItemRow | null) ?? undefined
    }

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
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
