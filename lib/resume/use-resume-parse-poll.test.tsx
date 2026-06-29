/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useResumeParsePoll } from "@/lib/resume/use-resume-parse-poll"

describe("useResumeParsePoll", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
    localStorage.setItem("applicantId", "applicant-1")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it("allows frontend to continue while parse_status is processing", async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ parseStatus: "processing", parsedJson: null, parseError: null }),
        { status: 200 },
      ),
    )

    const { result } = renderHook(() => useResumeParsePoll("resume-abc"))

    await waitFor(() => {
      expect(result.current.status).toBe("processing")
    })

    expect(result.current.parsedResume).toBeNull()
    expect(result.current.isPolling).toBe(true)
  })

  it("autofills parsedResume when polling returns completed", async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          parseStatus: "completed",
          parsedJson: {
            first_name: "Sam",
            last_name: "Rivera",
            email: "sam@example.com",
            phone: "",
            address1: "10 Oak",
            address2: "",
            city: "Austin",
            state: "TX",
            zip: "78701",
            job_role: "CNA",
          },
          parseError: null,
        }),
        { status: 200 },
      ),
    )

    const { result } = renderHook(() => useResumeParsePoll("resume-abc"))

    await waitFor(() => {
      expect(result.current.status).toBe("completed")
    })

    expect(result.current.parsedResume?.email).toBe("sam@example.com")
    expect(localStorage.getItem("parsedResume")).toContain("sam@example.com")
  })
})
