import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeResumeStorageObjectPath } from "@/lib/onboarding/normalize-resume-storage-path"

type JsonRow = Record<string, unknown>

type StepState = "complete" | "in_progress" | "pending"

type ProgressStep = {
  id: string
  label: string
  state: StepState
  detail?: string
}

type StorageHit = {
  bucket: string
  path: string
  name: string
  created_at: string | null
}

type MapperArgs = {
  supabase: SupabaseClient
  workerId: string
  userId: string | null
  applicantName: string
  workerDocuments: JsonRow | null
  resumePathRaw: string | null
  candidateBuckets: string[]
  storageHits: StorageHit[]
  zohoStatus: string | null
  referencesCount: number
}

type MapperResult = {
  steps: ProgressStep[]
  skillAssessments: { completed: number; total: number; rows: JsonRow[] }
}

function hasUrl(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0
}

function step(done: boolean, partial: boolean): StepState {
  if (done) return "complete"
  if (partial) return "in_progress"
  return "pending"
}

function isZohoSigned(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase()
  return s === "signed" || s === "completed"
}

function classifyStoragePath(path: string): "license" | "tb" | "cpr" | "authorization" | "resume" | null {
  const p = path.toLowerCase()
  if (p.startsWith("license/") && p.includes("authorization")) return "authorization"
  if (p.startsWith("authorization/") || p.includes("/authorization/") || p.includes("agreement")) {
    return "authorization"
  }
  if (p.startsWith("tb/") || p.includes("tb-test")) return "tb"
  if (p.startsWith("cpr/") || p.includes("cpr")) return "cpr"
  if (p.startsWith("license/")) return "license"
  if (p.includes("resume")) return "resume"
  return null
}

