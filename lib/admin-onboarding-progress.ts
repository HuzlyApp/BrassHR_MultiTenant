import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeResumeStorageObjectPath } from "@/lib/onboarding/normalize-resume-storage-path"
import { mapDynamicAdminOnboardingProgress } from "@/lib/onboarding/map-dynamic-admin-progress"
import { isFirmaSigningComplete } from "@/lib/onboarding/firma-step-settings"
import { loadWorkerSkillAssessmentProgress } from "@/lib/admin/worker-skill-assessment-progress"

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
  firmaSigningStatus: string | null
  referencesCount: number
}

type MapperResult = {
  steps: ProgressStep[]
  skillAssessments: { completed: number; total: number; rows: JsonRow[] }
  completedSteps: number
  totalSteps: number
  completionPercent: number
}

function hasUrl(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0
}

function step(done: boolean, partial: boolean): StepState {
  if (done) return "complete"
  if (partial) return "in_progress"
  return "pending"
}

function isFirmaSigned(status: string | null | undefined): boolean {
  return isFirmaSigningComplete(status)
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
  firmaSigningStatus,
  referencesCount,
}: MapperArgs): Promise<MapperResult> {
  const { data: workerTenant } = await supabase
    .from("worker")
    .select("tenant_id")
    .eq("id", workerId)
    .maybeSingle()

  const tenantId =
    workerTenant && typeof workerTenant === "object" && workerTenant.tenant_id != null
      ? String((workerTenant as { tenant_id: string }).tenant_id)
      : null

  const skillProgress = await loadWorkerSkillAssessmentProgress(supabase, workerId, userId)
  const skillAssessmentRows = skillProgress.rows
  const saCompleted = skillProgress.completed
  const saTotal = skillProgress.total

  if (tenantId) {
    try {
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("onboarding_config_version")
        .eq("id", tenantId)
        .maybeSingle()
      const version = (tenantRow as { onboarding_config_version?: number } | null)?.onboarding_config_version ?? 0
      if (version >= 1) {
        const dynamic = await mapDynamicAdminOnboardingProgress(supabase, workerId, tenantId)
        if (dynamic.steps.length > 0) {
          return {
            steps: dynamic.steps.map((s) => ({
              id: s.id,
              label: s.label,
              state: s.state,
              detail: s.detail,
            })),
            skillAssessments: {
              completed: saCompleted,
              total: saTotal,
              rows: skillAssessmentRows,
            },
            completedSteps: dynamic.completedSteps,
            totalSteps: dynamic.totalSteps,
            completionPercent: dynamic.completionPercent,
          }
        }
      }
    } catch (e) {
      console.warn("[admin-onboarding-progress] dynamic config fallback to legacy", e)
    }
  }

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

  const ssnUploaded =
    hasUrl(workerDocuments?.ssn_url) ||
    storageHits.some((hit) => hit.bucket === "worker_required_files" && hit.path.toLowerCase().startsWith(`ssn/${userId ?? ""}/`))
  const driversUploaded =
    hasUrl(workerDocuments?.drivers_license_url) ||
    storageHits.some((hit) => hit.bucket === "worker_required_files" && hit.path.toLowerCase().startsWith(`license/${userId ?? ""}/`))
  const authorizationUploaded =
    hasUrl(workerDocuments?.document_url) ||
    storageClassified.authorization > 0 ||
    isFirmaSigned(firmaSigningStatus)
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
      completed_assessments: saCompleted,
      total_assessments: saTotal,
    },
    computed_count: saCompleted,
    required_count: saTotal,
    final_status: steps[2].state,
  })

  console.info("[debug-onboarding-progress] authorizations_documents", {
    applicantName,
    user_id: userId,
    worker_id: workerId,
    table_queried: ["worker_documents", "worker_firma_signing_sessions"],
    storage_path_checked: ["worker_required_files/authorization/{user_id}", "worker_required_files/license/{user_id} (authorization file names)"],
    records_found: {
      firma_signed: isFirmaSigned(firmaSigningStatus),
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

  const totalSteps = steps.length
  const completedSteps = steps.filter((s) => s.state === "complete").length
  const completionPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  return {
    steps,
    skillAssessments: { completed: saCompleted, total: saTotal, rows: skillAssessmentRows },
    completedSteps,
    totalSteps,
    completionPercent,
  }
}
