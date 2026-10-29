import { NextResponse } from "next/server";
import { getCachedStaffAccessSeed } from "@/lib/auth/cached-session-grants";
import { getCachedStaffApiSession } from "@/lib/auth/cached-staff-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getCachedStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const result = await getCachedStaffAccessSeed();
  if (!result) {
    return NextResponse.json({ error: "Forbidden", detail: "Insufficient permission" }, { status: 403 });
  }
  return NextResponse.json(result);
}