export async function mapAdminOnboardingProgress({
  supabase,
  workerId,
  userId,
  applicantName,
  workerDocuments,
  resumePathRaw,
  candidateBuckets,
  storageHits,
  zohoStatus,
  referencesCount,
}: MapperArgs): Promise<MapperResult> {
  const normalizedResumePath = resumePathRaw ? normalizeResumeStorageObjectPath(resumePathRaw) : null
  const resumeStoragePathCandidates = [
    normalizedResumePath,
    resumePathRaw,
    userId ? `${userId}/${(resumePathRaw ?? "").split("/").pop()}` : null,
  ].filter((x): x is string => Boolean(x && x.trim()))

  const resumeStorageFound = storageHits.some((hit) => {
    if (hit.bucket !== "worker-resumes") return false
    return resumeStoragePathCandidates.some((candidate) => hit.path === candidate || hit.path.endsWith(candidate))
  })

  const profileExists = true
  const resumeExists = Boolean(normalizedResumePath) || resumeStorageFound

  const storageClassified = storageHits.reduce(
    (acc, hit) => {
      const type = classifyStoragePath(hit.path)
      if (type) acc[type] += 1
      return acc
    },
    { license: 0, tb: 0, cpr: 0, authorization: 0, resume: 0 }
  )

  const licenseChecks = [
    hasUrl(workerDocuments?.nursing_license_url) || storageClassified.license > 0,
    hasUrl(workerDocuments?.tb_test_url) || storageClassified.tb > 0,
    hasUrl(workerDocuments?.cpr_certification_url) || storageClassified.cpr > 0,
  ]
  const licenseCount = licenseChecks.filter(Boolean).length
  const licenseRequiredCount = licenseChecks.length

  const { data: skillAssessmentRowsRaw } = await supabase
    .from("skill_assessments")
    .select("*")
    .eq("worker_id", workerId)
  const skillAssessmentRows = (skillAssessmentRowsRaw ?? []) as JsonRow[]

  const categorySlugs = skillAssessmentRows
    .map((row) => String(row.category ?? "").trim())
    .filter((slug) => slug.length > 0)

  const { data: categoryRowsRaw } = await supabase
    .from("skill_categories")
    .select("id,slug,title")
    .in("slug", categorySlugs.length > 0 ? categorySlugs : ["__none__"])
  const categoryRows = (categoryRowsRaw ?? []) as JsonRow[]
  const categoryBySlug = new Map<string, JsonRow>(
    categoryRows.map((row) => [String(row.slug ?? "").trim(), row])
  )

  const categoryIds = categoryRows
    .map((row) => String(row.id ?? "").trim())
    .filter((id) => id.length > 0)

  const { data: questionRowsRaw } = await supabase
    .from("skill_questions")
    .select("id,category_id")
    .in("category_id", categoryIds.length > 0 ? categoryIds : ["00000000-0000-0000-0000-000000000000"])
  const questionRows = (questionRowsRaw ?? []) as JsonRow[]
  const requiredByCategory = new Map<string, number>()
  for (const row of questionRows) {
    const categoryId = String(row.category_id ?? "").trim()
    if (!categoryId) continue
    requiredByCategory.set(categoryId, (requiredByCategory.get(categoryId) ?? 0) + 1)
  }

  const applicantIdCandidates = [workerId, userId].filter((id): id is string => Boolean(id && id.trim()))
  const { data: answerRowsRaw } = await supabase
    .from("applicant_skill_assessment_answers")
    .select("applicant_id,category_id,skill_id")
    .in("applicant_id", applicantIdCandidates.length > 0 ? applicantIdCandidates : [workerId])
  const answerRows = (answerRowsRaw ?? []) as JsonRow[]
  const answeredByCategory = new Map<string, number>()
  for (const row of answerRows) {
    const categoryId = String(row.category_id ?? "").trim()
    if (!categoryId) continue
    answeredByCategory.set(categoryId, (answeredByCategory.get(categoryId) ?? 0) + 1)
  }

  let saCompleted = 0
  let saTotal = skillAssessmentRows.length
  for (const row of skillAssessmentRows) {
    const slug = String(row.category ?? "").trim()
    const category = categoryBySlug.get(slug)
    const categoryId = String(category?.id ?? "").trim()
    const required = categoryId ? (requiredByCategory.get(categoryId) ?? 0) : 0
    const normalizedAnswered = categoryId ? (answeredByCategory.get(categoryId) ?? 0) : 0
    const answersJson =
      row.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
        ? (row.answers as Record<string, unknown>)
        : {}
    const jsonAnswered = Object.keys(answersJson).length
    const answered = Math.max(normalizedAnswered, jsonAnswered)
    const rowCompleted = row.completed === true || (required > 0 ? answered >= required : answered > 0)
    row.category_id = categoryId || null
    row.category_title = String(category?.title ?? slug)
    row.answered_count = answered
    row.required_question_count = required
    row.completed = rowCompleted
    if (rowCompleted) saCompleted += 1
  }

  // If rows are missing but answer rows exist, derive dynamic totals from answer categories.
  if (saTotal === 0 && answeredByCategory.size > 0) {
    saTotal = answeredByCategory.size
    saCompleted = 0
    for (const [categoryId, answered] of answeredByCategory.entries()) {
      const required = requiredByCategory.get(categoryId) ?? 0
      if ((required > 0 && answered >= required) || (required === 0 && answered > 0)) {
        saCompleted += 1
      }
    }
  }

  const ssnUploaded =
    hasUrl(workerDocuments?.ssn_url) ||
    storageHits.some((hit) => hit.bucket === "worker_required_files" && hit.path.toLowerCase().startsWith(`ssn/${userId ?? ""}/`))
  const driversUploaded =
    hasUrl(workerDocuments?.drivers_license_url) ||
    storageHits.some((hit) => hit.bucket === "worker_required_files" && hit.path.toLowerCase().startsWith(`license/${userId ?? ""}/`))
  const authorizationUploaded =
    hasUrl(workerDocuments?.document_url) ||
    storageClassified.authorization > 0 ||
    isZohoSigned(zohoStatus)
  const authChecks = [authorizationUploaded, ssnUploaded, driversUploaded]
  const authDocsCount = authChecks.filter(Boolean).length
  const authDocsRequiredCount = authChecks.length

  const referencesRequiredCount = 2
  const referencesComplete = referencesCount >= referencesRequiredCount

  const steps: ProgressStep[] = [
    {
      id: "resume",
      label: "Add Resume / Profile",
      state: step(profileExists && resumeExists, profileExists && !resumeExists),
    },
    {
      id: "license",
      label: "Professional License",
      state: step(licenseCount >= licenseRequiredCount, licenseCount > 0 && licenseCount < licenseRequiredCount),
      detail: `${licenseCount} of ${licenseRequiredCount}`,
    },
    {
      id: "skills",
      label: "Skill Assessment",
      state: step(saTotal > 0 && saCompleted >= saTotal, saCompleted > 0 && saCompleted < saTotal),
      detail: saTotal > 0 ? `${saCompleted} of ${saTotal}` : undefined,
    },
    {
      id: "auth_docs",
      label: "Authorizations & Documents",
      state: step(authDocsCount >= authDocsRequiredCount, authDocsCount > 0 && authDocsCount < authDocsRequiredCount),
      detail: `${authDocsCount} of ${authDocsRequiredCount}`,
    },
    {
      id: "references",
      label: "Add References",
      state: step(referencesComplete, referencesCount > 0 && !referencesComplete),
      detail: `${referencesCount} added`,
    },
  ]

  console.info("[debug-onboarding-progress] resume_profile", {
    applicantName,
    user_id: userId,
    worker_id: workerId,
    table_queried: "worker_requirements",
    storage_path_checked: resumeStoragePathCandidates,
    records_found: {
      resume_path_present: Boolean(resumePathRaw),
      resume_storage_hits: storageClassified.resume,
      resume_storage_match: resumeStorageFound,
    },
    computed_count: resumeExists ? 1 : 0,
    required_count: 1,
    final_status: steps[0].state,
  })

  console.info("[debug-onboarding-progress] professional_license", {
    applicantName,
    user_id: userId,
    worker_id: workerId,
    table_queried: "worker_documents",
    storage_path_checked: ["worker_required_files/license/{user_id}", "worker_required_files/tb/{user_id}", "worker_required_files/cpr/{user_id}"],
    records_found: {
      nursing_license_url: hasUrl(workerDocuments?.nursing_license_url),
      tb_test_url: hasUrl(workerDocuments?.tb_test_url),
      cpr_certification_url: hasUrl(workerDocuments?.cpr_certification_url),
      storage_classified: storageClassified,
    },
    computed_count: licenseCount,
    required_count: licenseRequiredCount,
    final_status: steps[1].state,
  })

  console.info("[debug-onboarding-progress] skill_assessment", {
    applicantName,
    user_id: userId,
    worker_id: workerId,
    table_queried: ["skill_assessments", "applicant_skill_assessment_answers", "skill_questions"],
    storage_path_checked: null,
    records_found: {
      skill_assessment_rows: skillAssessmentRows.length,
      answer_rows: answerRows.length,
      categories_from_skill_assessments: categorySlugs.length,
      categories_with_answers: answeredByCategory.size,
    },
    computed_count: saCompleted,
    required_count: saTotal,
    final_status: steps[2].state,
  })

  console.info("[debug-onboarding-progress] authorizations_documents", {
    applicantName,
    user_id: userId,
    worker_id: workerId,
    table_queried: ["worker_documents", "zoho_sign_requests"],
    storage_path_checked: ["worker_required_files/authorization/{user_id}", "worker_required_files/license/{user_id} (authorization file names)"],
    records_found: {
      zoho_signed: isZohoSigned(zohoStatus),
      ssn_uploaded: ssnUploaded,
      drivers_license_uploaded: driversUploaded,
      authorization_uploaded: authorizationUploaded,
      storage_classified: storageClassified,
    },
    computed_count: authDocsCount,
    required_count: authDocsRequiredCount,
    final_status: steps[3].state,
  })

  console.info("[debug-onboarding-progress] references", {
    applicantName,
    user_id: userId,
    worker_id: workerId,
    table_queried: "worker_references",
    storage_path_checked: null,
    records_found: referencesCount,
    computed_count: referencesCount,
    required_count: referencesRequiredCount,
    final_status: steps[4].state,
  })

  return {
    steps,
    skillAssessments: { completed: saCompleted, total: saTotal, rows: skillAssessmentRows },
  }
}
