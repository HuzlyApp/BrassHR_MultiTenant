import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";

export const runtime = "nodejs";

/**
 * Bulk match analysis is intentionally disabled — AI cost must stay per-candidate only.
 */
export async function POST() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    { error: "Bulk match analysis is not available. Analyze candidates one at a time." },
    { status: 410 }
  );
}
