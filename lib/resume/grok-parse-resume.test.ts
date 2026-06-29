import { beforeEach, describe, expect, it, vi } from "vitest"
import { __setGrokClientForTests, grokParseResume } from "@/lib/resume/grok-parse-resume"

describe("grokParseResume", () => {
  beforeEach(() => {
    __setGrokClientForTests(null)
  })

  it("sends reduced resume text to Grok, not the full raw extracted text", async () => {
    const filler = "Unrelated experience bullet. ".repeat(500)
    const fullText = `Maria Garcia\nRN\nmaria@clinic.org\n(404) 555-0100\n${filler}`

    let userContent = ""
    const mockCreate = vi.fn(async (args: { messages: { role: string; content: string }[] }) => {
      userContent = args.messages.find((m) => m.role === "user")?.content ?? ""
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                first_name: "Maria",
                last_name: "Garcia",
                email: "maria@clinic.org",
                phone: "(404) 555-0100",
                address1: "",
                address2: "",
                city: "",
                state: "",
                zip: "",
                job_role: "RN",
              }),
            },
          },
        ],
      }
    })

    __setGrokClientForTests({
      chat: { completions: { create: mockCreate } },
    } as never)

    const result = await grokParseResume(fullText)

    expect(userContent.length).toBeLessThan(fullText.length)
    expect(result.grokSnippetReduced).toBe(true)
    expect(result.normalized.email).toBe("maria@clinic.org")
    expect(mockCreate).toHaveBeenCalledOnce()
  })
})
