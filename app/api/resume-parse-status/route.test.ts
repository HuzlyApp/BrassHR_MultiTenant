import { beforeEach, describe, expect, it, vi } from "vitest"

const resumeRow = vi.hoisted(() => ({
  current: {
    id: "resume-1",
    worker_id: "worker-1",
    parsing_status: "processing",
    parsed_json: null,
    parse_error: null,
    parse_started_at: "2026-01-01T00:00:00Z",
    parse_completed_at: null,
    extraction_ms: 40,
    ai_parse_ms: null,
    text_length: 1200,
  } as Record<string, unknown>,
}))

vi.mock("@/lib/supabase-env", () => ({
  getSupabaseUrl: () => "https://example.supabase.co",
}))

vi.mock("@/lib/onboarding/resolve-worker-context", () => ({
  resolveWorkerByApplicantId: vi.fn(async () => ({ workerId: "worker-1", tenantId: "tenant-1" })),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: resumeRow.current, error: null }),
        }),
      }),
    }),
  })),
}))

import { NextRequest } from "next/server"
import { GET } from "@/app/api/resume-parse-status/route"

describe("GET /api/resume-parse-status", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
  })

  it("returns processing state", async () => {
    resumeRow.current = {
      ...resumeRow.current,
      parsing_status: "processing",
      parsed_json: null,
    }

    const res = await GET(
      new NextRequest("http://localhost/api/resume-parse-status?resumeId=resume-1&applicantId=a1"),
    )
    const json = await res.json()
    expect(json.parseStatus).toBe("processing")
    expect(json.parsedJson).toBeNull()
  })

  it("returns completed state with parsed_json", async () => {
    resumeRow.current = {
      ...resumeRow.current,
      parsing_status: "completed",
      parsed_json: { first_name: "Jane", email: "jane@example.com" },
      parse_error: null,
    }

    const res = await GET(
      new NextRequest("http://localhost/api/resume-parse-status?resumeId=resume-1&applicantId=a1"),
    )
    const json = await res.json()
    expect(json.parseStatus).toBe("completed")
    expect(json.parsedJson).toMatchObject({ email: "jane@example.com" })
  })

  it("returns failed state with parse_error", async () => {
    resumeRow.current = {
      ...resumeRow.current,
      parsing_status: "failed",
      parsed_json: null,
      parse_error: "Resume parsing failed",
    }

    const res = await GET(
      new NextRequest("http://localhost/api/resume-parse-status?resumeId=resume-1&applicantId=a1"),
    )
    const json = await res.json()
    expect(json.parseStatus).toBe("failed")
    expect(json.parseError).toContain("failed")
  })
})
