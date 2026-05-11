import { NextRequest, NextResponse } from "next/server"
import { fetchZohoSignAccessToken, findZohoSignApiBaseForRequest } from "@/lib/zoho-sign-server"

export const runtime = "nodejs"

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(req: NextRequest) {
  try {
    const requestId = req.nextUrl.searchParams.get("request_id")?.trim() || ""
    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "Missing request_id query parameter" },
        { status: 400 },
      )
    }

    const accessToken = await fetchZohoSignAccessToken()
    const resolved = await findZohoSignApiBaseForRequest(accessToken, requestId)
    if (!resolved.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not resolve Zoho Sign request details",
          details: { resolve_attempts: resolved.attempts },
        },
        { status: 502 },
      )
    }

    const signBase = resolved.base.replace(/\/$/, "")
    const rid = encodeURIComponent(requestId)
    const detailsRes = await fetch(`${signBase}/api/v1/requests/${rid}`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      cache: "no-store",
    })

    const rawText = await detailsRes.text()
    let root: JsonRecord = {}
    try {
      root = JSON.parse(rawText) as JsonRecord
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Zoho request details response was not valid JSON",
          details: {
            status: detailsRes.status,
            body_preview: rawText.replace(/\s+/g, " ").slice(0, 240),
          },
        },
        { status: 502 },
      )
    }

    if (!detailsRes.ok || root.status !== "success") {
      const message = asText(root.message) || asText(root.error) || "Zoho request details API failed"
      const errorCode = asText(root.code)
      const status =
        detailsRes.status === 401 || errorCode === "9041"
          ? 401
          : detailsRes.status === 404
            ? 404
            : 502
      return NextResponse.json(
        {
          success: false,
          error: message,
          details: {
            status: detailsRes.status,
            code: errorCode,
            body_preview: rawText.replace(/\s+/g, " ").slice(0, 240),
          },
        },
        { status },
      )
    }

    const requests = root.requests
    const requestObj = asRecord(Array.isArray(requests) ? requests[0] : requests)
    const actions = asArray(requestObj.actions).map((action) => {
      const row = asRecord(action)
      return {
        action_id: asText(row.action_id),
        action_type: asText(row.action_type),
        action_status: asText(row.action_status),
        recipient_name: asText(row.recipient_name),
        recipient_email: asText(row.recipient_email),
        signed_time: asText(row.signed_time),
      }
    })

    const documents = asArray(requestObj.documents).map((doc) => {
      const row = asRecord(doc)
      return {
        document_id: asText(row.document_id),
        document_name: asText(row.document_name),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        request_id: asText(requestObj.request_id) || requestId,
        request_status: asText(requestObj.request_status),
        is_completed: asText(requestObj.request_status)?.toLowerCase().includes("complete") || false,
        actions,
        documents,
        documents_count: documents.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected request details error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
