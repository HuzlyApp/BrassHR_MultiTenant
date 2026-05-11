import { NextResponse } from "next/server"
import axios, { AxiosError } from "axios"

export async function POST(req: Request) {
  try {
    const { requestId } = await req.json()

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId is required" },
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