import { NextResponse } from "next/server";
import { APPLICANT_CONTINUATION_SESSION_COOKIE } from "@/lib/tenant/constants";

export const runtime = "nodejs";

export async function GET() {
  const res = NextResponse.json({ active: false, signInRequired: true });
  res.cookies.delete(APPLICANT_CONTINUATION_SESSION_COOKIE);
  return res;
}

export async function POST() {
  const res = NextResponse.json({ ok: true, completed: false });
  res.cookies.delete(APPLICANT_CONTINUATION_SESSION_COOKIE);
  return res;
}
