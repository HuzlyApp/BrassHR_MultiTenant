export const DEFAULT_SKILL_QUIZ_PAGE_SIZE = 5

export function getSkillQuizTotalPages(
  questionCount: number,
  pageSize = DEFAULT_SKILL_QUIZ_PAGE_SIZE
): number {
  if (questionCount <= 0) return 1
  return Math.ceil(questionCount / pageSize)
}

export function clampSkillQuizPage(
  page: number,
  questionCount: number,
  pageSize = DEFAULT_SKILL_QUIZ_PAGE_SIZE
): number {
  const totalPages = getSkillQuizTotalPages(questionCount, pageSize)
  return Math.min(Math.max(1, page), totalPages)
}

export function getSkillQuizPageQuestions<T>(
  questions: T[],
  page: number,
  pageSize = DEFAULT_SKILL_QUIZ_PAGE_SIZE
): {
  pageQuestions: T[]
  safePage: number
  totalPages: number
  start: number
} {
  const totalPages = getSkillQuizTotalPages(questions.length, pageSize)
  const safePage = clampSkillQuizPage(page, questions.length, pageSize)
  const start = (safePage - 1) * pageSize
  return {
    pageQuestions: questions.slice(start, start + pageSize),
    safePage,
    totalPages,
    start,
  }
}
