import { NextRequest, NextResponse } from "next/server"
import { writeActivityLog } from "@/lib/audit/activity-log"
import { formatApiError } from "@/lib/api/format-api-error"
import { requireStaffApiSession } from "@/lib/auth/api-session"
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import {
  createWorkerCallLog,
  loadWorkerCallLogs,
  normalizeCallLogOutcome,
  parseDurationMinutes,
} from "@/lib/admin/worker-call-logs"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

async function resolveWorkerAccess(workerIdRaw: string) {
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId")
  if (!idCheck.ok) {
    return { error: NextResponse.json({ error: idCheck.error }, { status: 400 }) }
  }

  const auth = await requireStaffApiSession()
  if (auth instanceof NextResponse) return { error: auth }

  const supabase = createServiceRoleClient()
  if (!supabase) {
    return {
      error: NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 }),
    }
  }

  const { data: worker, error } = await supabase
    .from("worker")
    .select("id, user_id, tenant_id")
    .eq("id", idCheck.value)
    .maybeSingle()

  if (error) throw error
  if (!worker?.id || !worker.tenant_id) {
    return { error: NextResponse.json({ error: "Worker not found" }, { status: 404 }) }
  }

  if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  const tenantId = String(worker.tenant_id)
  const scope = await resolveStaffTenantScope(auth.authUser)
  if (scope.mode === "scoped" && scope.tenantId !== tenantId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return {
    supabase,
    workerId: String(worker.id),
    tenantId,
    userId: auth.devBypass ? null : auth.userId,
  }
}

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || ""
    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 })
    }

    const resolved = await resolveWorkerAccess(workerIdRaw)
    if ("error" in resolved && resolved.error) return resolved.error

    const callLogs = await loadWorkerCallLogs(resolved.supabase, resolved.workerId)
    return NextResponse.json({ callLogs })
  } catch (err) {
    console.error("[admin/worker-call-logs GET]", err)
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      workerId?: string
      outcome?: string
      durationMinutes?: number | string | null
      notes?: string | null
      callAt?: string | null
      attemptNumber?: number | null
    }

    const workerIdRaw = body.workerId?.trim() || ""
    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 })
    }

    const outcome = normalizeCallLogOutcome(body.outcome)
    if (!outcome) {
      return NextResponse.json({ error: "Select call outcome" }, { status: 400 })
    }

    const resolved = await resolveWorkerAccess(workerIdRaw)
    if ("error" in resolved && resolved.error) return resolved.error

    const durationSeconds = parseDurationMinutes(body.durationMinutes)
    const attemptNumber =
      typeof body.attemptNumber === "number" && body.attemptNumber > 0
        ? Math.floor(body.attemptNumber)
        : null

    const callLog = await createWorkerCallLog(resolved.supabase, {
      workerId: resolved.workerId,
      tenantId: resolved.tenantId,
      createdByUserId: resolved.userId,
      outcome,
      durationSeconds,
      notes: body.notes ?? null,
      callAt: body.callAt ?? null,
      attemptNumber,
    })

    void writeActivityLog({
      actorUserId: resolved.userId,
      tenantId: resolved.tenantId,
      action: "worker.call_log.add",
      entityType: "worker",
      entityId: resolved.workerId,
      metadata: {
        route: "POST /api/admin/worker-call-logs",
        call_log_id: callLog.id,
        outcome,
      },
      request: req,
    })

    const callLogs = await loadWorkerCallLogs(resolved.supabase, resolved.workerId)
    return NextResponse.json({ callLog, callLogs })
  } catch (err) {
    console.error("[admin/worker-call-logs POST]", err)
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 })
  }
}
