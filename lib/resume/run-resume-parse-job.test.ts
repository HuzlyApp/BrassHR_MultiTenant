import { beforeEach, describe, expect, it, vi } from "vitest"

const grokParseResumeMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/resume/grok-parse-resume", () => ({
  grokParseResume: (...args: unknown[]) => grokParseResumeMock(...args),
}))

import { runResumeParseJob } from "@/lib/resume/run-resume-parse-job"

function createSupabaseMock(initialRow: Record<string, unknown>) {
  const row = { ...initialRow }
  return {
    from: () => ({
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          Object.assign(row, patch)
          return { error: null }
        },
      }),
    }),
    row,
  }
}

describe("runResumeParseJob", () => {
  beforeEach(() => {
    grokParseResumeMock.mockReset()
  })

  it("stores parsed_json in Supabase when Grok parse succeeds quality gate", async () => {
    grokParseResumeMock.mockResolvedValue({
      normalized: {
        first_name: "Alex",
        last_name: "Lee",
        email: "alex@example.com",
        phone: "555-0100",
        address1: "1 Main St",
        address2: "",
        city: "Denver",
        state: "CO",
        zip: "80202",
        job_role: "CNA",
      },
      preExtracted: { email: "alex@example.com" },
      aiParseMs: 120,
      grokSnippet: "snippet",
      grokSnippetReduced: true,
    })

    const supabase = createSupabaseMock({ id: "resume-1", parsing_status: "processing" })
    const result = await runResumeParseJob({
      supabase: supabase as never,
      resumeId: "resume-1",
      text: "Alex Lee resume text",
    })

    expect(result.parsingStatus).toBe("completed")
    expect(result.parsedJson?.email).toBe("alex@example.com")
    expect(supabase.row.parsed_json).toMatchObject({ email: "alex@example.com" })
    expect(supabase.row.parsing_status).toBe("completed")
  })

  it("does not block upload when quality gate fails — marks failed with parse_error", async () => {
    grokParseResumeMock.mockResolvedValue({
      normalized: {
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address1: "",
        address2: "",
        city: "",
        state: "",
        zip: "",
        job_role: "",
      },
      preExtracted: {},
      aiParseMs: 90,
      grokSnippet: "snippet",
      grokSnippetReduced: false,
    })

    const supabase = createSupabaseMock({ id: "resume-2", parsing_status: "processing" })
    const result = await runResumeParseJob({
      supabase: supabase as never,
      resumeId: "resume-2",
      text: " unreadable resume ",
    })

    expect(result.parsingStatus).toBe("failed")
    expect(result.parseError).toBeTruthy()
    expect(supabase.row.parsing_status).toBe("failed")
    expect(supabase.row.parse_error).toBeTruthy()
  })
})
