import { NextResponse } from "next/server";
import { requireTimeContext, timeApiError } from "@/lib/timesheets/api-context";
import { timesheetListSchema } from "@/lib/timesheets/v1-contract";
import { listPeriodTimesheets } from "@/lib/timesheets/v1-service";
import { invalidTimeInput } from "@/lib/scheduling/api-context";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await requireTimeContext(request);
    if (context instanceof NextResponse) return context;
    const parsed = timesheetListSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) {
      return invalidTimeInput(parsed.error, {
        required: ["period_start", "period_end"],
        optional: ["facility_id", "department_id", "worker_id", "status", "page", "limit"],
        example: "/api/v1/timesheets?period_start=2026-11-01&period_end=2026-11-30",
      });
    }
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
