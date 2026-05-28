import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { handleSendCandidateEmail } from "@/lib/communication/candidate-send-handler";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ workerId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const { workerId } = await context.params;
  const body = await req.json().catch(() => null);
  return handleSendCandidateEmail(auth, workerId, body);
}
