import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSchedulingContext, schedulingError, invalidSchedule } from "@/lib/scheduling/api-context";
import { shiftPatchSchema } from "@/lib/scheduling/v1-contract";
import { patchScheduleShift } from "@/lib/scheduling/v1-service";

export const runtime = "nodejs";
export async function PATCH(request: Request, route: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireSchedulingContext(request);
    if (context instanceof NextResponse) return context;
    const { id } = await route.params;
    const parsed = shiftPatchSchema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !parsed.success) return invalidSchedule();
    return NextResponse.json(await patchScheduleShift(context.supabase, context.tenantId, id, parsed.data, context.features, context.edition));
  } catch (error) { return schedulingError(error); }
}
