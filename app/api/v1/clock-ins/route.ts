import { NextResponse } from "next/server";
import { requireTimeContext, timeApiError } from "@/lib/timesheets/api-context";
import { clockInsSchema } from "@/lib/timesheets/v1-contract";
import { loadClockIns } from "@/lib/attendance/v1-clock-ins";
import { invalidTimeInput } from "@/lib/scheduling/api-context";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await requireTimeContext(request, true);
    if (context instanceof NextResponse) return context;
    const parsed = clockInsSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) {
      return invalidTimeInput(parsed.error, {
        optional: ["date", "facility_id", "department_id", "worker_id", "status", "page", "limit"],
        example: "/api/v1/clock-ins?date=2026-11-16",
      });
    }
    return NextResponse.json(
      await loadClockIns(context.supabase, context.tenantId, parsed.data),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return timeApiError(error);
  }
}
