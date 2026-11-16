import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTimeContext, timeApiError } from "@/lib/timesheets/api-context";
import { getPeriodTimesheet } from "@/lib/timesheets/v1-service";
import { invalidSchedule } from "@/lib/scheduling/api-context";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  route: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTimeContext(request);
    if (context instanceof NextResponse) return context;
    const { id } = await route.params;
    if (!z.uuid().safeParse(id).success) return invalidSchedule();
    return NextResponse.json(
      await getPeriodTimesheet(
        context.supabase,
        context.tenantId,
        context.ownEmployeeIds,
        id,
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return timeApiError(error);
  }
}
