import { beforeEach, describe, expect, it, vi } from "vitest"
import { __setGrokClientForTests, grokParseResume } from "@/lib/resume/grok-parse-resume"

describe("grokParseResume", () => {
  it("keeps explicit resume sections when AI omits them", async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    __setGrokClientForTests({ chat: { completions: { create } } } as never);
    const result = await grokParseResume("Jane Doe\njane@example.com\nSummary\nExperienced ICU nurse.\nSkills\nICU, First aid\nEducation\nUniversity");
    expect(result.normalized.summary).toBe("Experienced ICU nurse.");
    expect(result.normalized.skills).toEqual(["ICU", "First aid"]);
  });

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
  it("extracts and preserves ATS sections through the Grok merge", async () => {
    const completion = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ first_name: "Jane", last_name: "Doe", email: "jane@example.com", summary: "Registered nurse.", skills: ["ICU"], experience: [{ company: "Clinic", position: "RN", start_date: null, end_date: null, location: null, description: "Patient care" }], education: [{ institution: "University", degree: "BSN", field: null, start_date: null, end_date: "2020", gpa: null }] }) } }] });
    __setGrokClientForTests({ chat: { completions: { create: completion } } } as never);
    const result = await grokParseResume("Jane Doe\njane@example.com\nRegistered nurse.");
    expect(result.normalized).toMatchObject({ summary: "Registered nurse.", skills: ["ICU"], experience: [expect.objectContaining({ position: "RN" })], education: [expect.objectContaining({ degree: "BSN" })] });
  });

})

it("bounds interactive parsing without retrying the provider", async () => {
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
  __setGrokClientForTests({ chat: { completions: { create } } } as never);
  await grokParseResume("Jane Doe\njane@example.com", { timeoutMs: 8000 });
  expect(create).toHaveBeenCalledWith(expect.any(Object), { timeout: 8000, maxRetries: 0 });
});
