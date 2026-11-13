import "server-only";
import { NextRequest, NextResponse } from "next/server";

export const API_KEY_RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };

/** Cookie-authenticated mutations must originate from this site. Non-browser clients may omit Origin. */
export function rejectCrossOriginKeyMutation(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (req.headers.get("sec-fetch-site") === "cross-site" || (origin !== null && origin !== req.nextUrl.origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: API_KEY_RESPONSE_HEADERS });
  }
  return null;
}
