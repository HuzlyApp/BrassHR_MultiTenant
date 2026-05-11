import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { writeActivityLog } from "@/lib/audit/activity-log"
import { requireApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/app-role"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

type ItemState = "pending" | "complete" | "uploaded" | "answered" | "warning" | "not_reachable" | "not_applicable"

type ChecklistRow = {
  id: string
  title: string
  subtitle?: string
  state: ItemState
  optional?: boolean
  checked?: boolean
  detailLine?: string
  badge?: string
}

export type ChecklistSection = {
  id: string
  title: string
  subtitle?: string
  rows: ChecklistRow[]
}

function hasUrl(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0
}

function asTrimmedString(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}

function stateBadge(state: ItemState, fallback: string): string {
  switch (state) {
    case "complete":
    case "uploaded":
    case "answered":
      return state === "uploaded" ? "Uploaded" : state === "answered" ? "Answered" : "Complete"
    case "warning":
      return "Needs review"
    case "not_reachable":
      return "Not Reachable"
    case "not_applicable":
      return "N/A"
    default:
      return fallback
  }
}

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || ""
    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 })
    }
    const idCheck = parseRequiredUuid(workerIdRaw, "workerId")
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }
    const workerId = idCheck.value

    const auth = await requireApiSession()
    if (auth instanceof NextResponse) return auth

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)

    const { data: worker, error: wErr } = await supabase
      .from("worker")
      .select("id, user_id, first_name, last_name, job_role, created_at, updated_at, city, state, status")
      .eq("id", workerId)
      .maybeSingle()

    if (wErr) throw wErr
    if (!worker?.id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    }

    const wr = worker as { id: string; user_id?: unknown }
    if (!canAccessWorkerRecord(auth, { id: String(wr.id), user_id: wr.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      action: isStaffRole(auth.role) ? "worker.checklist.view" : "worker.checklist.self_view",
      entityType: "worker",
      entityId: workerId,
      metadata: { route: "GET /api/admin/worker-checklist", staff: isStaffRole(auth.role) },
      request: req,
    })

    const statusRaw = worker.status as string | null | undefined
    const statusNorm = typeof statusRaw === "string" ? statusRaw.trim().toLowerCase() : "new"

    const { data: docRow } = await supabase
      .from("worker_documents")
      .select("*")
      .eq("worker_id", workerId)
      .maybeSingle()

    const docs = docRow as Record<string, unknown> | null

    const documentChecks = [
      { id: "license", ok: hasUrl(docs?.nursing_license_url) },
      { id: "tb", ok: hasUrl(docs?.tb_test_url) },
      { id: "cpr", ok: hasUrl(docs?.cpr_certification_url) },
      { id: "ssn", ok: hasUrl(docs?.ssn_url) || hasUrl(docs?.drivers_license_url) },
    ]
    const licenseOk = documentChecks[0].ok
    const tbOk = documentChecks[1].ok
    const cprOk = documentChecks[2].ok
    const ssnOk = documentChecks[3].ok

    const verifiedDone = documentChecks.filter((d) => d.ok).length
    const verifiedTotal = documentChecks.length

    let completedAssessments = 0
    let totalAssessments = 0
    const { data: saRows, error: saErr } = await supabase
      .from("skill_assessments")
      .select("category, completed, answers")
      .eq("worker_id", workerId)

    if (!saErr) {
      const assessmentRows = (saRows ?? []) as Array<{
        category?: string | null
        completed?: boolean | null
        answers?: Record<string, unknown> | null
      }>
      const categorySlugs = Array.from(
        new Set(
          assessmentRows
            .map((r) => String(r.category ?? "").trim())
            .filter((slug) => slug.length > 0)
        )
      )

      const { data: categoryRows } = await supabase
        .from("skill_categories")
        .select("id,slug")
        .in("slug", categorySlugs.length > 0 ? categorySlugs : ["__none__"])
      const categoryBySlug = new Map<string, string>(
        ((categoryRows ?? []) as Array<{ id?: string; slug?: string }>).map((row) => [
          String(row.slug ?? ""),
          String(row.id ?? ""),
        ])
      )

      const { data: questionRows } = await supabase
        .from("skill_questions")
        .select("category_id")
      const requiredByCategory = new Map<string, number>()
      for (const row of ((questionRows ?? []) as Array<{ category_id?: string }>)) {
        const categoryId = String(row.category_id ?? "").trim()
        if (!categoryId) continue
        requiredByCategory.set(categoryId, (requiredByCategory.get(categoryId) ?? 0) + 1)
      }

      const { data: answerRows } = await supabase
        .from("applicant_skill_assessment_answers")
        .select("category_id")
        .eq("applicant_id", workerId)
      const answeredByCategory = new Map<string, number>()
      for (const row of ((answerRows ?? []) as Array<{ category_id?: string }>)) {
        const categoryId = String(row.category_id ?? "").trim()
        if (!categoryId) continue
        answeredByCategory.set(categoryId, (answeredByCategory.get(categoryId) ?? 0) + 1)
      }

      totalAssessments = assessmentRows.length
      completedAssessments = 0
      for (const row of assessmentRows) {
        const slug = String(row.category ?? "").trim()
        const categoryId = categoryBySlug.get(slug) ?? ""
        const normalizedAnswered = answeredByCategory.get(categoryId) ?? 0
        const answersJson =
          row.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
            ? row.answers
            : {}
        const jsonAnswered = Object.keys(answersJson).length
        const answered = Math.max(normalizedAnswered, jsonAnswered)
        const required = requiredByCategory.get(categoryId) ?? 0
        const completeByAnswers = required > 0 ? answered >= required : answered > 0
        if (row.completed === true || completeByAnswers) completedAssessments += 1
      }

      if (totalAssessments === 0) {
        totalAssessments = answeredByCategory.size
        completedAssessments = 0
        for (const [categoryId, answered] of answeredByCategory.entries()) {
          const required = requiredByCategory.get(categoryId) ?? 0
          if ((required > 0 && answered >= required) || (required === 0 && answered > 0)) {
            completedAssessments += 1
          }
        }
      }
    }

    const docPct = (verifiedDone / Math.max(verifiedTotal, 1)) * 35
    const quizPct =
      totalAssessments > 0 ? (completedAssessments / totalAssessments) * 35 : 0
    const progressPercent = Math.min(100, Math.round(docPct + quizPct))

    const created = worker.created_at ? new Date(String(worker.created_at)) : null
    const daysInStage =
      created && !Number.isNaN(created.getTime())
        ? Math.max(0, Math.floor((Date.now() - created.getTime()) / 86_400_000))
        : 0

    const sections: ChecklistSection[] = [
      {
        id: "claimed",
        title: "Claimed & Assigned Facilities",
        subtitle: "Facility onboarding and verified documents",
        rows: [
          {
            id: "facility_assigned",
            title: "Facility Assigned",
            subtitle: "No facility assigned",
            state: "pending",
            checked: false,
            badge: stateBadge("pending", "Pending"),
          },
          {
            id: "assign_rate",
            title: "Assign Rate",
            subtitle: "No rate assigned",
            state: "pending",
            checked: false,
            badge: stateBadge("pending", "Pending"),
          },
          {
            id: "verified_header",
            title: "Verified Documents",
            subtitle: `Verified ${verifiedDone} of ${verifiedTotal}`,
            state: verifiedDone === verifiedTotal ? "complete" : "pending",
            badge: verifiedDone === verifiedTotal ? "Complete" : "In progress",
          },
          {
            id: "doc_license",
            title: "Nursing License",
            state: licenseOk ? "uploaded" : "pending",
            checked: licenseOk,
            badge: licenseOk ? "Uploaded" : "Pending",
          },
          {
            id: "doc_tb",
            title: "TB Test",
            state: tbOk ? "uploaded" : "pending",
            checked: tbOk,
            badge: tbOk ? "Uploaded" : "Pending",
          },
          {
            id: "doc_cpr",
            title: "CPR Certifications",
            state: cprOk ? "uploaded" : "pending",
            checked: cprOk,
            badge: cprOk ? "Uploaded" : "Pending",
          },
          {
            id: "doc_ssn",
            title: "SSN Card",
            state: ssnOk ? "uploaded" : "pending",
            checked: ssnOk,
            badge: ssnOk ? "Uploaded" : "Pending",
          },
        ],
      },
      {
        id: "screening",
        title: "Initial Screening / Interview",
        subtitle: "Call attempts and interview status",
        rows: [
          {
            id: "call_1",
            title: "Call 1",
            subtitle: "For Interview",
            state: "pending",
            badge: "Pending",
            detailLine: "No call logs synced yet",
          },
          {
            id: "call_2",
            title: "Call 2",
            subtitle: "Done Initial Interview",
            state: "pending",
            badge: "Pending",
            detailLine: "No call logs synced yet",
          },
        ],
      },
      {
        id: "compliance",
        title: "Pre-employment Compliance Screening",
        subtitle: "OIG, drug screen, and background",
        rows: [
          {
            id: "oig",
            title: "OIG Verification",
            subtitle: "(Not Mandatory)",
            state: "not_applicable",
            optional: true,
            badge: "Pending",
          },
          {
            id: "drug",
            title: "Drug Test",
            subtitle: "(Not Mandatory)",
            state: "not_applicable",
            optional: true,
            badge: "Pending",
          },
          {
            id: "bg",
            title: "Background Check",
            state: "pending",
            badge: "Pending",
          },
        ],
      },
      {
        id: "facility_req",
        title: "Facility Specific Requirements",
        subtitle: "eSign and statements",
        rows: [
          {
            id: "fac_approval",
            title: "Facility Approval",
            subtitle: "For eSign",
            state: "pending",
            badge: "Pending",
          },
          {
            id: "sworn",
            title: "Sworn Statement",
            subtitle: "To be fill-up",
            state: "pending",
            badge: "Pending",
          },
        ],
      },
      {
        id: "new_hire",
        title: "New Hire Agreement",
        subtitle: "Payroll and workforce accounts",
        rows: [
          {
            id: "w2_i9",
            title: "Employee Agreement W2 + I9",
            subtitle: "To be signed",
            state: "pending",
            badge: "Pending",
          },
          {
            id: "everify",
            title: "Create eVerify Record",
            subtitle: "To be created",
            state: "pending",
            badge: "Pending",
          },
          {
            id: "wheniwork",
            title: "WhenIWork Account",
            subtitle: "To be created",
            state: "pending",
            badge: "Pending",
          },
          {
            id: "paychex",
            title: "PayChex Account",
            subtitle: "To be created",
            state: "pending",
            badge: "Pending",
          },
        ],
      },
      {
        id: "final",
        title: "Final Onboarding Steps",
        subtitle: "Welcome communication and badge",
        rows: [
          {
            id: "welcome_email",
            title: "Welcome Email Sent",
            subtitle: "For Email",
            state: "pending",
            badge: "Pending",
          },
          {
            id: "badge",
            title: "Badge Sent",
            subtitle: "Send badge",
            state: "pending",
            badge: "Pending",
          },
        ],
      },
    ]

    const trackerLabels = [
      "Claimed & Assigned Facilities",
      "Initial Screening",
      "Compliance Screening",
      "Facility Requirements",
      "New Hire Agreement",
      "Final Onboarding",
    ]

    const docSectionDone = verifiedDone >= verifiedTotal
    const trackDone = [
      docSectionDone,
      false,
      false,
      false,
      false,
      false,
    ]

    const { data: activityRows } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("entity_id", workerId)
      .order("created_at", { ascending: false })
      .limit(10)
    const activityHistory = ((activityRows ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id != null ? String(row.id) : null,
      action: asTrimmedString(row.action),
      entity_type: asTrimmedString(row.entity_type),
      entity_id: row.entity_id != null ? String(row.entity_id) : null,
      details: row.details ?? null,
      created_at: asTrimmedString(row.created_at) || null,
    }))

    return NextResponse.json({
      worker: {
        id: String(worker.id),
        first_name: worker.first_name,
        last_name: worker.last_name,
        job_role: worker.job_role,
        city: worker.city,
        state: worker.state,
        created_at: worker.created_at,
        updated_at: worker.updated_at ?? worker.created_at,
        status: statusNorm,
        status_label:
          statusNorm === "new"
            ? "New Applicant"
            : statusNorm.charAt(0).toUpperCase() + statusNorm.slice(1),
      },
      meta: {
        daysInStage,
        progressPercent,
        completedItems: verifiedDone + completedAssessments,
        totalItems: verifiedTotal + totalAssessments,
        verifiedDocuments: { done: verifiedDone, total: verifiedTotal },
        skillAssessments: { completed: completedAssessments, total: totalAssessments },
      },
      tracker: {
        labels: trackerLabels,
        done: trackDone,
      },
      sections,
      activity_history: activityHistory,
    })
  } catch (err: unknown) {
    console.error("[admin/worker-checklist]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
