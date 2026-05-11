import { NextRequest, NextResponse } from "next/server"
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js"
import { requireApiSession } from "@/lib/auth/api-session"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import { getSupabaseUrl } from "@/lib/supabase-env"

export const runtime = "nodejs"

type SectionError = { message: string; code?: string | null; details?: string | null }

type RecruiterDataResponse = {
  checklist: Record<string, unknown>[]
  profile: Record<string, unknown>
  attachments: Record<string, unknown>[]
  skill_assessments: Record<string, unknown>[]
  authorization: Record<string, unknown>
  activities: Record<string, unknown>[]
  facility_assignments: Record<string, unknown>[]
  agreement: Record<string, unknown>
  history: Record<string, unknown>[]
  section_errors?: Partial<Record<keyof Omit<RecruiterDataResponse, "section_errors">, SectionError>>
}

type TableCandidate = {
  table: string
  idColumns: string[]
  orderBy?: string
  ascending?: boolean
  limit?: number
}

function parseRuntimeId(req: NextRequest): string {
  const params = req.nextUrl.searchParams
  return (
    params.get("candidate_id")?.trim() ||
    params.get("recruiter_id")?.trim() ||
    params.get("workerId")?.trim() ||
    params.get("id")?.trim() ||
    ""
  )
}

function toSectionError(error: PostgrestError): SectionError {
  return {
    message: error.message,
    code: error.code ?? null,
    details: error.details ?? null,
  }
}

async function queryRows(
  supabase: SupabaseClient,
  candidate: TableCandidate,
  runtimeId: string
): Promise<{ rows: Record<string, unknown>[]; error: PostgrestError | null }> {
  for (const idColumn of candidate.idColumns) {
    let query = supabase
      .from(candidate.table)
      .select("*")
      .eq(idColumn, runtimeId)

    if (candidate.orderBy) {
      query = query.order(candidate.orderBy, { ascending: candidate.ascending ?? false })
    }

    if (typeof candidate.limit === "number") {
      query = query.limit(candidate.limit)
    }

    const { data, error } = await query
    if (!error) {
      return { rows: (data as Record<string, unknown>[] | null) ?? [], error: null }
    }

    // Try the next candidate ID column if this one is invalid for the table.
    if (error.code === "42703") {
      continue
    }

    return { rows: [], error }
  }

  return { rows: [], error: null }
}

async function queryFirstAvailableRows(
  supabase: SupabaseClient,
  runtimeId: string,
  candidates: TableCandidate[]
): Promise<{ rows: Record<string, unknown>[]; error: PostgrestError | null }> {
  let lastError: PostgrestError | null = null

  for (const candidate of candidates) {
    const { rows, error } = await queryRows(supabase, candidate, runtimeId)
    if (error) {
      lastError = error
      continue
    }
    if (rows.length > 0) {
      return { rows, error: null }
    }
  }

  return { rows: [], error: lastError }
}

function coerceObject(row: Record<string, unknown> | undefined): Record<string, unknown> {
  return row ?? {}
}

