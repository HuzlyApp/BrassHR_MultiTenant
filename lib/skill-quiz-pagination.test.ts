import { describe, expect, it } from "vitest"
import {
  clampSkillQuizPage,
  getSkillQuizPageQuestions,
  getSkillQuizTotalPages,
} from "@/lib/skill-quiz-pagination"

describe("skill quiz pagination", () => {
  it("computes total pages for basic care (10 questions, 5 per page)", () => {
    expect(getSkillQuizTotalPages(10, 5)).toBe(2)
  })

  it("computes total pages for mobility (8 questions, 5 per page)", () => {
    expect(getSkillQuizTotalPages(8, 5)).toBe(2)
  })

  it("clamps page when user advances past the last page", () => {
    expect(clampSkillQuizPage(3, 10, 5)).toBe(2)
    expect(clampSkillQuizPage(3, 8, 5)).toBe(2)
  })

  it("returns questions for the clamped page", () => {
    const questions = Array.from({ length: 10 }, (_, i) => i + 1)
    const { pageQuestions, safePage, totalPages, start } = getSkillQuizPageQuestions(
      questions,
      3,
      5
    )
    expect(totalPages).toBe(2)
    expect(safePage).toBe(2)
    expect(start).toBe(5)
    expect(pageQuestions).toEqual([6, 7, 8, 9, 10])
  })
})
