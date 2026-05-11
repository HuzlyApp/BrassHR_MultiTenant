import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireApiSession } from "@/lib/auth/api-session"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

type JsonMap = Record<string, unknown>

function formatStatus(completed: unknown): string {
  return completed === true ? "Completed" : "In Progress"
}

function asObject(value: unknown): JsonMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as JsonMap
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  const str = String(value).trim()
  return str.length > 0 ? str : null
}

function toIsoIfDateLike(value: unknown): string | null {
  if (value == null) return null
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return asNullableString(value)
  return d.toISOString()
}

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || ""
    const assessmentIdRaw = req.nextUrl.searchParams.get("assessmentId")?.trim() || ""

    const workerIdCheck = parseRequiredUuid(workerIdRaw, "workerId")
    if (!workerIdCheck.ok) {
      return NextResponse.json({ error: workerIdCheck.error }, { status: 400 })
    }
    const workerId = workerIdCheck.value

    if (assessmentIdRaw) {
      const assessmentIdCheck = parseRequiredUuid(assessmentIdRaw, "assessmentId")
      if (!assessmentIdCheck.ok) {
        return NextResponse.json({ error: assessmentIdCheck.error }, { status: 400 })
      }
    }

    const auth = await requireApiSession()
    if (auth instanceof NextResponse) return auth

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)
    const { data: worker, error: workerErr } = await supabase
      .from("worker")
      .select("*")
      .eq("id", workerId)
      .maybeSingle()

    if (workerErr) throw workerErr
    if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!assessmentIdRaw) {
      const { data: assessments, error: assessmentsErr } = await supabase
        .from("skill_assessments")
        .select("*")
        .eq("worker_id", workerId)
        .order("created_at", { ascending: false })
      if (assessmentsErr) throw assessmentsErr

      const rows = (assessments ?? []) as JsonMap[]
      const categorySlugs = rows
        .map((row) => String(row.category ?? "").trim())
        .filter((v) => v.length > 0)
      const { data: categories } = await supabase
        .from("skill_categories")
        .select("*")
        .in("slug", categorySlugs.length > 0 ? categorySlugs : ["__none__"])
      const categoryBySlug = new Map<string, JsonMap>(
        ((categories ?? []) as JsonMap[]).map((c) => [String(c.slug ?? ""), c])
      )

      const { data: normalizedRows } = await supabase
        .from("applicant_skill_assessment_answers")
        .select("*")
        .eq("applicant_id", workerId)

      const normalizedByCategory = new Map<string, JsonMap[]>()
      for (const row of (normalizedRows ?? []) as JsonMap[]) {
        const key = String(row.category_id ?? "")
        const prev = normalizedByCategory.get(key) ?? []
        prev.push(row)
        normalizedByCategory.set(key, prev)
      }

      const categoryIds = Array.from(
        new Set(
          ((categories ?? []) as JsonMap[])
            .map((row) => String(row.id ?? "").trim())
            .filter((id) => id.length > 0)
        )
      )
      const { data: questionRows } = await supabase
        .from("skill_questions")
        .select("id,category_id")
        .in(
          "category_id",
          categoryIds.length > 0 ? categoryIds : ["00000000-0000-0000-0000-000000000000"]
        )
      const requiredByCategory = new Map<string, number>()
      for (const row of ((questionRows ?? []) as JsonMap[])) {
        const categoryId = String(row.category_id ?? "").trim()
        if (!categoryId) continue
        requiredByCategory.set(categoryId, (requiredByCategory.get(categoryId) ?? 0) + 1)
      }

      const list = rows.map((row) => {
        const slug = String(row.category ?? "")
        const category = categoryBySlug.get(slug) ?? {}
        const categoryId = asNullableString(category.id)
        const answerRows = categoryId ? normalizedByCategory.get(categoryId) ?? [] : []
        const requiredCount = categoryId ? (requiredByCategory.get(categoryId) ?? 0) : 0
        const answersJson = asObject(row.answers)
        const totalScoreFromRows = answerRows.reduce((acc, item) => {
          const n = Number(item.answer_value)
          return Number.isFinite(n) ? acc + n : acc
        }, 0)
        const totalScoreFromJson = Object.values(answersJson).reduce<number>((acc, v) => {
          const n = Number(v)
          return Number.isFinite(n) ? acc + n : acc
        }, 0)
        // Use the most complete signal available. Some records have partial normalized rows
        // while the JSON payload still contains the full submitted answers.
        const answeredCount = Math.max(answerRows.length, Object.keys(answersJson).length)
        const inferredCompleted = requiredCount > 0 ? answeredCount >= requiredCount : answeredCount > 0
        const completed = row.completed === true || inferredCompleted

        return {
          id: asNullableString(row.id),
          worker_id: asNullableString(row.worker_id),
          category_slug: slug,
          category_id: categoryId,
          title: asNullableString(category.title) ?? slug,
          total_score: answerRows.length > 0 ? totalScoreFromRows : totalScoreFromJson,
          answered_count: answeredCount,
          result_status: formatStatus(completed),
          completed,
          created_at: toIsoIfDateLike(row.created_at),
          updated_at: null,
        }
      })

      return NextResponse.json({ worker, skill_assessments: list })
    }

    const { data: assessment, error: assessmentErr } = await supabase
      .from("skill_assessments")
      .select("*")
      .eq("id", assessmentIdRaw)
      .eq("worker_id", workerId)
      .maybeSingle()
    if (assessmentErr) throw assessmentErr
    if (!assessment) return NextResponse.json({ error: "Skill assessment not found" }, { status: 404 })

    // Verified mapping from live schema:
    // skill_assessments.category (slug) -> skill_categories.slug
    const categorySlug = String(assessment.category ?? "")
    const { data: category } = await supabase
      .from("skill_categories")
      .select("*")
      .eq("slug", categorySlug)
      .maybeSingle()
    const categoryId = asNullableString(category?.id)

    const { data: questionRows, error: qErr } = await supabase
      .from("skill_questions")
      .select("*")
      .eq("category_id", categoryId ?? "")
      .order("quiz_number", { ascending: true })
    if (qErr) throw qErr

    const normalizedAnswers = categoryId
      ? await supabase
          .from("applicant_skill_assessment_answers")
          .select("*")
          .eq("applicant_id", workerId)
          .eq("category_id", categoryId)
      : { data: [], error: null }
    if (normalizedAnswers.error) throw normalizedAnswers.error

    const answersBySkillId = new Map<string, JsonMap>(
      ((normalizedAnswers.data ?? []) as JsonMap[]).map((row) => [String(row.skill_id ?? ""), row])
    )
    const jsonAnswers = asObject(assessment.answers)

    const questions = ((questionRows ?? []) as JsonMap[]).map((questionRow) => {
      const questionId = String(questionRow.id ?? "")
      const answerRow = answersBySkillId.get(questionId)
      const selectedAnswer = answerRow?.answer_value ?? jsonAnswers[questionId] ?? null

      return {
        question_id: asNullableString(questionRow.id),
        quiz_number: questionRow.quiz_number ?? null,
        question_text: asNullableString(questionRow.question),
        selected_answer: selectedAnswer,
        // There is no correct-answer column in the verified schema.
        correct_answer: null,
        answer_created_at: toIsoIfDateLike(answerRow?.created_at),
        answer_updated_at: toIsoIfDateLike(answerRow?.updated_at),
      }
    })

    const totalScore = questions.reduce((acc, q) => {
      const n = Number(q.selected_answer)
      return Number.isFinite(n) ? acc + n : acc
    }, 0)

    const workerProfile = {
      worker_id: asNullableString(worker.id),
      first_name: asNullableString(worker.first_name),
      last_name: asNullableString(worker.last_name),
      email: asNullableString(worker.email),
      phone: asNullableString(worker.phone),
      city: asNullableString(worker.city),
      state: asNullableString(worker.state),
      job_role: asNullableString(worker.job_role),
      worker_status: asNullableString(worker.worker_status ?? worker.status),
      profile_created_at: toIsoIfDateLike(worker.created_at),
      profile_updated_at: toIsoIfDateLike(worker.updated_at),
    }

    const assessmentDetails = {
      assessment_id: asNullableString(assessment.id),
      worker_id: asNullableString(assessment.worker_id),
      category_slug: asNullableString(assessment.category),
      category_id: categoryId,
      assessment_title: asNullableString(category?.title) ?? categorySlug,
      category_description: asNullableString(category?.description),
      category_order_number: category?.order_number ?? null,
      total_score: totalScore,
      answered_count: questions.filter((q) => q.selected_answer != null).length,
      result_status: formatStatus(assessment.completed),
      completed: assessment.completed === true,
      submitted_at: toIsoIfDateLike(assessment.created_at),
      completed_at: assessment.completed === true ? toIsoIfDateLike(assessment.created_at) : null,
    }

    return NextResponse.json({
      worker: workerProfile,
      assessment: assessmentDetails,
      questions,
      metadata: {
        source_tables: [
          "public.worker",
          "public.skill_assessments",
          "public.skill_categories",
          "public.skill_questions",
          "public.applicant_skill_assessment_answers",
        ],
        relationships_verified: [
          "skill_assessments.worker_id -> worker.id",
          "skill_categories.id <- applicant_skill_assessment_answers.category_id",
          "skill_questions.id <- applicant_skill_assessment_answers.skill_id",
          "skill_assessments.category (slug text) -> skill_categories.slug",
          "skill_questions.category_id -> skill_categories.id",
        ],
        generated_at: new Date().toISOString(),
      },
    })
  } catch (err: unknown) {
    console.error("[admin/skill-assessment-results]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
