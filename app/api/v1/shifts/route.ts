import { NextResponse } from "next/server";
import { requireSchedulingContext, schedulingError, invalidSchedule } from "@/lib/scheduling/api-context";
import { shiftSchema } from "@/lib/scheduling/v1-contract";
import { createScheduleShift } from "@/lib/scheduling/v1-service";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const context = await requireSchedulingContext(request);
    if (context instanceof NextResponse) return context;
    const parsed = shiftSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidSchedule();
    return NextResponse.json(await createScheduleShift(context.supabase, context.tenantId, parsed.data, context.features, context.edition), { status: 201 });
  } catch (error) { return schedulingError(error); }
}
