import { NextResponse } from "next/server";
import { requireTimeContext, timeApiError } from "@/lib/timesheets/api-context";
import { clockInsSchema } from "@/lib/timesheets/v1-contract";
import { loadClockIns } from "@/lib/attendance/v1-clock-ins";
import { invalidSchedule } from "@/lib/scheduling/api-context";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await requireTimeContext(request, true);
    if (context instanceof NextResponse) return context;
    const parsed = clockInsSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return invalidSchedule();
    return NextResponse.json(
      await loadClockIns(context.supabase, context.tenantId, parsed.data),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return timeApiError(error);
  }
}
