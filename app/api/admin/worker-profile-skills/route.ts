import { NextRequest, NextResponse } from "next/server"
import { writeActivityLog } from "@/lib/audit/activity-log"
import { formatApiError } from "@/lib/api/format-api-error"
import { requireStaffApiSession } from "@/lib/auth/api-session"
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  loadWorkerProfileSkills,
  normalizeWorkerProfileSkillName,
} from "@/lib/worker-profile-skills"
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

    const skills = await loadWorkerProfileSkills(resolved.supabase, resolved.workerId)
    return NextResponse.json({ skills })
  } catch (err) {
    console.error("[admin/worker-profile-skills GET]", err)
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { workerId?: string; skillName?: string }
    const workerIdRaw = body.workerId?.trim() || ""
    const skillName = normalizeWorkerProfileSkillName(body.skillName)

    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 })
    }
    if (!skillName) {
      return NextResponse.json({ error: "Enter a skill name" }, { status: 400 })
    }

    const resolved = await resolveWorkerAccess(workerIdRaw)
    if ("error" in resolved && resolved.error) return resolved.error

    const { supabase, workerId, tenantId, userId } = resolved

    const existing = await loadWorkerProfileSkills(supabase, workerId)
    const duplicate = existing.some(
      (skill) => skill.skill_name.trim().toLowerCase() === skillName.toLowerCase()
    )
    if (duplicate) {
      return NextResponse.json({ error: "This skill is already on the profile." }, { status: 409 })
    }

    const { data, error } = await supabase
      .from("worker_profile_skills")
      .insert({
        worker_id: workerId,
        tenant_id: tenantId,
        skill_name: skillName,
        created_by_user_id: userId,
      })
      .select("id, skill_name, created_at")
      .single()

    if (error) throw error

    void writeActivityLog({
      actorUserId: userId,
      tenantId,
      action: "worker.profile_skill.add",
      entityType: "worker",
      entityId: workerId,
      metadata: {
        route: "POST /api/admin/worker-profile-skills",
        skill_name: skillName,
        skill_id: data?.id != null ? String(data.id) : null,
      },
      request: req,
    })

    const skills = await loadWorkerProfileSkills(supabase, workerId)
    return NextResponse.json({ skill: data, skills })
  } catch (err) {
    console.error("[admin/worker-profile-skills POST]", err)
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || ""
    const skillIdRaw = req.nextUrl.searchParams.get("skillId")?.trim() || ""

    const workerIdCheck = parseRequiredUuid(workerIdRaw, "workerId")
    if (!workerIdCheck.ok) {
      return NextResponse.json({ error: workerIdCheck.error }, { status: 400 })
    }
    const skillIdCheck = parseRequiredUuid(skillIdRaw, "skillId")
    if (!skillIdCheck.ok) {
      return NextResponse.json({ error: skillIdCheck.error }, { status: 400 })
    }

    const resolved = await resolveWorkerAccess(workerIdRaw)
    if ("error" in resolved && resolved.error) return resolved.error

    const { supabase, workerId, tenantId, userId } = resolved

    const { error } = await supabase
      .from("worker_profile_skills")
      .delete()
      .eq("id", skillIdCheck.value)
      .eq("worker_id", workerId)

    if (error) throw error

    void writeActivityLog({
      actorUserId: userId,
      tenantId,
      action: "worker.profile_skill.remove",
      entityType: "worker",
      entityId: workerId,
      metadata: {
        route: "DELETE /api/admin/worker-profile-skills",
        skill_id: skillIdCheck.value,
      },
      request: req,
    })

    const skills = await loadWorkerProfileSkills(supabase, workerId)
    return NextResponse.json({ ok: true, skills })
  } catch (err) {
    console.error("[admin/worker-profile-skills DELETE]", err)
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 })
  }
}
