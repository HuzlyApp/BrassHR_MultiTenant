import { NextResponse } from "next/server"
import OpenAI from "openai"
import {
  evaluateResumeParseQuality,
  extractJsonObjectFromModelText,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
} from "@/lib/resumeParseQuality"

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
})

export async function POST(req: Request) {
  const body = await req.json()

  const completion = await client.chat.completions.create({
    model: "grok-4-fast",
    messages: [
      {
        role: "system",
        content: `
You are an ATS resume parser.

Extract structured information from the resume.

Return JSON ONLY (no markdown, no commentary).

Schema:

{
"first_name":"",
"last_name":"",
"address1":"",
"address2":"",
"city":"",
"state":"",
"zip":"",
"phone":"",
"email":"",
"job_role":""
}

Rules:

Split full name into first_name and last_name.

Extract ZIP / postal code into zip when present.

Detect healthcare roles such as:
CNA, RN, LPN, Caregiver, Medical Assistant.

If a field is missing return an empty string.
`,
      },
      {
        role: "user",
        content: body.text,
      },
    ],
  })

  const result = completion.choices?.[0]?.message?.content || ""
  const extracted = extractJsonObjectFromModelText(result)
  const rawParsed: unknown = extracted ?? {}

  const quality = evaluateResumeParseQuality(rawParsed)
  if (!quality.ok) {
    return NextResponse.json(
      {
        parseStatus: quality.parseStatus,
        error: quality.message ?? RESUME_PARSE_FAILED_USER_MESSAGE,
        missingFields: quality.missingFieldLabels,
      },
      { status: 422 },
    )
  }

  return NextResponse.json(normalizedResumeToStoredJson(quality.normalized))
}
