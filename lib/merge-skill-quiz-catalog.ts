/**
 * Merge static quiz catalog with DB `skill_questions` rows so every displayed
 * question uses a real `skill_questions.id` (required for FK on persisted answers).
 */

export type CatalogItem = {
  quiz_number: number
  question: string
  description: string | null
}

export type DbQuestionRow = {
  id: string
  question: string
  quiz_number: number | null
  description?: string | null
}

/** When the DB has duplicate rows per quiz_number, keep a single canonical row (stable: smallest id). */
export function dedupeSkillQuestionsByQuizNumber<T extends DbQuestionRow>(rows: T[]): T[] {
  const best = new Map<number, T>()
  for (const r of rows) {
    if (r.quiz_number == null) continue
    const prev = best.get(r.quiz_number)
    if (!prev || r.id < prev.id) best.set(r.quiz_number, r)
  }
  return Array.from(best.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
}

/**
 * Build the ordered question list: one real id per catalog row.
 * Throws if any catalog slot is missing in the database.
 */
export function mergeQuestionCatalogWithDb<T extends DbQuestionRow>(
  catalog: readonly CatalogItem[],
  dbRows: T[]
): T[] {
  const byNum = new Map<number, T>()
  for (const r of dedupeSkillQuestionsByQuizNumber(dbRows)) {
    if (r.quiz_number != null) byNum.set(r.quiz_number, r)
  }
  const out: T[] = []
  for (const item of catalog) {
    const db = byNum.get(item.quiz_number)
    if (!db?.id) {
      throw new Error(
        `Missing skill_questions row for quiz_number=${item.quiz_number}. Run the latest database migration.`
      )
    }
    out.push({
      ...db,
      quiz_number: item.quiz_number,
      question: db.question,
      description: item.description,
    })
  }
  return out
}

/** Remap legacy JSON keys that used synthetic UUIDs onto real question ids. */
export function remapLegacySyntheticAnswerKeys(
  answers: Record<string, number>,
  questions: DbQuestionRow[],
  kind: "basic-care" | "documentation"
): Record<string, number> {
  const synth =
    kind === "basic-care"
      ? /^10000000-0000-4000-8000-([0-9a-f]{12})$/i
      : /^00000000-0000-4000-8000-([0-9a-f]{12})$/i
  const out = { ...answers }
  const byQuiz = new Map<number, string>()
  for (const q of questions) {
    if (q.quiz_number != null) byQuiz.set(q.quiz_number, q.id)
  }
  for (const [k, v] of Object.entries(answers)) {
    const m = k.match(synth)
    if (!m) continue
    const quizNum = parseInt(m[1], 16)
    const realId = byQuiz.get(quizNum)
    if (!realId || realId === k) continue
    if (out[realId] == null) out[realId] = v
    delete out[k]
  }
  return out
}