export async function GET(req: NextRequest) {
  const runtimeId = parseRuntimeId(req)
  if (!runtimeId) {
    return NextResponse.json(
      { error: "Missing runtime identifier. Provide candidate_id or recruiter_id." },
      { status: 400 }
    )
  }

  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  const url = getSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
  }

  const supabase = createClient(url, key)

  const response: RecruiterDataResponse = {
    checklist: [],
    profile: {},
    attachments: [],
    skill_assessments: [],
    authorization: {},
    activities: [],
    facility_assignments: [],
    agreement: {},
    history: [],
  }
  const sectionErrors: NonNullable<RecruiterDataResponse["section_errors"]> = {}

  // Access guard for worker-linked records when a worker row exists for this runtime ID.
  const workerForAccess = await queryFirstAvailableRows(supabase, runtimeId, [
    { table: "worker", idColumns: ["id", "worker_id", "candidate_id"], limit: 1 },
  ])
  if (workerForAccess.error) {
    sectionErrors.profile = toSectionError(workerForAccess.error)
  } else if (workerForAccess.rows[0]) {
    const workerRow = workerForAccess.rows[0]
    if (
      !canAccessWorkerRecord(auth, {
        id: String(workerRow.id ?? runtimeId),
        user_id: workerRow.user_id,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const profileData = await queryFirstAvailableRows(supabase, runtimeId, [
    { table: "worker", idColumns: ["id", "worker_id", "candidate_id", "recruiter_id"], limit: 1 },
    { table: "profiles", idColumns: ["id", "user_id", "candidate_id", "recruiter_id"], limit: 1 },
  ])
  if (profileData.error) sectionErrors.profile = toSectionError(profileData.error)
  response.profile = coerceObject(profileData.rows[0])

  const checklistData = await queryFirstAvailableRows(supabase, runtimeId, [
    { table: "worker_checklist", idColumns: ["worker_id", "candidate_id", "recruiter_id"] },
    { table: "checklist", idColumns: ["worker_id", "candidate_id", "recruiter_id"] },
  ])
  if (checklistData.error) sectionErrors.checklist = toSectionError(checklistData.error)
  response.checklist = checklistData.rows

  const attachmentsData = await queryFirstAvailableRows(supabase, runtimeId, [
    { table: "worker_documents", idColumns: ["worker_id", "candidate_id", "recruiter_id"] },
    { table: "worker_requirements", idColumns: ["worker_id", "candidate_id", "recruiter_id"] },
    { table: "attachments", idColumns: ["worker_id", "candidate_id", "recruiter_id"] },
  ])
  if (attachmentsData.error) sectionErrors.attachments = toSectionError(attachmentsData.error)
  response.attachments = attachmentsData.rows

  const skillAssessmentsData = await queryFirstAvailableRows(supabase, runtimeId, [
    {
      table: "skill_assessments",
      idColumns: ["worker_id", "candidate_id", "recruiter_id"],
      orderBy: "updated_at",
      ascending: false,
    },
    {
      table: "applicant_skill_assessment_answers",
      idColumns: ["worker_id", "candidate_id", "recruiter_id"],
      orderBy: "updated_at",
      ascending: false,
    },
  ])
  if (skillAssessmentsData.error) {
    sectionErrors.skill_assessments = toSectionError(skillAssessmentsData.error)
  }
  response.skill_assessments = skillAssessmentsData.rows

  const authorizationData = await queryFirstAvailableRows(supabase, runtimeId, [
    { table: "worker_authorization", idColumns: ["worker_id", "candidate_id", "recruiter_id"], limit: 1 },
    { table: "authorizations", idColumns: ["worker_id", "candidate_id", "recruiter_id"], limit: 1 },
    { table: "worker_documents", idColumns: ["worker_id", "candidate_id", "recruiter_id"], limit: 1 },
  ])
  if (authorizationData.error) sectionErrors.authorization = toSectionError(authorizationData.error)
  response.authorization = coerceObject(authorizationData.rows[0])

  const activitiesData = await queryFirstAvailableRows(supabase, runtimeId, [
    {
      table: "activity_log",
      idColumns: ["entity_id", "worker_id", "candidate_id", "recruiter_id"],
      orderBy: "created_at",
      ascending: false,
    },
    {
      table: "activity_logs",
      idColumns: ["entity_id", "worker_id", "candidate_id", "recruiter_id"],
      orderBy: "created_at",
      ascending: false,
    },
  ])
  if (activitiesData.error) sectionErrors.activities = toSectionError(activitiesData.error)
  response.activities = activitiesData.rows

  const facilityAssignmentsData = await queryFirstAvailableRows(supabase, runtimeId, [
    { table: "facility_assignments", idColumns: ["worker_id", "candidate_id", "recruiter_id"] },
    { table: "worker_facility_assignments", idColumns: ["worker_id", "candidate_id", "recruiter_id"] },
  ])
  if (facilityAssignmentsData.error) {
    sectionErrors.facility_assignments = toSectionError(facilityAssignmentsData.error)
  }
  response.facility_assignments = facilityAssignmentsData.rows

  const agreementData = await queryFirstAvailableRows(supabase, runtimeId, [
    { table: "agreements", idColumns: ["worker_id", "candidate_id", "recruiter_id"], limit: 1 },
    { table: "zoho_sign_requests", idColumns: ["worker_id", "candidate_id", "recruiter_id"], limit: 1 },
  ])
  if (agreementData.error) sectionErrors.agreement = toSectionError(agreementData.error)
  response.agreement = coerceObject(agreementData.rows[0])

  const historyData = await queryFirstAvailableRows(supabase, runtimeId, [
    {
      table: "activity_log",
      idColumns: ["entity_id", "worker_id", "candidate_id", "recruiter_id"],
      orderBy: "created_at",
      ascending: false,
    },
    {
      table: "activity_logs",
      idColumns: ["entity_id", "worker_id", "candidate_id", "recruiter_id"],
      orderBy: "created_at",
      ascending: false,
    },
  ])
  if (historyData.error) sectionErrors.history = toSectionError(historyData.error)
  response.history = historyData.rows

  if (Object.keys(sectionErrors).length > 0) {
    response.section_errors = sectionErrors
  }

  return NextResponse.json(response)
}
