import { NextResponse } from "next/server";
import { requireTimeContext, timeApiError } from "@/lib/timesheets/api-context";
import { timesheetListSchema } from "@/lib/timesheets/v1-contract";
import { listPeriodTimesheets } from "@/lib/timesheets/v1-service";
import { invalidSchedule } from "@/lib/scheduling/api-context";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await requireTimeContext(request);
    if (context instanceof NextResponse) return context;
    const parsed = timesheetListSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return invalidSchedule();
    return NextResponse.json(
      await listPeriodTimesheets(
        context.supabase,
        context.tenantId,
        context.ownEmployeeIds,
        parsed.data,
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return timeApiError(error);
  }
}
