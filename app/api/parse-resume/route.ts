import { NextResponse } from "next/server"
import {
  evaluateResumeParseQuality,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
} from "@/lib/resumeParseQuality"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    namespace: "parse-resume",
    key: getClientIp(req),
    limit: Number(process.env.RATE_LIMIT_AI_PER_HOUR ?? 20),
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  })
  if (limited) return limited

  const { text } = await req.json()

  const prompt = `
Extract resume data and return ONLY JSON:

{
  "firstName": "",
  "lastName": "",
  "address1": "",
  "address2": "",
  "city": "",
  "state": "",
  "zipCode": "",
  "phone": "",
  "email": "",
  "jobRole": ""
}

Rules:
- Extract city/state from address
- jobRole = latest job title
- Return empty string if missing
`

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-beta",
      temperature: 0,
      messages: [{ role: "user", content: prompt + text }],
    }),
  })

  const data = await response.json()

  const raw = data.choices?.[0]?.message?.content || ""

  const clean = raw.match(/\{[\s\S]*\}/)?.[0] || "{}"

  let parsed: unknown = {}
  try {
    parsed = JSON.parse(clean)
  } catch {
    parsed = {}
  }

  const quality = evaluateResumeParseQuality(parsed)
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
