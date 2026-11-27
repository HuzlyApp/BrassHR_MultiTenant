import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifiedSessionIdentity } from "@/lib/auth/staff-session-verification";
import { checkStaffSessionActivity } from "@/lib/auth/staff-session-activity";
import { STAFF_SESSION_PROOF_COOKIE, verifyStaffSessionProof } from "@/lib/auth/login-otp-proof";

async function activity(req: NextRequest, touch: boolean) {
  if (touch && req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const identity = await verifiedSessionIdentity();
  if (!identity || !verifyStaffSessionProof(identity.user.id, identity.sessionId, (await cookies()).get(STAFF_SESSION_PROOF_COOKIE)?.value)) {
    return NextResponse.json({ error: "Sign in and verify your session." }, { status: 401 });
  }
  const active = await checkStaffSessionActivity(identity.user.id, identity.sessionId, touch ? "touch" : "check", identity.accessToken);
  return NextResponse.json({ active }, { status: active ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
export const GET = (req: NextRequest) => activity(req, false);
export const POST = (req: NextRequest) => activity(req, true);
