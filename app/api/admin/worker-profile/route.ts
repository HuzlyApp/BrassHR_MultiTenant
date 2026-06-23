import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { writeActivityLog } from "@/lib/audit/activity-log"
import { mapAdminOnboardingProgress } from "@/lib/admin-onboarding-progress"
import { loadAdminAttachmentRequirements } from "@/lib/onboarding/load-admin-attachment-requirements"
import { requireApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/app-role"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import { normalizeResumeStorageObjectPath } from "@/lib/onboarding/normalize-resume-storage-path"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets"
import { resolveStorageAccessibleUrl } from "@/lib/supabase/resolve-storage-accessible-url"
import { resolveWorkerProfilePhotoUrl } from "@/lib/applicant-portal/worker-profile-photo"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

function hasUrl(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0
}

function urlOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null
  const s = v.trim()
  return s.length > 0 ? s : null
}

function titleCaseStatus(s: string | null | undefined): string {
  const v = (s || "").trim().toLowerCase()
  if (!v) return "New Applicant"
  if (v === "new") return "New Applicant"
  return v.charAt(0).toUpperCase() + v.slice(1)
}

type ZohoSignRow = {
  request_id: string | null
  zoho_document_id: string | null
  status: string | null
  updated_at: string | null
}

type StorageHit = {
  bucket: string
  path: string
  name: string
  created_at: string | null
}

type ClassifiedDocType = "license" | "tb" | "cpr" | "authorization" | "agreement_w2" | "agreement_i9"

