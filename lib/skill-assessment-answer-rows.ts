import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getSkillAssessmentWorkerKey,
  getWorkerPrimaryKey,
  getWorkerSessionContext,
  resolveWorkerSessionContext,
} from "@/lib/onboarding-worker-pk"

export type SkillAnswerRow = {
  skill_id: string
  answer_value: number
}

function isUpsertConflictSpecError(error: { code?: string; message?: string }): boolean {
  return error.code === "42P10" || (error.message ?? "").includes("ON CONFLICT")
}

/** Insert or update one answer row without relying on PostgREST upsert. */
async function saveSkillAnswerRow(
  supabase: SupabaseClient,
  row: {
    applicant_id: string
    category_id: string
    skill_id: string
    answer_value: number
  }
): Promise<{ ok: boolean; error?: string }> {
  const { data: existing, error: findErr } = await supabase
    .from("applicant_skill_assessment_answers")
    .select("id")
    .eq("applicant_id", row.applicant_id)
    .eq("category_id", row.category_id)
    .eq("skill_id", row.skill_id)
    .maybeSingle()

  if (findErr) return { ok: false, error: findErr.message }

  if (existing?.id) {
    const { error: upErr } = await supabase
      .from("applicant_skill_assessment_answers")
      .update({
        answer_value: row.answer_value,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
    if (upErr) return { ok: false, error: upErr.message }
    return { ok: true }
  }

  const { error: insErr } = await supabase.from("applicant_skill_assessment_answers").insert({
    applicant_id: row.applicant_id,
    category_id: row.category_id,
    skill_id: row.skill_id,
    answer_value: row.answer_value,
  })
  if (insErr) return { ok: false, error: insErr.message }
  return { ok: true }
}

/** Load normalized answers for a category; merges with optional legacy JSON map. */
export async function fetchApplicantSkillAnswers(
  supabase: SupabaseClient,
  categoryId: string,
  legacyNormalized: Record<string, number>
): Promise<Record<string, number>> {
  const applicantId = await getWorkerPrimaryKey(supabase)
  const fromDb: Record<string, number> = {}

  if (applicantId) {
    const { data, error } = await supabase
      .from("applicant_skill_assessment_answers")
      .select("skill_id, answer_value")
      .eq("applicant_id", applicantId)
      .eq("category_id", categoryId)

    if (!error && data?.length) {
      for (const row of data) {
        const sid = row.skill_id as string
        const v = Number(row.answer_value)
        if (v >= 1 && v <= 4) fromDb[sid] = v
      }
    }
  }

  return { ...legacyNormalized, ...fromDb }
}

export async function upsertSkillAnswerRow(
  supabase: SupabaseClient,
  params: {
    categoryId: string
    skillId: string
    answerValue: number
  }
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await resolveWorkerSessionContext(supabase, { ensure: true })
  if (!ctx) {
    return { ok: false, error: "no_worker_row" }
  }
  if (params.answerValue < 1 || params.answerValue > 4) {
    return { ok: false, error: "invalid_answer" }
  }

  const row = {
    applicant_id: ctx.id,
    category_id: params.categoryId,
    skill_id: params.skillId,
    answer_value: params.answerValue,
  }

  const { error } = await supabase.from("applicant_skill_assessment_answers").upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "applicant_id,category_id,skill_id" }
  )

  if (error) {
    if (isUpsertConflictSpecError(error)) {
      return saveSkillAnswerRow(supabase, row)
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Avoid PostgREST PGRST116 when duplicate legacy rows exist. */
export async function findSkillAssessmentRowId(
  supabase: SupabaseClient,
  workerId: string,
  categorySlug: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("skill_assessments")
    .select("id")
    .eq("worker_id", workerId)
    .eq("category", categorySlug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn("[findSkillAssessmentRowId]", error.message)
    return null
  }
  return data?.id ? String(data.id) : null
}

/** Keep `skill_assessments.answers` JSON in sync for reporting (best-effort). */
export async function syncSkillAssessmentJson(
  supabase: SupabaseClient,
  categorySlug: string,
  answers: Record<string, number>,
  completed: boolean
): Promise<void> {
  const ctx = await getWorkerSessionContext(supabase)
  const workerKey = ctx?.id ?? (await getSkillAssessmentWorkerKey(supabase))
  if (!workerKey) return

  const cleanAnswers = JSON.parse(JSON.stringify(answers)) as Record<string, number>
  const existingId = await findSkillAssessmentRowId(supabase, workerKey, categorySlug)

  if (existingId) {
    await supabase
      .from("skill_assessments")
      .update({ answers: cleanAnswers, completed })
      .eq("id", existingId)
  } else {
    const tenantId = ctx?.tenantId
    if (!tenantId) return
    await supabase.from("skill_assessments").insert({
      tenant_id: tenantId,
      worker_id: workerKey,
      category: categorySlug,
      answers: cleanAnswers,
      completed,
    })
  }
}

/** Save or update the JSON snapshot for a skill assessment category. */
export async function persistSkillAssessment(
  supabase: SupabaseClient,
  params: {
    categorySlug: string
    answers: Record<string, number>
    completed: boolean
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await resolveWorkerSessionContext(supabase, { ensure: true })
  if (!ctx) {
    return {
      ok: false,
      error: "Could not save your answers. Go back and upload your resume again.",
    }
  }

  const cleanAnswers = JSON.parse(JSON.stringify(params.answers)) as Record<string, number>
  const existingId = await findSkillAssessmentRowId(supabase, ctx.id, params.categorySlug)

  if (existingId) {
    const { error } = await supabase
      .from("skill_assessments")
      .update({ answers: cleanAnswers, completed: params.completed })
      .eq("id", existingId)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.from("skill_assessments").insert({
      tenant_id: ctx.tenantId,
      worker_id: ctx.id,
      category: params.categorySlug,
      answers: cleanAnswers,
      completed: params.completed,
    })
    if (error) {
      const e = error as { code?: string; message?: string }
      if (e.code === "23505" && (e.message || "").includes("skill_assessments_worker_id_key")) {
        return {
          ok: false,
          error:
            'Database constraint is still UNIQUE(worker_id). Apply the migration that replaces it with UNIQUE(worker_id, category) (see supabase/migrations/20260410194500_create_skill_assessments.sql), then try again.',
        }
      }
      return { ok: false, error: error.message }
    }
  }

  return { ok: true }
}
