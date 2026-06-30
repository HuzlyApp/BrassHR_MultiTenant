import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { LICENSE_TYPE_LABELS, LICENSE_TYPES } from "@/lib/applicant-portal/documents"
import { requireStaffApiSession } from "@/lib/auth/api-session"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession()
    if (auth instanceof NextResponse) return auth

    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() ?? ""
    const idCheck = parseRequiredUuid(workerIdRaw, "workerId")
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }

    const stateCodeParam = req.nextUrl.searchParams.get("stateCode")?.trim().toUpperCase() ?? ""

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)

    const { data: worker, error: workerErr } = await supabase
      .from("worker")
      .select("id, user_id, tenant_id, state, city, job_role")
      .eq("id", idCheck.value)
      .maybeSingle()

    if (workerErr) throw workerErr
    if (!worker?.id || !worker.tenant_id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    }

    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tenantId = String(worker.tenant_id)
    const workerState = worker.state != null ? String(worker.state).trim() : ""
    const stateCodeForCities =
      stateCodeParam ||
      (workerState.length === 2 ? workerState.toUpperCase() : "")

    const [statesRes, citiesRes, rolesRes] = await Promise.all([
      supabase
        .from("signup_us_states")
        .select("code, name, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      stateCodeForCities
        ? supabase
            .from("signup_us_cities")
            .select("city_name, state_code, sort_order")
            .eq("state_code", stateCodeForCities)
            .order("sort_order", { ascending: true })
            .order("city_name", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("job_categories")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .or("active.is.null,active.eq.true")
        .order("name", { ascending: true }),
    ])

    if (statesRes.error) throw statesRes.error
    if (citiesRes.error) throw citiesRes.error
    if (rolesRes.error) throw rolesRes.error

    const states = (statesRes.data ?? []).map((row) => ({
      value: String(row.code),
      label: String(row.name),
    }))

    const stateNameByCode = new Map(states.map((s) => [s.value, s.label]))

    const cities = (citiesRes.data ?? []).map((row) => ({
      value: String(row.city_name),
      label: String(row.city_name),
      stateCode: String(row.state_code),
    }))

    const currentCity = worker.city != null ? String(worker.city).trim() : ""
    if (
      currentCity &&
      !cities.some((row) => row.value.toLowerCase() === currentCity.toLowerCase())
    ) {
      cities.unshift({
        value: currentCity,
        label: currentCity,
        stateCode: stateCodeForCities,
      })
    }

    const alliedHealthRoles = (rolesRes.data ?? []).map((row) => ({
      value: String(row.name),
      label: String(row.name),
    }))

    const currentJobRole = worker.job_role != null ? String(worker.job_role).trim() : ""
    if (
      currentJobRole &&
      !alliedHealthRoles.some((row) => row.value.toLowerCase() === currentJobRole.toLowerCase())
    ) {
      alliedHealthRoles.unshift({ value: currentJobRole, label: currentJobRole })
    }

    const licenseTypes = LICENSE_TYPES.map((type) => ({
      value: type,
      label: LICENSE_TYPE_LABELS[type],
    }))

    return NextResponse.json({
      states,
      cities,
      alliedHealthRoles,
      licenseTypes,
      workerStateCode:
        workerState.length === 2
          ? workerState.toUpperCase()
          : states.find((s) => s.label.toLowerCase() === workerState.toLowerCase())?.value ?? "",
      workerStateName:
        workerState.length === 2
          ? stateNameByCode.get(workerState.toUpperCase()) ?? workerState
          : workerState,
      stateCodeForCities: stateCodeForCities || null,
    })
  } catch (err) {
    console.error("[admin/worker-profile/field-options]", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