function asTrimmedString(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((item) => String(item).trim()).filter((x) => x.length > 0)
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
      .select("*")
      .eq("id", workerId)
      .maybeSingle()

    if (wErr) throw wErr
    if (!worker?.id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    }

    const w = worker as Record<string, unknown>
    if (!canAccessWorkerRecord(auth, { id: String(w.id), user_id: w.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const userIdForLegacy =
      w.user_id != null && String(w.user_id).trim() !== "" ? String(w.user_id) : null
    const tenantIdForWorker =
      w.tenant_id != null && String(w.tenant_id).trim() !== "" ? String(w.tenant_id) : null

    const workerEmail = w.email != null ? String(w.email).trim().toLowerCase() : ""

    const [tenantResult, reqResult, docResult] = await Promise.all([
      tenantIdForWorker
        ? supabase
            .from("tenants")
            .select("onboarding_config_version")
            .eq("id", tenantIdForWorker)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("worker_requirements")
        .select("resume_path")
        .or(
          userIdForLegacy
            ? `worker_id.eq.${workerId},worker_id.eq.${userIdForLegacy}`
            : `worker_id.eq.${workerId}`
        )
        .limit(1),
      supabase.from("worker_documents").select("*").eq("worker_id", workerId).maybeSingle(),
    ])

    let onboardingConfigVersion = 0
    if (tenantIdForWorker) {
      onboardingConfigVersion =
        (tenantResult.data as { onboarding_config_version?: number } | null)
          ?.onboarding_config_version ?? 0
    }
    const skipLegacyStorageScan = onboardingConfigVersion >= 1

    const { error: reqErr } = reqResult
    if (reqErr) {
      console.warn("[admin/worker-profile] worker_requirements", reqErr)
    }

    const reqRow = Array.isArray(reqResult.data) ? reqResult.data[0] : reqResult.data
    const resumePathRaw = (reqRow as { resume_path?: string } | null | undefined)?.resume_path
    const resumePathStored =
      typeof resumePathRaw === "string" && resumePathRaw.trim() !== ""
        ? resumePathRaw.trim()
        : null

    const resumePath = resumePathStored ? normalizeResumeStorageObjectPath(resumePathStored) : null
    const resumePathCanonical =
      resumePath && resumePath.length > 0 ? resumePath : null

    let resumeUrl: string | null = null
    if (resumePathCanonical) {
      const { data: signed, error: signErr } = await supabase.storage
        .from(WORKER_RESUMES_BUCKET)
        .createSignedUrl(resumePathCanonical, 3600)
      if (signErr) {
        console.warn("[admin/worker-profile] resume signed URL", signErr)
      } else {
        resumeUrl = signed?.signedUrl ?? null
      }
    }

    const { data: docRow } = docResult

    const docs = (docRow ?? null) as Record<string, unknown> | null
    const workerKeys = Array.from(
      new Set([workerId, userIdForLegacy].filter((x): x is string => Boolean(x && x.trim())))
    )

    let candidateBuckets: string[] = []
    let publicBucketSet = new Set<string>()
    let listHits: StorageHit[] = []

    if (!skipLegacyStorageScan) {
      const { data: allBuckets } = await supabase.storage.listBuckets()
      const bucketSet = new Set<string>((allBuckets ?? []).map((b) => b.id))
      candidateBuckets = Array.from(
        new Set(["docs", "worker_required_files", "worker-onboarding", "worker-resumes"])
      ).filter((bucket) => bucketSet.has(bucket))
      publicBucketSet = new Set<string>(
        (allBuckets ?? []).filter((b) => b.public).map((b) => b.id)
      )

      const candidatePaths = Array.from(
        new Set(
          workerKeys.flatMap((key) => [
            key,
            `license/${key}`,
            `tb/${key}`,
            `cpr/${key}`,
            `docs/${key}`,
            `authorization/${key}`,
            `agreement/${key}`,
            `onboarding/${key}`,
          ])
        )
      )
      const scanTargets = candidateBuckets.flatMap((bucket) =>
        candidatePaths.map((path) => ({ bucket, path }))
      )
      const listResults = await Promise.all(
        scanTargets.map(async ({ bucket, path }) => {
          const { data: files, error } = await supabase.storage.from(bucket).list(path, {
            limit: 25,
            sortBy: { column: "created_at", order: "desc" },
          })
          if (error || !Array.isArray(files)) return [] as StorageHit[]
          return files
            .filter((f) => Boolean(f?.name) && !String(f?.name).endsWith("/"))
            .map((f) => ({
              bucket,
              path: `${path}/${f.name}`,
              name: String(f.name),
              created_at: (f as { created_at?: string }).created_at ?? null,
            }))
        })
      )
      listHits = listResults.flat()
    }

    async function toAccessibleUrl(hit: StorageHit): Promise<string | null> {
      if (publicBucketSet.has(hit.bucket)) {
        return supabase.storage.from(hit.bucket).getPublicUrl(hit.path).data.publicUrl
      }
      const { data, error } = await supabase.storage.from(hit.bucket).createSignedUrl(hit.path, 3600)
      if (error) return null
      return data?.signedUrl ?? null
    }

    function classifyStorageHit(hit: StorageHit): ClassifiedDocType | null {
      const path = hit.path.toLowerCase()
      const name = hit.name.toLowerCase()
      const full = `${path} ${name}`
      if (
        path.startsWith("tb/") ||
        full.includes("tb test") ||
        full.includes("tb_test") ||
        full.includes("/tb-") ||
        full.includes("tuberculosis")
      ) {
        return "tb"
      }
      if (
        path.startsWith("cpr/") ||
        full.includes("cpr") ||
        full.includes("bls") ||
        full.includes("basic life support")
      ) {
        return "cpr"
      }
      if (
        full.includes("agreement_i9") ||
        full.includes("agreement-i9") ||
        (full.includes("/i9") && !full.includes("authorization"))
      ) {
        return "agreement_i9"
      }
      if (
        full.includes("agreement_w2") ||
        full.includes("agreement-w2") ||
        full.includes("/w2")
      ) {
        return "agreement_w2"
      }
      if (
        full.includes("authorization") ||
        full.includes("agreement") ||
        full.includes("w2") ||
        full.includes("i9") ||
        (hit.bucket === "worker-onboarding" && full.includes("document"))
      ) {
        return "authorization"
      }
      if (
        path.startsWith("license/") ||
        full.includes("nursing") ||
        full.includes("license")
      ) {
        return "license"
      }
      return null
    }

    function newestHit(hits: StorageHit[]): StorageHit | null {
      if (hits.length === 0) return null
      return [...hits].sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at) : 0
        const tb = b.created_at ? Date.parse(b.created_at) : 0
        return tb - ta
      })[0]
    }
    async function toAccessibleUrlIfAny(hit: StorageHit | null): Promise<string | null> {
      if (!hit) return null
      return toAccessibleUrl(hit)
    }

    const byType: Record<ClassifiedDocType, StorageHit[]> = {
      license: [],
      tb: [],
      cpr: [],
      authorization: [],
      agreement_w2: [],
      agreement_i9: [],
    }
    for (const hit of listHits) {
      const type = classifyStorageHit(hit)
      if (type) byType[type].push(hit)
    }
    const [
      storageNursingUrl,
      storageTbUrl,
      storageCprUrl,
      storageAuthUrlFromFiles,
      storageAgreementW2Url,
      storageAgreementI9Url,
    ] = await Promise.all([
      toAccessibleUrlIfAny(newestHit(byType.license)),
      toAccessibleUrlIfAny(newestHit(byType.tb)),
      toAccessibleUrlIfAny(newestHit(byType.cpr)),
      toAccessibleUrlIfAny(newestHit(byType.authorization)),
      toAccessibleUrlIfAny(newestHit(byType.agreement_w2)),
      toAccessibleUrlIfAny(newestHit(byType.agreement_i9)),
    ])
    const attachmentFiles = await Promise.all(
      listHits.slice(0, 12).map(async (hit) => ({
        bucket: hit.bucket,
        path: hit.path,
        name: hit.name,
        created_at: hit.created_at,
        url: await toAccessibleUrl(hit),
      }))
    )
    async function resolveDocUrl(stored: unknown, storageFallback: string | null): Promise<string | null> {
      const fromDb = await resolveStorageAccessibleUrl(supabase, urlOrNull(stored))
      return fromDb ?? storageFallback
    }

    const [
      refResult,
      workerRoleResult,
      activityResult,
      noteResult,
      zohoResult,
      legacyReviewResult,
      nursingLicenseUrlResolved,
      tbTestUrlResolved,
      cprCertUrlResolved,
      ssnUrl,
      ssnBackUrl,
      driversLicenseUrl,
      driversLicenseBackUrl,
      agreementW2UrlResolved,
      agreementI9UrlResolved,
    ] = await Promise.all([
      supabase
        .from("worker_references")
        .select("id, reference_first_name, reference_last_name, reference_phone, reference_email, created_at")
        .eq("worker_id", workerId)
        .order("created_at", { ascending: true })
        .limit(10),
      supabase.from("worker_category_roles").select("*").eq("worker_id", workerId),
      supabase
        .from("activity_logs")
        .select("*")
        .eq("entity_id", workerId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("worker_notes")
        .select("id, body, created_at, updated_at, created_by_user_id")
        .eq("worker_id", workerId)
        .order("created_at", { ascending: false })
        .limit(50),
      workerEmail
        ? supabase
            .from("zoho_sign_requests")
            .select("request_id,zoho_document_id,status,updated_at")
            .eq("email", workerEmail)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("worker_legacy_document_reviews")
        .select("document_key, status")
        .eq("worker_id", workerId),
      resolveDocUrl(docs?.nursing_license_url, storageNursingUrl),
      resolveDocUrl(docs?.tb_test_url, storageTbUrl),
      resolveDocUrl(docs?.cpr_certification_url, storageCprUrl),
      resolveDocUrl(docs?.ssn_url, null),
      resolveDocUrl(docs?.ssn_back_url, null),
      resolveDocUrl(docs?.drivers_license_url, null),
      resolveDocUrl(docs?.drivers_license_back_url, null),
      resolveDocUrl(docs?.agreement_w2_url, storageAgreementW2Url),
      resolveDocUrl(docs?.agreement_i9_url, storageAgreementI9Url),
    ])

    const nursingLicenseUrl = nursingLicenseUrlResolved ?? storageNursingUrl
    const tbTestUrl = tbTestUrlResolved ?? storageTbUrl
    const cprCertUrl = cprCertUrlResolved ?? storageCprUrl
    const licenseOk = hasUrl(nursingLicenseUrl)
    const tbOk = hasUrl(tbTestUrl)
    const cprOk = hasUrl(cprCertUrl)
    const idOk = hasUrl(docs?.ssn_url) || hasUrl(docs?.drivers_license_url)

    const { data: refRows } = refResult

    const references = (refRows ?? []).map((r) => {
      const row = r as Record<string, unknown>
      const fn = String(row.reference_first_name ?? "").trim()
      const ln = String(row.reference_last_name ?? "").trim()
      const name = `${fn} ${ln}`.trim() || "—"
      return {
        id: String(row.id),
        name,
        phone: row.reference_phone != null ? String(row.reference_phone) : null,
        email: row.reference_email != null ? String(row.reference_email) : null,
      }
    })

    let skillAssessmentRows: Record<string, unknown>[] = []
    let saCompleted = 0
    let saTotal = 0

    const positions = toStringArray(w.positions)
    const experienceYearsRaw = w.experience_years ?? w.years_experience
    const experienceYears =
      typeof experienceYearsRaw === "number"
        ? experienceYearsRaw
        : experienceYearsRaw != null && String(experienceYearsRaw).trim() !== ""
          ? Number(experienceYearsRaw)
          : null

    const { data: workerRoleRows } = workerRoleResult
    const workerRoles = ((workerRoleRows ?? []) as Record<string, unknown>[]).filter(
      (row) => row != null
    )
    const categoryIds = workerRoles
      .map((row) => String(row.job_category_id ?? "").trim())
      .filter((id) => id.length > 0)
    const { data: jobCategoryRows } = await supabase
      .from("job_categories")
      .select("*")
      .in("id", categoryIds.length > 0 ? categoryIds : ["00000000-0000-0000-0000-000000000000"])
    const jobCategoryById = new Map<string, Record<string, unknown>>(
      ((jobCategoryRows ?? []) as Record<string, unknown>[]).map((row) => [String(row.id ?? ""), row])
    )
    const roleAssignments = workerRoles.map((row) => {
      const categoryId = String(row.job_category_id ?? "")
      const cat = jobCategoryById.get(categoryId)
      return {
        role: asTrimmedString(row.role),
        job_category_id: categoryId || null,
        job_category_name: asTrimmedString(cat?.name),
        created_at: asTrimmedString(row.created_at),
      }
    })

    const workerAuthId = asTrimmedString(w.user_id)
    const facilityAssignments: Array<Record<string, unknown>> = []
    if (workerAuthId) {
      const { data: assignmentRows } = await supabase
        .from("worker_shift_assignments")
        .select("*")
        .eq("worker_id", workerAuthId)
      const assignments = (assignmentRows ?? []) as Record<string, unknown>[]
      if (assignments.length > 0) {
        const shiftIds = assignments
          .map((row) => String(row.shift_id ?? "").trim())
          .filter((id) => id.length > 0)
        const { data: shiftRows } = await supabase
          .from("shifts")
          .select("*")
          .in("id", shiftIds.length > 0 ? shiftIds : ["00000000-0000-0000-0000-000000000000"])
        const shiftById = new Map<string, Record<string, unknown>>(
          ((shiftRows ?? []) as Record<string, unknown>[]).map((row) => [String(row.id ?? ""), row])
        )
        const facilityIds = ((shiftRows ?? []) as Record<string, unknown>[])
          .map((row) => String(row.facility_id ?? "").trim())
          .filter((id) => id.length > 0)
        const { data: facilityRows } = await supabase
          .from("facility")
          .select("*")
          .in(
            "id",
            facilityIds.length > 0 ? facilityIds : ["00000000-0000-0000-0000-000000000000"]
          )
        const facilityById = new Map<string, Record<string, unknown>>(
          ((facilityRows ?? []) as Record<string, unknown>[]).map((row) => [String(row.id ?? ""), row])
        )
        for (const assignment of assignments) {
          const shift = shiftById.get(String(assignment.shift_id ?? ""))
          const facility = shift ? facilityById.get(String(shift.facility_id ?? "")) : null
          facilityAssignments.push({
            assignment_id: assignment.id ?? null,
            assigned_at: asTrimmedString(assignment.assigned_at),
            status: asTrimmedString(assignment.status),
            shift_id: assignment.shift_id ?? null,
            shift_title: asTrimmedString(shift?.title),
            facility_id: shift?.facility_id ?? null,
            facility_name: asTrimmedString(facility?.name),
            facility_address: asTrimmedString(facility?.address),
          })
        }
      }
    }

    const { data: activityRows } = activityResult
    const activityLogs = ((activityRows ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id ?? null,
      action: asTrimmedString(row.action),
      entity_type: asTrimmedString(row.entity_type),
      entity_id: row.entity_id ?? null,
      details: row.details ?? null,
      created_at: asTrimmedString(row.created_at),
    }))

    const { data: noteRows, error: notesErr } = noteResult
    if (notesErr) {
      console.warn("[admin/worker-profile] worker_notes", notesErr)
    }
    const noteAuthorIds = [
      ...new Set(
        ((noteRows ?? []) as { created_by_user_id?: string | null }[])
          .map((row) => row.created_by_user_id)
          .filter((id): id is string => Boolean(id))
      ),
    ]
    const noteAuthorsById = new Map<string, { first_name: string | null; last_name: string | null }>()
    if (noteAuthorIds.length > 0) {
      const { data: noteAuthors } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .in("id", noteAuthorIds)
      for (const author of (noteAuthors ?? []) as {
        id: string
        first_name: string | null
        last_name: string | null
      }[]) {
        noteAuthorsById.set(author.id, author)
      }
    }
    const workerNotes = ((noteRows ?? []) as Record<string, unknown>[]).map((row) => {
      const authorId =
        row.created_by_user_id != null ? String(row.created_by_user_id) : null
      const author = authorId ? noteAuthorsById.get(authorId) : null
      const authorName = author
        ? `${author.first_name ?? ""} ${author.last_name ?? ""}`.trim() || "Recruiter"
        : "Recruiter"
      return {
        id: row.id ?? null,
        body: asTrimmedString(row.body),
        created_at: asTrimmedString(row.created_at),
        updated_at: asTrimmedString(row.updated_at),
        author_name: authorName,
      }
    })

    let zohoSign: ZohoSignRow | null = null
    const { data: zohoRow, error: zohoErr } = zohoResult
    if (zohoErr) {
      console.warn("[admin/worker-profile] zoho_sign_requests", zohoErr)
    } else {
      zohoSign = (zohoRow as ZohoSignRow | null) ?? null
    }

    const applicantName = `${String(w.first_name ?? "").trim()} ${String(w.last_name ?? "").trim()}`.trim() || "Applicant"
    const mapped = await mapAdminOnboardingProgress({
      supabase,
      workerId,
      userId: userIdForLegacy,
      applicantName,
      workerDocuments: docs,
      resumePathRaw: resumePathStored,
      candidateBuckets,
      storageHits: listHits,
      zohoStatus: zohoSign?.status ?? null,
      referencesCount: references.length,
    })
    skillAssessmentRows = mapped.skillAssessments.rows
    saCompleted = mapped.skillAssessments.completed
    saTotal = mapped.skillAssessments.total
    const onboardingSteps = mapped.steps
    const onboardingCompletion = {
      completedSteps: mapped.completedSteps,
      totalSteps: mapped.totalSteps,
      percent: mapped.completionPercent,
    }

    const createdAt = w.created_at != null ? String(w.created_at) : null
    const updatedAt = w.updated_at != null ? String(w.updated_at) : createdAt

    const statusRaw = (w.status ?? w.worker_status) as string | undefined
    const statusLabel = titleCaseStatus(statusRaw)

    const zohoAuthUrl =
      zohoSign?.request_id && zohoSign.request_id.trim().length > 0
        ? `/api/zoho-sign/document?request_id=${encodeURIComponent(zohoSign.request_id)}&mode=preview`
        : null
    const resolvedDocumentUrl = await resolveDocUrl(docs?.document_url, storageAuthUrlFromFiles)
    const storageAuthUrl = resolvedDocumentUrl ?? zohoAuthUrl
    const agreementW2Url =
      agreementW2UrlResolved ?? storageAgreementW2Url ?? storageAuthUrl
    const agreementI9Url = agreementI9UrlResolved ?? storageAgreementI9Url

    const legacyUrls = {
      nursing_license_url: nursingLicenseUrl,
      tb_test_url: tbTestUrl,
      cpr_certification_url: cprCertUrl,
      authorization_document_url: storageAuthUrl,
      agreement_w2_url: agreementW2Url,
      agreement_i9_url: agreementI9Url,
      ssn_url: ssnUrl,
      drivers_license_url: driversLicenseUrl,
    }

    const { data: legacyReviewRows } = legacyReviewResult
    const legacyDocumentReviews = Object.fromEntries(
      (legacyReviewRows ?? [])
        .map((row) => {
          const key = String((row as { document_key?: string }).document_key ?? "").trim()
          const status = String((row as { status?: string }).status ?? "").trim()
          return key && status ? [key, status] : null
        })
        .filter((entry): entry is [string, string] => entry != null)
    )

    let attachmentRequirements: Awaited<ReturnType<typeof loadAdminAttachmentRequirements>> = []
    if (tenantIdForWorker) {
      try {
        attachmentRequirements = await loadAdminAttachmentRequirements(
          {
            supabase,
            workerId,
            tenantId: tenantIdForWorker,
            resumeUrl,
            resumePath: resumePathCanonical,
            resumePathRaw: resumePathStored,
            legacyUrls,
          },
          { onboardingConfigVersion, legacyReviewRows: legacyReviewRows ?? [] }
        )
      } catch (attachErr) {
        console.warn("[admin/worker-profile] attachment requirements", attachErr)
      }
    }

    console.info("[debug-doc-upload] admin-worker-profile:attachment-mapping", {
      route: "GET /api/admin/worker-profile",
      workerId,
      workerUserId: userIdForLegacy,
      bucketCandidates: candidateBuckets,
      storageHits: listHits.length,
      classifiedCounts: {
        license: byType.license.length,
        tb: byType.tb.length,
        cpr: byType.cpr.length,
        authorization: byType.authorization.length,
      },
      dbUrls: {
        nursing_license_url: urlOrNull(docs?.nursing_license_url),
        tb_test_url: urlOrNull(docs?.tb_test_url),
        cpr_certification_url: urlOrNull(docs?.cpr_certification_url),
        document_url: urlOrNull(docs?.document_url),
      },
      resolvedUrls: {
        nursing_license_url: nursingLicenseUrl,
        tb_test_url: tbTestUrl,
        cpr_certification_url: cprCertUrl,
        authorization_document_url: storageAuthUrl,
      },
    })

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      tenantId: tenantIdForWorker,
      action: isStaffRole(auth.role) ? "worker.profile.view" : "worker.profile.self_view",
      entityType: "worker",
      entityId: workerId,
      metadata: {
        route: "GET /api/admin/worker-profile",
        staff: isStaffRole(auth.role),
        tenant_id: tenantIdForWorker,
      },
      request: req,
    })

    const profilePhotoUrl = await resolveWorkerProfilePhotoUrl(supabase, w.profile_photo)

    return NextResponse.json({
      worker: {
        id: String(w.id),
        first_name: w.first_name != null ? String(w.first_name) : null,
        last_name: w.last_name != null ? String(w.last_name) : null,
        email: w.email != null ? String(w.email) : null,
        phone: w.phone != null ? String(w.phone) : null,
        address1: w.address1 != null ? String(w.address1) : null,
        address2: w.address2 != null ? String(w.address2) : null,
        city: w.city != null ? String(w.city) : null,
        state: w.state != null ? String(w.state) : null,
        zip: w.zip != null ? String(w.zip) : null,
        job_role: w.job_role != null ? String(w.job_role) : null,
        created_at: createdAt,
        updated_at: updatedAt,
        status: statusRaw ?? "new",
        status_label: statusLabel,
        date_of_birth: w.date_of_birth != null ? String(w.date_of_birth) : null,
        years_experience:
          experienceYears,
        hourly_rate: w.hourly_rate != null ? String(w.hourly_rate) : null,
        ssn_last_four: w.ssn_last_four != null ? String(w.ssn_last_four) : null,
        positions,
        profile_photo_url: profilePhotoUrl,
        employee_id: asTrimmedString(w.employee_id) ?? asTrimmedString(w.employee_number),
        employee_number: asTrimmedString(w.employee_number),
        employment_type: asTrimmedString(w.employment_type),
        reports_to: asTrimmedString(w.reports_to) ?? asTrimmedString(w.manager_name),
      },
      requirements: {
        resume_path: resumePathCanonical,
        resume_path_raw: resumePathStored,
        resume_url: resumeUrl,
      },
      documents: docs
        ? {
            updated_at: docs.updated_at != null ? String(docs.updated_at) : null,
            nursing_license_url: licenseOk,
            tb_test_url: tbOk,
            cpr_certification_url: cprOk,
            identity_uploaded: idOk,
          }
        : null,
      document_urls: {
        nursing_license_url: nursingLicenseUrl,
        tb_test_url: tbTestUrl,
        cpr_certification_url: cprCertUrl,
        ssn_url: ssnUrl,
        ssn_back_url: ssnBackUrl,
        drivers_license_url: driversLicenseUrl,
        drivers_license_back_url: driversLicenseBackUrl,
        authorization_document_url: storageAuthUrl,
        agreement_w2_url: agreementW2Url,
        agreement_i9_url: agreementI9Url,
      },
      signeasy: {
        document_name:
          docs != null && docs.document_name != null ? String(docs.document_name) : null,
        document_id:
          docs != null && docs.document_id != null ? String(docs.document_id) : null,
      },
      zoho_sign: {
        request_id: zohoSign?.request_id ?? null,
        document_id: zohoSign?.zoho_document_id ?? null,
        status: zohoSign?.status ?? null,
        updated_at: zohoSign?.updated_at ?? null,
      },
      references,
      skillAssessments: { completed: saCompleted, total: saTotal, rows: skillAssessmentRows },
      onboardingSteps,
      onboardingCompletion,
      nursing_licenses: [
        {
          license_url: urlOrNull(docs?.nursing_license_url),
          state: asTrimmedString(w.state),
          license_type: asTrimmedString(w.job_role),
          expires_at: null,
        },
      ].filter((row) => row.license_url != null),
      education: {
        source: resumePathCanonical ? "worker_requirements.resume_path" : "none",
        resume_available: Boolean(resumePathCanonical),
        items: [] as Array<Record<string, unknown>>,
      },
      experience: {
        years: experienceYears,
        job_role: asTrimmedString(w.job_role),
        positions,
        role_assignments: roleAssignments,
      },
      skills: {
        positions,
        role_assignments: roleAssignments,
        assessed_categories: skillAssessmentRows.map((row) => ({
          category: asTrimmedString(row.category),
          category_title: asTrimmedString(row.category_title),
          completed: row.completed === true,
        })),
      },
      facilities_assigned: facilityAssignments,
      notes: workerNotes,
      attachment_files: attachmentFiles,
      attachment_requirements: attachmentRequirements,
      legacy_document_reviews: legacyDocumentReviews,
      activity_logs: activityLogs,
      activity_history: activityLogs,
      activity: {
        source: "Onboarding application",
        created_at: createdAt,
        updated_at: updatedAt,
      },
    })
  } catch (err: unknown) {
    console.error("[admin/worker-profile]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
