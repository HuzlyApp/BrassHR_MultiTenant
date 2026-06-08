import { NextResponse } from "next/server"
import OpenAI from "openai"
import { XAI_VISION_MODEL, XAI_VISION_MODEL_FALLBACKS } from "@/lib/ai-vision-model"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"
import {
  buildDocumentVerificationPrompt,
  parseDocumentVerificationResult,
  pdfManualReviewIfNeeded,
  type DocumentVerificationResult,
} from "@/lib/document-verification"

export const runtime = "nodejs"

function isAllowedImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== "https:") return false
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : ""
  return Boolean(supabaseHost && url.host === supabaseHost)
}

function isAllowedDataImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)
}

function getVisionClient(): OpenAI | null {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY
  if (!apiKey) return null
  const baseURL = process.env.GROK_BASE_URL || "https://api.x.ai/v1"
  return new OpenAI({ apiKey, baseURL })
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    namespace: "verify-document",
    key: getClientIp(req),
    limit: Number(process.env.RATE_LIMIT_AI_PER_HOUR ?? 20),
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  })
  if (limited) return limited

  const body = (await req.json().catch(() => ({}))) as {
    documentType?: string
    fileUrl?: string
    imageBase64?: string
    mimeType?: string
    fileName?: string
  }

  const documentType =
    typeof body.documentType === "string" && body.documentType.trim()
      ? body.documentType.trim()
      : "Document"

  const pdfResult = pdfManualReviewIfNeeded({
    fileName: body.fileName,
    mimeType: body.mimeType,
    url: body.fileUrl,
  })
  if (pdfResult) {
    return NextResponse.json(pdfResult satisfies DocumentVerificationResult)
  }

  const fileUrl = body.fileUrl
  const imageBase64 = body.imageBase64

  const hasUrl = fileUrl && isAllowedImageUrl(fileUrl)
  const hasBase64 = imageBase64 && isAllowedDataImageUrl(imageBase64)

  if (!hasUrl && !hasBase64) {
    return NextResponse.json({ error: "Invalid or missing image" }, { status: 400 })
  }

  const client = getVisionClient()
  if (!client) {
    return NextResponse.json({ error: "Vision API not configured" }, { status: 503 })
  }

  const imageUrl = hasBase64 ? imageBase64 : fileUrl!

  const modelsToTry = [
    XAI_VISION_MODEL,
    ...XAI_VISION_MODEL_FALLBACKS.filter((m) => m !== XAI_VISION_MODEL),
  ]

  let lastError = "Vision API request failed"

  for (const model of modelsToTry) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildDocumentVerificationPrompt(documentType) },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        temperature: 0.2,
      })

      const raw = completion.choices[0]?.message?.content ?? ""
      const result = parseDocumentVerificationResult(raw)
      if (!result) {
        return NextResponse.json(
          { error: "Could not parse verification response" },
          { status: 502 }
        )
      }

      return NextResponse.json(result)
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : "Vision API request failed"
      const modelMissing = /model not found/i.test(lastError)
      if (!modelMissing) {
        console.error("[verify-document]", model, lastError)
        return NextResponse.json({ error: lastError }, { status: 502 })
      }
      console.warn("[verify-document] model unavailable, trying fallback:", model)
    }
  }

  console.error("[verify-document]", lastError)
  return NextResponse.json({ error: lastError }, { status: 502 })
}
