import { NextResponse } from "next/server";
import { requireSchedulingContext, schedulingError, invalidSchedule } from "@/lib/scheduling/api-context";
import { scheduleQuerySchema } from "@/lib/scheduling/v1-contract";
import { loadTenantSchedule } from "@/lib/scheduling/v1-service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await requireSchedulingContext(request);
    if (context instanceof NextResponse) return context;
    const parsed = scheduleQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return invalidSchedule();
    return NextResponse.json(await loadTenantSchedule(context.supabase, context.tenantId, parsed.data, context.features),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return schedulingError(error); }
}
