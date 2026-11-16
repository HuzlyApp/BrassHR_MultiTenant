import { NextResponse } from "next/server";
import { requireSchedulingContext, schedulingError, invalidSchedule } from "@/lib/scheduling/api-context";
import { whoIsOffQuerySchema } from "@/lib/scheduling/v1-contract";
import { loadTenantTimeOff } from "@/lib/scheduling/time-off-service";
import { listTenantHolidays } from "@/lib/scheduling/v1-service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await requireSchedulingContext(request);
    if (context instanceof NextResponse) return context;
    const parsed = whoIsOffQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return invalidSchedule();
    const [timeOff, holidays] = await Promise.all([
      loadTenantTimeOff(context.supabase, context.tenantId, parsed.data),
      !parsed.data.off_type || parsed.data.off_type === "Holiday"
        ? listTenantHolidays(context.supabase, context.tenantId, parsed.data)
        : Promise.resolve({ holidays: [], total: 0 }),
    ]);
    return NextResponse.json({ ...timeOff, holidays: holidays.holidays, holidays_total: holidays.total },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return schedulingError(error); }
}
