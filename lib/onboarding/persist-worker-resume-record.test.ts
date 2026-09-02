import { describe, expect, it } from "vitest"
import { persistWorkerResumeRecord } from "@/lib/onboarding/persist-worker-resume-record"

describe("persistWorkerResumeRecord", () => {
  it("strips NUL bytes so Postgres does not reject the row with 22P05", async () => {
    let inserted: Record<string, unknown> | null = null
    const supabase = {
      from: (table: string) => {
        if (table === "worker") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "w1", tenant_id: "t1", user_id: "u1" },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {
          insert: (row: Record<string, unknown>) => {
            inserted = row
            return {
              select: () => ({
                single: async () => ({ data: { id: "r1" }, error: null }),
              }),
            }
          },
        }
      },
    }

    const resumeId = await persistWorkerResumeRecord(supabase as never, "u1", {
      fileUrl: "path/resume.pdf",
      originalFileName: "Almog\u0000.pdf",
      extractedText: "Almog\u0000 Arazi\nEngineer",
      parsedData: { text: "Almog\u0000 Arazi" },
      enforceUploadLimit: false,
    })

    expect(resumeId).toBe("r1")
    expect(inserted?.extracted_text).toBe("Almog Arazi\nEngineer")
    expect(inserted?.parsed_data).toEqual({ text: "Almog Arazi" })
    expect(inserted?.original_file_name).toBe("Almog.pdf")
  })
})
