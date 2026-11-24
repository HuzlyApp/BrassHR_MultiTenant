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
    if (!parsed.success) {
      return invalidSchedule(parsed.error, {
        required: ["title", "start_date", "end_date", "is_internal"],
        optional: [
          "description",
          "facility_id",
          "department_id",
          "client_id",
          "job_category_id",
          "number_of_people_needed",
          "rate_per_hour",
        ],
        example:
          '{"title":"Day shift","start_date":"2026-11-16","end_date":"2026-11-16","is_internal":true}',
      });
    }
    return NextResponse.json(await createScheduleShift(context.supabase, context.tenantId, parsed.data, context.features, context.edition), { status: 201 });
  } catch (error) { return schedulingError(error); }
}
