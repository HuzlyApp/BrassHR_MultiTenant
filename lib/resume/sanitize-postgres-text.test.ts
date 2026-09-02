import { describe, expect, it } from "vitest"
import { normalizeResumeWhitespace } from "@/lib/jobs/match-analysis/sanitize-resume"
import { sanitizePostgresJson, stripNullBytes } from "@/lib/resume/sanitize-postgres-text"
describe("stripNullBytes", () => {
  it("removes NULs that Postgres rejects as 22P05", () => {
    expect(stripNullBytes("Almog\u0000 Arazi")).toBe("Almog Arazi")
    expect(stripNullBytes("a\u0000b\u0000c")).toBe("abc")
  })

  it("leaves normal resume text unchanged", () => {
    expect(stripNullBytes("Jane Doe\njane@example.com")).toBe("Jane Doe\njane@example.com")
  })
})

describe("sanitizePostgresJson", () => {
  it("strips NULs from nested strings used as jsonb", () => {
    expect(
      sanitizePostgresJson({
        text: "Almog\u0000 Arazi\nEngineer",
        pre_extracted: { first_name: "Almog\u0000" },
      })
    ).toEqual({
      text: "Almog Arazi\nEngineer",
      pre_extracted: { first_name: "Almog" },
    })
  })
})

describe("normalizeResumeWhitespace", () => {
  it("strips NUL bytes from extracted resume text", () => {
    expect(normalizeResumeWhitespace("Almog\u0000 Arazi")).toBe("Almog Arazi")
  })
})
