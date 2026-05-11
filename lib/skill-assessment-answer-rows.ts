import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getSkillAssessmentWorkerKey,
  getWorkerPrimaryKey,
  getWorkerSessionContext,
} from "@/lib/onboarding-worker-pk"

export type SkillAnswerRow = {
  skill_id: string
  answer_value: number
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
  const ctx = await getWorkerSessionContext(supabase)
  if (!ctx) {
    return { ok: false, error: "no_worker_row" }
  }
  if (params.answerValue < 1 || params.answerValue > 4) {
    return { ok: false, error: "invalid_answer" }
  }

  const { error } = await supabase.from("applicant_skill_assessment_answers").upsert(
    {
      applicant_id: ctx.id,
      tenant_id: ctx.tenantId,
      category_id: params.categoryId,
      skill_id: params.skillId,
      answer_value: params.answerValue,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "applicant_id,category_id,skill_id" }
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
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
  const { data: existing } = await supabase
    .from("skill_assessments")
    .select("id")
    .eq("worker_id", workerKey)
    .eq("category", categorySlug)
    .maybeSingle()

  if (existing?.id) {
    await supabase
      .from("skill_assessments")
      .update({ answers: cleanAnswers, completed })
      .eq("id", existing.id)
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
