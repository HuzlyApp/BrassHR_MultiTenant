import { NextResponse } from "next/server"
import axios, { AxiosError } from "axios"
import { requireStaffApiSession } from "@/lib/auth/api-session"
import { enforceRateLimit } from "@/lib/security/rate-limit"

export async function POST(req: Request) {
  try {
    const auth = await requireStaffApiSession()
    if (auth instanceof NextResponse) return auth
    const limited = await enforceRateLimit(req, {
      namespace: "signeasy-link",
      key: auth.userId,
      limit: Number(process.env.RATE_LIMIT_SIGNING_PER_HOUR ?? 20),
      windowMs: 60 * 60 * 1000,
      failClosed: true,
    })
    if (limited) return limited

    const { requestId } = await req.json()

    if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{3,120}$/.test(requestId)) {
      return NextResponse.json(
        { error: "Invalid requestId" },
        { status: 400 }
      )
    }

    const response = await axios.get(
      `${process.env.SIGNEASY_BASE_URL}/requests/${requestId}/signing_url`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SIGNEASY_API_KEY}`,
        },
      }
    )

    return NextResponse.json(response.data)

  } catch (error: unknown) {
    const err = error as AxiosError

    console.error(
      err.response?.data || err.message || "Unknown error"
    )

    return NextResponse.json(
      { error: "Failed to get signing link" },
      { status: 500 }
    )
  }
}