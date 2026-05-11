/**
 * Read-only helpers for the onboarding Summary page — maps localStorage + API
 * responses to display state (no fabricated file names or statuses).
 */

export const STEP2_FILE_TYPES = ["license", "tb", "cpr"] as const
export type Step2FileType = (typeof STEP2_FILE_TYPES)[number]

export type Step2UploadedFile = { name: string; size: string }

export const STEP2_REQUIREMENT_LABELS: Record<Step2FileType, string> = {
  license: "Nursing / professional license",
  tb: "TB test",
  cpr: "CPR certification",
}

export function displayNameFromStoragePath(path: string): string {
  const seg = path.split("/").pop() || path
  return seg.length > 40 ? `${seg.slice(0, 18)}…${seg.slice(-12)}` : seg
}

export function readResumeFileIndicators(): { fileName: string | null; hasUploadedFile: boolean } {
  if (typeof window === "undefined") return { fileName: null, hasUploadedFile: false }
  const name = localStorage.getItem("resumeName")?.trim() || null
  const storagePath = localStorage.getItem("resumeStoragePath")?.trim() || null
  if (name) return { fileName: name, hasUploadedFile: true }
  if (storagePath) return { fileName: displayNameFromStoragePath(storagePath), hasUploadedFile: true }
  return { fileName: null, hasUploadedFile: false }
}

export function parseStep2Files(): Record<Step2FileType, Step2UploadedFile | null> | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem("step2_files")
  if (!raw?.trim()) return null
  try {
    const p = JSON.parse(raw) as Record<string, unknown>
    const out: Record<Step2FileType, Step2UploadedFile | null> = {
      license: null,
      tb: null,
      cpr: null,
    }
    for (const k of STEP2_FILE_TYPES) {
      const v = p[k]
      if (v && typeof v === "object" && v !== null && "name" in v) {
        const name = String((v as { name: unknown }).name ?? "").trim()
        if (!name) continue
        out[k] = {
          name,
          size: String((v as { size?: unknown }).size ?? ""),
        }
      }
    }
    return out
  } catch {
    return null
  }
}

export function step2HasAnyUpload(files: Record<Step2FileType, Step2UploadedFile | null> | null): boolean {
  if (!files) return false
  return STEP2_FILE_TYPES.some((k) => Boolean(files[k]?.name))
}

/** Legacy quiz slug → localStorage completion flag (matches step-3-assessment / quizzes). */
const SLUG_TO_DONE_KEY: Record<string, string> = {
  "basic-care": "basic_care_done",
  mobility: "mobility_done",
  clinical: "clinical_done",
  monitoring: "monitoring_done",
  documentation: "documentation_done",
}

const LEGACY_ORDER_TO_SLUG: Record<number, string> = {
  1: "basic-care",
  2: "mobility",
  3: "clinical",
  4: "monitoring",
  5: "documentation",
}

export type SkillCategoryRow = {
  id: string
  title: string
  slug: string | null
  order_number: number | null
}

export function quizSlugForCategory(cat: SkillCategoryRow): string | null {
  const s = cat.slug?.trim()
  if (s) return s.replace(/_/g, "-")
  if (cat.order_number != null && LEGACY_ORDER_TO_SLUG[cat.order_number]) {
    return LEGACY_ORDER_TO_SLUG[cat.order_number]
  }
  return null
}

export function isSkillQuizDoneLocal(slug: string): boolean {
  const normalized = slug.trim().replace(/_/g, "-")
  const key = SLUG_TO_DONE_KEY[normalized] ?? `${slug.replace(/-/g, "_")}_done`
  return localStorage.getItem(key) === "true"
}

export function countLocalLegacyQuizDone(): { completed: number; total: number } {
  if (typeof window === "undefined") return { completed: 0, total: 0 }
  const keys = Object.values(SLUG_TO_DONE_KEY)
  const completed = keys.filter((k) => localStorage.getItem(k) === "true").length
  return { completed, total: keys.length }
}

export type SigningDisplayStatus = "none" | "pending" | "signed"

export function readAuthorizationSigningState(): {
  statusRaw: string
  display: SigningDisplayStatus
  hasActivity: boolean
} {
  if (typeof window === "undefined") {
    return { statusRaw: "", display: "none", hasActivity: false }
  }
  const requestId = localStorage.getItem("signingRequestId")?.trim()
  const agreed = localStorage.getItem("step4AuthorizationAgreed") === "true"
  const raw = (localStorage.getItem("signingStatus") || "").trim().toLowerCase()
  const hasActivity = Boolean(requestId || agreed || raw)
  if (raw === "signed" || raw === "completed") {
    return { statusRaw: raw, display: "signed", hasActivity: true }
  }
  if (requestId || raw === "sent" || raw === "viewed" || raw === "declined") {
    return { statusRaw: raw || "sent", display: "pending", hasActivity: true }
  }
  if (agreed) {
    return { statusRaw: "", display: "pending", hasActivity: true }
  }
  return { statusRaw: raw, display: "none", hasActivity: false }
}
