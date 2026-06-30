import { beforeEach, describe, expect, it, vi } from "vitest"

const afterMock = vi.hoisted(() => vi.fn((_fn: () => void | Promise<void>) => undefined))
const runResumeParseJobMock = vi.hoisted(() => vi.fn(async () => undefined))
const persistRecordMock = vi.hoisted(() => vi.fn(async () => "resume-uuid-1"))
const pdfParseMock = vi.hoisted(() => vi.fn(async () => ({ text: "Jane Doe\njane@example.com" })))
const mammothExtractRawTextMock = vi.hoisted(() => vi.fn(async () => ({ value: "Docx Person\ndocx@example.com" })))

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return { ...actual, after: afterMock }
})

vi.mock("pdf-parse", () => ({ default: pdfParseMock }))
vi.mock("mammoth", () => ({ default: { extractRawText: mammothExtractRawTextMock } }))
vi.mock("@/lib/resume/run-resume-parse-job", () => ({
  runResumeParseJob: (...args: unknown[]) => runResumeParseJobMock(...args),
}))
vi.mock("@/lib/onboarding/resolve-worker-context", () => ({
  resolveWorkerByApplicantId: vi.fn(async () => null),
  resolveOrEnsureWorkerForApplicant: vi.fn(async () => ({
    workerId: "worker-1",
    tenantId: "tenant-1",
    userId: "applicant-1",
  })),
}))
vi.mock("@/lib/onboarding/persist-worker-resume-path", () => ({
  persistWorkerResumePath: vi.fn(async () => undefined),
}))
vi.mock("@/lib/onboarding/persist-worker-resume-record", () => ({
  persistWorkerResumeRecord: (...args: unknown[]) => persistRecordMock(...args),
}))
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => null),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))
vi.mock("@/lib/supabase-env", () => ({
  getSupabaseUrl: () => "https://example.supabase.co",
}))

const storageUploadMock = vi.hoisted(() => vi.fn(async () => ({ error: null })))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: storageUploadMock,
      }),
    },
  })),
}))

import { POST } from "@/app/api/upload-resume/route"

function makePdfFile() {
  return new File([new Uint8Array([1, 2, 3])], "resume.pdf", { type: "application/pdf" })
}

function makeDocxFile() {
  return new File([new Uint8Array([1, 2, 3])], "resume.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}

describe("POST /api/upload-resume", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
    runResumeParseJobMock.mockResolvedValue(undefined)
    persistRecordMock.mockResolvedValue("resume-uuid-1")
    pdfParseMock.mockResolvedValue({ text: "Jane Doe\njane@example.com" })
    mammothExtractRawTextMock.mockResolvedValue({ value: "Docx Person\ndocx@example.com" })
  })

  it("uploads a PDF, extracts text, and returns a resumeId without waiting for Grok", async () => {
    const grokStarted = vi.fn()
    runResumeParseJobMock.mockImplementation(async () => {
      grokStarted()
      await new Promise((r) => setTimeout(r, 500))
    })

    const fd = new FormData()
    fd.append("file", makePdfFile())
    fd.append("applicantId", "applicant-1")

    const started = Date.now()
    const res = await POST(new Request("http://localhost/api/upload-resume", { method: "POST", body: fd }))
    const elapsed = Date.now() - started

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.parseStatus).toBe("processing")
    expect(json.resumeId).toBe("resume-uuid-1")
    expect(json.storagePath).toBeTruthy()
    expect(json.text).toBeUndefined()
    expect(json.textLength).toBeGreaterThan(0)
    expect(json.extractionMs).toBeGreaterThanOrEqual(0)
    expect(elapsed).toBeLessThan(1000)
    expect(pdfParseMock).toHaveBeenCalled()
    expect(persistRecordMock).toHaveBeenCalledWith(
      expect.anything(),
      "applicant-1",
      expect.objectContaining({
        extractedText: "Jane Doe\njane@example.com",
        textLength: "Jane Doe\njane@example.com".length,
        fileType: "pdf",
        fileSizeBytes: 3,
      }),
    )
    expect(afterMock).toHaveBeenCalled()
    expect(grokStarted).not.toHaveBeenCalled()
  })

  it("uploads a DOCX, extracts text, and returns a resumeId", async () => {
    const fd = new FormData()
    fd.append("file", makeDocxFile())
    fd.append("applicantId", "applicant-1")
    fd.append("tenantSlug", "subdomaintest")

    const res = await POST(new Request("http://localhost/api/upload-resume", { method: "POST", body: fd }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.resumeId).toBe("resume-uuid-1")
    expect(json.parseStatus).toBe("processing")
    expect(mammothExtractRawTextMock).toHaveBeenCalled()
    expect(persistRecordMock).toHaveBeenCalledWith(
      expect.anything(),
      "applicant-1",
      expect.objectContaining({
        extractedText: "Docx Person\ndocx@example.com",
        fileType: "docx",
      }),
    )
  })

  it("returns a clear error when resume DB persistence fails", async () => {
    persistRecordMock.mockRejectedValueOnce(new Error("worker_resumes insert failed"))
    const fd = new FormData()
    fd.append("file", makePdfFile())
    fd.append("applicantId", "applicant-1")

    const res = await POST(new Request("http://localhost/api/upload-resume", { method: "POST", body: fd }))

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain("worker_resumes insert failed")
  })

  it("returns an error instead of resumeId null when DB persistence returns null", async () => {
    persistRecordMock.mockResolvedValueOnce(null)
    const fd = new FormData()
    fd.append("file", makePdfFile())
    fd.append("applicantId", "applicant-1")

    const res = await POST(new Request("http://localhost/api/upload-resume", { method: "POST", body: fd }))

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain("resume database record was not created")
  })
})
