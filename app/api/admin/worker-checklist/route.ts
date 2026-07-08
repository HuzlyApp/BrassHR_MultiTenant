import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { writeActivityLog } from "@/lib/audit/activity-log"
import { requireApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/app-role"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { resolveWorkerProfilePhotoUrl } from "@/lib/applicant-portal/worker-profile-photo"
import { parseRequiredUuid } from "@/lib/validation/uuid"
import {
  attachmentRequirementHasUpload,
  buildLegacyAttachmentRequirements,
} from "@/lib/onboarding/build-admin-attachment-requirements"
import { loadAdminAttachmentRequirements } from "@/lib/onboarding/load-admin-attachment-requirements"
import { normalizeResumeStorageObjectPath } from "@/lib/onboarding/normalize-resume-storage-path"
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets"
import {
  buildPipelineDetailLine,
  getPipelineItemDef,
  loadWorkerPipelineChecklistItems,
  pipelineCheckboxLabel,
  pipelineItemIsComplete,
  pipelineSectionComplete,
  type PipelineChecklistItemKey,
} from "@/lib/worker-pipeline-checklist"
import { loadWorkerCallLogs, type CallLogOutcome } from "@/lib/admin/worker-call-logs"
import {
  areFinalApprovalPrerequisitesMet,
  shouldPromoteToForApproval,
} from "@/lib/admin/promote-for-approval"
import { isEligibleForFinalApprovalView } from "@/lib/admin/final-approval"
import { formatPipelineStatusLabel } from "@/lib/workers/candidate-status-label"

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
  callLogCompleted?: boolean
  checkboxLabel?: string
  callOutcome?: "answered" | "no_answer" | null
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
      .select(
        "id, user_id, tenant_id, first_name, last_name, email, job_role, created_at, updated_at, city, state, status, profile_photo"
      )
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

    const checklistTenantId =
      worker.tenant_id != null && String(worker.tenant_id).trim() !== ""
        ? String(worker.tenant_id)
        : null

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      tenantId: checklistTenantId,
      action: isStaffRole(auth.role) ? "worker.checklist.view" : "worker.checklist.self_view",
      entityType: "worker",
      entityId: workerId,
      metadata: {
        route: "GET /api/admin/worker-checklist",
        staff: isStaffRole(auth.role),
        tenant_id: checklistTenantId,
      },
      request: req,
    })

    const statusRaw = worker.status as string | null | undefined
    let statusNorm = typeof statusRaw === "string" ? statusRaw.trim().toLowerCase() : "new"

    const { data: docRow } = await supabase
      .from("worker_documents")
      .select("*")
      .eq("worker_id", workerId)
      .maybeSingle()

    const docs = docRow as Record<string, unknown> | null

    const { data: reqRows } = await supabase
      .from("worker_requirements")
      .select("resume_path")
      .eq("worker_id", workerId)
      .limit(1)
    const resumePathRaw = (reqRows?.[0] as { resume_path?: string } | undefined)?.resume_path ?? null
    const resumePath = resumePathRaw ? normalizeResumeStorageObjectPath(String(resumePathRaw)) : null

    let resumeUrl: string | null = null
    if (resumePath) {
      const { data: signed } = await supabase.storage
        .from(WORKER_RESUMES_BUCKET)
        .createSignedUrl(resumePath, 3600)
      resumeUrl = signed?.signedUrl ?? null
    }

    const legacyUrls = {
      nursing_license_url: asTrimmedString(docs?.nursing_license_url) || null,
      tb_test_url: asTrimmedString(docs?.tb_test_url) || null,
      cpr_certification_url: asTrimmedString(docs?.cpr_certification_url) || null,
      authorization_document_url: asTrimmedString(docs?.document_url) || null,
      ssn_url: asTrimmedString(docs?.ssn_url) || null,
      drivers_license_url: asTrimmedString(docs?.drivers_license_url) || null,
    }

    const tenantId = checklistTenantId

    let attachmentRequirements = tenantId
      ? await loadAdminAttachmentRequirements({
          supabase,
          workerId,
          tenantId,
          resumeUrl,
          resumePath,
          resumePathRaw: resumePathRaw ? String(resumePathRaw) : null,
          legacyUrls,
        }).catch(() => [] as Awaited<ReturnType<typeof loadAdminAttachmentRequirements>>)
      : buildLegacyAttachmentRequirements({
          config: null,
          resumeUrl,
          resumePath,
          resumePathRaw: resumePathRaw ? String(resumePathRaw) : null,
          legacyUrls,
          submittedByRequiredId: new Map(),
          useLegacyFallback: true,
        })

    const documentChecks = attachmentRequirements.map((req) => ({
      id: req.id,
      title: req.title,
      ok: attachmentRequirementHasUpload(req),
    }))

    const verifiedDone = documentChecks.filter((d) => d.ok).length
    const verifiedTotal = Math.max(documentChecks.length, 1)

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

    const pipelineRowsByKey = await loadWorkerPipelineChecklistItems(supabase, workerId)

    const callLogs = await loadWorkerCallLogs(supabase, workerId).catch(() => [])
    const callLogOutcomeById = new Map<string, CallLogOutcome>(
      callLogs.map((log) => [log.id, log.outcome])
    )

    function callRowOutcome(itemKey: "call_1" | "call_2"): CallLogOutcome | null {
      const ref = pipelineRowsByKey.get(itemKey)?.call_log_ref?.trim() || null
      if (ref && callLogOutcomeById.has(ref)) return callLogOutcomeById.get(ref) ?? null
      return null
    }

    function buildPipelineChecklistRow(itemKey: PipelineChecklistItemKey): ChecklistRow {
      const def = getPipelineItemDef(itemKey)
      const row = pipelineRowsByKey.get(itemKey)
      const isComplete = pipelineItemIsComplete(row)

      if (itemKey === "call_1" || itemKey === "call_2") {
        const outcome = callRowOutcome(itemKey)
        if (outcome === "no_answer") {
          return {
            id: itemKey,
            title: def.title,
            subtitle: def.subtitle,
            optional: def.optional,
            state: "not_reachable",
            checked: false,
            badge: "No answer",
            detailLine: "No answer — call again",
            callLogCompleted: false,
            checkboxLabel: pipelineCheckboxLabel(itemKey),
            callOutcome: "no_answer",
          }
        }
        if (outcome === "answered" || isComplete) {
          return {
            id: itemKey,
            title: def.title,
            subtitle: def.subtitle,
            optional: def.optional,
            state: "answered",
            checked: true,
            badge: "Answered",
            detailLine: buildPipelineDetailLine(itemKey, row, true),
            callLogCompleted: row?.call_log_completed === true,
            checkboxLabel: pipelineCheckboxLabel(itemKey),
            callOutcome: "answered",
          }
        }
        return {
          id: itemKey,
          title: def.title,
          subtitle: def.subtitle,
          optional: def.optional,
          state: "pending",
          checked: false,
          badge: "Pending",
          detailLine: "No call logs synced yet",
          callLogCompleted: false,
          checkboxLabel: pipelineCheckboxLabel(itemKey),
          callOutcome: null,
        }
      }

      const state: ItemState = isComplete
        ? "complete"
        : def.optional
          ? "not_applicable"
          : "pending"
      const detailLine = buildPipelineDetailLine(itemKey, row, isComplete)
      return {
        id: itemKey,
        title: def.title,
        subtitle: def.subtitle,
        optional: def.optional,
        state,
        checked: isComplete,
        badge: stateBadge(state, isComplete ? "Complete" : "Pending"),
        detailLine,
        callLogCompleted: row?.call_log_completed === true,
        checkboxLabel: pipelineCheckboxLabel(itemKey),
      }
    }

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
          ...documentChecks.map((doc) => ({
            id: `doc_${doc.id}`,
            title: doc.title,
            state: doc.ok ? ("uploaded" as const) : ("pending" as const),
            checked: doc.ok,
            badge: doc.ok ? "Uploaded" : "Pending",
          })),
        ],
      },
      {
        id: "screening",
        title: "Initial Screening / Interview",
        subtitle: "Call attempts and interview status",
        rows: [
          buildPipelineChecklistRow("call_1"),
          buildPipelineChecklistRow("call_2"),
        ],
      },
      {
        id: "compliance",
        title: "Pre-employment Compliance Screening",
        subtitle: "OIG, drug screen, and background",
        rows: [
          buildPipelineChecklistRow("oig"),
          buildPipelineChecklistRow("drug"),
          buildPipelineChecklistRow("bg"),
        ],
      },
      {
        id: "facility_req",
        title: "Facility Specific Requirements",
        subtitle: "eSign and statements",
        rows: [
          buildPipelineChecklistRow("fac_approval"),
          buildPipelineChecklistRow("sworn"),
        ],
      },
      {
        id: "new_hire",
        title: "New Hire Agreement",
        subtitle: "Payroll and workforce accounts",
        rows: [
          buildPipelineChecklistRow("w2_i9"),
          buildPipelineChecklistRow("everify"),
          buildPipelineChecklistRow("wheniwork"),
          buildPipelineChecklistRow("paychex"),
        ],
      },
      {
        id: "final",
        title: "Final Onboarding Steps",
        subtitle: "Welcome communication and badge",
        rows: [
          buildPipelineChecklistRow("welcome_email"),
          buildPipelineChecklistRow("badge"),
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
      pipelineSectionComplete("screening", pipelineRowsByKey),
      pipelineSectionComplete("compliance", pipelineRowsByKey),
      pipelineSectionComplete("facility_req", pipelineRowsByKey),
      pipelineSectionComplete("new_hire", pipelineRowsByKey),
      pipelineSectionComplete("final", pipelineRowsByKey),
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

    const { count: referencesCount } = await supabase
      .from("worker_references")
      .select("id", { count: "exact", head: true })
      .eq("worker_id", workerId)

    const prerequisitesComplete = areFinalApprovalPrerequisitesMet({
      hasWorker: true,
      sections,
      skillAssessments: { completed: completedAssessments, total: totalAssessments },
      referencesCount: referencesCount ?? 0,
    })
    const finalApprovalReady = isEligibleForFinalApprovalView({
      workerStatus: statusNorm,
      checklistProgressPercent: progressPercent,
      onboardingCompletionPercent: progressPercent,
      trackerDoneCount: trackDone.filter(Boolean).length,
    })

    if (
      shouldPromoteToForApproval({
        workerId,
        currentStatus: statusNorm,
        prerequisitesComplete,
        finalApprovalReady,
      })
    ) {
      const now = new Date().toISOString()
      const { error: promoteErr } = await supabase
        .from("worker")
        .update({ status: "for_approval", updated_at: now })
        .eq("id", workerId)
      if (!promoteErr) {
        statusNorm = "for_approval"
      }
    }

    return NextResponse.json({
      worker: {
        id: String(worker.id),
        first_name: worker.first_name,
        last_name: worker.last_name,
        email: worker.email != null ? String(worker.email) : null,
        job_role: worker.job_role,
        city: worker.city,
        state: worker.state,
        created_at: worker.created_at,
        updated_at: worker.updated_at ?? worker.created_at,
        status: statusNorm,
        status_label: formatPipelineStatusLabel(statusNorm),
        profile_photo_url: await resolveWorkerProfilePhotoUrl(
          supabase,
          (worker as { profile_photo?: unknown }).profile_photo
        ),
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
      permissions: {
        canManualCompleteScreening: isStaffRole(auth.role),
        canManualCompletePipeline: isStaffRole(auth.role),
      },
    })
  } catch (err: unknown) {
    console.error("[admin/worker-checklist]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
