import { NextResponse } from "next/server";
import { requireTimeContext, timeApiError } from "@/lib/timesheets/api-context";
import { clockEventSchema } from "@/lib/timesheets/v1-contract";
import { recordEmployeeClockEvent } from "@/lib/timesheets/v1-service";
import { invalidSchedule } from "@/lib/scheduling/api-context";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const context = await requireTimeContext(request);
    if (context instanceof NextResponse) return context;
    const parsed = clockEventSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidSchedule();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip");
    return NextResponse.json(
      await recordEmployeeClockEvent(
        context.supabase,
        context.tenantId,
        context.auth.userId,
        context.ownEmployeeIds,
        parsed.data,
        ip,
      ),
    );
  } catch (error) {
    return timeApiError(error);
  }
}
