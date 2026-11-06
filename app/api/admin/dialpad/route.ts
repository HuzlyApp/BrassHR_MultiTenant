import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  DialpadError,
  dialpadApiKey,
  initiateDialpadCall,
  listDialpadCalls,
  listDialpadUsers,
  type DialpadCallLog,
  type DialpadCaller,
} from "@/lib/dialpad/client";
import { toE164 } from "@/lib/dialpad/phone";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function dialpadHttpStatus(error: DialpadError): number {
  if (error.status === 400 || error.status === 404 || error.status === 429) return error.status;
  return 502;
}

function defaultCallerId(callers: DialpadCaller[], email: string | null): string | null {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (normalized) {
    const match = callers.find((caller) =>
      caller.emails.some((item) => item.trim().toLowerCase() === normalized)
    );
    if (match) return match.id;
  }
  return callers.length === 1 ? callers[0].id : null;
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const limited = await enforceRateLimit(req, {
    namespace: "dialpad-callers",
    key: auth.userId,
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const apiKey = dialpadApiKey();
  if (!apiKey) {
    return NextResponse.json({ configured: false, callers: [], defaultUserId: null });
  }

  try {
    const startedAfter = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const [callers, callLogs] = await Promise.all([
      listDialpadUsers(apiKey),
      listDialpadCalls(apiKey, startedAfter).then(
        (calls) => ({ calls, callsError: null as string | null }),
        (error: unknown) => ({
          calls: [] as DialpadCallLog[],
          callsError:
            error instanceof DialpadError ? error.message : "Could not load Dialpad call logs.",
        })
      ),
    ]);
    return NextResponse.json({
      configured: true,
      callers,
      defaultUserId: defaultCallerId(callers, auth.email),
      calls: callLogs.calls,
      callsError: callLogs.callsError,
    });
  } catch (error) {
    console.error("[admin/dialpad GET]", error instanceof Error ? error.message : "unknown");
    if (error instanceof DialpadError) {
      return NextResponse.json({ error: error.message }, { status: dialpadHttpStatus(error) });
    }
    return NextResponse.json({ error: "Could not load Dialpad users." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const limited = await enforceRateLimit(req, {
    namespace: "dialpad-call",
    key: auth.userId,
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const apiKey = dialpadApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Dialpad is not configured." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { phoneNumber?: unknown; userId?: unknown };
  const phoneNumber = toE164(typeof body.phoneNumber === "string" ? body.phoneNumber : "");
  if (!phoneNumber) {
    return NextResponse.json(
      { error: "Enter a phone number, including the country code for numbers outside the US." },
      { status: 400 }
    );
  }

  const requestedUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (requestedUserId && !/^\d{1,20}$/.test(requestedUserId)) {
    return NextResponse.json({ error: "Choose a Dialpad user to place the call." }, { status: 400 });
  }

  try {
    const callers = await listDialpadUsers(apiKey);
    const userId = requestedUserId || defaultCallerId(callers, auth.email) || "";
    const caller = callers.find((item) => item.id === userId);
    if (!caller) {
      return NextResponse.json({ error: "Choose a Dialpad user to place the call." }, { status: 400 });
    }

    const result = await initiateDialpadCall(apiKey, { phoneNumber, userId: caller.id });
    return NextResponse.json({
      ok: true,
      callId: result.callId,
      phoneNumber,
      caller: { id: caller.id, name: caller.name },
    });
  } catch (error) {
    console.error("[admin/dialpad POST]", error instanceof Error ? error.message : "unknown");
    if (error instanceof DialpadError) {
      return NextResponse.json({ error: error.message }, { status: dialpadHttpStatus(error) });
    }
    return NextResponse.json({ error: "Could not place the Dialpad call." }, { status: 502 });
  }
}
