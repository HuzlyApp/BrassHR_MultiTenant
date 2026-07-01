import type { SupabaseClient } from "@supabase/supabase-js"

type JsonRow = Record<string, unknown>

function rowTimestampMs(row: JsonRow): number {
  const updated = row.updated_at != null ? Date.parse(String(row.updated_at)) : Number.NaN
  if (!Number.isNaN(updated)) return updated
  const created = row.created_at != null ? Date.parse(String(row.created_at)) : Number.NaN
  return Number.isNaN(created) ? 0 : created
}

/** Keep one assessment row per category slug (completed first, then latest). */
export function dedupeSkillAssessmentRowsByCategory(rows: JsonRow[]): JsonRow[] {
  const bestByKey = new Map<string, JsonRow>()

  for (const row of rows) {
    const slug = String(row.category ?? "").trim().toLowerCase()
    const fallbackId = String(row.id ?? "").trim()
    const key = slug || `id:${fallbackId}`
    const existing = bestByKey.get(key)

    if (!existing) {
      bestByKey.set(key, row)
      continue
    }

    const existingCompleted = existing.completed === true
    const nextCompleted = row.completed === true
    if (nextCompleted && !existingCompleted) {
      bestByKey.set(key, row)
      continue
    }
    if (nextCompleted === existingCompleted && rowTimestampMs(row) > rowTimestampMs(existing)) {
      bestByKey.set(key, row)
    }
  }

  return Array.from(bestByKey.values())
}

export type WorkerSkillAssessmentProgress = {
  completed: number
  total: number
  rows: JsonRow[]
}

export async function loadWorkerSkillAssessmentProgress(
  supabase: SupabaseClient,
  workerId: string,
  userId: string | null = null
): Promise<WorkerSkillAssessmentProgress> {
  const { data: skillAssessmentRowsRaw } = await supabase
    .from("skill_assessments")
    .select("*")
    .eq("worker_id", workerId)

  const skillAssessmentRows = dedupeSkillAssessmentRowsByCategory(
    (skillAssessmentRowsRaw ?? []) as JsonRow[]
  )

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

  const requiredByCategory = new Map<string, number>()
  for (const row of (questionRowsRaw ?? []) as JsonRow[]) {
    const categoryId = String(row.category_id ?? "").trim()
    if (!categoryId) continue
    requiredByCategory.set(categoryId, (requiredByCategory.get(categoryId) ?? 0) + 1)
  }

  const applicantIdCandidates = [workerId, userId].filter((id): id is string => Boolean(id?.trim()))
  const { data: answerRowsRaw } = await supabase
    .from("applicant_skill_assessment_answers")
    .select("applicant_id,category_id,skill_id")
    .in("applicant_id", applicantIdCandidates.length > 0 ? applicantIdCandidates : [workerId])

  const answeredByCategory = new Map<string, number>()
  for (const row of (answerRowsRaw ?? []) as JsonRow[]) {
    const categoryId = String(row.category_id ?? "").trim()
    if (!categoryId) continue
    answeredByCategory.set(categoryId, (answeredByCategory.get(categoryId) ?? 0) + 1)
  }

  let completed = 0
  let total = skillAssessmentRows.length

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

    if (rowCompleted) completed += 1
  }

  if (total === 0 && answeredByCategory.size > 0) {
    total = answeredByCategory.size
    completed = 0
    for (const [categoryId, answered] of answeredByCategory.entries()) {
      const required = requiredByCategory.get(categoryId) ?? 0
      if ((required > 0 && answered >= required) || (required === 0 && answered > 0)) {
        completed += 1
      }
    }
  }

  return { completed, total, rows: skillAssessmentRows }
}

export function isWorkerSkillAssessmentProgressComplete(
  progress: WorkerSkillAssessmentProgress | undefined
): boolean {
  if (!progress) return false
  const { total, completed, rows } = progress
  if (total > 0 && completed >= total) return true
  if (rows.length > 0) {
    const done = rows.filter((row) => row.completed === true).length
    return done >= rows.length
  }
  return false
}
